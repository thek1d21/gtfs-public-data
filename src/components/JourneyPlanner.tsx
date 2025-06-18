import React, { useState, useMemo } from 'react';
import { Stop, Route, Trip, StopTime } from '../types/gtfs';
import { MapPin, Navigation, Clock, ArrowRight, Bus, AlertCircle, CheckCircle, Route as RouteIcon } from 'lucide-react';

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
    fromStop: Stop;
    toStop: Stop;
    departureTime: string;
    arrivalTime: string;
    duration: number;
    stops: Stop[];
  }>;
  totalDuration: number;
  totalDistance: number;
  transfers: number;
  walkingTime: number;
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

  // Filter stops based on search terms
  const filteredFromStops = useMemo(() => {
    return stops.filter(stop => 
      stop.stop_name.toLowerCase().includes(searchFromTerm.toLowerCase()) ||
      stop.stop_code.toLowerCase().includes(searchFromTerm.toLowerCase())
    ).slice(0, 10);
  }, [stops, searchFromTerm]);

  const filteredToStops = useMemo(() => {
    return stops.filter(stop => 
      stop.stop_name.toLowerCase().includes(searchToTerm.toLowerCase()) ||
      stop.stop_code.toLowerCase().includes(searchToTerm.toLowerCase())
    ).slice(0, 10);
  }, [stops, searchToTerm]);

  // Get current time as default
  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  // Calculate journey options
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

      // Find direct routes (same route serves both stops)
      const directRoutes = findDirectRoutes(fromStop, toStop);
      
      // Find routes with one transfer
      const transferRoutes = findTransferRoutes(fromStop, toStop);
      
      // Combine and sort results
      const allJourneys = [...directRoutes, ...transferRoutes]
        .sort((a, b) => a.totalDuration - b.totalDuration)
        .slice(0, 5); // Show top 5 options

      setJourneyResults(allJourneys);
    } catch (error) {
      console.error('Error planning journey:', error);
    } finally {
      setIsPlanning(false);
    }
  };

  // Find direct routes between two stops
  const findDirectRoutes = (fromStop: Stop, toStop: Stop): JourneyResult[] => {
    const results: JourneyResult[] = [];
    const searchTime = departureTime || getCurrentTime();

    // Get all routes that serve both stops
    const fromStopTimes = stopTimes.filter(st => st.stop_id === fromStop.stop_id);
    const toStopTimes = stopTimes.filter(st => st.stop_id === toStop.stop_id);

    // Find common trips
    const commonTripIds = fromStopTimes
      .map(st => st.trip_id)
      .filter(tripId => toStopTimes.some(st => st.trip_id === tripId));

    const routeJourneys = new Map<string, any>();

    commonTripIds.forEach(tripId => {
      const trip = trips.find(t => t.trip_id === tripId);
      if (!trip) return;

      const route = routes.find(r => r.route_id === trip.route_id);
      if (!route) return;

      const fromStopTime = fromStopTimes.find(st => st.trip_id === tripId);
      const toStopTime = toStopTimes.find(st => st.trip_id === tripId);

      if (!fromStopTime || !toStopTime || !fromStopTime.departure_time || !toStopTime.arrival_time) return;

      // Check if this is the correct direction (from stop should come before to stop)
      if (fromStopTime.stop_sequence >= toStopTime.stop_sequence) return;

      // Check if departure time is after search time
      if (fromStopTime.departure_time < searchTime) return;

      const duration = calculateTimeDifference(fromStopTime.departure_time, toStopTime.arrival_time);
      
      if (!routeJourneys.has(route.route_id) || 
          fromStopTime.departure_time < routeJourneys.get(route.route_id).departureTime) {
        
        // Get intermediate stops
        const intermediateStops = getIntermediateStops(tripId, fromStopTime.stop_sequence, toStopTime.stop_sequence);
        
        routeJourneys.set(route.route_id, {
          route,
          fromStop,
          toStop,
          departureTime: fromStopTime.departure_time,
          arrivalTime: toStopTime.arrival_time,
          duration,
          stops: [fromStop, ...intermediateStops, toStop]
        });
      }
    });

    // Convert to journey results
    Array.from(routeJourneys.values()).forEach((routeJourney, index) => {
      results.push({
        id: `direct-${routeJourney.route.route_id}-${index}`,
        fromStop,
        toStop,
        routes: [routeJourney],
        totalDuration: routeJourney.duration,
        totalDistance: calculateDistance(fromStop, toStop),
        transfers: 0,
        walkingTime: 0
      });
    });

    return results;
  };

  // Find routes with transfers
  const findTransferRoutes = (fromStop: Stop, toStop: Stop): JourneyResult[] => {
    const results: JourneyResult[] = [];
    const searchTime = departureTime || getCurrentTime();

    // Find potential transfer stops (interchanges and major stops)
    const transferStops = stops.filter(stop => 
      stop.location_type === 1 || // Interchanges
      (stop.stop_id !== fromStop.stop_id && stop.stop_id !== toStop.stop_id &&
       calculateDistance(fromStop, stop) < 10 && calculateDistance(stop, toStop) < 10)
    ).slice(0, 10); // Limit transfer options

    transferStops.forEach(transferStop => {
      // Find route from origin to transfer stop
      const firstLeg = findDirectRoutes(fromStop, transferStop);
      
      if (firstLeg.length === 0) return;

      // Find route from transfer stop to destination
      const secondLeg = findDirectRoutes(transferStop, toStop);
      
      if (secondLeg.length === 0) return;

      // Combine legs with reasonable transfer time
      firstLeg.forEach(leg1 => {
        secondLeg.forEach(leg2 => {
          const transferTime = 10; // 10 minutes transfer time
          const leg1Arrival = leg1.routes[0].arrivalTime;
          const leg2Departure = leg2.routes[0].departureTime;
          
          const timeDiff = calculateTimeDifference(leg1Arrival, leg2Departure);
          
          if (timeDiff >= transferTime && timeDiff <= 60) { // Reasonable transfer window
            const totalDuration = leg1.totalDuration + leg2.totalDuration + transferTime;
            
            results.push({
              id: `transfer-${leg1.routes[0].route.route_id}-${leg2.routes[0].route.route_id}`,
              fromStop,
              toStop,
              routes: [leg1.routes[0], leg2.routes[0]],
              totalDuration,
              totalDistance: leg1.totalDistance + leg2.totalDistance,
              transfers: 1,
              walkingTime: transferTime
            });
          }
        });
      });
    });

    return results.slice(0, 3); // Limit transfer options
  };

  // Get intermediate stops for a trip segment
  const getIntermediateStops = (tripId: string, fromSequence: number, toSequence: number): Stop[] => {
    const tripStopTimes = stopTimes
      .filter(st => st.trip_id === tripId && st.stop_sequence > fromSequence && st.stop_sequence < toSequence)
      .sort((a, b) => a.stop_sequence - b.stop_sequence);

    return tripStopTimes
      .map(st => stops.find(stop => stop.stop_id === st.stop_id))
      .filter(Boolean) as Stop[];
  };

  // Calculate time difference in minutes
  const calculateTimeDifference = (startTime: string, endTime: string): number => {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    
    return endTotalMinutes - startTotalMinutes;
  };

  // Calculate distance between stops (simplified)
  const calculateDistance = (stop1: Stop, stop2: Stop): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (stop2.stop_lat - stop1.stop_lat) * Math.PI / 180;
    const dLon = (stop2.stop_lon - stop1.stop_lon) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(stop1.stop_lat * Math.PI / 180) * Math.cos(stop2.stop_lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 100) / 100; // Round to 2 decimal places
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
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Navigation className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Journey Planner</h3>
            <p className="text-sm text-gray-600">Plan your trip using Madrid's bus network</p>
          </div>
        </div>
        {(fromStopId || toStopId || journeyResults.length > 0) && (
          <button
            onClick={resetPlanner}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Journey Input Form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* From Stop */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin className="w-4 h-4 inline mr-1" />
            From
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchFromTerm}
              onChange={(e) => setSearchFromTerm(e.target.value)}
              placeholder="Search departure stop..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchFromTerm && filteredFromStops.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredFromStops.map(stop => (
                  <button
                    key={stop.stop_id}
                    onClick={() => {
                      setFromStopId(stop.stop_id);
                      setSearchFromTerm(stop.stop_name);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                      fromStopId === stop.stop_id ? 'bg-blue-50 text-blue-900' : ''
                    }`}
                  >
                    <div className="font-medium text-sm">{stop.stop_name}</div>
                    <div className="text-xs text-gray-600">Code: {stop.stop_code} • Zone: {stop.zone_id}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* To Stop */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin className="w-4 h-4 inline mr-1" />
            To
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchToTerm}
              onChange={(e) => setSearchToTerm(e.target.value)}
              placeholder="Search destination stop..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchToTerm && filteredToStops.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredToStops.map(stop => (
                  <button
                    key={stop.stop_id}
                    onClick={() => {
                      setToStopId(stop.stop_id);
                      setSearchToTerm(stop.stop_name);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                      toStopId === stop.stop_id ? 'bg-blue-50 text-blue-900' : ''
                    }`}
                  >
                    <div className="font-medium text-sm">{stop.stop_name}</div>
                    <div className="text-xs text-gray-600">Code: {stop.stop_code} • Zone: {stop.zone_id}</div>
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

      {/* Journey Results */}
      {journeyResults.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <RouteIcon className="w-5 h-5" />
            Journey Options ({journeyResults.length})
          </h4>
          
          {journeyResults.map((journey, index) => (
            <div
              key={journey.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedJourney?.id === journey.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
              onClick={() => handleJourneySelect(journey)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-bold text-gray-900">
                      Option {index + 1}
                    </span>
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
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-600">
                    {formatDuration(journey.totalDuration)}
                  </div>
                  <div className="text-xs text-gray-600">
                    {journey.totalDistance}km
                  </div>
                </div>
              </div>

              {/* Route Details */}
              <div className="space-y-3">
                {journey.routes.map((routeSegment, segmentIndex) => (
                  <div key={segmentIndex}>
                    {segmentIndex > 0 && (
                      <div className="flex items-center justify-center py-2">
                        <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                          <ArrowRight className="w-3 h-3" />
                          Transfer ({journey.walkingTime}min walk)
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

              {/* Journey Summary */}
              <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-4">
                  <span>Departure: {formatTime(journey.routes[0].departureTime)}</span>
                  <span>Arrival: {formatTime(journey.routes[journey.routes.length - 1].arrivalTime)}</span>
                </div>
                {selectedJourney?.id === journey.id && (
                  <div className="flex items-center gap-1 text-blue-600">
                    <CheckCircle className="w-3 h-3" />
                    <span className="font-medium">Selected</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Results Message */}
      {!isPlanning && journeyResults.length === 0 && fromStopId && toStopId && (
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Routes Found</h3>
          <p className="text-gray-600 mb-4">
            We couldn't find any direct routes or reasonable connections between these stops.
          </p>
          <p className="text-sm text-gray-500">
            Try selecting different stops or check if both stops are served by the bus network.
          </p>
        </div>
      )}

      {/* Instructions */}
      {journeyResults.length === 0 && !fromStopId && !toStopId && (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Navigation className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Plan Your Journey</h3>
          <p className="text-gray-600 mb-4">
            Enter your departure and destination stops to find the best routes.
          </p>
          <div className="text-sm text-gray-500 space-y-1">
            <p>• Search by stop name or code</p>
            <p>• Set your preferred departure time</p>
            <p>• Get direct routes and transfer options</p>
            <p>• View real-time schedules and durations</p>
          </div>
        </div>
      )}
    </div>
  );
};