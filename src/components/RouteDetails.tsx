import React, { useState, useMemo } from 'react';
import { Route, Trip, StopTime, Stop, Shape, RouteAnalytics } from '../types/gtfs';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import { Bus, Clock, MapPin, Users, Accessibility, TrendingUp, Navigation, X, ArrowRight, Calendar, Zap, Route as RouteIcon } from 'lucide-react';
import { LatLngBounds } from 'leaflet';

interface RouteDetailsProps {
  route: Route;
  trips: Trip[];
  stopTimes: StopTime[];
  stops: Stop[];
  shapes: Shape[];
  analytics: RouteAnalytics;
  onClose: () => void;
}

// Map bounds component
function MapBounds({ 
  routeStops, 
  shapes 
}: { 
  routeStops: Stop[], 
  shapes: Shape[]
}) {
  const map = require('react-leaflet').useMap();

  React.useEffect(() => {
    if (routeStops.length > 0 || shapes.length > 0) {
      const bounds = new LatLngBounds([]);
      
      // Add route stops bounds
      routeStops.forEach(stop => {
        if (stop && typeof stop.stop_lat === 'number' && typeof stop.stop_lon === 'number') {
          bounds.extend([stop.stop_lat, stop.stop_lon]);
        }
      });
      
      // Add shape bounds for more precise fitting
      shapes.forEach(shape => {
        if (shape && typeof shape.shape_pt_lat === 'number' && typeof shape.shape_pt_lon === 'number') {
          bounds.extend([shape.shape_pt_lat, shape.shape_pt_lon]);
        }
      });
      
      if (bounds.isValid()) {
        map.fitBounds(bounds, { 
          padding: [20, 20],
          maxZoom: 15
        });
      }
    }
  }, [routeStops, shapes, map]);

  return null;
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
  const routeTrips = useMemo(() => 
    trips.filter(trip => trip.route_id === route.route_id), 
    [trips, route.route_id]
  );

  const directionTrips = useMemo(() => 
    routeTrips.filter(trip => trip.direction_id === selectedDirection),
    [routeTrips, selectedDirection]
  );

  const routeStopTimes = useMemo(() => 
    stopTimes.filter(st => routeTrips.some(trip => trip.trip_id === st.trip_id)),
    [stopTimes, routeTrips]
  );

  const uniqueStopIds = useMemo(() => 
    [...new Set(routeStopTimes.map(st => st.stop_id))],
    [routeStopTimes]
  );

  const routeStops = useMemo(() => {
    const stopsForRoute = stops.filter(stop => uniqueStopIds.includes(stop.stop_id));
    
    // Sort stops by sequence for the selected direction
    const directionStopTimes = stopTimes.filter(st => 
      directionTrips.some(trip => trip.trip_id === st.trip_id)
    );
    
    return stopsForRoute.sort((a, b) => {
      const aStopTime = directionStopTimes.find(st => st.stop_id === a.stop_id);
      const bStopTime = directionStopTimes.find(st => st.stop_id === b.stop_id);
      return (aStopTime?.stop_sequence || 0) - (bStopTime?.stop_sequence || 0);
    });
  }, [stops, uniqueStopIds, stopTimes, directionTrips]);

  // Get shape data for route visualization
  const routeShapes = useMemo(() => {
    const shapeIds = [...new Set(directionTrips.map(trip => trip.shape_id).filter(Boolean))];
    return shapes.filter(shape => shapeIds.includes(shape.shape_id));
  }, [shapes, directionTrips]);

  const shapePoints = useMemo(() => 
    routeShapes
      .sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence)
      .map(shape => [shape.shape_pt_lat, shape.shape_pt_lon] as [number, number]),
    [routeShapes]
  );

  // Calculate schedule information
  const scheduleInfo = useMemo(() => {
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
      const prevMinutes = timeToMinutes(prev);
      const currMinutes = timeToMinutes(curr);
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
  }, [stopTimes, directionTrips]);

  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const directions = useMemo(() => 
    [...new Set(routeTrips.map(trip => trip.direction_id))],
    [routeTrips]
  );

  // Get final destination for direction
  const getFinalDestination = (direction: number): string => {
    const dirTrips = routeTrips.filter(trip => trip.direction_id === direction);
    if (dirTrips.length === 0) return 'Unknown destination';

    const sampleTrip = dirTrips[0];
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
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-7xl w-full max-h-[95vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-madrid-primary/10 to-madrid-secondary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-lg shadow-sm">
                <Bus className="w-8 h-8 text-madrid-primary" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Route {route.route_short_name}
                  </h2>
                  <div className={`route-badge text-lg px-3 py-1 ${route.route_color === '8EBF42' ? 'route-badge-green' : 'route-badge-red'}`}>
                    {route.route_short_name}
                  </div>
                </div>
                <p className="text-gray-700 font-medium">{route.route_long_name}</p>
                {route.route_desc && (
                  <p className="text-sm text-gray-600 mt-1">{route.route_desc}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="flex h-[calc(95vh-120px)]">
          {/* Sidebar */}
          <div className="w-1/3 p-6 border-r border-gray-200 overflow-y-auto">
            {/* Analytics Cards */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Total Trips</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">{analytics.total_trips}</p>
                <p className="text-xs text-blue-700">Daily services</p>
              </div>
              
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Stops</span>
                </div>
                <p className="text-2xl font-bold text-green-900">{analytics.total_stops}</p>
                <p className="text-xs text-green-700">Total served</p>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">Service Hours</span>
                </div>
                <p className="text-2xl font-bold text-purple-900">{analytics.service_hours}h</p>
                <p className="text-xs text-purple-700">Operating time</p>
              </div>
              
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <Accessibility className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-900">Accessible</span>
                </div>
                <p className="text-2xl font-bold text-orange-900">{analytics.accessibility_score}%</p>
                <p className="text-xs text-orange-700">Of stops</p>
              </div>
            </div>

            {/* Direction Selector */}
            {directions.length > 1 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Navigation className="w-5 h-5" />
                  Direction
                </h3>
                <div className="space-y-2">
                  {directions.map(direction => (
                    <button
                      key={direction}
                      onClick={() => setSelectedDirection(direction)}
                      className={`w-full p-3 rounded-lg text-left transition-all ${
                        selectedDirection === direction
                          ? 'bg-madrid-primary text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            {direction === 0 ? 'Outbound (Ida)' : 'Inbound (Vuelta)'}
                          </div>
                          <div className="text-sm opacity-90">
                            → {getFinalDestination(direction)}
                          </div>
                        </div>
                        <Navigation className={`w-4 h-4 ${direction === 0 ? '' : 'transform rotate-180'}`} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Schedule Information */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Schedule Info
              </h3>
              <div className="space-y-3 bg-gray-50 rounded-lg p-4">
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
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Stops ({routeStops.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {routeStops.map((stop, index) => (
                  <div key={stop.stop_id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-madrid-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{stop.stop_name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                          <span>Zone: {stop.zone_id}</span>
                          {stop.wheelchair_boarding === 1 && (
                            <div className="flex items-center gap-1">
                              <Accessibility className="w-3 h-3 text-green-600" />
                              <span className="text-green-600">Accessible</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 p-6">
            <div className="h-full bg-gray-100 rounded-lg overflow-hidden shadow-inner">
              <MapContainer
                center={routeStops.length > 0 ? [routeStops[0].stop_lat, routeStops[0].stop_lon] : [40.6, -3.9]}
                zoom={12}
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                <MapBounds routeStops={routeStops} shapes={routeShapes} />
                
                {/* Route Shape */}
                {shapePoints.length > 0 && (
                  <Polyline
                    positions={shapePoints}
                    color={`#${route.route_color}`}
                    weight={5}
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
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 bg-madrid-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </div>
                          <h4 className="font-semibold text-gray-900">{stop.stop_name}</h4>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p>Code: {stop.stop_code}</p>
                          <p>Zone: {stop.zone_id}</p>
                          {stop.wheelchair_boarding === 1 && (
                            <p className="text-green-600 flex items-center gap-1">
                              <Accessibility className="w-3 h-3" />
                              Wheelchair Accessible
                            </p>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Route Type: Bus</span>
              <span>•</span>
              <span>Agency: CRTM</span>
              <span>•</span>
              <a 
                href={route.route_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-madrid-primary hover:text-madrid-primary/80 font-medium"
              >
                View on CRTM Website →
              </a>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};