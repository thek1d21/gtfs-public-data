import React, { useState, useMemo } from 'react';
import { StopTime, Trip, Stop, Route } from '../types/gtfs';
import { Clock, Calendar, Filter, Search } from 'lucide-react';
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
  const [selectedStop, setSelectedStop] = useState<string>('');
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter and process schedule data
  const scheduleData = useMemo(() => {
    let filteredStopTimes = stopTimes;

    // Filter by stop
    if (selectedStop) {
      filteredStopTimes = filteredStopTimes.filter(st => st.stop_id === selectedStop);
    }

    // Filter by route
    if (selectedRoute) {
      const routeTrips = trips.filter(trip => trip.route_id === selectedRoute);
      const routeTripIds = routeTrips.map(trip => trip.trip_id);
      filteredStopTimes = filteredStopTimes.filter(st => routeTripIds.includes(st.trip_id));
    }

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

      if (!trip || !stop || !route) return acc;

      const key = `${st.stop_id}-${trip.route_id}`;
      if (!acc[key]) {
        acc[key] = {
          stop,
          route,
          trip,
          times: []
        };
      }

      acc[key].times.push({
        arrival: st.arrival_time,
        departure: st.departure_time,
        sequence: st.stop_sequence,
        headsign: st.stop_headsign || trip.trip_headsign
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
  }, [stopTimes, trips, stops, routes, selectedStop, selectedRoute, timeFilter]);

  // Filter stops and routes for search
  const filteredStops = stops.filter(stop => 
    stop.stop_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stop.stop_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRoutes = routes.filter(route =>
    route.route_short_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    route.route_long_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule Filters</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search stops or routes..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-madrid-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Stop Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Stop</label>
            <select
              value={selectedStop}
              onChange={(e) => setSelectedStop(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-madrid-primary focus:border-transparent"
            >
              <option value="">All Stops</option>
              {filteredStops.slice(0, 50).map(stop => (
                <option key={stop.stop_id} value={stop.stop_id}>
                  {stop.stop_name} ({stop.stop_code})
                </option>
              ))}
            </select>
          </div>

          {/* Route Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Route</label>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-madrid-primary focus:border-transparent"
            >
              <option value="">All Routes</option>
              {filteredRoutes.map(route => (
                <option key={route.route_id} value={route.route_id}>
                  {route.route_short_name} - {route.route_long_name}
                </option>
              ))}
            </select>
          </div>

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
        </div>
      </div>

      {/* Schedule Results */}
      <div className="space-y-4">
        {scheduleData.length === 0 ? (
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Schedule Data Found</h3>
            <p className="text-gray-600">Try adjusting your filters to see schedule information.</p>
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
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Zone: {schedule.stop.zone_id}</p>
                  <p className="text-sm text-gray-600">{schedule.times.length} departures</p>
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
    </div>
  );
};