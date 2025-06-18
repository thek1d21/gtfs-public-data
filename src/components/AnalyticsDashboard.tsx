import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';
import { RouteAnalytics, ServicePattern, StopAnalytics } from '../types/gtfs';
import { TrendingUp, Clock, Users, MapPin, Accessibility, Calendar } from 'lucide-react';

interface AnalyticsDashboardProps {
  routeAnalytics: RouteAnalytics[];
  servicePatterns: ServicePattern[];
  stopAnalytics: StopAnalytics[];
}

const COLORS = ['#8EBF42', '#E60003', '#FFB800', '#00A8E6', '#8B5CF6', '#F59E0B'];

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  routeAnalytics,
  servicePatterns,
  stopAnalytics
}) => {
  // Prepare data for charts
  const routeFrequencyData = routeAnalytics
    .sort((a, b) => b.total_trips - a.total_trips)
    .slice(0, 10)
    .map(route => ({
      route: route.route_id.split('__')[1]?.split('___')[0] || route.route_id,
      trips: route.total_trips,
      stops: route.total_stops,
      accessibility: route.accessibility_score
    }));

  const servicePatternData = servicePatterns.map(pattern => ({
    service: pattern.service_id.substring(0, 8),
    trips: pattern.total_trips,
    routes: pattern.routes_count,
    days: pattern.days_of_week.length
  }));

  const accessibilityData = [
    { name: 'Accessible', value: stopAnalytics.filter(s => s.accessibility_features.length > 0).length },
    { name: 'Not Accessible', value: stopAnalytics.filter(s => s.accessibility_features.length === 0).length }
  ];

  const zoneDistribution = stopAnalytics.reduce((acc, stop) => {
    acc[stop.zone_info] = (acc[stop.zone_info] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const zoneData = Object.entries(zoneDistribution).map(([zone, count]) => ({
    zone,
    stops: count
  }));

  const topInterchanges = stopAnalytics
    .filter(stop => stop.interchange_connections > 0)
    .sort((a, b) => b.interchange_connections - a.interchange_connections)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="analytics-card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {routeAnalytics.reduce((sum, r) => sum + r.total_trips, 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">Total Trips</p>
            </div>
          </div>
        </div>

        <div className="analytics-card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-lg">
              <Clock className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(routeAnalytics.reduce((sum, r) => sum + r.service_hours, 0) / routeAnalytics.length)}h
              </p>
              <p className="text-sm text-gray-600">Avg Service Hours</p>
            </div>
          </div>
        </div>

        <div className="analytics-card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(routeAnalytics.reduce((sum, r) => sum + r.accessibility_score, 0) / routeAnalytics.length)}%
              </p>
              <p className="text-sm text-gray-600">Accessibility Score</p>
            </div>
          </div>
        </div>

        <div className="analytics-card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-50 rounded-lg">
              <MapPin className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {topInterchanges.length}
              </p>
              <p className="text-sm text-gray-600">Major Interchanges</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Route Performance */}
        <div className="analytics-card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Route Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={routeFrequencyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="route" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="trips" fill="#8EBF42" name="Total Trips" />
              <Bar dataKey="stops" fill="#E60003" name="Total Stops" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Service Patterns */}
        <div className="analytics-card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Patterns</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={servicePatternData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="service" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="trips" stackId="1" stroke="#8EBF42" fill="#8EBF42" />
              <Area type="monotone" dataKey="routes" stackId="1" stroke="#E60003" fill="#E60003" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Accessibility Distribution */}
        <div className="analytics-card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Accessibility Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={accessibilityData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {accessibilityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Zone Distribution */}
        <div className="analytics-card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Stops by Zone</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={zoneData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="zone" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="stops" fill="#8EBF42" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Interchanges */}
      <div className="analytics-card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Major Interchange Hubs</h3>
        <div className="space-y-3">
          {topInterchanges.map((interchange, index) => (
            <div key={interchange.stop_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-madrid-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-gray-900">Stop ID: {interchange.stop_id}</p>
                  <p className="text-sm text-gray-600">Zone: {interchange.zone_info}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-madrid-primary">{interchange.routes_serving}</p>
                <p className="text-xs text-gray-600">Routes</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Route Accessibility Scores */}
      <div className="analytics-card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Route Accessibility Scores</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={routeFrequencyData} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} />
            <YAxis dataKey="route" type="category" width={60} />
            <Tooltip />
            <Bar dataKey="accessibility" fill="#8EBF42" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};