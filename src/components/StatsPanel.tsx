import React from 'react';
import { Stop, Route, Calendar, Trip, StopTime, Shape } from '../types/gtfs';
import { 
  MapPin, Bus, Calendar as CalendarIcon, Clock, Accessibility, 
  TrendingUp, Navigation, Users, Zap 
} from 'lucide-react';

interface StatsPanelProps {
  stops: Stop[];
  routes: Route[];
  calendar: Calendar[];
  trips: Trip[];
  stopTimes: StopTime[];
  shapes: Shape[];
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ 
  stops, 
  routes, 
  calendar, 
  trips, 
  stopTimes, 
  shapes 
}) => {
  const totalStops = stops.length;
  const totalRoutes = routes.length;
  const totalTrips = trips.length;
  const totalStopTimes = stopTimes.length;
  const totalShapes = [...new Set(shapes.map(s => s.shape_id))].length;
  
  const interchanges = stops.filter(stop => stop.location_type === 1).length;
  const accessibleStops = stops.filter(stop => stop.wheelchair_boarding === 1).length;
  const accessibilityPercentage = totalStops > 0 ? Math.round((accessibleStops / totalStops) * 100) : 0;
  
  const zones = [...new Set(stops.map(stop => stop.zone_id))].length;
  const activeServices = calendar.length;

  // Calculate average trips per route
  const avgTripsPerRoute = totalRoutes > 0 ? Math.round(totalTrips / totalRoutes) : 0;

  // Calculate service coverage (unique shape points)
  const totalShapePoints = shapes.length;

  // Calculate daily service frequency
  const dailyFrequency = totalStopTimes > 0 ? Math.round(totalStopTimes / activeServices) : 0;

  const stats = [
    {
      label: 'Total Stops',
      value: totalStops.toLocaleString(),
      icon: MapPin,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'Bus stops and interchanges'
    },
    {
      label: 'Bus Routes',
      value: totalRoutes.toLocaleString(),
      icon: Bus,
      color: 'text-madrid-primary',
      bgColor: 'bg-green-50',
      description: 'Active bus routes'
    },
    {
      label: 'Daily Trips',
      value: totalTrips.toLocaleString(),
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: 'Scheduled trips per day'
    },
    {
      label: 'Interchanges',
      value: interchanges.toLocaleString(),
      icon: Navigation,
      color: 'text-madrid-secondary',
      bgColor: 'bg-red-50',
      description: 'Major transit hubs'
    },
    {
      label: 'Service Zones',
      value: zones.toLocaleString(),
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      description: 'Fare zones covered'
    },
    {
      label: 'Accessible Stops',
      value: `${accessibilityPercentage}%`,
      icon: Accessibility,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'Wheelchair accessible'
    },
    {
      label: 'Route Shapes',
      value: totalShapes.toLocaleString(),
      icon: Navigation,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      description: 'Unique route geometries'
    },
    {
      label: 'Avg Frequency',
      value: `${avgTripsPerRoute}`,
      icon: Zap,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      description: 'Trips per route'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div key={index} className="stats-card group">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${stat.bgColor} group-hover:scale-110 transition-transform duration-200`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-600">{stat.label}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};