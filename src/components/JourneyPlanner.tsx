import React, { useState, useMemo } from 'react';
import { Stop, Route, Trip, StopTime } from '../types/gtfs';
import { MapPin, Navigation, Clock, ArrowRight, Bus, AlertCircle, CheckCircle, Router as RouteIcon, Search, X } from 'lucide-react';

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

  // Enhanced journey planning with better algorithm
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

      console.log('Planning journey from:', fromStop.stop_name, 'to:', toStop.stop_name);

      // Find all possible routes
      const directRoutes = await findDirectRoutes(fromStop, toStop);
      const transferRoutes = await findTransferRoutes(fromStop, toStop);
      
      // Combine and rank results
      const allJourneys = [...directRoutes, ...transferRoutes]
        .filter(journey => journey.routes.length > 0)
        .sort((a, b) => {
          // Sort by confidence first, then by duration
          if (a.confidence !== b.confidence) return b.confidence - a.confidence;
          return a.totalDuration - b.totalDuration;
        })
        .slice(0, 8); // Show top 8 options

      console.log('Found journeys:', allJourneys.length);
      setJourneyResults(allJourneys);
    } catch (error) {
      console.error('Error planning journey:', error);
    } finally {
      setIsPlanning(false);
    }
  };

  // Enhanced direct route finding with proper direction handling
  const findDirectRoutes = async (fromStop: Stop, toStop: Stop): Promise<JourneyResult[]> => {
    const results: JourneyResult[] = [];
    const searchTime = departureTime || getCurrentTime();

    // Get all stop times for both stops
    const fromStopTimes = stopTimes.filter(st => st.stop_id === fromStop.stop_id);
    const toStopTimes = stopTimes.filter(st => st.stop_id === toStop.stop_id);

    console.log(`From stop ${fromStop.stop_name}: ${fromStopTimes.length} stop times`);
    console.log(`To stop ${toStop.stop_name}: ${toStopTimes.length} stop times`);

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

    console.log(`Found ${tripConnections.size} direct connections`);

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

  // Enhanced transfer route finding
  const findTransferRoutes = async (fromStop: Stop, toStop: Stop): Promise<JourneyResult[]> => {
    const results: JourneyResult[] = [];
    const searchTime = departureTime || getCurrentTime();

    // Find potential transfer hubs
    const transferHubs = stops.filter(stop => 
      stop.location_type === 1 || // Official interchanges
      (stop.stop_id !== fromStop.stop_id && 
       stop.stop_id !== toStop.stop_id &&
       isLikelyTransferHub(stop))
    ).slice(0, 20); // Limit to top 20 potential hubs

    console.log(`Checking ${transferHubs.length} potential transfer hubs`);

    for (const hub of transferHubs) {
      try {
        // Find routes from origin to hub
        const firstLeg = await findDirectRoutes(fromStop, hub);
        if (firstLeg.length === 0) continue;

        // Find routes from hub to destination
        const secondLeg = await findDirectRoutes(hub, toStop);
        if (secondLeg.length === 0) continue;

        // Combine compatible legs
        firstLeg.forEach(leg1 => {
          secondLeg.forEach(leg2 => {
            const transferTime = calculateTransferTime(hub);
            const leg1Arrival = leg1.routes[0].arrivalTime;
            const leg2Departure = leg2.routes[0].departureTime;
            
            const waitTime = calculateTimeDifference(leg1Arrival, leg2Departure);
            
            // Check if transfer is feasible (5-90 minutes)
            if (waitTime >= transferTime && waitTime <= 90) {
              const totalDuration = leg1.totalDuration + leg2.totalDuration + waitTime;
              
              // Avoid very long journeys
              if (totalDuration < 240) { // Less than 4 hours
                results.push({
                  id: `transfer-${leg1.routes[0].route.route_id}-${leg2.routes[0].route.route_id}-${hub.stop_id}`,
                  fromStop,
                  toStop,
                  routes: [leg1.routes[0], leg2.routes[0]],
                  totalDuration,
                  totalDistance: leg1.totalDistance + leg2.totalDistance,
                  transfers: 1,
                  walkingTime: transferTime,
                  confidence: Math.max(20, 80 - waitTime) // Lower confidence for longer waits
                });
              }
            }
          });
        });
      } catch (error) {
        console.error(`Error processing transfer hub ${hub.stop_name}:`, error);
      }
    }

    return results.slice(0, 5); // Limit transfer options
  };

  // Check if a stop is likely a transfer hub
  const isLikelyTransferHub = (stop: Stop): boolean => {
    const stopRoutes = getRoutesServingStop(stop.stop_id);
    return stopRoutes.length >= 3; // Served by 3+ routes
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
    return 10; // Regular stop - 10 minutes
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
            <p className="text-sm text-gray-600">Plan your trip using Madrid's complete bus network</p>
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
            <ArrowRight className="w-4 h-4 transform rotate-90" />
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
              Planning Journey...
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              Plan Journey
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
              Sorted by best options first
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
                    
                    {/* Journey Type Badges */}
                    {journey.transfers === 0 && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                        Direct
                      </span>
                    )}
                    {journey.transfers > 0 && (
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">
                        {journey.transfers} Transfer{journey.transfers > 1 ? 's' : ''}
                      </span>
                    )}
                    
                    {/* Confidence Badge */}
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      journey.confidence >= 80 ? 'bg-green-100 text-green-800' :
                      journey.confidence >= 60 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {journey.confidence}% confidence
                    </span>
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
                    <span>Departure: {formatTime(journey.routes[0].departureTime)}</span>
                    <span>Arrival: {formatTime(journey.routes[journey.routes.length - 1].arrivalTime)}</span>
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
            We couldn't find any routes between these stops at the specified time.
          </p>
          <div className="text-sm text-gray-500 space-y-1">
            <p>• Try a different departure time</p>
            <p>• Check if both stops are served by the bus network</p>
            <p>• Consider nearby stops as alternatives</p>
            <p>• Some routes may not operate at certain times</p>
          </div>
        </div>
      )}

      {/* Enhanced Instructions */}
      {journeyResults.length === 0 && !fromStopId && !toStopId && (
        <div className="text-center py-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
          <Navigation className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Enhanced Journey Planning</h3>
          <p className="text-gray-600 mb-4">
            Plan your trip using Madrid's complete bus network with all stops and routes.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900">Features:</h4>
              <p>• Search all {stops.length.toLocaleString()} bus stops</p>
              <p>• Direct routes and transfer options</p>
              <p>• Inbound/Outbound direction handling</p>
              <p>• Real-time schedule integration</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900">How to use:</h4>
              <p>• Type stop name, code, or ID to search</p>
              <p>• Set departure time or use current time</p>
              <p>• Get ranked journey options</p>
              <p>• Click to highlight route on map</p>
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