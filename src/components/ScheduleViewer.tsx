import React, { useState, useMemo } from 'react';
import { StopTime, Trip, Stop, Route } from '../types/gtfs';
import { Clock, Calendar, Filter, Search, MapPin, Bus, ArrowRight, AlertCircle, Navigation, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface ScheduleViewerProps {
  stopTimes: StopTime[];
  trips: Trip[];
  stops: Stop[];
  routes: Route[];
}

export const ScheduleViewer: React.FC<ScheduleViewerProps> = ({
  stopTimes,
  trips,
  stops,
  routes
}) => {
  const [selectionType, setSelectionType] = useState<'route' | 'stop' | null>(null);
  const [selectedStop, setSelectedStop] = useState<string>('');
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [selectedDirection, setSelectedDirection] = useState<number | null>(null);
  const [timeFilter, setTimeFilter] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // FIXED: Move getFinalDestination function declaration to the top
  const getFinalDestination = (directionTrips: Trip[], direction: number): string => {
    if (directionTrips.length === 0) return 'Unknown destination';

    try {
      const sampleTrip = directionTrips[0];
      const tripStopTimes = stopTimes
        .filter(st => st.trip_id === sampleTrip.trip_id)
        .sort((a, b) => a.stop_sequence - b.stop_sequence);

      if (tripStopTimes.length === 0) return 'Unknown destination';

      const finalStopTime = tripStopTimes[tripStopTimes.length - 1];
      const finalStop = stops.find(s => s.stop_id === finalStopTime.stop_id);

      if (!finalStop) return 'Unknown destination';

      let destination = finalStop.stop_name
        .replace(/^(CTRA\.|AV\.|AVDA\.|PLAZA|PZA\.|C\/|CALLE)/i, '')
        .replace(/-(URB\.|URBANIZACIÓN|COL\.|COLONIA)/i, '')
        .trim();

      if (destination.length > 30) {
        const parts = destination.split('-');
        destination = parts[0].trim();
      }

      return destination || 'Terminal';
    } catch (error) {
      return 'Unknown destination';
    }
  };

  // Filter stops and routes for search
  const filteredStops = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return stops.slice(0, 50);
    
    return stops.filter(stop => 
      stop.stop_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stop.stop_code.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 50);
  }, [stops, searchTerm]);

  const filteredRoutes = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return routes;
    
    return routes.filter(route =>
      route.route_short_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.route_long_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [routes, searchTerm]);

  // Get available directions for selected route or stop
  const availableDirections = useMemo(() => {
    if (!selectedRoute && !selectedStop) return [];

    let relevantTrips: Trip[] = [];

    if (selectedRoute) {
      relevantTrips = trips.filter(trip => trip.route_id === selectedRoute);
    } else if (selectedStop) {
      const stopTripIds = stopTimes
        .filter(st => st.stop_id === selectedStop)
        .map(st => st.trip_id);
      relevantTrips = trips.filter(trip => stopTripIds.includes(trip.trip_id));
    }

    const directions = [...new Set(relevantTrips.map(trip => trip.direction_id))];
    
    return directions.map(direction => {
      const directionTrips = relevantTrips.filter(trip => trip.direction_id === direction);
      const directionLabel = direction === 0 ? 'Outbound (Ida)' : 'Inbound (Vuelta)';
      const finalDestination = getFinalDestination(directionTrips, direction);
      
      return {
        direction,
        label: directionLabel,
        finalDestination,
        tripCount: directionTrips.length
      };
    }).sort((a, b) => a.direction - b.direction);
  }, [selectedRoute, selectedStop, trips, stopTimes, getFinalDestination]);

  // Only process schedule data when all selections are made (including direction)
  const scheduleData = useMemo(() => {
    // Don't process any data until user makes all selections including direction
    if (!selectionType || (!selectedStop && !selectedRoute) || selectedDirection === null) {
      return [];
    }

    let filteredStopTimes = stopTimes;

    // Filter by stop
    if (selectionType === 'stop' && selectedStop) {
      filteredStopTimes = filteredStopTimes.filter(st => st.stop_id === selectedStop);
    }

    // Filter by route
    if (selectionType === 'route' && selectedRoute) {
      const routeTrips = trips.filter(trip => trip.route_id === selectedRoute);
      const routeTripIds = routeTrips.map(trip => trip.trip_id);
      filteredStopTimes = filteredStopTimes.filter(st => routeTripIds.includes(st.trip_id));
    }

    // CRITICAL: Filter by direction
    const directionTrips = trips.filter(trip => trip.direction_id === selectedDirection);
    const directionTripIds = directionTrips.map(trip => trip.trip_id);
    filteredStopTimes = filteredStopTimes.filter(st => directionTripIds.includes(st.trip_id));

    // Filter by time
    if (timeFilter !== 'all') {
      filteredStopTimes = filteredStopTimes.filter(st => {
        if (!st.departure_time) return false;
        const hour = parseInt(st.departure_time.split(':')[0]);
        switch (timeFilter) {
          case 'morning': return hour >= 6 && hour < 12;
          case 'afternoon': return hour >= 12 && hour < 18;
          case 'evening': return hour >= 18 && hour < 24;
          default: return true;
        }
      });
    }

    // Group by stop and route
    const grouped = filteredStopTimes.reduce((acc, st) => {
      const trip = trips.find(t => t.trip_id === st.trip_id);
      const stop = stops.find(s => s.stop_id === st.stop_id);
      const route = routes.find(r => r.route_id === trip?.route_id);

      if (!trip || !stop || !route || trip.direction_id !== selectedDirection) return acc;

      const key = `${st.stop_id}-${trip.route_id}-${trip.direction_id}`;
      if (!acc[key]) {
        acc[key] = {
          stop,
          route,
          trip,
          direction: trip.direction_id,
          times: []
        };
      }

      acc[key].times.push({
        arrival: st.arrival_time,
        departure: st.departure_time,
        sequence: st.stop_sequence,
        headsign: st.stop_headsign || trip.trip_headsign,
        direction: trip.direction_id
      });

      return acc;
    }, {} as Record<string, any>);

    // Sort times for each group
    Object.values(grouped).forEach((group: any) => {
      group.times.sort((a: any, b: any) => {
        if (!a.departure || !b.departure) return 0;
        return a.departure.localeCompare(b.departure);
      });
    });

    return Object.values(grouped);
  }, [stopTimes, trips, stops, routes, selectedStop, selectedRoute, selectedDirection, timeFilter, selectionType]);

  const formatTime = (timeStr: string): string => {
    if (!timeStr || !timeStr.includes(':')) return 'N/A';
    const [hours, minutes] = timeStr.split(':');
    let hour = parseInt(hours);
    const min = minutes;
    
    // Handle next-day times (24+ hours)
    if (hour >= 24) {
      hour = hour - 24;
    }
    
    if (hour === 0) return `12:${min} AM`;
    if (hour < 12) return `${hour}:${min} AM`;
    if (hour === 12) return `12:${min} PM`;
    return `${hour - 12}:${min} PM`;
  };

  const resetSelection = () => {
    setSelectionType(null);
    setSelectedStop('');
    setSelectedRoute('');
    setSelectedDirection(null);
    setSearchTerm('');
    setTimeFilter('all');
  };

  const getSelectedItemName = () => {
    if (selectionType === 'stop' && selectedStop) {
      const stop = stops.find(s => s.stop_id === selectedStop);
      return stop?.stop_name || 'Unknown Stop';
    }
    if (selectionType === 'route' && selectedRoute) {
      const route = routes.find(r => r.route_id === selectedRoute);
      return `Route ${route?.route_short_name} - ${route?.route_long_name}` || 'Unknown Route';
    }
    return '';
  };

  const getSelectedDirectionInfo = () => {
    if (selectedDirection === null) return null;
    const directionInfo = availableDirections.find(d => d.direction === selectedDirection);
    return directionInfo;
  };

  return (
    <div className="space-y-6">
      {/* Selection Type Chooser */}
      {!selectionType && (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
          <div className="text-center mb-8">
            <Clock className="w-16 h-16 text-madrid-primary mx-auto mb-4" />
            <h3 className="text-2xl font-semibold text-gray-900 mb-2">Schedule Viewer</h3>
            <p className="text-gray-600 max-w-2xl mx-auto">
              View detailed bus schedules and departure times. Choose how you want to explore the schedules:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Route Selection Option */}
            <button
              onClick={() => setSelectionType('route')}
              className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-xl border border-blue-200 hover:border-blue-300 transition-all group"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-blue-100 group-hover:bg-blue-200 rounded-lg transition-colors">
                  <Bus className="w-8 h-8 text-blue-600" />
                </div>
                <div className="text-left">
                  <h4 className="text-xl font-semibold text-blue-900">Browse by Route</h4>
                  <p className="text-blue-700">Select a specific bus route</p>
                </div>
              </div>
              <div className="text-left space-y-2 text-sm text-blue-800">
                <p>• View all stops served by a route</p>
                <p>• Choose inbound or outbound direction</p>
                <p>• See departure times for each stop</p>
                <p>• Perfect for route planning</p>
              </div>
              <div className="mt-4 text-right">
                <span className="text-sm font-medium text-blue-600">
                  {routes.length} routes available →
                </span>
              </div>
            </button>

            {/* Stop Selection Option */}
            <button
              onClick={() => setSelectionType('stop')}
              className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 rounded-xl border border-green-200 hover:border-green-300 transition-all group"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-green-100 group-hover:bg-green-200 rounded-lg transition-colors">
                  <MapPin className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-left">
                  <h4 className="text-xl font-semibold text-green-900">Browse by Stop</h4>
                  <p className="text-green-700">Select a specific bus stop</p>
                </div>
              </div>
              <div className="text-left space-y-2 text-sm text-green-800">
                <p>• View all routes serving a stop</p>
                <p>• Choose direction for each route</p>
                <p>• See next departures by direction</p>
                <p>• Perfect for departure planning</p>
              </div>
              <div className="mt-4 text-right">
                <span className="text-sm font-medium text-green-600">
                  {stops.length} stops available →
                </span>
              </div>
            </button>
          </div>

          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
              <AlertCircle className="w-4 h-4" />
              <span>Choose an option above to start viewing schedules</span>
            </div>
          </div>
        </div>
      )}

      {/* Route Selection Interface */}
      {selectionType === 'route' && !selectedRoute && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Bus className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Select a Route</h3>
                <p className="text-sm text-gray-600">Choose a bus route to view its schedule by direction</p>
              </div>
            </div>
            <button
              onClick={resetSelection}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              ← Back to Options
            </button>
          </div>

          {/* Search Routes */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search routes by number or name..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Routes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
            {filteredRoutes.map(route => (
              <button
                key={route.route_id}
                onClick={() => setSelectedRoute(route.route_id)}
                className="p-4 text-left bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-all"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`route-badge ${route.route_color === '8EBF42' ? 'route-badge-green' : 'route-badge-red'}`}>
                    {route.route_short_name}
                  </div>
                  <Bus className="w-4 h-4 text-gray-600" />
                </div>
                <h4 className="font-medium text-gray-900 mb-1">{route.route_long_name}</h4>
                {route.route_desc && (
                  <p className="text-xs text-gray-600">{route.route_desc}</p>
                )}
              </button>
            ))}
          </div>

          {filteredRoutes.length === 0 && searchTerm && (
            <div className="text-center py-8">
              <Bus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No routes found matching "{searchTerm}"</p>
            </div>
          )}
        </div>
      )}

      {/* Stop Selection Interface */}
      {selectionType === 'stop' && !selectedStop && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <MapPin className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Select a Stop</h3>
                <p className="text-sm text-gray-600">Choose a bus stop to view routes and directions</p>
              </div>
            </div>
            <button
              onClick={resetSelection}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              ← Back to Options
            </button>
          </div>

          {/* Search Stops */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search stops by name or code..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Stops Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
            {filteredStops.map(stop => (
              <button
                key={stop.stop_id}
                onClick={() => setSelectedStop(stop.stop_id)}
                className="p-4 text-left bg-gray-50 hover:bg-green-50 rounded-lg border border-gray-200 hover:border-green-300 transition-all"
              >
                <div className="flex items-center gap-3 mb-2">
                  <MapPin className="w-4 h-4 text-green-600" />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{stop.stop_name}</h4>
                    <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                      <span>Code: {stop.stop_code}</span>
                      <span>•</span>
                      <span>Zone: {stop.zone_id}</span>
                      {stop.location_type === 1 && (
                        <>
                          <span>•</span>
                          <span className="text-red-600 font-medium">Interchange</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {filteredStops.length === 0 && searchTerm && (
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No stops found matching "{searchTerm}"</p>
            </div>
          )}
        </div>
      )}

      {/* Direction Selection Interface - CRITICAL NEW STEP */}
      {(selectedRoute || selectedStop) && selectedDirection === null && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Navigation className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Choose Direction</h3>
                <p className="text-sm text-gray-600">
                  Select inbound or outbound direction for {getSelectedItemName()}
                </p>
              </div>
            </div>
            <button
              onClick={resetSelection}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              ← Change Selection
            </button>
          </div>

          {/* Selected Item Info */}
          <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 mb-6">
            <div className="flex items-center gap-3">
              {selectionType === 'route' ? (
                <div className={`route-badge ${routes.find(r => r.route_id === selectedRoute)?.route_color === '8EBF42' ? 'route-badge-green' : 'route-badge-red'}`}>
                  {routes.find(r => r.route_id === selectedRoute)?.route_short_name}
                </div>
              ) : (
                <MapPin className="w-5 h-5 text-purple-600" />
              )}
              <div>
                <h4 className="font-semibold text-purple-900">{getSelectedItemName()}</h4>
                <p className="text-sm text-purple-700">
                  {availableDirections.length} direction{availableDirections.length !== 1 ? 's' : ''} available
                </p>
              </div>
            </div>
          </div>

          {/* Direction Options */}
          {availableDirections.length > 0 ? (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  🚌 You must choose a direction to see schedules
                </h4>
                <p className="text-gray-600">
                  Bus routes operate in both directions with different destinations. Select one:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableDirections.map(directionInfo => (
                  <button
                    key={directionInfo.direction}
                    onClick={() => setSelectedDirection(directionInfo.direction)}
                    className={`p-6 rounded-xl border-2 transition-all text-left ${
                      directionInfo.direction === 0 
                        ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300 hover:border-blue-400' 
                        : 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-300 hover:border-purple-400'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-3 rounded-lg ${
                        directionInfo.direction === 0 ? 'bg-blue-200' : 'bg-purple-200'
                      }`}>
                        <Navigation className={`w-6 h-6 ${
                          directionInfo.direction === 0 ? 'text-blue-700' : 'text-purple-700'
                        } ${directionInfo.direction === 0 ? '' : 'transform rotate-180'}`} />
                      </div>
                      <div>
                        <h5 className={`text-xl font-semibold ${
                          directionInfo.direction === 0 ? 'text-blue-900' : 'text-purple-900'
                        }`}>
                          {directionInfo.label}
                        </h5>
                        <p className={`text-sm ${
                          directionInfo.direction === 0 ? 'text-blue-700' : 'text-purple-700'
                        }`}>
                          Direction {directionInfo.direction}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <ArrowRight className={`w-4 h-4 ${
                          directionInfo.direction === 0 ? 'text-blue-600' : 'text-purple-600'
                        }`} />
                        <span className={`font-medium ${
                          directionInfo.direction === 0 ? 'text-blue-900' : 'text-purple-900'
                        }`}>
                          Towards: {directionInfo.finalDestination}
                        </span>
                      </div>
                      <div className={`text-sm ${
                        directionInfo.direction === 0 ? 'text-blue-700' : 'text-purple-700'
                      }`}>
                        {directionInfo.tripCount} trips available
                      </div>
                    </div>

                    <div className="mt-4 text-right">
                      <ChevronRight className={`w-5 h-5 ${
                        directionInfo.direction === 0 ? 'text-blue-600' : 'text-purple-600'
                      }`} />
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <h5 className="font-semibold text-yellow-900">Direction Selection Required</h5>
                </div>
                <p className="text-sm text-yellow-800">
                  <strong>Inbound vs Outbound:</strong> Each direction serves different stops and has different schedules. 
                  You must select a specific direction to view accurate departure times and destinations.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Navigation className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h5 className="text-lg font-semibold text-gray-900 mb-2">No Directions Available</h5>
              <p className="text-gray-600">No direction information found for the selected {selectionType}.</p>
            </div>
          )}
        </div>
      )}

      {/* Schedule Results (only shown after ALL selections including direction) */}
      {(selectedRoute || selectedStop) && selectedDirection !== null && (
        <>
          {/* Filters and Selection Summary */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-madrid-primary/10 rounded-lg">
                  <Filter className="w-5 h-5 text-madrid-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Schedule for {getSelectedItemName()}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>Direction: {getSelectedDirectionInfo()?.label}</span>
                    <span>•</span>
                    <span>Towards: {getSelectedDirectionInfo()?.finalDestination}</span>
                    <span>•</span>
                    <span>{scheduleData.length} schedule{scheduleData.length !== 1 ? 's' : ''} found</span>
                  </div>
                </div>
              </div>
              <button
                onClick={resetSelection}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                ← Change Selection
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Time Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time Period</label>
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-madrid-primary focus:border-transparent"
                >
                  <option value="all">All Day</option>
                  <option value="morning">Morning (6AM-12PM)</option>
                  <option value="afternoon">Afternoon (12PM-6PM)</option>
                  <option value="evening">Evening (6PM-12AM)</option>
                </select>
              </div>

              {/* Summary Stats */}
              <div className="flex items-center gap-4">
                <div className="bg-blue-50 rounded-lg p-3 text-center flex-1">
                  <div className="text-lg font-bold text-blue-600">{scheduleData.length}</div>
                  <div className="text-xs text-blue-700">Route-Stop Combinations</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center flex-1">
                  <div className="text-lg font-bold text-green-600">
                    {scheduleData.reduce((sum, schedule) => sum + schedule.times.length, 0)}
                  </div>
                  <div className="text-xs text-green-700">Total Departures</div>
                </div>
                <div className={`rounded-lg p-3 text-center flex-1 ${
                  selectedDirection === 0 ? 'bg-blue-50' : 'bg-purple-50'
                }`}>
                  <div className={`text-lg font-bold ${
                    selectedDirection === 0 ? 'text-blue-600' : 'text-purple-600'
                  }`}>
                    {getSelectedDirectionInfo()?.label.split(' ')[0]}
                  </div>
                  <div className={`text-xs ${
                    selectedDirection === 0 ? 'text-blue-700' : 'text-purple-700'
                  }`}>
                    Direction Only
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Schedule Results */}
          <div className="space-y-4">
            {scheduleData.length === 0 ? (
              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Schedule Data Found</h3>
                <p className="text-gray-600">
                  No schedules found for the selected {selectionType}, direction, and time filter.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Try adjusting your time filter or selecting a different direction.
                </p>
              </div>
            ) : (
              scheduleData.map((schedule: any, index) => (
                <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`route-badge ${schedule.route.route_color === '8EBF42' ? 'route-badge-green' : 'route-badge-red'}`}>
                        {schedule.route.route_short_name}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{schedule.stop.stop_name}</h4>
                        <p className="text-sm text-gray-600">{schedule.route.route_long_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Navigation className={`w-3 h-3 ${
                            schedule.direction === 0 ? 'text-blue-600' : 'text-purple-600'
                          } ${schedule.direction === 0 ? '' : 'transform rotate-180'}`} />
                          <span className={`text-xs font-medium ${
                            schedule.direction === 0 ? 'text-blue-600' : 'text-purple-600'
                          }`}>
                            {schedule.direction === 0 ? 'Outbound (Ida)' : 'Inbound (Vuelta)'}
                          </span>
                          <span className="text-xs text-gray-500">
                            → {getSelectedDirectionInfo()?.finalDestination}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Zone: {schedule.stop.zone_id}</p>
                      <p className="text-sm text-gray-600">{schedule.times.length} departures</p>
                      <p className="text-xs text-gray-500">Direction {schedule.direction}</p>
                    </div>
                  </div>

                  {/* Schedule Times */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {schedule.times.slice(0, 24).map((time: any, timeIndex: number) => (
                      <div key={timeIndex} className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Clock className="w-3 h-3 text-gray-500" />
                          <span className="text-sm font-medium text-gray-900">
                            {formatTime(time.departure)}
                          </span>
                        </div>
                        <div className={`text-xs font-medium ${
                          time.direction === 0 ? 'text-blue-600' : 'text-purple-600'
                        }`}>
                          {time.direction === 0 ? 'Outbound' : 'Inbound'}
                        </div>
                        {time.headsign && (
                          <p className="text-xs text-gray-600 truncate">{time.headsign}</p>
                        )}
                      </div>
                    ))}
                    {schedule.times.length > 24 && (
                      <div className="bg-gray-100 rounded-lg p-3 text-center flex items-center justify-center">
                        <span className="text-sm text-gray-600">+{schedule.times.length - 24} more</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};