import React, { useState, useMemo } from 'react';
import { Calendar, ServicePattern, Stop, Route, Trip, StopTime } from '../types/gtfs';
import { Calendar as CalendarIcon, Clock, Users, Filter, Search, MapPin, Bus, ArrowRight, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
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
  stopName: string;
}

export const ServiceCalendar: React.FC<ServiceCalendarProps> = ({
  calendar,
  servicePatterns,
  stops,
  routes,
  trips,
  stopTimes
}) => {
  // Step-by-step state management
  const [step, setStep] = useState<'selectDay' | 'selectRoute' | 'viewDepartures'>('selectDay');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

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
        isHoliday: false,
        scheduleType
      } as DaySchedule;
    });
  }, [currentMonth, calendar, trips, routes]);

  // Get available routes for selected date
  const availableRoutesForDate = useMemo(() => {
    if (!selectedDate) return [];
    
    const activeServices = calendar.filter(service => isServiceActiveOnDate(service, selectedDate));
    const serviceIds = activeServices.map(s => s.service_id);
    const dayTrips = trips.filter(trip => serviceIds.includes(trip.service_id));
    const routeIds = [...new Set(dayTrips.map(trip => trip.route_id))];
    
    return routes
      .filter(route => routeIds.includes(route.route_id))
      .sort((a, b) => a.route_short_name.localeCompare(b.route_short_name));
  }, [selectedDate, calendar, trips, routes]);

  // Get departures for selected date and route
  const getDeparturesForDateAndRoute = (date: Date, routeId: string): DepartureInfo[] => {
    try {
      const activeServices = calendar.filter(service => isServiceActiveOnDate(service, date));
      const serviceIds = activeServices.map(s => s.service_id);
      
      // Get trips for the selected date and route
      const dayTrips = trips.filter(trip => 
        serviceIds.includes(trip.service_id) && 
        trip.route_id === routeId
      );
      
      if (dayTrips.length === 0) return [];
      
      // Get stop times for the trips
      const tripIds = dayTrips.map(trip => trip.trip_id);
      const dayStopTimes = stopTimes.filter(st => 
        tripIds.includes(st.trip_id) && 
        st.departure_time // Only include times with departure
      );
      
      // Convert to departure info with stop names
      const departures: DepartureInfo[] = dayStopTimes
        .map(st => {
          const trip = dayTrips.find(t => t.trip_id === st.trip_id);
          const route = routes.find(r => r.route_id === routeId);
          const stop = stops.find(s => s.stop_id === st.stop_id);
          
          if (!trip || !route || !stop) return null;
          
          const directionLabel = trip.direction_id === 0 ? 'Outbound (Ida)' : 'Inbound (Vuelta)';
          const finalDestination = getFinalDestination(route.route_id, trip.direction_id, st.stop_id);
          
          return {
            time: st.departure_time,
            route,
            trip,
            direction: trip.direction_id,
            directionLabel,
            finalDestination,
            stopSequence: st.stop_sequence,
            stopName: stop.stop_name
          };
        })
        .filter(Boolean) as DepartureInfo[];
      
      // Sort by stop sequence, then by departure time
      return departures.sort((a, b) => {
        if (a.stopSequence !== b.stopSequence) {
          return a.stopSequence - b.stopSequence;
        }
        return a.time.localeCompare(b.time);
      });
    } catch (error) {
      console.error('Error getting departures:', error);
      return [];
    }
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

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedRoute('');
    setStep('selectRoute');
  };

  const handleRouteSelect = (routeId: string) => {
    setSelectedRoute(routeId);
    setStep('viewDepartures');
  };

  const resetSelection = () => {
    setSelectedDate(null);
    setSelectedRoute('');
    setStep('selectDay');
  };

  const selectedDateData = selectedDate ? monthData.find(d => isSameDay(d.date, selectedDate)) : null;
  const selectedRouteData = selectedRoute ? routes.find(r => r.route_id === selectedRoute) : null;
  const departures = selectedDate && selectedRoute ? getDeparturesForDateAndRoute(selectedDate, selectedRoute) : [];

  // Group departures by direction
  const departuresByDirection = useMemo(() => {
    const grouped = departures.reduce((acc, departure) => {
      const key = departure.direction;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(departure);
      return acc;
    }, {} as Record<number, DepartureInfo[]>);

    return grouped;
  }, [departures]);

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

      {/* Step-by-Step Process */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        {/* Progress Indicator */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Service Calendar & Departures</h3>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${step === 'selectDay' ? 'text-madrid-primary' : step !== 'selectDay' ? 'text-green-600' : 'text-gray-400'}`}>
              {step !== 'selectDay' ? <CheckCircle className="w-5 h-5" /> : <div className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center"><span className="text-xs font-bold">1</span></div>}
              <span className="text-sm font-medium">Select Day</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className={`flex items-center gap-2 ${step === 'selectRoute' ? 'text-madrid-primary' : step === 'viewDepartures' ? 'text-green-600' : 'text-gray-400'}`}>
              {step === 'viewDepartures' ? <CheckCircle className="w-5 h-5" /> : <div className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center"><span className="text-xs font-bold">2</span></div>}
              <span className="text-sm font-medium">Choose Route</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className={`flex items-center gap-2 ${step === 'viewDepartures' ? 'text-madrid-primary' : 'text-gray-400'}`}>
              <div className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center"><span className="text-xs font-bold">3</span></div>
              <span className="text-sm font-medium">View Departures</span>
            </div>
          </div>
          {(selectedDate || selectedRoute) && (
            <button
              onClick={resetSelection}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              Reset Selection
            </button>
          )}
        </div>

        {/* Step 1: Select Day */}
        {step === 'selectDay' && (
          <div className="space-y-6">
            <div className="text-center">
              <h4 className="text-xl font-semibold text-gray-900 mb-2">Step 1: Choose a Day</h4>
              <p className="text-gray-600">Select any day from the calendar to see available bus routes</p>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between">
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
            <div className="grid grid-cols-7 gap-2">
              {/* Day Headers */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="text-center p-3 font-medium text-gray-600 text-sm">
                  {day}
                </div>
              ))}

              {/* Calendar Days */}
              {monthData.map((dayData, index) => {
                const isCurrentMonth = dayData.date.getMonth() === currentMonth.getMonth();
                const isCurrentDay = isToday(dayData.date);
                const hasService = dayData.totalTrips > 0;
                
                return (
                  <button
                    key={index}
                    onClick={() => hasService ? handleDateSelect(dayData.date) : null}
                    disabled={!hasService}
                    className={`p-3 rounded-lg border-2 transition-all min-h-[80px] ${
                      hasService 
                        ? 'cursor-pointer border-transparent hover:border-madrid-primary/50' 
                        : 'cursor-not-allowed opacity-50'
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
                      {hasService ? (
                        <>
                          <div className="text-xs">
                            <div className="font-medium text-gray-900">{dayData.totalTrips}</div>
                            <div className="text-gray-600">trips</div>
                          </div>
                          <div className="text-xs">
                            <div className="font-medium text-gray-900">{dayData.availableRoutes.length}</div>
                            <div className="text-gray-600">routes</div>
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-gray-500">No Service</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 text-sm">
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
          </div>
        )}

        {/* Step 2: Select Route */}
        {step === 'selectRoute' && selectedDate && selectedDateData && (
          <div className="space-y-6">
            <div className="text-center">
              <h4 className="text-xl font-semibold text-gray-900 mb-2">Step 2: Choose a Route</h4>
              <p className="text-gray-600">
                Select a bus route for <strong>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</strong>
              </p>
            </div>

            {/* Selected Date Info */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-lg font-semibold text-blue-900">
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </h5>
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
                  <div className="text-2xl font-bold text-purple-600">{availableRoutesForDate.length}</div>
                  <div className="text-purple-700">Available Routes</div>
                </div>
              </div>
            </div>

            {/* Available Routes */}
            {availableRoutesForDate.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableRoutesForDate.map(route => (
                  <button
                    key={route.route_id}
                    onClick={() => handleRouteSelect(route.route_id)}
                    className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 hover:border-madrid-primary transition-all text-left"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`route-badge ${route.route_color === '8EBF42' ? 'route-badge-green' : 'route-badge-red'}`}>
                        {route.route_short_name}
                      </div>
                      <Bus className="w-4 h-4 text-gray-600" />
                    </div>
                    <h6 className="font-medium text-gray-900 mb-1">{route.route_long_name}</h6>
                    {route.route_desc && (
                      <p className="text-xs text-gray-600">{route.route_desc}</p>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <Bus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h5 className="text-lg font-semibold text-gray-900 mb-2">No Routes Available</h5>
                <p className="text-gray-600">No bus routes are available for the selected date.</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: View Departures */}
        {step === 'viewDepartures' && selectedDate && selectedRoute && selectedRouteData && (
          <div className="space-y-6">
            <div className="text-center">
              <h4 className="text-xl font-semibold text-gray-900 mb-2">Step 3: Departures</h4>
              <p className="text-gray-600">
                All departures for Route <strong>{selectedRouteData.route_short_name}</strong> on <strong>{format(selectedDate, 'EEEE, MMMM d')}</strong>
              </p>
            </div>

            {/* Route and Date Info */}
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`route-badge ${selectedRouteData.route_color === '8EBF42' ? 'route-badge-green' : 'route-badge-red'}`}>
                    {selectedRouteData.route_short_name}
                  </div>
                  <div>
                    <h5 className="font-semibold text-green-900">{selectedRouteData.route_long_name}</h5>
                    <p className="text-sm text-green-700">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">{departures.length}</div>
                  <div className="text-sm text-green-700">Total Departures</div>
                </div>
              </div>
            </div>

            {/* Departures by Direction */}
            {Object.keys(departuresByDirection).length > 0 ? (
              <div className="space-y-6">
                {Object.entries(departuresByDirection).map(([direction, directionDepartures]) => {
                  const directionLabel = parseInt(direction) === 0 ? 'Outbound (Ida)' : 'Inbound (Vuelta)';
                  const directionColor = parseInt(direction) === 0 ? 'blue' : 'purple';
                  
                  return (
                    <div key={direction} className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className={`px-4 py-2 rounded-lg ${
                          directionColor === 'blue' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          <h5 className="font-semibold">{directionLabel}</h5>
                          <p className="text-sm">
                            → {directionDepartures[0]?.finalDestination || 'Terminal'}
                          </p>
                        </div>
                        <div className="text-sm text-gray-600">
                          {directionDepartures.length} departures
                        </div>
                      </div>

                      <div className="grid gap-2">
                        {directionDepartures.map((departure, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="text-lg font-bold text-madrid-primary">
                                {formatTime(departure.time)}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{departure.stopName}</div>
                                <div className="text-sm text-gray-600">
                                  Stop #{departure.stopSequence} • Trip: {departure.trip.trip_id.slice(-6)}
                                </div>
                              </div>
                            </div>
                            <div className="text-right text-sm text-gray-600">
                              <div>→ {departure.finalDestination}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h5 className="text-lg font-semibold text-gray-900 mb-2">No Departures Found</h5>
                <p className="text-gray-600">
                  No departures found for Route {selectedRouteData.route_short_name} on {format(selectedDate, 'EEEE, MMMM d')}.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};