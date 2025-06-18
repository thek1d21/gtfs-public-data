import React from 'react';
import { Stop, Route, Calendar } from '../types/gtfs';
import { MapPin, Bus, Calendar as CalendarIcon, Clock, Accessibility } from 'lucide-react';

interface StatsPanelProps {
  stops: Stop[];
  routes: Route[];
  calendar: Calendar[];
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stops, routes, calendar }) => {
  const totalStops = stops.length;
  const totalRoutes = routes.length;
  const interchanges = stops.filter(stop => stop.location_type === 1).length;
  const accessibleStops = stops.filter(stop => stop.wheelchair_boarding === 1).length;
  const accessibilityPercentage = totalStops > 0 ? Math.round((accessibleStops / totalStops) * 100) : 0;
  
  const zones = [...new Set(stops.map(stop => stop.zone_id))].length;
  const activeServices = calendar.length;

  const stats = [
    {
      label: 'Total Stops',
      value: totalStops.toLocaleString(),
      icon: MapPin,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      label: 'Bus Routes',
      value: totalRoutes.toLocaleString(),
      icon: Bus,
      color: 'text-madrid-primary',
      bgColor: 'bg-green-50'
    },
    {
      label: 'Interchanges',
      value: interchanges.toLocaleString(),
      icon: CalendarIcon,
      color: 'text-madrid-secondary',
      bgColor: 'bg-red-50'
    },
    {
      label: 'Service Zones',
      value: zones.toLocaleString(),
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      label: 'Accessible Stops',
      value: `${accessibilityPercentage}%`,
      icon: Accessibility,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      label: 'Active Services',
      value: activeServices.toLocaleString(),
      icon: CalendarIcon,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {stats.map((stat, index) => (
        <div key={index} className="stats-card">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-600">{stat.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};