import React, { useState, useMemo } from 'react';
import { Calendar, ServicePattern } from '../types/gtfs';
import { Calendar as CalendarIcon, Clock, Users, Filter } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';

interface ServiceCalendarProps {
  calendar: Calendar[];
  servicePatterns: ServicePattern[];
}

export const ServiceCalendar: React.FC<ServiceCalendarProps> = ({
  calendar,
  servicePatterns
}) => {
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [selectedService, setSelectedService] = useState<string>('');

  // Generate week view
  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedWeek, { weekStartsOn: 1 }); // Start on Monday
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedWeek]);

  // Get service data for the week
  const weekServiceData = useMemo(() => {
    return weekDays.map(day => {
      const dayName = format(day, 'EEEE').toLowerCase();
      const activeServices = calendar.filter(service => {
        const servicePattern = servicePatterns.find(sp => sp.service_id === service.service_id);
        if (!servicePattern) return false;

        // Check if service is active on this day
        const dayActive = service[dayName as keyof Calendar] === 1;
        
        // Check if date is within service period
        const serviceStart = servicePattern.start_date;
        const serviceEnd = servicePattern.end_date;
        const isInPeriod = day >= serviceStart && day <= serviceEnd;

        return dayActive && isInPeriod;
      });

      const totalTrips = activeServices.reduce((sum, service) => {
        const pattern = servicePatterns.find(sp => sp.service_id === service.service_id);
        return sum + (pattern?.total_trips || 0);
      }, 0);

      return {
        date: day,
        activeServices: activeServices.length,
        totalTrips,
        services: activeServices
      };
    });
  }, [weekDays, calendar, servicePatterns]);

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
      custom: servicePatterns.filter(sp => 
        sp.days_of_week.length > 0 && 
        sp.days_of_week.length < 7 &&
        !(sp.days_of_week.includes('Monday') && sp.days_of_week.includes('Friday') && !sp.days_of_week.includes('Saturday'))
      ).length
    };

    return [
      { name: 'Weekday Only', value: types.weekday, color: '#8EBF42' },
      { name: 'Weekend Only', value: types.weekend, color: '#E60003' },
      { name: 'Daily Service', value: types.daily, color: '#FFB800' },
      { name: 'Custom Schedule', value: types.custom, color: '#00A8E6' }
    ];
  }, [servicePatterns]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = addDays(selectedWeek, direction === 'next' ? 7 : -7);
    setSelectedWeek(newDate);
  };

  const getDayIntensity = (dayData: any) => {
    const maxTrips = Math.max(...weekServiceData.map(d => d.totalTrips));
    const intensity = maxTrips > 0 ? dayData.totalTrips / maxTrips : 0;
    
    if (intensity > 0.8) return 'bg-madrid-primary';
    if (intensity > 0.6) return 'bg-madrid-primary/80';
    if (intensity > 0.4) return 'bg-madrid-primary/60';
    if (intensity > 0.2) return 'bg-madrid-primary/40';
    if (intensity > 0) return 'bg-madrid-primary/20';
    return 'bg-gray-100';
  };

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
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Week Navigation */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Weekly Service Calendar</h3>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigateWeek('prev')}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              ← Previous Week
            </button>
            <span className="text-sm font-medium text-gray-900">
              {format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d, yyyy')}
            </span>
            <button
              onClick={() => navigateWeek('next')}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Next Week →
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Day Headers */}
          {weekDays.map(day => (
            <div key={day.toISOString()} className="text-center p-3">
              <div className="text-sm font-medium text-gray-900">
                {format(day, 'EEE')}
              </div>
              <div className="text-xs text-gray-600">
                {format(day, 'MMM d')}
              </div>
            </div>
          ))}

          {/* Service Data */}
          {weekServiceData.map((dayData, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border-2 border-transparent hover:border-madrid-primary/50 transition-all cursor-pointer ${getDayIntensity(dayData)}`}
            >
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900 mb-1">
                  {dayData.activeServices}
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  Active Services
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {dayData.totalTrips.toLocaleString()}
                </div>
                <div className="text-xs text-gray-600">
                  Total Trips
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 rounded"></div>
            <span className="text-sm text-gray-600">No Service</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-madrid-primary/20 rounded"></div>
            <span className="text-sm text-gray-600">Low</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-madrid-primary/60 rounded"></div>
            <span className="text-sm text-gray-600">Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-madrid-primary rounded"></div>
            <span className="text-sm text-gray-600">High</span>
          </div>
        </div>
      </div>

      {/* Service Patterns Detail */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Patterns</h3>
        
        <div className="space-y-3">
          {servicePatterns.slice(0, 10).map((pattern, index) => (
            <div key={pattern.service_id} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-madrid-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Service {pattern.service_id}</p>
                    <p className="text-sm text-gray-600">
                      {pattern.days_of_week.join(', ')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-madrid-primary">{pattern.total_trips}</p>
                  <p className="text-xs text-gray-600">trips</p>
                </div>
              </div>
              
              <div className="mt-3 flex items-center gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{pattern.routes_count} routes</span>
                </div>
                <div className="flex items-center gap-1">
                  <CalendarIcon className="w-4 h-4" />
                  <span>{format(pattern.start_date, 'MMM d')} - {format(pattern.end_date, 'MMM d')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};