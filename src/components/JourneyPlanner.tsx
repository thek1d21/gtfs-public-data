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

// NEW: Stop consolidation interface for handling direction-specific stops
interface ConsolidatedStop {
  baseLocation: string; // Base name without direction indicators
  physicalStops: Stop[]; // All stops at this physical location
  coordinates: { lat: number; lon: number }; // Average coordinates
  zone: string;
  accessibility: number;
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

  // NEW: Consolidate stops by physical location
  const consolidatedStops = useMemo(() => {
    const stopGroups = new Map<string, Stop[]>();
    
    stops.forEach(stop => {
      // Create base location key by removing direction indicators and normalizing
      let baseLocation = stop.stop_name
        .replace(/\s*-\s*(IDA|VUELTA|INBOUND|OUTBOUND|A|B|1|2)$/i, '') // Remove direction suffixes
        .replace(/\s*\((IDA|VUELTA|INBOUND|OUTBOUND|A|B|1|2)\)$/i, '') // Remove direction in parentheses
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim()
        .toUpperCase();
      
      // Also check for stops with very similar coordinates (within 50m)
      let foundGroup = false;
      for (const [existingBase, existingStops] of stopGroups.entries()) {
        const avgLat = existingStops.reduce((sum, s) => sum + s.stop_lat, 0) / existingStops.length;
        const avgLon = existingStops.reduce((sum, s) => sum + s.stop_lon, 0) / existingStops.length;
        
        const distance = calculateDistance(
          { stop_lat: avgLat, stop_lon: avgLon } as Stop,
          stop
        );
        
        // If within 50m and similar name, group together
        if (distance < 0.05 && (
          existingBase.includes(baseLocation.substring(0, 10)) || 
          baseLocation.includes(existingBase.substring(0, 10))
        )) {
          existingStops.push(stop);
          foundGroup = true;
          break;
        }
      }
      
      if (!foundGroup) {
        if (!stopGroups.has(baseLocation)) {
          stopGroups.set(baseLocation, []);
        }
        stopGroups.get(baseLocation)!.push(stop);
      }
    });

    // Convert to consolidated stops
    const consolidated: ConsolidatedStop[] = [];
    stopGroups.forEach((physicalStops, baseLocation) => {
      if (physicalStops.length > 0) {
        const avgLat = physicalStops.reduce((sum, s) => sum + s.stop_lat, 0) / physicalStops.length;
        const avgLon = physicalStops.reduce((sum, s) => sum + s.stop_lon, 0) / physicalStops.length;
        const bestAccessibility = Math.max(...physicalStops.map(s => s.wheelchair_boarding));
        
        consolidated.push({
          baseLocation,
          physicalStops,
          coordinates: { lat: avgLat, lon: avgLon },
          zone: physicalStops[0].zone_id,
          accessibility: bestAccessibility
        });
      }
    });

    console.log(`🏢 Consolidated ${stops.length} stops into ${consolidated.length} physical locations`);
    return consolidated;
  }, [stops]);

  // Enhanced stop filtering with consolidated stops
  const filteredFromStops = useMemo(() => {
    if (!searchFromTerm || searchFromTerm.length < 2) return [];
    
    const matchingConsolidated = consolidatedStops.filter(consolidated => 
      consolidated.baseLocation.includes(searchFromTerm.toUpperCase()) ||
      consolidated.physicalStops.some(stop => 
        stop.stop_name.toLowerCase().includes(searchFromTerm.toLowerCase()) ||
        stop.stop_code.toLowerCase().includes(searchFromTerm.toLowerCase())
      )
    );

    // Flatten to individual stops but prioritize by consolidated location
    const results: Stop[] = [];
    matchingConsolidated.forEach(consolidated => {
      // Add the "best" stop from each location (prefer interchange, then accessibility)
      const bestStop = consolidated.physicalStops.sort((a, b) => {
        if (a.location_type !== b.location_type) return b.location_type - a.location_type;
        if (a.wheelchair_boarding !== b.wheelchair_boarding) return b.wheelchair_boarding - a.wheelchair_boarding;
        return a.stop_name.length - b.stop_name.length; // Prefer shorter names
      })[0];
      
      results.push(bestStop);
    });

    return results
      .sort((a, b) => {
        const aExact = a.stop_name.toLowerCase().startsWith(searchFromTerm.toLowerCase()) ? 0 : 1;
        const bExact = b.stop_name.toLowerCase().startsWith(searchFromTerm.toLowerCase()) ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        return a.stop_name.length - b.stop_name.length;
      })
      .slice(0, 15);
  }, [consolidatedStops, searchFromTerm]);

