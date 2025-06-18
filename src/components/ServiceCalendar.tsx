import React, { useState, useMemo } from 'react';
import { Calendar, ServicePattern, Stop, Route, Trip, StopTime } from '../types/gtfs';
import { Calendar as CalendarIcon, Clock, Users, Filter, Search, MapPin, Bus, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isToday, isBefore, isAfter } from 'date-fns';

interface ServiceCalendarProps {
  calendar: Calendar[];
  servicePatterns: ServicePattern[];
  stops: Stop[];
  routes: Route[];
  trips: Trip[];
  stopTimes: StopTime[];
}

interface DaySchedule {
  date: Date;
  activeServices: Calendar[];
  totalTrips: number;
  availableRoutes: Route[];
  isWeekend: boolean;
  isHoliday: boolean;
  scheduleType: 'weekday' | 'saturday' | 'sunday' | 'holiday';
}

interface DepartureInfo {
  time: string;
  route: Route;
  trip: Trip;
  direction: number;
  directionLabel: string;
  finalDestination: string;
  stopSequence: number;
}

export const ServiceCalendar: React.FC<ServiceCalendarProps> = ({
  calendar,
  servicePatterns,
  stops,
  routes,
  trips,
  stopTimes
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedStop, setSelectedStop] = useState<string>('');
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'calendar' | 'departures'>('calendar');
  const [showStopDropdown, setShowStopDropdown] = useState<boolean>(false);

  // Parse GTFS date format (YYYYMMDD)
  const parseGTFSDate = (dateStr: string): Date => {
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  };

  // Check if a service is active on a specific date
  const isServiceActiveOnDate = (service: Calendar, date: Date): boolean => {
    const startDate = parseGTFSDate(service.start_date);
    const endDate = parseGTFSDate(service.end_date);
    
    // Check if date is within service period
    if (isBefore(date, startDate) || isAfter(date, endDate)) {
      return false;
    }
    
    // Check day of week (0 = Sunday, 1 = Monday, etc.)
    const dayOfWeek = getDay(date);
    
    switch (dayOfWeek) {
      case 0: return service.sunday === 1; // Sunday
      case 1: return service.monday === 1; // Monday
      case 2: return service.tuesday === 1; // Tuesday
      case 3: return service.wednesday === 1; // Wednesday
      case 4: return service.thursday === 1; // Thursday
      case 5: return service.friday === 1; // Friday
      case 6: return service.saturday === 1; // Saturday
      default: return false;
    }
  };

  // Get schedule type for a date
  const getScheduleType = (date: Date): 'weekday' | 'saturday' | 'sunday' | 'holiday' => {
    const dayOfWeek = getDay(date);
    
    // TODO: Add holiday detection logic here
    // For now, we'll use basic day-of-week logic
    
    if (dayOfWeek === 0) return 'sunday';
    if (dayOfWeek === 6) return 'saturday';
    return 'weekday';
  };

  // Generate calendar month data
  const monthData = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Start on Monday
    const calendarEnd = addDays(endOfMonth(addDays(monthEnd, 6)), 6);
    
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    
    return days.map(date => {
      const activeServices = calendar.filter(service => isServiceActiveOnDate(service, date));
      const scheduleType = getScheduleType(date);
      
      // Get trips for active services
      const serviceIds = activeServices.map(s => s.service_id);
      const dayTrips = trips.filter(trip => serviceIds.includes(trip.service_id));
      
      // Get unique routes for the day
      const routeIds = [...new Set(dayTrips.map(trip => trip.route_id))];
      const availableRoutes = routes.filter(route => routeIds.includes(route.route_id));
      
      return {
        date,
        activeServices,
        totalTrips: dayTrips.length,
        availableRoutes,
        isWeekend: scheduleType === 'saturday' || scheduleType === 'sunday',
        isHoliday: false, // TODO: Implement holiday detection
        scheduleType
      } as DaySchedule;
    });
  }, [currentMonth, calendar, trips, routes]);

  // Get departures for selected date, stop, and route
  const getDeparturesForDate = (date: Date, stopId?: string, routeId?: string): DepartureInfo[] => {
    const activeServices = calendar.filter(service => isServiceActiveOnDate(service, date));
    const serviceIds = activeServices.map(s => s.service_id);
    
    // Get trips for the selected date
    let dayTrips = trips.filter(trip => serviceIds.includes(trip.service_id));
    
    // Filter by route if selected
    if (routeId) {
      dayTrips = dayTrips.filter(trip => trip.route_id === routeId);
    }
    
    // Get stop times for the trips
    const tripIds = dayTrips.map(trip => trip.trip_id);
    let dayStopTimes = stopTimes.filter(st => tripIds.includes(st.trip_id));
    
    // Filter by stop if selected
    if (stopId) {
      dayStopTimes = dayStopTimes.filter(st => st.stop_id === stopId);
    }
    
    // Convert to departure info
    const departures: DepartureInfo[] = dayStopTimes
      .filter(st => st.departure_time) // Only include times with departure
      .map(st => {
        const trip = dayTrips.find(t => t.trip_id === st.trip_id);
        const route = trip ? routes.find(r => r.route_id === trip.route_id) : null;
        
        if (!trip || !route) return null;
        
        const directionLabel = trip.direction_id === 0 ? 'Outbound (Ida)' : 'Inbound (Vuelta)';
        const finalDestination = getFinalDestination(route.route_id, trip.direction_id, st.stop_id);
        
        return {
          time: st.departure_time,
          route,
          trip,
          direction: trip.direction_id,
          directionLabel,
          finalDestination,
          stopSequence: st.stop_sequence
        };
      })
      .filter(Boolean) as DepartureInfo[];
    
    // Sort by departure time
    return departures.sort((a, b) => a.time.localeCompare(b.time));
  };

  // Get final destination for a route direction
  const getFinalDestination = (routeId: string, direction: number, fromStopId: string): string => {
    try {
      const routeTrips = trips.filter(trip => 
        trip.route_id === routeId && 
        trip.direction_id === direction
      );

      if (routeTrips.length === 0) return 'Unknown destination';

      const sampleTrip = routeTrips[0];
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

      if (destination.length > 25) {
        const parts = destination.split('-');
        destination = parts[0].trim();
      }

      return destination || 'Terminal';
    } catch (error) {
      return 'Unknown destination';
    }
  };

  // Filter stops for search
  const filteredStops = stops.filter(stop => 
    stop.stop_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stop.stop_code.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 20);

  // Service type distribution
  const serviceTypeData = useMemo(() => {
    const types = {
      weekday: servicePatterns.filter(sp => 
        sp.days_of_week.includes('Monday') && 
        sp.days_of_week.includes('Friday') && 
        !sp.days_of_week.includes('Saturday') && 
        !sp.days_of_week.includes('Sunday')
      ).length,
      weekend: servicePatterns.filter(sp => 
        (sp.days_of_week.includes('Saturday') || sp.days_of_week.includes('Sunday')) &&
        !sp.days_of_week.includes('Monday')
      ).length,
      daily: servicePatterns.filter(sp => 
        sp.days_of_week.length === 7
      ).length,
      seasonal: servicePatterns.filter(sp => 
        sp.days_of_week.length > 0 && 
        sp.days_of_week.length < 7 &&
        !(sp.days_of_week.includes('Monday') && sp.days_of_week.includes('Friday') && !sp.days_of_week.includes('Saturday'))
      ).length
    };

    return [
      { name: 'Weekday Service', value: types.weekday, color: '#8EBF42', description: 'Monday to Friday' },
      { name: 'Weekend Service', value: types.weekend, color: '#E60003', description: 'Saturday & Sunday' },
      { name: 'Daily Service', value: types.daily, color: '#FFB800', description: 'Every day' },
      { name: 'Seasonal/Custom', value: types.seasonal, color: '#00A8E6', description: 'Special schedules' }
    ];
  }, [servicePatterns]);

  // Format time for display
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

  // Get day intensity for calendar visualization
  const getDayIntensity = (dayData: DaySchedule) => {
    const maxTrips = Math.max(...monthData.map(d => d.totalTrips));
    const intensity = maxTrips > 0 ? dayData.totalTrips / maxTrips : 0;
    
    if (dayData.scheduleType === 'sunday') return 'bg-purple-200';
    if (dayData.scheduleType === 'saturday') return 'bg-blue-200';
    if (intensity > 0.8) return 'bg-madrid-primary';
    if (intensity > 0.6) return 'bg-madrid-primary/80';
    if (intensity > 0.4) return 'bg-madrid-primary/60';
    if (intensity > 0.2) return 'bg-madrid-primary/40';
    if (intensity > 0) return 'bg-madrid-primary/20';
    return 'bg-gray-100';
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(direction === 'next' ? addMonths(currentMonth, 1) : subMonths(currentMonth, 1));
  };

  const handleStopSelect = (stop: Stop) => {
    setSelectedStop(stop.stop_id);
    setSearchTerm(stop.stop_name);
    setShowStopDropdown(false);
  };

  const selectedDateData = monthData.find(d => isSameDay(d.date, selectedDate));
  const departures = selectedDateData ? getDeparturesForDate(selectedDate, selectedStop, selectedRoute) : [];

  return (
    <div className="space-y-6">
      {/* Service Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {serviceTypeData.map((type, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: type.color }}
              ></div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{type.value}</p>
                <p className="text-sm text-gray-600">{type.name}</p>
                <p className="text-xs text-gray-500">{type.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* View Mode Toggle */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Service Calendar & Departures</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-madrid-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CalendarIcon className="w-4 h-4 inline mr-2" />
              Calendar View
            </button>
            <button
              onClick={() => setViewMode('departures')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'departures'
                  ? 'bg-madrid-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Clock className="w-4 h-4 inline mr-2" />
              Departures View
            </button>
          </div>
        </div>

        {viewMode === 'calendar' ? (
          <>
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => navigateMonth('prev')}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <h4 className="text-xl font-semibold text-gray-900">
                {format(currentMonth, 'MMMM yyyy')}
              </h4>
              <button
                onClick={() => navigateMonth('next')}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 mb-4">
              {/* Day Headers */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="text-center p-3 font-medium text-gray-600 text-sm">
                  {day}
                </div>
              ))}

              {/* Calendar Days */}
              {monthData.map((dayData, index) => {
                const isCurrentMonth = dayData.date.getMonth() === currentMonth.getMonth();
                const isSelected = isSameDay(dayData.date, selectedDate);
                const isCurrentDay = isToday(dayData.date);
                
                return (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(dayData.date)}
                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer min-h-[80px] ${
                      isSelected 
                        ? 'border-madrid-primary bg-madrid-primary/10' 
                        : 'border-transparent hover:border-madrid-primary/50'
                    } ${
                      !isCurrentMonth ? 'opacity-30' : ''
                    } ${
                      isCurrentDay ? 'ring-2 ring-blue-500' : ''
                    } ${getDayIntensity(dayData)}`}
                  >
                    <div className="text-left">
                      <div className={`text-sm font-bold mb-1 ${
                        isCurrentDay ? 'text-blue-600' : 'text-gray-900'
                      }`}>
                        {format(dayData.date, 'd')}
                      </div>
                      <div className="text-xs text-gray-600 mb-1">
                        {dayData.scheduleType === 'weekday' && '📅 Weekday'}
                        {dayData.scheduleType === 'saturday' && '🎯 Saturday'}
                        {dayData.scheduleType === 'sunday' && '🌟 Sunday'}
                      </div>
                      <div className="text-xs">
                        <div className="font-medium text-gray-900">{dayData.totalTrips}</div>
                        <div className="text-gray-600">trips</div>
                      </div>
                      <div className="text-xs">
                        <div className="font-medium text-gray-900">{dayData.availableRoutes.length}</div>
                        <div className="text-gray-600">routes</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Date Info */}
            {selectedDateData && (
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-blue-900">
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </h4>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedDateData.scheduleType === 'weekday' ? 'bg-green-100 text-green-800' :
                    selectedDateData.scheduleType === 'saturday' ? 'bg-blue-100 text-blue-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {selectedDateData.scheduleType.charAt(0).toUpperCase() + selectedDateData.scheduleType.slice(1)} Schedule
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-white rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{selectedDateData.activeServices.length}</div>
                    <div className="text-blue-700">Active Services</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{selectedDateData.totalTrips}</div>
                    <div className="text-green-700">Total Trips</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-600">{selectedDateData.availableRoutes.length}</div>
                    <div className="text-purple-700">Available Routes</div>
                  </div>
                </div>

                <button
                  onClick={() => setViewMode('departures')}
                  className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  View Departures for This Day
                </button>
              </div>
            )}

            {/* Legend */}
            <div className="mt-6 flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-madrid-primary rounded"></div>
                <span className="text-gray-600">High Service</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-200 rounded"></div>
                <span className="text-gray-600">Saturday</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-200 rounded"></div>
                <span className="text-gray-600">Sunday</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-100 rounded"></div>
                <span className="text-gray-600">No Service</span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Departures View */}
            <div className="space-y-6">
              {/* Date and Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Date Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <CalendarIcon className="w-4 h-4 inline mr-1" />
                    Select Date
                  </label>
                  <input
                    type="date"
                    value={format(selectedDate, 'yyyy-MM-dd')}
                    onChange={(e) => setSelectedDate(new Date(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-madrid-primary focus:border-transparent"
                  />
                </div>

                {/* Stop Selector */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Stop (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setShowStopDropdown(true);
                        if (!e.target.value) setSelectedStop('');
                      }}
                      onFocus={() => setShowStopDropdown(true)}
                      placeholder="Search stops..."
                      className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-madrid-primary focus:border-transparent"
                    />
                    <Search className="absolute right-2 top-2.5 w-4 h-4 text-gray-400" />
                    
                    {showStopDropdown && searchTerm && filteredStops.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                        {filteredStops.map(stop => (
                          <button
                            key={stop.stop_id}
                            onClick={() => handleStopSelect(stop)}
                            className={`w-full text-left px-3 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                              selectedStop === stop.stop_id ? 'bg-blue-50 text-blue-900' : ''
                            }`}
                          >
                            <div className="font-medium text-sm">{stop.stop_name}</div>
                            <div className="text-xs text-gray-600">
                              Code: {stop.stop_code} • Zone: {stop.zone_id}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Route Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Bus className="w-4 h-4 inline mr-1" />
                    Route (Optional)
                  </label>
                  <select
                    value={selectedRoute}
                    onChange={(e) => setSelectedRoute(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-madrid-primary focus:border-transparent"
                  >
                    <option value="">All Routes</option>
                    {selectedDateData?.availableRoutes.map(route => (
                      <option key={route.route_id} value={route.route_id}>
                        {route.route_short_name} - {route.route_long_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clear Filters */}
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setSelectedStop('');
                      setSelectedRoute('');
                      setSearchTerm('');
                      setShowStopDropdown(false);
                    }}
                    className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>

              {/* Departures Results */}
              {departures.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-gray-900">
                      Departures for {format(selectedDate, 'EEEE, MMMM d')}
                    </h4>
                    <span className="text-sm text-gray-600">
                      {departures.length} departures found
                    </span>
                  </div>

                  <div className="grid gap-3">
                    {departures.map((departure, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-2xl font-bold text-madrid-primary">
                              {formatTime(departure.time)}
                            </div>
                            <div className={`route-badge ${departure.route.route_color === '8EBF42' ? 'route-badge-green' : 'route-badge-red'}`}>
                              {departure.route.route_short_name}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{departure.route.route_long_name}</div>
                              <div className="text-sm text-gray-600">
                                {departure.directionLabel} → {departure.finalDestination}
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-sm text-gray-600">
                            <div>Stop #{departure.stopSequence}</div>
                            <div>Trip: {departure.trip.trip_id.slice(-6)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Departures Found</h3>
                  <p className="text-gray-600 mb-4">
                    No departures found for the selected date and filters.
                  </p>
                  <div className="text-sm text-gray-500 space-y-1">
                    <p>• Try selecting a different date</p>
                    <p>• Remove stop or route filters</p>
                    <p>• Check if service is available on {format(selectedDate, 'EEEE')}s</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Click outside to close dropdowns */}
      {showStopDropdown && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => setShowStopDropdown(false)}
        />
      )}
    </div>
  );
};