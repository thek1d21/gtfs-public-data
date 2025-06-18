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

  // Enhanced stop filtering with better search
  const filteredFromStops = useMemo(() => {
    if (!searchFromTerm || searchFromTerm.length < 2) return [];
    
    return stops.filter(stop => 
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
  }, [stops, searchFromTerm]);

  const filteredToStops = useMemo(() => {
    if (!searchToTerm || searchToTerm.length < 2) return [];
    
    return stops.filter(stop => 
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
  }, [stops, searchToTerm, fromStopId]);

  // Get current time as default
  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  // Enhanced journey planning with better transfer detection
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

      // Find all possible routes with enhanced algorithms
      const directRoutes = await findDirectRoutes(fromStop, toStop);
      console.log('📍 Direct routes found:', directRoutes.length);
      
      const transferRoutes = await findEnhancedTransferRoutes(fromStop, toStop);
      console.log('🔄 Transfer routes found:', transferRoutes.length);
      
      // Combine and rank results
      const allJourneys = [...directRoutes, ...transferRoutes]
        .filter(journey => journey.routes.length > 0)
        .sort((a, b) => {
          // Sort by confidence first, then by duration, then by transfers
          if (a.confidence !== b.confidence) return b.confidence - a.confidence;
          if (a.transfers !== b.transfers) return a.transfers - b.transfers;
          return a.totalDuration - b.totalDuration;
        })
        .slice(0, 10); // Show top 10 options

      console.log('✅ Total journeys found:', allJourneys.length);
      setJourneyResults(allJourneys);
    } catch (error) {
      console.error('❌ Error planning journey:', error);
    } finally {
      setIsPlanning(false);
    }
  };

  // Enhanced direct route finding with better sequence handling
  const findDirectRoutes = async (fromStop: Stop, toStop: Stop): Promise<JourneyResult[]> => {
    const results: JourneyResult[] = [];
    const searchTime = departureTime || getCurrentTime();

    // Get all stop times for both stops
    const fromStopTimes = stopTimes.filter(st => st.stop_id === fromStop.stop_id);
    const toStopTimes = stopTimes.filter(st => st.stop_id === toStop.stop_id);

    console.log(`🔍 From stop ${fromStop.stop_name}: ${fromStopTimes.length} stop times`);
    console.log(`🔍 To stop ${toStop.stop_name}: ${toStopTimes.length} stop times`);

    // Group by trip to find common trips
    const tripConnections = new Map<string, {
      fromStopTime: StopTime;
      toStopTime: StopTime;
      trip: Trip;
      route: Route;
    }>();

    fromStopTimes.forEach(fromST => {
      const toST = toStopTimes.find(toStopTime => 
        toStopTime.trip_id === fromST.trip_id &&
        toStopTime.stop_sequence > fromST.stop_sequence && // Ensure correct direction
        toStopTime.departure_time && fromST.departure_time &&
        fromST.departure_time >= searchTime // After search time
      );

      if (toST) {
        const trip = trips.find(t => t.trip_id === fromST.trip_id);
        const route = trip ? routes.find(r => r.route_id === trip.route_id) : null;

        if (trip && route) {
          const key = `${route.route_id}-${trip.direction_id}`;
          
          // Keep the earliest departure for each route-direction combination
          if (!tripConnections.has(key) || 
              fromST.departure_time < tripConnections.get(key)!.fromStopTime.departure_time) {
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

    console.log(`🎯 Found ${tripConnections.size} direct connections`);

    // Convert to journey results
    Array.from(tripConnections.values()).forEach((connection, index) => {
      const duration = calculateTimeDifference(
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
          id: `direct-${connection.route.route_id}-${connection.trip.direction_id}-${index}`,
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

    return results;
  };

  // ENHANCED transfer route finding with better hub detection
  const findEnhancedTransferRoutes = async (fromStop: Stop, toStop: Stop): Promise<JourneyResult[]> => {
    const results: JourneyResult[] = [];
    const searchTime = departureTime || getCurrentTime();

    console.log('🔄 Starting enhanced transfer route search...');

    // Get all potential transfer hubs with multiple strategies
    const transferHubs = await findAllPotentialTransferHubs(fromStop, toStop);
    
    console.log(`🏢 Found ${transferHubs.length} potential transfer hubs`);

    // Process each hub with enhanced logic
    for (const hub of transferHubs) {
      try {
        console.log(`🔍 Checking hub: ${hub.stop_name} (${hub.stop_id})`);
        
        // Strategy 1: Direct route connections
        const firstLegDirect = await findDirectRoutes(fromStop, hub);
        const secondLegDirect = await findDirectRoutes(hub, toStop);
        
        console.log(`  📍 First leg options: ${firstLegDirect.length}`);
        console.log(`  📍 Second leg options: ${secondLegDirect.length}`);

        // Strategy 2: Same-stop different-route transfers
        const sameStopTransfers = await findSameStopTransfers(fromStop, toStop, hub);
        
        // Strategy 3: Nearby stop transfers (within walking distance)
        const nearbyTransfers = await findNearbyStopTransfers(fromStop, toStop, hub);

        // Combine all transfer options
        const allTransferOptions = [
          ...combineTransferLegs(firstLegDirect, secondLegDirect, hub),
          ...sameStopTransfers,
          ...nearbyTransfers
        ];

        results.push(...allTransferOptions);
        
      } catch (error) {
        console.error(`❌ Error processing transfer hub ${hub.stop_name}:`, error);
      }
    }

    // Remove duplicates and sort by quality
    const uniqueResults = removeDuplicateJourneys(results);
    console.log(`✅ Enhanced transfer search complete: ${uniqueResults.length} unique options`);
    
    return uniqueResults.slice(0, 8); // Limit to best 8 transfer options
  };

  // Find all potential transfer hubs using multiple strategies
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

    // Strategy 4: Geographic intermediate stops
    const geographicHubs = findGeographicIntermediateStops(fromStop, toStop);
    geographicHubs.forEach(hub => hubs.add(hub));

    // Convert to array and sort by potential (route count + interchange status)
    return Array.from(hubs)
      .map(hub => ({
        stop: hub,
        score: calculateHubScore(hub, fromStop, toStop)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 25) // Top 25 potential hubs
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

  // Find geographically intermediate stops
  const findGeographicIntermediateStops = (fromStop: Stop, toStop: Stop): Stop[] => {
    const midLat = (fromStop.stop_lat + toStop.stop_lat) / 2;
    const midLon = (fromStop.stop_lon + toStop.stop_lon) / 2;
    const maxDistance = calculateDistance(fromStop, toStop) * 0.7; // Within 70% of total distance

    return stops.filter(stop => {
      if (stop.stop_id === fromStop.stop_id || stop.stop_id === toStop.stop_id) return false;
      
      const distanceFromMidpoint = calculateDistance(
        { stop_lat: midLat, stop_lon: midLon } as Stop,
        stop
      );
      
      const distanceFromOrigin = calculateDistance(fromStop, stop);
      const distanceToDestination = calculateDistance(stop, toStop);
      
      return distanceFromMidpoint < 2 && // Within 2km of midpoint
             distanceFromOrigin < maxDistance &&
             distanceToDestination < maxDistance &&
             getRoutesServingStop(stop.stop_id).length >= 2; // At least 2 routes
    });
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

  // Find same-stop transfers (different routes at same physical location)
  const findSameStopTransfers = async (fromStop: Stop, toStop: Stop, hub: Stop): Promise<JourneyResult[]> => {
    const results: JourneyResult[] = [];
    
    // Get all routes serving this hub
    const hubRoutes = getRoutesServingStop(hub.stop_id);
    
    // Find routes that can get us from origin to hub
    const originToHubRoutes = hubRoutes.filter(route => {
      const routeStops = getStopsServedByRoute(route.route_id);
      return routeStops.some(stop => stop.stop_id === fromStop.stop_id);
    });
    
    // Find routes that can get us from hub to destination
    const hubToDestinationRoutes = hubRoutes.filter(route => {
      const routeStops = getStopsServedByRoute(route.route_id);
      return routeStops.some(stop => stop.stop_id === toStop.stop_id);
    });
    
    console.log(`  🔄 Same-stop transfers at ${hub.stop_name}: ${originToHubRoutes.length} → ${hubToDestinationRoutes.length}`);
    
    // Create transfer combinations
    for (const route1 of originToHubRoutes) {
      for (const route2 of hubToDestinationRoutes) {
        if (route1.route_id !== route2.route_id) { // Different routes
          const transfer = await createTransferJourney(fromStop, hub, toStop, route1, route2);
          if (transfer) {
            results.push(transfer);
          }
        }
      }
    }
    
    return results;
  };

  // Find nearby stop transfers (walking between close stops)
  const findNearbyStopTransfers = async (fromStop: Stop, toStop: Stop, hub: Stop): Promise<JourneyResult[]> => {
    const results: JourneyResult[] = [];
    const walkingRadius = 0.3; // 300 meters
    
    // Find stops near the hub
    const nearbyStops = stops.filter(stop => 
      stop.stop_id !== hub.stop_id &&
      calculateDistance(hub, stop) <= walkingRadius
    );
    
    console.log(`  🚶 Found ${nearbyStops.length} stops within ${walkingRadius}km of ${hub.stop_name}`);
    
    // Check transfers via nearby stops
    for (const nearbyStop of nearbyStops) {
      const firstLeg = await findDirectRoutes(fromStop, hub);
      const secondLeg = await findDirectRoutes(nearbyStop, toStop);
      
      if (firstLeg.length > 0 && secondLeg.length > 0) {
        const walkingTime = Math.ceil(calculateDistance(hub, nearbyStop) * 12); // ~12 min per km
        
        firstLeg.forEach(leg1 => {
          secondLeg.forEach(leg2 => {
            const leg1Arrival = leg1.routes[0].arrivalTime;
            const leg2Departure = leg2.routes[0].departureTime;
            const waitTime = calculateTimeDifference(leg1Arrival, leg2Departure);
            
            if (waitTime >= walkingTime && waitTime <= 60) { // Feasible transfer
              results.push({
                id: `nearby-transfer-${hub.stop_id}-${nearbyStop.stop_id}-${leg1.routes[0].route.route_id}-${leg2.routes[0].route.route_id}`,
                fromStop,
                toStop,
                routes: [leg1.routes[0], leg2.routes[0]],
                totalDuration: leg1.totalDuration + leg2.totalDuration + waitTime,
                totalDistance: leg1.totalDistance + leg2.totalDistance + calculateDistance(hub, nearbyStop),
                transfers: 1,
                walkingTime: walkingTime,
                confidence: Math.max(30, 70 - waitTime), // Lower confidence for walking transfers
                transferStops: [hub, nearbyStop]
              });
            }
          });
        });
      }
    }
    
    return results;
  };

  // Create a transfer journey between two routes
  const createTransferJourney = async (fromStop: Stop, hubStop: Stop, toStop: Stop, route1: Route, route2: Route): Promise<JourneyResult | null> => {
    try {
      // Find trip segments for each route
      const firstLegTrips = trips.filter(trip => trip.route_id === route1.route_id);
      const secondLegTrips = trips.filter(trip => trip.route_id === route2.route_id);
      
      // Find valid connections
      for (const trip1 of firstLegTrips) {
        const trip1StopTimes = stopTimes.filter(st => st.trip_id === trip1.trip_id);
        const fromStopTime = trip1StopTimes.find(st => st.stop_id === fromStop.stop_id);
        const hubStopTime1 = trip1StopTimes.find(st => st.stop_id === hubStop.stop_id);
        
        if (!fromStopTime || !hubStopTime1 || hubStopTime1.stop_sequence <= fromStopTime.stop_sequence) continue;
        
        for (const trip2 of secondLegTrips) {
          const trip2StopTimes = stopTimes.filter(st => st.trip_id === trip2.trip_id);
          const hubStopTime2 = trip2StopTimes.find(st => st.stop_id === hubStop.stop_id);
          const toStopTime = trip2StopTimes.find(st => st.stop_id === toStop.stop_id);
          
          if (!hubStopTime2 || !toStopTime || toStopTime.stop_sequence <= hubStopTime2.stop_sequence) continue;
          
          const transferTime = calculateTransferTime(hubStop);
          const waitTime = calculateTimeDifference(
            hubStopTime1.arrival_time || hubStopTime1.departure_time,
            hubStopTime2.departure_time
          );
          
          if (waitTime >= transferTime && waitTime <= 45) { // Reasonable transfer window
            const leg1Duration = calculateTimeDifference(fromStopTime.departure_time, hubStopTime1.arrival_time || hubStopTime1.departure_time);
            const leg2Duration = calculateTimeDifference(hubStopTime2.departure_time, toStopTime.arrival_time || toStopTime.departure_time);
            
            return {
              id: `transfer-${route1.route_id}-${route2.route_id}-${hubStop.stop_id}`,
              fromStop,
              toStop,
              routes: [
                {
                  route: route1,
                  trip: trip1,
                  fromStop,
                  toStop: hubStop,
                  departureTime: fromStopTime.departure_time,
                  arrivalTime: hubStopTime1.arrival_time || hubStopTime1.departure_time,
                  duration: leg1Duration,
                  stops: [fromStop, hubStop],
                  direction: trip1.direction_id,
                  directionLabel: trip1.direction_id === 0 ? 'Outbound (Ida)' : 'Inbound (Vuelta)'
                },
                {
                  route: route2,
                  trip: trip2,
                  fromStop: hubStop,
                  toStop,
                  departureTime: hubStopTime2.departure_time,
                  arrivalTime: toStopTime.arrival_time || toStopTime.departure_time,
                  duration: leg2Duration,
                  stops: [hubStop, toStop],
                  direction: trip2.direction_id,
                  directionLabel: trip2.direction_id === 0 ? 'Outbound (Ida)' : 'Inbound (Vuelta)'
                }
              ],
              totalDuration: leg1Duration + leg2Duration + waitTime,
              totalDistance: calculateDistance(fromStop, hubStop) + calculateDistance(hubStop, toStop),
              transfers: 1,
              walkingTime: transferTime,
              confidence: Math.max(40, 85 - waitTime), // Good confidence for reasonable transfers
              transferStops: [hubStop]
            };
          }
        }
      }
    } catch (error) {
      console.error('Error creating transfer journey:', error);
    }
    
    return null;
  };

  // Combine transfer legs from direct route results
  const combineTransferLegs = (firstLegs: JourneyResult[], secondLegs: JourneyResult[], hub: Stop): JourneyResult[] => {
    const results: JourneyResult[] = [];
    
    firstLegs.forEach(leg1 => {
      secondLegs.forEach(leg2 => {
        const transferTime = calculateTransferTime(hub);
        const leg1Arrival = leg1.routes[0].arrivalTime;
        const leg2Departure = leg2.routes[0].departureTime;
        
        const waitTime = calculateTimeDifference(leg1Arrival, leg2Departure);
        
        // Check if transfer is feasible
        if (waitTime >= transferTime && waitTime <= 60) {
          const totalDuration = leg1.totalDuration + leg2.totalDuration + waitTime;
          
          if (totalDuration < 300) { // Less than 5 hours
            results.push({
              id: `combined-${leg1.routes[0].route.route_id}-${leg2.routes[0].route.route_id}-${hub.stop_id}`,
              fromStop: leg1.fromStop,
              toStop: leg2.toStop,
              routes: [leg1.routes[0], leg2.routes[0]],
              totalDuration,
              totalDistance: leg1.totalDistance + leg2.totalDistance,
              transfers: 1,
              walkingTime: transferTime,
              confidence: Math.max(50, 90 - waitTime), // Good confidence for direct connections
              transferStops: [hub]
            });
          }
        }
      });
    });
    
    return results;
  };

  // Remove duplicate journeys
  const removeDuplicateJourneys = (journeys: JourneyResult[]): JourneyResult[] => {
    const seen = new Set<string>();
    return journeys.filter(journey => {
      const key = `${journey.fromStop.stop_id}-${journey.toStop.stop_id}-${journey.routes.map(r => r.route.route_id).join('-')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
    return 8; // Regular stop - 8 minutes (reduced from 10 for better connections)
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

  // Calculate time difference in minutes
  const calculateTimeDifference = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;
    
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    let startTotalMinutes = startHours * 60 + startMinutes;
    let endTotalMinutes = endHours * 60 + endMinutes;
    
    // Handle next day scenarios
    if (endTotalMinutes < startTotalMinutes) {
      endTotalMinutes += 24 * 60;
    }
    
    return endTotalMinutes - startTotalMinutes;
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

  // Format time for display
  const formatTime = (timeStr: string): string => {
    if (!timeStr || !timeStr.includes(':')) return 'N/A';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const min = minutes;
    
    if (hour === 0) return `12:${min} AM`;
    if (hour < 12) return `${hour}:${min} AM`;
    if (hour === 12) return `12:${min} PM`;
    return `${hour - 12}:${min} PM`;
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

  const handleFromStopSelect = (stop: Stop) => {
    setFromStopId(stop.stop_id);
    setSearchFromTerm(stop.stop_name);
    setShowFromDropdown(false);
  };

  const handleToStopSelect = (stop: Stop) => {
    setToStopId(stop.stop_id);
    setSearchToTerm(stop.stop_name);
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
            <p className="text-sm text-gray-600">Advanced transfer detection • All stops & routes • Smart connections</p>
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
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {filteredFromStops.map(stop => (
                  <button
                    key={stop.stop_id}
                    onClick={() => handleFromStopSelect(stop)}
                    className={`w-full text-left px-3 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                      fromStopId === stop.stop_id ? 'bg-blue-50 text-blue-900' : ''
                    }`}
                  >
                    <div className="font-medium text-sm">{stop.stop_name}</div>
                    <div className="text-xs text-gray-600">
                      Code: {stop.stop_code} • Zone: {stop.zone_id}
                      {stop.location_type === 1 && <span className="ml-2 text-red-600">• Interchange</span>}
                      <span className="ml-2 text-blue-600">• {getRoutesServingStop(stop.stop_id).length} routes</span>
                    </div>
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
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {filteredToStops.map(stop => (
                  <button
                    key={stop.stop_id}
                    onClick={() => handleToStopSelect(stop)}
                    className={`w-full text-left px-3 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                      toStopId === stop.stop_id ? 'bg-blue-50 text-blue-900' : ''
                    }`}
                  >
                    <div className="font-medium text-sm">{stop.stop_name}</div>
                    <div className="text-xs text-gray-600">
                      Code: {stop.stop_code} • Zone: {stop.zone_id}
                      {stop.location_type === 1 && <span className="ml-2 text-red-600">• Interchange</span>}
                      <span className="ml-2 text-blue-600">• {getRoutesServingStop(stop.stop_id).length} routes</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Departure Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Clock className="w-4 h-4 inline mr-1" />
            Departure Time
          </label>
          <input
            type="time"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {!departureTime && (
            <p className="text-xs text-gray-500 mt-1">Leave empty for current time</p>
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
              Analyzing all transfer options...
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              Find Best Routes
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
              Ranked by best connections
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
                        🚌 Direct
                      </span>
                    )}
                    {journey.transfers > 0 && (
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">
                        🔄 {journey.transfers} Transfer{journey.transfers > 1 ? 's' : ''}
                      </span>
                    )}
                    
                    {/* Enhanced Confidence Badge */}
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      journey.confidence >= 80 ? 'bg-green-100 text-green-800' :
                      journey.confidence >= 60 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {journey.confidence}% reliable
                    </span>

                    {/* Transfer Hub Info */}
                    {journey.transferStops && journey.transferStops.length > 0 && (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
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
                    {journey.totalDistance}km • {journey.walkingTime}m walk
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
                          {journey.transferStops && journey.transferStops.length > 1 && (
                            <span className="text-blue-600">• Walk to {journey.transferStops[1].stop_name}</span>
                          )}
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
                    <div className="text-gray-600">Walking</div>
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
            We couldn't find any routes between these stops with our enhanced search.
          </p>
          <div className="text-sm text-gray-500 space-y-1">
            <p>• ✅ Checked direct routes on all lines</p>
            <p>• ✅ Analyzed {stops.filter(s => s.location_type === 1).length} official interchanges</p>
            <p>• ✅ Searched high-traffic transfer hubs</p>
            <p>• ✅ Considered nearby stop connections</p>
            <p>• 💡 Try different departure times or nearby stops</p>
          </div>
        </div>
      )}

      {/* Enhanced Instructions */}
      {journeyResults.length === 0 && !fromStopId && !toStopId && (
        <div className="text-center py-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
          <Navigation className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">🚌 Advanced Journey Planning</h3>
          <p className="text-gray-600 mb-4">
            Enhanced transfer detection finds connections between any stops in Madrid's bus network.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900">🔍 Enhanced Features:</h4>
              <p>• 🏢 Official interchange detection</p>
              <p>• 🔄 Smart transfer hub analysis</p>
              <p>• 🚶 Walking connection options</p>
              <p>• 📊 Confidence scoring system</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900">🎯 How it works:</h4>
              <p>• Analyzes all {routes.length} bus routes</p>
              <p>• Finds connections via {stops.filter(s => s.location_type === 1).length} interchanges</p>
              <p>• Considers {stops.filter(s => getRoutesServingStop(s.stop_id).length >= 3).length} high-traffic hubs</p>
              <p>• Optimizes for time and reliability</p>
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