  const filteredToStops = useMemo(() => {
    if (!searchToTerm || searchToTerm.length < 2) return [];
    
    const matchingConsolidated = consolidatedStops.filter(consolidated => 
      !consolidated.physicalStops.some(s => s.stop_id === fromStopId) && // Exclude selected from location
      (consolidated.baseLocation.includes(searchToTerm.toUpperCase()) ||
       consolidated.physicalStops.some(stop => 
         stop.stop_name.toLowerCase().includes(searchToTerm.toLowerCase()) ||
         stop.stop_code.toLowerCase().includes(searchToTerm.toLowerCase())
       ))
    );

    const results: Stop[] = [];
    matchingConsolidated.forEach(consolidated => {
      const bestStop = consolidated.physicalStops.sort((a, b) => {
        if (a.location_type !== b.location_type) return b.location_type - a.location_type;
        if (a.wheelchair_boarding !== b.wheelchair_boarding) return b.wheelchair_boarding - a.wheelchair_boarding;
        return a.stop_name.length - b.stop_name.length;
      })[0];
      
      results.push(bestStop);
    });

    return results
      .sort((a, b) => {
        const aExact = a.stop_name.toLowerCase().startsWith(searchToTerm.toLowerCase()) ? 0 : 1;
        const bExact = b.stop_name.toLowerCase().startsWith(searchToTerm.toLowerCase()) ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        return a.stop_name.length - b.stop_name.length;
      })
      .slice(0, 15);
  }, [consolidatedStops, searchToTerm, fromStopId]);

  // Get current time as default
  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  // NEW: Get all physical stops for a given stop (including direction variants)
  const getPhysicalStopsForLocation = (stopId: string): Stop[] => {
    const stop = stops.find(s => s.stop_id === stopId);
    if (!stop) return [stop].filter(Boolean) as Stop[];
    
    const consolidated = consolidatedStops.find(c => 
      c.physicalStops.some(s => s.stop_id === stopId)
    );
    
    return consolidated ? consolidated.physicalStops : [stop];
  };

  // Enhanced journey planning with stop consolidation
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

      console.log('🚌 Enhanced journey planning with stop consolidation');
      console.log(`📍 From: ${fromStop.stop_name} (${fromStop.stop_id})`);
      console.log(`📍 To: ${toStop.stop_name} (${toStop.stop_id})`);

      // Get all physical variants of origin and destination
      const fromPhysicalStops = getPhysicalStopsForLocation(fromStopId);
      const toPhysicalStops = getPhysicalStopsForLocation(toStopId);
      
      console.log(`🏢 From location has ${fromPhysicalStops.length} physical stops`);
      console.log(`🏢 To location has ${toPhysicalStops.length} physical stops`);

      // Find routes using all physical stop combinations
      const allJourneys: JourneyResult[] = [];
      
      // Try direct routes with all combinations
      for (const fromPhysical of fromPhysicalStops) {
        for (const toPhysical of toPhysicalStops) {
          const directRoutes = await findDirectRoutesEnhanced(fromPhysical, toPhysical);
          allJourneys.push(...directRoutes);
        }
      }
      
      console.log(`🎯 Found ${allJourneys.length} direct route combinations`);

      // Try transfer routes with enhanced logic
      const transferRoutes = await findTransferRoutesEnhanced(fromPhysicalStops, toPhysicalStops);
      allJourneys.push(...transferRoutes);
      
      console.log(`🔄 Found ${transferRoutes.length} transfer route combinations`);

      // Remove duplicates and rank results
      const uniqueJourneys = removeDuplicateJourneys(allJourneys)
        .filter(journey => journey.routes.length > 0)
        .sort((a, b) => {
          // Prioritize: confidence, then transfers, then duration
          if (a.confidence !== b.confidence) return b.confidence - a.confidence;
          if (a.transfers !== b.transfers) return a.transfers - b.transfers;
          return a.totalDuration - b.totalDuration;
        })
        .slice(0, 12); // Show top 12 options

