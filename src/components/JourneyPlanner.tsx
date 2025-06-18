import React, { useState, useMemo } from 'react';
import { Stop, Route, Trip, StopTime } from '../types/gtfs';
import { MapPin, Navigation, Clock, ArrowRight, Bus, AlertCircle, CheckCircle, Router as RouteIcon, Search, X, Shuffle } from 'lucide-react';

interface JourneyPlannerProps {
  stops: Stop[];
  routes: Route[];
  trips: Trip[];
  stopTimes: StopTime[];
  onJourneySelect?: (journey: JourneyResult) => void;
}

interface JourneyResult {
  id: string;
  fromStop: Stop;
  toStop: Stop;
  routes: Array<{
    route: Route;
    trip: Trip;
    fromStop: Stop;
    toStop: Stop;
    departureTime: string;
    arrivalTime: string;
    duration: number;
    stops: Stop[];
    direction: number;
    directionLabel: string;
  }>;
  totalDuration: number;
  totalDistance: number;
  transfers: number;
  walkingTime: number;
  confidence: number;
  transferStops?: Stop[];
}

interface StopWithDirections {
  stop: Stop;
  routeDirections: Array<{
    route: Route;
    direction: number;
    directionLabel: string;
    finalDestination: string;
  }>;
}

export const JourneyPlanner: React.FC<JourneyPlannerProps> = ({
  stops,
  routes,
  trips,
  stopTimes,
  onJourneySelect
}) => {
  const [fromStopId, setFromStopId] = useState<string>('');
  const [toStopId, setToStopId] = useState<string>('');
  const [searchFromTerm, setSearchFromTerm] = useState<string>('');
  const [searchToTerm, setSearchToTerm] = useState<string>('');
  const [departureTime, setDepartureTime] = useState<string>('');
  const [isPlanning, setIsPlanning] = useState<boolean>(false);
  const [journeyResults, setJourneyResults] = useState<JourneyResult[]>([]);
  const [selectedJourney, setSelectedJourney] = useState<JourneyResult | null>(null);
  const [showFromDropdown, setShowFromDropdown] = useState<boolean>(false);
  const [showToDropdown, setShowToDropdown] = useState<boolean>(false);

  // Get route directions and final destinations for a stop
  const getStopRouteDirections = (stop: Stop): Array<{
    route: Route;
    direction: number;
    directionLabel: string;
    finalDestination: string;
  }> => {
    // Get all trips that serve this stop
    const stopStopTimes = stopTimes.filter(st => st.stop_id === stop.stop_id);
    const stopTripIds = stopStopTimes.map(st => st.trip_id);
    const stopTrips = trips.filter(trip => stopTripIds.includes(trip.trip_id));
    
    // Group by route and direction
    const routeDirectionMap = new Map<string, {
      route: Route;
      direction: number;
      trips: Trip[];
    }>();

    stopTrips.forEach(trip => {
      const route = routes.find(r => r.route_id === trip.route_id);
      if (!route) return;

      const key = `${trip.route_id}-${trip.direction_id}`;
      if (!routeDirectionMap.has(key)) {
        routeDirectionMap.set(key, {
          route,
          direction: trip.direction_id,
          trips: []
        });
      }
      routeDirectionMap.get(key)!.trips.push(trip);
    });

    // Convert to array with final destinations
    return Array.from(routeDirectionMap.values()).map(({ route, direction, trips }) => {
      const directionLabel = direction === 0 ? 'Outbound' : 'Inbound';
      const finalDestination = getFinalDestination(route.route_id, direction, stop.stop_id);
      
      return {
        route,
        direction,
        directionLabel,
        finalDestination
      };
    }).sort((a, b) => {
      // Sort by route number first, then by direction
      const routeCompare = a.route.route_short_name.localeCompare(b.route.route_short_name);
      if (routeCompare !== 0) return routeCompare;
      return a.direction - b.direction;
    });
  };

  // Get final destination for a route direction from a specific stop
  const getFinalDestination = (routeId: string, direction: number, fromStopId: string): string => {
    try {
      // Get all trips for this route and direction
      const routeTrips = trips.filter(trip => 
        trip.route_id === routeId && 
        trip.direction_id === direction
      );

      if (routeTrips.length === 0) return 'Unknown destination';

      // Get a representative trip
      const sampleTrip = routeTrips[0];
      
      // Get all stop times for this trip, sorted by sequence
      const tripStopTimes = stopTimes
        .filter(st => st.trip_id === sampleTrip.trip_id)
        .sort((a, b) => a.stop_sequence - b.stop_sequence);

      if (tripStopTimes.length === 0) return 'Unknown destination';

      // Find the current stop in the sequence
      const currentStopTime = tripStopTimes.find(st => st.stop_id === fromStopId);
      if (!currentStopTime) return 'Unknown destination';

      // Get the final stop (last in sequence)
      const finalStopTime = tripStopTimes[tripStopTimes.length - 1];
      const finalStop = stops.find(s => s.stop_id === finalStopTime.stop_id);

      if (!finalStop) return 'Unknown destination';

      // Extract meaningful destination name (remove technical parts)
      let destination = finalStop.stop_name;
      
      // Clean up destination name
      destination = destination
        .replace(/^(CTRA\.|AV\.|AVDA\.|PLAZA|PZA\.|C\/|CALLE)/i, '')
        .replace(/-(URB\.|URBANIZACIÓN|COL\.|COLONIA)/i, '')
        .trim();

      // If destination is too long, take first meaningful part
      if (destination.length > 25) {
        const parts = destination.split('-');
        destination = parts[0].trim();
      }

      return destination || 'Terminal';
    } catch (error) {
      console.error('Error getting final destination:', error);
      return 'Unknown destination';
    }
  };

  // Enhanced stop filtering with route directions
  const filteredFromStops = useMemo(() => {
    if (!searchFromTerm || searchFromTerm.length < 2) return [];
    
    const matchingStops = stops.filter(stop => 
      stop.stop_name.toLowerCase().includes(searchFromTerm.toLowerCase()) ||
      stop.stop_code.toLowerCase().includes(searchFromTerm.toLowerCase()) ||
      stop.stop_id.toLowerCase().includes(searchFromTerm.toLowerCase())
    )
    .sort((a, b) => {
      // Prioritize exact matches and shorter names
      const aExact = a.stop_name.toLowerCase().startsWith(searchFromTerm.toLowerCase()) ? 0 : 1;
      const bExact = b.stop_name.toLowerCase().startsWith(searchFromTerm.toLowerCase()) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return a.stop_name.length - b.stop_name.length;
    })
    .slice(0, 15);

    // Add route directions to each stop
    return matchingStops.map(stop => ({
      stop,
      routeDirections: getStopRouteDirections(stop)
    }));
  }, [stops, searchFromTerm, routes, trips, stopTimes]);

  const filteredToStops = useMemo(() => {
    if (!searchToTerm || searchToTerm.length < 2) return [];
    
    const matchingStops = stops.filter(stop => 
      stop.stop_id !== fromStopId && // Exclude selected from stop
      (stop.stop_name.toLowerCase().includes(searchToTerm.toLowerCase()) ||
       stop.stop_code.toLowerCase().includes(searchToTerm.toLowerCase()) ||
       stop.stop_id.toLowerCase().includes(searchToTerm.toLowerCase()))
    )
    .sort((a, b) => {
      const aExact = a.stop_name.toLowerCase().startsWith(searchToTerm.toLowerCase()) ? 0 : 1;
      const bExact = b.stop_name.toLowerCase().startsWith(searchToTerm.toLowerCase()) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return a.stop_name.length - b.stop_name.length;
    })
    .slice(0, 15);

    // Add route directions to each stop
    return matchingStops.map(stop => ({
      stop,
      routeDirections: getStopRouteDirections(stop)
    }));
  }, [stops, searchToTerm, fromStopId, routes, trips, stopTimes]);

  // Get current time as default (Madrid timezone)
  const getCurrentTime = () => {
    const now = new Date();
    // Convert to Madrid time (UTC+1 or UTC+2 depending on DST)
    const madridTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Madrid"}));
    return `${madridTime.getHours().toString().padStart(2, '0')}:${madridTime.getMinutes().toString().padStart(2, '0')}`;
  };

  // FIXED: Standard GTFS time parsing and comparison
  const parseGTFSTime = (timeStr: string): { hours: number; minutes: number; totalMinutes: number } => {
    if (!timeStr || !timeStr.includes(':')) {
      return { hours: 0, minutes: 0, totalMinutes: 0 };
    }
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    return {
      hours,
      minutes,
      totalMinutes: hours * 60 + minutes
    };
  };

  // FIXED: Proper time comparison respecting user's departure time
  const isTimeAfterDeparture = (gtfsTime: string, userDepartureTime: string): boolean => {
    const gtfsTimeData = parseGTFSTime(gtfsTime);
    const userTimeData = parseGTFSTime(userDepartureTime);
    
    // Handle next-day times (GTFS allows 24:00+ for next day)
    let gtfsTotalMinutes = gtfsTimeData.totalMinutes;
    let userTotalMinutes = userTimeData.totalMinutes;
    
    // If GTFS time is next day (25:30 = 1:30 AM next day)
    if (gtfsTimeData.hours >= 24) {
      gtfsTotalMinutes = gtfsTimeData.totalMinutes; // Keep as is for comparison
    }
    
    return gtfsTotalMinutes >= userTotalMinutes;
  };

  // FIXED: Use exact GTFS duration calculation
  const calculateGTFSDuration = (startTime: string, endTime: string): number => {
    const startData = parseGTFSTime(startTime);
    const endData = parseGTFSTime(endTime);
    
    let duration = endData.totalMinutes - startData.totalMinutes;
    
    // Handle next-day scenarios
    if (duration < 0) {
      duration += 24 * 60; // Add 24 hours
    }
    
    return duration;
  };

  // Enhanced journey planning with proper departure time filtering
  const planJourney = async () => {
    if (!fromStopId || !toStopId || fromStopId === toStopId) {
      return;
    }

    setIsPlanning(true);
    
    try {
      const fromStop = stops.find(s => s.stop_id === fromStopId);
      const toStop = stops.find(s => s.stop_id === toStopId);
      
      if (!fromStop || !toStop) {
        setIsPlanning(false);
        return;
      }

      console.log('🚌 Planning journey from:', fromStop.stop_name, 'to:', toStop.stop_name);
      console.log('🕐 Departure time filter:', departureTime || 'Current time');

      // FIXED: Use user's departure time or current Madrid time
      const searchTime = departureTime || getCurrentTime();
      console.log('🔍 Searching for departures after:', searchTime);

      // Find direct routes first (prioritized)
      const directRoutes = await findDirectRoutesWithDepartureTime(fromStop, toStop, searchTime);
      console.log('📍 Direct routes found:', directRoutes.length);
      
      // Only find transfer routes if no direct routes available
      let transferRoutes: JourneyResult[] = [];
      if (directRoutes.length === 0) {
        console.log('🔄 No direct routes found, searching for transfer options...');
        transferRoutes = await findEnhancedTransferRoutesWithDepartureTime(fromStop, toStop, searchTime);
        console.log('🔄 Transfer routes found:', transferRoutes.length);
      }
      
      // Combine and rank results (direct routes always first)
      const allJourneys = [...directRoutes, ...transferRoutes]
        .filter(journey => journey.routes.length > 0)
        .sort((a, b) => {
          // Direct routes always come first
          if (a.transfers === 0 && b.transfers > 0) return -1;
          if (a.transfers > 0 && b.transfers === 0) return 1;
          
          // Among same type, sort by departure time (earliest first)
          const aDeparture = parseGTFSTime(a.routes[0].departureTime).totalMinutes;
          const bDeparture = parseGTFSTime(b.routes[0].departureTime).totalMinutes;
          if (aDeparture !== bDeparture) return aDeparture - bDeparture;
          
          // Then by total duration
          return a.totalDuration - b.totalDuration;
        })
        .slice(0, 8); // Show top 8 options

      console.log('✅ Total journeys found:', allJourneys.length);
      setJourneyResults(allJourneys);
    } catch (error) {
      console.error('❌ Error planning journey:', error);
    } finally {
      setIsPlanning(false);
    }
  };

  // FIXED: Direct route finding with proper departure time filtering
  const findDirectRoutesWithDepartureTime = async (fromStop: Stop, toStop: Stop, searchTime: string): Promise<JourneyResult[]> => {
    const results: JourneyResult[] = [];

    console.log(`🔍 Searching direct routes from ${fromStop.stop_name} to ${toStop.stop_name} after ${searchTime}`);

    // Get all stop times for both stops
    const fromStopTimes = stopTimes.filter(st => st.stop_id === fromStop.stop_id);
    const toStopTimes = stopTimes.filter(st => st.stop_id === toStop.stop_id);

    console.log(`📊 From stop times: ${fromStopTimes.length}, To stop times: ${toStopTimes.length}`);

    // Group by trip to find common trips
    const tripConnections = new Map<string, {
      fromStopTime: StopTime;
      toStopTime: StopTime;
      trip: Trip;
      route: Route;
    }>();

    fromStopTimes.forEach(fromST => {
      // FIXED: Apply departure time filter immediately
      if (!fromST.departure_time || !isTimeAfterDeparture(fromST.departure_time, searchTime)) {
        return; // Skip if before departure time
      }

      const toST = toStopTimes.find(toStopTime => 
        toStopTime.trip_id === fromST.trip_id &&
        toStopTime.stop_sequence > fromST.stop_sequence && // Ensure correct direction
        toStopTime.departure_time &&
        parseGTFSTime(toStopTime.departure_time).totalMinutes > parseGTFSTime(fromST.departure_time).totalMinutes
      );

      if (toST) {
        const trip = trips.find(t => t.trip_id === fromST.trip_id);
        const route = trip ? routes.find(r => r.route_id === trip.route_id) : null;

        if (trip && route) {
          const key = `${route.route_id}-${trip.direction_id}-${fromST.departure_time}`;
          
          // Keep all valid departures (not just earliest)
          if (!tripConnections.has(key)) {
            tripConnections.set(key, {
              fromStopTime: fromST,
              toStopTime: toST,
              trip,
              route
            });
          }
        }
      }
    });

    console.log(`🎯 Found ${tripConnections.size} direct connections after ${searchTime}`);

    // Convert to journey results using exact GTFS times
    Array.from(tripConnections.values()).forEach((connection, index) => {
      // FIXED: Use exact GTFS duration calculation
      const duration = calculateGTFSDuration(
        connection.fromStopTime.departure_time,
        connection.toStopTime.arrival_time || connection.toStopTime.departure_time
      );

      if (duration > 0 && duration < 300) { // Reasonable duration (less than 5 hours)
        const intermediateStops = getIntermediateStops(
          connection.trip.trip_id,
          connection.fromStopTime.stop_sequence,
          connection.toStopTime.stop_sequence
        );

        const directionLabel = connection.trip.direction_id === 0 ? 'Outbound (Ida)' : 'Inbound (Vuelta)';

        results.push({
          id: `direct-${connection.route.route_id}-${connection.trip.direction_id}-${connection.fromStopTime.departure_time}-${index}`,
          fromStop,
          toStop,
          routes: [{
            route: connection.route,
            trip: connection.trip,
            fromStop,
            toStop,
            departureTime: connection.fromStopTime.departure_time,
            arrivalTime: connection.toStopTime.arrival_time || connection.toStopTime.departure_time,
            duration,
            stops: [fromStop, ...intermediateStops, toStop],
            direction: connection.trip.direction_id,
            directionLabel
          }],
          totalDuration: duration,
          totalDistance: calculateDistance(fromStop, toStop),
          transfers: 0,
          walkingTime: 0,
          confidence: 100 // Direct routes have highest confidence
        });
      }
    });

    console.log(`✅ Generated ${results.length} direct journey options`);
    return results.sort((a, b) => {
      // Sort by departure time (earliest first)
      const aDeparture = parseGTFSTime(a.routes[0].departureTime).totalMinutes;
      const bDeparture = parseGTFSTime(b.routes[0].departureTime).totalMinutes;
      return aDeparture - bDeparture;
    });
  };

  // FIXED: Transfer route finding with departure time filtering
  const findEnhancedTransferRoutesWithDepartureTime = async (fromStop: Stop, toStop: Stop, searchTime: string): Promise<JourneyResult[]> => {
    const results: JourneyResult[] = [];

    console.log('🔄 Starting enhanced transfer route search with departure time filtering...');

    // Get potential transfer hubs
    const transferHubs = await findAllPotentialTransferHubs(fromStop, toStop);
    console.log(`🏢 Found ${transferHubs.length} potential transfer hubs`);

    // Process each hub with departure time filtering
    for (const hub of transferHubs.slice(0, 15)) { // Limit to top 15 hubs
      try {
        console.log(`🔍 Checking hub: ${hub.stop_name} (${hub.stop_id})`);
        
        // Find first leg (origin to hub) with departure time filter
        const firstLegOptions = await findDirectRoutesWithDepartureTime(fromStop, hub, searchTime);
        
        if (firstLegOptions.length === 0) continue;

        // For each first leg, find second leg options
        for (const firstLeg of firstLegOptions.slice(0, 3)) { // Top 3 first leg options
          const firstLegArrival = firstLeg.routes[0].arrivalTime;
          const transferTime = calculateTransferTime(hub);
          
          // Calculate minimum departure time for second leg (arrival + transfer time)
          const firstLegArrivalData = parseGTFSTime(firstLegArrival);
          const secondLegMinDeparture = `${Math.floor((firstLegArrivalData.totalMinutes + transferTime) / 60).toString().padStart(2, '0')}:${((firstLegArrivalData.totalMinutes + transferTime) % 60).toString().padStart(2, '0')}`;
          
          const secondLegOptions = await findDirectRoutesWithDepartureTime(hub, toStop, secondLegMinDeparture);
          
          // Create transfer journey for the best second leg option
          if (secondLegOptions.length > 0) {
            const secondLeg = secondLegOptions[0]; // Take earliest departure
            const waitTime = calculateGTFSDuration(firstLegArrival, secondLeg.routes[0].departureTime);
            
            if (waitTime >= transferTime && waitTime <= 60) { // Reasonable transfer window
              const totalDuration = firstLeg.totalDuration + secondLeg.totalDuration + waitTime;
              
              results.push({
                id: `transfer-${firstLeg.routes[0].route.route_id}-${secondLeg.routes[0].route.route_id}-${hub.stop_id}-${firstLeg.routes[0].departureTime}`,
                fromStop,
                toStop,
                routes: [firstLeg.routes[0], secondLeg.routes[0]],
                totalDuration,
                totalDistance: firstLeg.totalDistance + secondLeg.totalDistance,
                transfers: 1,
                walkingTime: transferTime,
                confidence: Math.max(60, 90 - waitTime), // Good confidence for reasonable transfers
                transferStops: [hub]
              });
            }
          }
        }
        
      } catch (error) {
        console.error(`❌ Error processing transfer hub ${hub.stop_name}:`, error);
      }
    }

    console.log(`✅ Enhanced transfer search complete: ${results.length} transfer options`);
    
    // Return only the fastest transfer option
    return results
      .sort((a, b) => a.totalDuration - b.totalDuration)
      .slice(0, 1); // Only return the fastest transfer option
  };

  // Get all potential transfer hubs using multiple strategies
  const findAllPotentialTransferHubs = async (fromStop: Stop, toStop: Stop): Promise<Stop[]> => {
    const hubs = new Set<Stop>();

    // Strategy 1: Official interchange stations
    const officialInterchanges = stops.filter(stop => stop.location_type === 1);
    officialInterchanges.forEach(hub => hubs.add(hub));

    // Strategy 2: High-traffic stops (served by many routes)
    const highTrafficStops = stops.filter(stop => {
      const routeCount = getRoutesServingStop(stop.stop_id).length;
      return routeCount >= 3 && stop.stop_id !== fromStop.stop_id && stop.stop_id !== toStop.stop_id;
    });
    highTrafficStops.forEach(hub => hubs.add(hub));

    // Strategy 3: Stops that serve routes connecting to both origin and destination
    const connectingStops = await findConnectingStops(fromStop, toStop);
    connectingStops.forEach(hub => hubs.add(hub));

    // Convert to array and sort by potential (route count + interchange status)
    return Array.from(hubs)
      .map(hub => ({
        stop: hub,
        score: calculateHubScore(hub, fromStop, toStop)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20) // Top 20 potential hubs
      .map(item => item.stop);
  };

  // Find stops that have routes serving both origin and destination areas
  const findConnectingStops = async (fromStop: Stop, toStop: Stop): Promise<Stop[]> => {
    const fromRoutes = getRoutesServingStop(fromStop.stop_id);
    const toRoutes = getRoutesServingStop(toStop.stop_id);
    
    const connectingStops: Stop[] = [];

    // Find stops served by routes that also serve the origin
    fromRoutes.forEach(route => {
      const routeStops = getStopsServedByRoute(route.route_id);
      routeStops.forEach(stop => {
        if (stop.stop_id !== fromStop.stop_id && stop.stop_id !== toStop.stop_id) {
          // Check if this stop is also served by routes that serve the destination
          const stopRoutes = getRoutesServingStop(stop.stop_id);
          const hasConnectionToDestination = stopRoutes.some(stopRoute => 
            toRoutes.some(toRoute => toRoute.route_id === stopRoute.route_id) ||
            getStopsServedByRoute(stopRoute.route_id).some(s => s.stop_id === toStop.stop_id)
          );
          
          if (hasConnectionToDestination) {
            connectingStops.push(stop);
          }
        }
      });
    });

    return connectingStops;
  };

  // Calculate hub score for ranking
  const calculateHubScore = (hub: Stop, fromStop: Stop, toStop: Stop): number => {
    let score = 0;
    
    // Route count (more routes = better hub)
    const routeCount = getRoutesServingStop(hub.stop_id).length;
    score += routeCount * 10;
    
    // Official interchange bonus
    if (hub.location_type === 1) score += 50;
    
    // Geographic position (prefer hubs between origin and destination)
    const totalDistance = calculateDistance(fromStop, toStop);
    const hubToOrigin = calculateDistance(fromStop, hub);
    const hubToDestination = calculateDistance(hub, toStop);
    const detourFactor = (hubToOrigin + hubToDestination) / totalDistance;
    
    if (detourFactor < 1.5) score += 30; // Reasonable detour
    if (detourFactor < 1.2) score += 20; // Good detour
    
    // Accessibility bonus
    if (hub.wheelchair_boarding === 1) score += 10;
    
    return score;
  };

  // Get routes serving a specific stop
  const getRoutesServingStop = (stopId: string): Route[] => {
    const stopTrips = stopTimes
      .filter(st => st.stop_id === stopId)
      .map(st => st.trip_id);
    
    const routeIds = [...new Set(
      trips
        .filter(trip => stopTrips.includes(trip.trip_id))
        .map(trip => trip.route_id)
    )];

    return routes.filter(route => routeIds.includes(route.route_id));
  };

  // Get stops served by a specific route
  const getStopsServedByRoute = (routeId: string): Stop[] => {
    const routeTrips = trips.filter(trip => trip.route_id === routeId);
    const routeTripIds = routeTrips.map(trip => trip.trip_id);
    const routeStopTimes = stopTimes.filter(st => routeTripIds.includes(st.trip_id));
    const uniqueStopIds = [...new Set(routeStopTimes.map(st => st.stop_id))];
    
    return stops.filter(stop => uniqueStopIds.includes(stop.stop_id));
  };

  // Calculate appropriate transfer time based on stop type
  const calculateTransferTime = (stop: Stop): number => {
    if (stop.location_type === 1) return 5; // Official interchange - 5 minutes
    return 8; // Regular stop - 8 minutes
  };

  // Get intermediate stops for a trip segment
  const getIntermediateStops = (tripId: string, fromSequence: number, toSequence: number): Stop[] => {
    const tripStopTimes = stopTimes
      .filter(st => 
        st.trip_id === tripId && 
        st.stop_sequence > fromSequence && 
        st.stop_sequence < toSequence
      )
      .sort((a, b) => a.stop_sequence - b.stop_sequence);

    return tripStopTimes
      .map(st => stops.find(stop => stop.stop_id === st.stop_id))
      .filter(Boolean) as Stop[];
  };

  // Calculate distance between stops using Haversine formula
  const calculateDistance = (stop1: Stop, stop2: Stop): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (stop2.stop_lat - stop1.stop_lat) * Math.PI / 180;
    const dLon = (stop2.stop_lon - stop1.stop_lon) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(stop1.stop_lat * Math.PI / 180) * Math.cos(stop2.stop_lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 100) / 100;
  };

  // FIXED: Format time for display (Madrid timezone aware)
  const formatTime = (timeStr: string): string => {
    if (!timeStr || !timeStr.includes(':')) return 'N/A';
    
    const timeData = parseGTFSTime(timeStr);
    let displayHour = timeData.hours;
    const displayMinute = timeData.minutes.toString().padStart(2, '0');
    
    // Handle next-day times (24+ hours)
    if (displayHour >= 24) {
      displayHour = displayHour - 24;
    }
    
    // Convert to 12-hour format
    if (displayHour === 0) return `12:${displayMinute} AM`;
    if (displayHour < 12) return `${displayHour}:${displayMinute} AM`;
    if (displayHour === 12) return `12:${displayMinute} PM`;
    return `${displayHour - 12}:${displayMinute} PM`;
  };

  // Format duration
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const handleJourneySelect = (journey: JourneyResult) => {
    setSelectedJourney(journey);
    onJourneySelect?.(journey);
  };

  const resetPlanner = () => {
    setFromStopId('');
    setToStopId('');
    setSearchFromTerm('');
    setSearchToTerm('');
    setDepartureTime('');
    setJourneyResults([]);
    setSelectedJourney(null);
    setShowFromDropdown(false);
    setShowToDropdown(false);
  };

  const handleFromStopSelect = (stopWithDirections: StopWithDirections) => {
    setFromStopId(stopWithDirections.stop.stop_id);
    setSearchFromTerm(stopWithDirections.stop.stop_name);
    setShowFromDropdown(false);
  };

  const handleToStopSelect = (stopWithDirections: StopWithDirections) => {
    setToStopId(stopWithDirections.stop.stop_id);
    setSearchToTerm(stopWithDirections.stop.stop_name);
    setShowToDropdown(false);
  };

  const swapStops = () => {
    const tempId = fromStopId;
    const tempTerm = searchFromTerm;
    
    setFromStopId(toStopId);
    setSearchFromTerm(searchToTerm);
    setToStopId(tempId);
    setSearchToTerm(tempTerm);
    
    // Clear results when swapping
    setJourneyResults([]);
    setSelectedJourney(null);
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Navigation className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Enhanced Journey Planner</h3>
            <p className="text-sm text-gray-600">Route directions • Final destinations • Standard GTFS times</p>
          </div>
        </div>
        {(fromStopId || toStopId || journeyResults.length > 0) && (
          <button
            onClick={resetPlanner}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Clear All
          </button>
        )}
      </div>

      {/* Enhanced Journey Input Form */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* From Stop */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin className="w-4 h-4 inline mr-1 text-green-600" />
            From
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchFromTerm}
              onChange={(e) => {
                setSearchFromTerm(e.target.value);
                setShowFromDropdown(true);
                if (!e.target.value) setFromStopId('');
              }}
              onFocus={() => setShowFromDropdown(true)}
              placeholder="Search departure stop..."
              className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Search className="absolute right-2 top-2.5 w-4 h-4 text-gray-400" />
            
            {showFromDropdown && searchFromTerm && filteredFromStops.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                {filteredFromStops.map(stopWithDirections => (
                  <button
                    key={stopWithDirections.stop.stop_id}
                    onClick={() => handleFromStopSelect(stopWithDirections)}
                    className={`w-full text-left px-3 py-4 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                      fromStopId === stopWithDirections.stop.stop_id ? 'bg-blue-50 text-blue-900' : ''
                    }`}
                  >
                    <div className="font-medium text-sm mb-1">{stopWithDirections.stop.stop_name}</div>
                    <div className="text-xs text-gray-600 mb-2">
                      Code: {stopWithDirections.stop.stop_code} • Zone: {stopWithDirections.stop.zone_id}
                      {stopWithDirections.stop.location_type === 1 && <span className="ml-2 text-red-600">• Interchange</span>}
                      <span className="ml-2 text-blue-600">• {stopWithDirections.routeDirections.length} route directions</span>
                    </div>
                    
                    {/* Route Directions Display */}
                    {stopWithDirections.routeDirections.length > 0 && (
                      <div className="space-y-1">
                        {stopWithDirections.routeDirections.slice(0, 4).map((routeDir, index) => (
                          <div key={`${routeDir.route.route_id}-${routeDir.direction}`} className="flex items-center gap-2 text-xs">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                              routeDir.route.route_color === '8EBF42' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {routeDir.route.route_short_name}
                            </span>
                            <span className={`text-xs font-medium ${
                              routeDir.direction === 0 ? 'text-blue-600' : 'text-purple-600'
                            }`}>
                              {routeDir.directionLabel}
                            </span>
                            <span className="text-gray-500">→</span>
                            <span className="text-gray-700 truncate max-w-[120px]" title={routeDir.finalDestination}>
                              {routeDir.finalDestination}
                            </span>
                          </div>
                        ))}
                        {stopWithDirections.routeDirections.length > 4 && (
                          <div className="text-xs text-gray-500 italic">
                            +{stopWithDirections.routeDirections.length - 4} more directions...
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex items-end">
          <button
            onClick={swapStops}
            disabled={!fromStopId && !toStopId}
            className="w-full mb-0 px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed text-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Shuffle className="w-4 h-4" />
            <span className="text-sm">Swap</span>
          </button>
        </div>

        {/* To Stop */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin className="w-4 h-4 inline mr-1 text-red-600" />
            To
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchToTerm}
              onChange={(e) => {
                setSearchToTerm(e.target.value);
                setShowToDropdown(true);
                if (!e.target.value) setToStopId('');
              }}
              onFocus={() => setShowToDropdown(true)}
              placeholder="Search destination stop..."
              className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Search className="absolute right-2 top-2.5 w-4 h-4 text-gray-400" />
            
            {showToDropdown && searchToTerm && filteredToStops.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                {filteredToStops.map(stopWithDirections => (
                  <button
                    key={stopWithDirections.stop.stop_id}
                    onClick={() => handleToStopSelect(stopWithDirections)}
                    className={`w-full text-left px-3 py-4 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                      toStopId === stopWithDirections.stop.stop_id ? 'bg-blue-50 text-blue-900' : ''
                    }`}
                  >
                    <div className="font-medium text-sm mb-1">{stopWithDirections.stop.stop_name}</div>
                    <div className="text-xs text-gray-600 mb-2">
                      Code: {stopWithDirections.stop.stop_code} • Zone: {stopWithDirections.stop.zone_id}
                      {stopWithDirections.stop.location_type === 1 && <span className="ml-2 text-red-600">• Interchange</span>}
                      <span className="ml-2 text-blue-600">• {stopWithDirections.routeDirections.length} route directions</span>
                    </div>
                    
                    {/* Route Directions Display */}
                    {stopWithDirections.routeDirections.length > 0 && (
                      <div className="space-y-1">
                        {stopWithDirections.routeDirections.slice(0, 4).map((routeDir, index) => (
                          <div key={`${routeDir.route.route_id}-${routeDir.direction}`} className="flex items-center gap-2 text-xs">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                              routeDir.route.route_color === '8EBF42' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {routeDir.route.route_short_name}
                            </span>
                            <span className={`text-xs font-medium ${
                              routeDir.direction === 0 ? 'text-blue-600' : 'text-purple-600'
                            }`}>
                              {routeDir.directionLabel}
                            </span>
                            <span className="text-gray-500">→</span>
                            <span className="text-gray-700 truncate max-w-[120px]" title={routeDir.finalDestination}>
                              {routeDir.finalDestination}
                            </span>
                          </div>
                        ))}
                        {stopWithDirections.routeDirections.length > 4 && (
                          <div className="text-xs text-gray-500 italic">
                            +{stopWithDirections.routeDirections.length - 4} more directions...
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Departure Time - FIXED to actually filter results */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Clock className="w-4 h-4 inline mr-1" />
            Departure Time (Madrid)
          </label>
          <input
            type="time"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {!departureTime && (
            <p className="text-xs text-gray-500 mt-1">Leave empty for current Madrid time ({getCurrentTime()})</p>
          )}
        </div>
      </div>

      {/* Plan Journey Button */}
      <div className="mb-6">
        <button
          onClick={planJourney}
          disabled={!fromStopId || !toStopId || fromStopId === toStopId || isPlanning}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isPlanning ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Searching with departure time filter...
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              Find Routes {departureTime && `(after ${departureTime})`}
            </>
          )}
        </button>
      </div>

      {/* Enhanced Journey Results */}
      {journeyResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <RouteIcon className="w-5 h-5" />
              Journey Options ({journeyResults.length})
            </h4>
            <div className="text-sm text-gray-600">
              {journeyResults.some(j => j.transfers === 0) ? 'Direct routes available' : 'Transfer routes only'}
            </div>
          </div>
          
          {journeyResults.map((journey, index) => (
            <div
              key={journey.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedJourney?.id === journey.id
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
              onClick={() => handleJourneySelect(journey)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-900">
                      Option {index + 1}
                    </span>
                    
                    {/* Enhanced Journey Type Badges */}
                    {journey.transfers === 0 && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                        🚌 Direct Route
                      </span>
                    )}
                    {journey.transfers > 0 && (
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">
                        🔄 {journey.transfers} Transfer{journey.transfers > 1 ? 's' : ''}
                      </span>
                    )}
                    
                    {/* GTFS Time Badge */}
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                      📅 GTFS Standard Times
                    </span>

                    {/* Transfer Hub Info */}
                    {journey.transferStops && journey.transferStops.length > 0 && (
                      <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full font-medium">
                        via {journey.transferStops[0].stop_name.split('-')[0]}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-600">
                    {formatDuration(journey.totalDuration)}
                  </div>
                  <div className="text-xs text-gray-600">
                    {journey.totalDistance}km • {journey.walkingTime}m transfer
                  </div>
                </div>
              </div>

              {/* Enhanced Route Details */}
              <div className="space-y-3">
                {journey.routes.map((routeSegment, segmentIndex) => (
                  <div key={segmentIndex}>
                    {segmentIndex > 0 && (
                      <div className="flex items-center justify-center py-2">
                        <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                          <ArrowRight className="w-3 h-3" />
                          Transfer at {routeSegment.fromStop.stop_name} ({journey.walkingTime}min)
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`route-badge ${routeSegment.route.route_color === '8EBF42' ? 'route-badge-green' : 'route-badge-red'}`}>
                        {routeSegment.route.route_short_name}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{routeSegment.fromStop.stop_name}</span>
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                          <span className="font-medium">{routeSegment.toStop.stop_name}</span>
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {routeSegment.route.route_long_name}
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          Direction: {routeSegment.directionLabel}
                        </div>
                      </div>
                      
                      <div className="text-right text-sm">
                        <div className="font-medium text-gray-900">
                          {formatTime(routeSegment.departureTime)} → {formatTime(routeSegment.arrivalTime)}
                        </div>
                        <div className="text-xs text-gray-600">
                          {formatDuration(routeSegment.duration)} • {routeSegment.stops.length - 1} stops
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Enhanced Journey Summary */}
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                  <div className="flex items-center gap-4">
                    <span>🕐 Depart: {formatTime(journey.routes[0].departureTime)}</span>
                    <span>🏁 Arrive: {formatTime(journey.routes[journey.routes.length - 1].arrivalTime)}</span>
                  </div>
                  {selectedJourney?.id === journey.id && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <CheckCircle className="w-3 h-3" />
                      <span className="font-medium">Selected & Highlighted on Map</span>
                    </div>
                  )}
                </div>
                
                {/* Additional Journey Info */}
                <div className="grid grid-cols-4 gap-4 text-xs">
                  <div className="text-center">
                    <div className="font-medium text-gray-900">{journey.routes.length}</div>
                    <div className="text-gray-600">Routes</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900">
                      {journey.routes.reduce((sum, r) => sum + r.stops.length - 1, 0)}
                    </div>
                    <div className="text-gray-600">Total Stops</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900">{journey.walkingTime}m</div>
                    <div className="text-gray-600">Transfer</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900">
                      {journey.routes.map(r => r.route.route_short_name).join(' → ')}
                    </div>
                    <div className="text-gray-600">Route Sequence</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Enhanced No Results Message */}
      {!isPlanning && journeyResults.length === 0 && fromStopId && toStopId && (
        <div className="text-center py-8 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Routes Found</h3>
          <p className="text-gray-600 mb-4">
            No routes found {departureTime && `after ${departureTime}`} between these stops.
          </p>
          <div className="text-sm text-gray-500 space-y-1">
            <p>• ✅ Checked direct routes with departure time filter</p>
            <p>• ✅ Analyzed transfer options via major hubs</p>
            <p>• ✅ Used standard GTFS scheduling data</p>
            <p>• 💡 Try a different departure time or nearby stops</p>
          </div>
        </div>
      )}

      {/* Enhanced Instructions */}
      {journeyResults.length === 0 && !fromStopId && !toStopId && (
        <div className="text-center py-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
          <Navigation className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">🚌 Enhanced Journey Planning</h3>
          <p className="text-gray-600 mb-4">
            Route directions with final destinations • Standard GTFS times • Madrid timezone support
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900">🔍 Enhanced Features:</h4>
              <p>• 🚌 Route directions (Inbound/Outbound)</p>
              <p>• 🎯 Final destination display</p>
              <p>• 📅 Standard GTFS scheduling times</p>
              <p>• 🕐 Madrid timezone awareness</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900">🎯 Smart Logic:</h4>
              <p>• Shows where each route goes</p>
              <p>• Direct routes prioritized</p>
              <p>• Respects your departure time</p>
              <p>• Uses official bus schedules</p>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close dropdowns */}
      {(showFromDropdown || showToDropdown) && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => {
            setShowFromDropdown(false);
            setShowToDropdown(false);
          }}
        />
      )}
    </div>
  );
};