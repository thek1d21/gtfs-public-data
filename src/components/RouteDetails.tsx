import React, { useState } from 'react';
import { Route, Trip, StopTime, Stop, Shape, RouteAnalytics } from '../types/gtfs';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import { Bus, Clock, MapPin, Users, Accessibility, TrendingUp, Navigation } from 'lucide-react';

interface RouteDetailsProps {
  route: Route;
  trips: Trip[];
  stopTimes: StopTime[];
  stops: Stop[];
  shapes: Shape[];
  analytics: RouteAnalytics;
  onClose: () => void;
}

export const RouteDetails: React.FC<RouteDetailsProps> = ({
  route,
  trips,
  stopTimes,
  stops,
  shapes,
  analytics,
  onClose
}) => {
  const [selectedDirection, setSelectedDirection] = useState<number>(0);

  // Get route-specific data
  const routeTrips = trips.filter(trip => trip.route_id === route.route_id);
  const directionTrips = routeTrips.filter(trip => trip.direction_id === selectedDirection);
  const routeStopTimes = stopTimes.filter(st => 
    routeTrips.some(trip => trip.trip_id === st.trip_id)
  );
  const uniqueStopIds = [...new Set(routeStopTimes.map(st => st.stop_id))];
  const routeStops = stops.filter(stop => uniqueStopIds.includes(stop.stop_id));

  // Get shape data for route visualization
  const routeShapes = shapes.filter(shape => 
    routeTrips.some(trip => trip.shape_id === shape.shape_id)
  );
  const shapePoints = routeShapes
    .sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence)
    .map(shape => [shape.shape_pt_lat, shape.shape_pt_lon] as [number, number]);

  // Calculate schedule information
  const getScheduleInfo = () => {
    const directionStopTimes = stopTimes.filter(st => 
      directionTrips.some(trip => trip.trip_id === st.trip_id)
    );
    
    const departureTimes = directionStopTimes
      .map(st => st.departure_time)
      .filter(time => time && time.includes(':'))
      .sort();

    const frequencies = [];
    for (let i = 1; i < departureTimes.length; i++) {
      const prev = departureTimes[i - 1];
      const curr = departureTimes[i];
      const prevMinutes = this.timeToMinutes(prev);
      const currMinutes = this.timeToMinutes(curr);
      frequencies.push(currMinutes - prevMinutes);
    }

    const avgFrequency = frequencies.length > 0 
      ? Math.round(frequencies.reduce((a, b) => a + b, 0) / frequencies.length)
      : 0;

    return {
      firstDeparture: departureTimes[0] || 'N/A',
      lastDeparture: departureTimes[departureTimes.length - 1] || 'N/A',
      totalDepartures: departureTimes.length,
      avgFrequency: avgFrequency > 0 ? `${avgFrequency} min` : 'N/A'
    };
  };

  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const scheduleInfo = getScheduleInfo();
  const directions = [...new Set(routeTrips.map(trip => trip.direction_id))];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-madrid-primary/10 rounded-lg">
                <Bus className="w-8 h-8 text-madrid-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Route {route.route_short_name}
                </h2>
                <p className="text-gray-600">{route.route_long_name}</p>
                {route.route_desc && (
                  <p className="text-sm text-gray-500 mt-1">{route.route_desc}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Sidebar */}
          <div className="w-1/3 p-6 border-r border-gray-200 overflow-y-auto">
            {/* Analytics Cards */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Total Trips</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">{analytics.total_trips}</p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Stops</span>
                </div>
                <p className="text-2xl font-bold text-green-900">{analytics.total_stops}</p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">Service Hours</span>
                </div>
                <p className="text-2xl font-bold text-purple-900">{analytics.service_hours}h</p>
              </div>
              
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Accessibility className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-900">Accessible</span>
                </div>
                <p className="text-2xl font-bold text-orange-900">{analytics.accessibility_score}%</p>
              </div>
            </div>

            {/* Direction Selector */}
            {directions.length > 1 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Direction</h3>
                <div className="flex gap-2">
                  {directions.map(direction => (
                    <button
                      key={direction}
                      onClick={() => setSelectedDirection(direction)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedDirection === direction
                          ? 'bg-madrid-primary text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Direction {direction}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Schedule Information */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Schedule Info</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">First Departure:</span>
                  <span className="font-medium">{scheduleInfo.firstDeparture}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Departure:</span>
                  <span className="font-medium">{scheduleInfo.lastDeparture}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Daily Trips:</span>
                  <span className="font-medium">{scheduleInfo.totalDepartures}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Frequency:</span>
                  <span className="font-medium">{scheduleInfo.avgFrequency}</span>
                </div>
              </div>
            </div>

            {/* Stops List */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Stops ({routeStops.length})</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {routeStops.map((stop, index) => (
                  <div key={stop.stop_id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-madrid-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{stop.stop_name}</p>
                        <p className="text-xs text-gray-600">Zone: {stop.zone_id}</p>
                        {stop.wheelchair_boarding === 1 && (
                          <div className="flex items-center gap-1 mt-1">
                            <Accessibility className="w-3 h-3 text-green-600" />
                            <span className="text-xs text-green-600">Accessible</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 p-6">
            <div className="h-full bg-gray-100 rounded-lg overflow-hidden">
              <MapContainer
                center={routeStops.length > 0 ? [routeStops[0].stop_lat, routeStops[0].stop_lon] : [40.6, -3.9]}
                zoom={12}
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Route Shape */}
                {shapePoints.length > 0 && (
                  <Polyline
                    positions={shapePoints}
                    color={`#${route.route_color}`}
                    weight={4}
                    opacity={0.8}
                  />
                )}
                
                {/* Stops */}
                {routeStops.map((stop, index) => (
                  <Marker
                    key={stop.stop_id}
                    position={[stop.stop_lat, stop.stop_lon]}
                  >
                    <Popup>
                      <div className="min-w-[200px]">
                        <h4 className="font-semibold text-gray-900">{stop.stop_name}</h4>
                        <p className="text-sm text-gray-600 mt-1">Stop #{index + 1}</p>
                        <p className="text-sm text-gray-600">Zone: {stop.zone_id}</p>
                        {stop.wheelchair_boarding === 1 && (
                          <p className="text-sm text-green-600 mt-1">♿ Wheelchair Accessible</p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};