      console.log(`✅ Final results: ${uniqueJourneys.length} unique journey options`);
      setJourneyResults(uniqueJourneys);
    } catch (error) {
      console.error('❌ Error in enhanced journey planning:', error);
    } finally {
      setIsPlanning(false);
    }
  };

  // Enhanced direct route finding with better direction handling
  const findDirectRoutesEnhanced = async (fromStop: Stop, toStop: Stop): Promise<JourneyResult[]> => {
    const results: JourneyResult[] = [];
    const searchTime = departureTime || getCurrentTime();

    console.log(`🔍 Searching direct routes: ${fromStop.stop_name} → ${toStop.stop_name}`);

    // Get stop times for both stops
    const fromStopTimes = stopTimes.filter(st => st.stop_id === fromStop.stop_id);
    const toStopTimes = stopTimes.filter(st => st.stop_id === toStop.stop_id);

    // Group by trip to find connections
    const tripConnections = new Map<string, {
      fromStopTime: StopTime;
      toStopTime: StopTime;
      trip: Trip;
      route: Route;
    }>();

    fromStopTimes.forEach(fromST => {
      const toST = toStopTimes.find(toStopTime => 
        toStopTime.trip_id === fromST.trip_id &&
        toStopTime.stop_sequence > fromST.stop_sequence && // Correct sequence
        toStopTime.departure_time && fromST.departure_time &&
        fromST.departure_time >= searchTime // After search time
      );

      if (toST) {
        const trip = trips.find(t => t.trip_id === fromST.trip_id);
        const route = trip ? routes.find(r => r.route_id === trip.route_id) : null;

        if (trip && route) {
          const key = `${route.route_id}-${trip.direction_id}-${trip.trip_id}`;
          tripConnections.set(key, {
            fromStopTime: fromST,
            toStopTime: toST,
            trip,
            route
          });
        }
      }
    });

    console.log(`  📊 Found ${tripConnections.size} direct trip connections`);

    // Convert to journey results
    Array.from(tripConnections.values()).forEach((connection, index) => {
      const duration = calculateTimeDifference(
        connection.fromStopTime.departure_time,
        connection.toStopTime.arrival_time || connection.toStopTime.departure_time
      );

      if (duration > 0 && duration < 300) { // Reasonable duration
        const intermediateStops = getIntermediateStops(
          connection.trip.trip_id,
          connection.fromStopTime.stop_sequence,
          connection.toStopTime.stop_sequence
        );

        const directionLabel = connection.trip.direction_id === 0 ? 'Outbound (Ida)' : 'Inbound (Vuelta)';

        results.push({
          id: `direct-enhanced-${connection.route.route_id}-${connection.trip.direction_id}-${index}`,
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

  // Enhanced transfer route finding with physical stop awareness
  const findTransferRoutesEnhanced = async (fromPhysicalStops: Stop[], toPhysicalStops: Stop[]): Promise<JourneyResult[]> => {
    const results: JourneyResult[] = [];
    
    console.log('🔄 Enhanced transfer search with physical stop consolidation');

    // Find potential transfer hubs
    const transferHubs = await findEnhancedTransferHubs(fromPhysicalStops, toPhysicalStops);
    console.log(`🏢 Found ${transferHubs.length} potential transfer hubs`);

    for (const hub of transferHubs) {
      try {
        // Get all physical stops at this hub location
        const hubPhysicalStops = getPhysicalStopsForLocation(hub.stop_id);
        
        console.log(`🔍 Checking hub: ${hub.stop_name} (${hubPhysicalStops.length} physical stops)`);

        // Try all combinations of origin → hub → destination
        for (const fromStop of fromPhysicalStops) {
          for (const hubStop of hubPhysicalStops) {
            for (const toStop of toPhysicalStops) {
              // Find first leg: origin to hub
              const firstLeg = await findDirectRoutesEnhanced(fromStop, hubStop);
              
              // Find second leg: hub to destination (try all hub physical stops)
              for (const hubExitStop of hubPhysicalStops) {
                const secondLeg = await findDirectRoutesEnhanced(hubExitStop, toStop);
                
                // Create transfer combinations
                firstLeg.forEach(leg1 => {
                  secondLeg.forEach(leg2 => {
                    const transfer = createEnhancedTransfer(leg1, leg2, hubStop, hubExitStop);
                    if (transfer) {
                      results.push(transfer);
                    }
                  });
                });
              }
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error processing hub ${hub.stop_name}:`, error);
      }
    }

    return results;
  };

  // Enhanced transfer hub finding
  const findEnhancedTransferHubs = async (fromPhysicalStops: Stop[], toPhysicalStops: Stop[]): Promise<Stop[]> => {
    const hubs = new Set<Stop>();

    // Strategy 1: Official interchanges
    const interchanges = stops.filter(stop => stop.location_type === 1);
    interchanges.forEach(hub => hubs.add(hub));

    // Strategy 2: High-traffic stops (served by many routes)
    const highTrafficStops = stops.filter(stop => {
      const routeCount = getRoutesServingStop(stop.stop_id).length;
      return routeCount >= 3 && 
             !fromPhysicalStops.some(s => s.stop_id === stop.stop_id) &&
             !toPhysicalStops.some(s => s.stop_id === stop.stop_id);
    });
    highTrafficStops.forEach(hub => hubs.add(hub));

    // Strategy 3: Stops that connect origin and destination networks
    const fromRoutes = new Set<string>();
    const toRoutes = new Set<string>();
    
    fromPhysicalStops.forEach(stop => {
      getRoutesServingStop(stop.stop_id).forEach(route => fromRoutes.add(route.route_id));
    });
    
    toPhysicalStops.forEach(stop => {
      getRoutesServingStop(stop.stop_id).forEach(route => toRoutes.add(route.route_id));
    });

    // Find stops served by routes that connect to both networks
    stops.forEach(stop => {
      const stopRoutes = getRoutesServingStop(stop.stop_id);
      const connectsToOrigin = stopRoutes.some(route => fromRoutes.has(route.route_id));
      const connectsToDestination = stopRoutes.some(route => toRoutes.has(route.route_id));
      
      if (connectsToOrigin && connectsToDestination) {
        hubs.add(stop);
      }
    });

    // Convert to array and sort by potential
    return Array.from(hubs)
      .map(hub => ({
        stop: hub,
        score: calculateEnhancedHubScore(hub, fromPhysicalStops, toPhysicalStops)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30) // Top 30 hubs
      .map(item => item.stop);
  };

  // Enhanced hub scoring
  const calculateEnhancedHubScore = (hub: Stop, fromStops: Stop[], toStops: Stop[]): number => {
    let score = 0;
    
    // Route count bonus
    const routeCount = getRoutesServingStop(hub.stop_id).length;
    score += routeCount * 15;
    
    // Official interchange bonus
    if (hub.location_type === 1) score += 100;
    
    // Physical stop consolidation bonus
    const hubPhysicalStops = getPhysicalStopsForLocation(hub.stop_id);
    score += hubPhysicalStops.length * 20; // More physical stops = better transfer hub
    
    // Geographic position bonus
    const avgFromLat = fromStops.reduce((sum, s) => sum + s.stop_lat, 0) / fromStops.length;
    const avgFromLon = fromStops.reduce((sum, s) => sum + s.stop_lon, 0) / fromStops.length;
    const avgToLat = toStops.reduce((sum, s) => sum + s.stop_lat, 0) / toStops.length;
    const avgToLon = toStops.reduce((sum, s) => sum + s.stop_lon, 0) / toStops.length;
    
    const fromDistance = calculateDistance({ stop_lat: avgFromLat, stop_lon: avgFromLon } as Stop, hub);
    const toDistance = calculateDistance({ stop_lat: avgToLat, stop_lon: avgToLon } as Stop, hub);
    const directDistance = calculateDistance(
      { stop_lat: avgFromLat, stop_lon: avgFromLon } as Stop,
      { stop_lat: avgToLat, stop_lon: avgToLon } as Stop
    );
    
    const detourFactor = (fromDistance + toDistance) / Math.max(directDistance, 0.1);
    if (detourFactor < 2.0) score += 50; // Reasonable detour
    if (detourFactor < 1.5) score += 30; // Good detour
    
    // Accessibility bonus
    if (hub.wheelchair_boarding === 1) score += 25;
    
    return score;
  };

  // Enhanced transfer creation with physical stop awareness
  const createEnhancedTransfer = (
    leg1: JourneyResult, 
    leg2: JourneyResult, 
    hubEntryStop: Stop, 
    hubExitStop: Stop
  ): JourneyResult | null => {
    try {
      const leg1Route = leg1.routes[0];
      const leg2Route = leg2.routes[0];
      
      // Calculate transfer time (consider if it's the same physical stop or requires walking)
      const transferTime = hubEntryStop.stop_id === hubExitStop.stop_id ? 
        calculateTransferTime(hubEntryStop) : // Same stop transfer
        calculateWalkingTime(hubEntryStop, hubExitStop); // Walking transfer
      
      const waitTime = calculateTimeDifference(
        leg1Route.arrivalTime,
        leg2Route.departureTime
      );
      
      // Validate transfer feasibility
      if (waitTime >= transferTime && waitTime <= 60) { // 1-60 minute transfer window
        const totalDuration = leg1.totalDuration + leg2.totalDuration + waitTime;
        
        if (totalDuration < 360) { // Less than 6 hours total
          return {
            id: `enhanced-transfer-${leg1Route.route.route_id}-${leg2Route.route.route_id}-${hubEntryStop.stop_id}-${hubExitStop.stop_id}`,
            fromStop: leg1.fromStop,
            toStop: leg2.toStop,
            routes: [
              {
                ...leg1Route,
                toStop: hubEntryStop
              },
              {
                ...leg2Route,
                fromStop: hubExitStop
              }
            ],
            totalDuration,
            totalDistance: leg1.totalDistance + leg2.totalDistance + 
              (hubEntryStop.stop_id !== hubExitStop.stop_id ? calculateDistance(hubEntryStop, hubExitStop) : 0),
            transfers: 1,
            walkingTime: transferTime,
            confidence: Math.max(60, 95 - waitTime - (transferTime > 5 ? 10 : 0)), // Penalize walking transfers
            transferStops: hubEntryStop.stop_id === hubExitStop.stop_id ? [hubEntryStop] : [hubEntryStop, hubExitStop]
          };
        }
      }
    } catch (error) {
      console.error('Error creating enhanced transfer:', error);
    }
    
    return null;
  };

  // Calculate walking time between stops
  const calculateWalkingTime = (stop1: Stop, stop2: Stop): number => {
    const distance = calculateDistance(stop1, stop2);
    return Math.max(5, Math.ceil(distance * 12)); // Minimum 5 minutes, ~12 min per km
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

  // Remove duplicate journeys
  const removeDuplicateJourneys = (journeys: JourneyResult[]): JourneyResult[] => {
    const seen = new Set<string>();
    return journeys.filter(journey => {
      const key = `${journey.fromStop.stop_id}-${journey.toStop.stop_id}-${journey.routes.map(r => `${r.route.route_id}-${r.direction}`).join('-')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
            <h3 className="text-lg font-semibold text-gray-900">🚌 Smart Journey Planner</h3>
            <p className="text-sm text-gray-600">Direction-aware • Stop consolidation • Physical location matching</p>
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
                {filteredFromStops.map(stop => {
                  const physicalStops = getPhysicalStopsForLocation(stop.stop_id);
                  return (
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
                        {physicalStops.length > 1 && (
                          <span className="ml-2 text-purple-600">• {physicalStops.length} platforms</span>
                        )}
                      </div>
                    </button>
                  );
                })}
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
                {filteredToStops.map(stop => {
                  const physicalStops = getPhysicalStopsForLocation(stop.stop_id);
                  return (
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
                        {physicalStops.length > 1 && (
                          <span className="ml-2 text-purple-600">• {physicalStops.length} platforms</span>
                        )}
                      </div>
                    </button>
                  );
                })}
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
              Smart routing with stop consolidation...
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              Find Smart Routes
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
              Smart Journey Options ({journeyResults.length})
            </h4>
            <div className="text-sm text-gray-600">
              🧠 Direction-aware • 🏢 Stop consolidation
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

                    {/* Walking Transfer Indicator */}
                    {journey.walkingTime > 8 && (
                      <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full font-medium">
                        🚶 {journey.walkingTime}m walk
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-600">
                    {formatDuration(journey.totalDuration)}
                  </div>
                  <div className="text-xs text-gray-600">
                    {journey.totalDistance}km total
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
            Our smart routing couldn't find connections between these locations.
          </p>
          <div className="text-sm text-gray-500 space-y-1">
            <p>• ✅ Checked all direction combinations</p>
            <p>• ✅ Analyzed {consolidatedStops.length} physical locations</p>
            <p>• ✅ Searched {stops.filter(s => s.location_type === 1).length} official interchanges</p>
            <p>• ✅ Considered walking transfers between platforms</p>
            <p>• 💡 Try different departure times or nearby stops</p>
          </div>
        </div>
      )}

      {/* Enhanced Instructions */}
      {journeyResults.length === 0 && !fromStopId && !toStopId && (
        <div className="text-center py-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
          <Navigation className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">🧠 Smart Journey Planning</h3>
          <p className="text-gray-600 mb-4">
            Advanced stop consolidation handles direction-specific stops and finds the fastest routes.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900">🚀 Smart Features:</h4>
              <p>• 🏢 Physical stop consolidation</p>
              <p>• 🔄 Direction-aware routing</p>
              <p>• 🚶 Walking transfer detection</p>
              <p>• 📊 Confidence scoring system</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900">🎯 How it works:</h4>
              <p>• Groups {stops.length} stops into {consolidatedStops.length} locations</p>
              <p>• Handles inbound/outbound platforms</p>
              <p>• Finds optimal transfer points</p>
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