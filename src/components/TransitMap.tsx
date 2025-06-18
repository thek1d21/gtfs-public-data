import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Icon, LatLngBounds } from 'leaflet';
import { Stop, Route, Shape, Trip, StopTime } from '../types/gtfs';
import { MapPin, Bus, Accessibility, Navigation, Info, Clock, ArrowRight } from 'lucide-react';

interface TransitMapProps {
  stops: Stop[];
  routes: Route[];
  shapes: Shape[];
  trips: Trip[];
  stopTimes: StopTime[];
  selectedRoute?: string;
  onStopClick?: (stop: Stop) => void;
  onRouteClick?: (route: Route) => void;
}

// Custom marker icons
const createCustomIcon = (color: string, size: number = 24) => new Icon({
  iconUrl: `data:image/svg+xml;base64,${btoa(`
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8" fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="12" cy="12" r="4" fill="white"/>
    </svg>
  `)}`,
  iconSize: [size, size],
  iconAnchor: [size/2, size/2],
  popupAnchor: [0, -size/2]
});

const busStopIcon = createCustomIcon('#8EBF42');
const interchangeIcon = createCustomIcon('#E60003', 32);
const selectedStopIcon = createCustomIcon('#FFB800', 28);
const routeStopIcon = createCustomIcon('#00A8E6', 26);

// Component to fit map bounds to stops
function MapBounds({ stops, shapes, selectedRoute }: { stops: Stop[], shapes: Shape[], selectedRoute?: string }) {
  const map = useMap();

  useEffect(() => {
    const bounds = new LatLngBounds([]);
    
    // Add stop bounds
    stops.forEach(stop => {
      bounds.extend([stop.stop_lat, stop.stop_lon]);
    });
    
    // Add shape bounds if route is selected
    if (selectedRoute && shapes.length > 0) {
      shapes.forEach(shape => {
        bounds.extend([shape.shape_pt_lat, shape.shape_pt_lon]);
      });
    }
    
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [stops, shapes, selectedRoute, map]);

  return null;
}

export const TransitMap: React.FC<TransitMapProps> = ({ 
  stops, 
  routes, 
  shapes, 
  trips, 
  stopTimes,
  selectedRoute,
  onStopClick,
  onRouteClick
}) => {
  const [filteredStops, setFilteredStops] = useState<Stop[]>(stops);
  const [routeShapes, setRouteShapes] = useState<Shape[]>([]);
  const [routeStops, setRouteStops] = useState<Stop[]>([]);
  const [hoveredStop, setHoveredStop] = useState<string | null>(null);
  const [selectedStopDetails, setSelectedStopDetails] = useState<{
    stop: Stop;
    routeInfo: Array<{
      route: Route;
      nextArrivals: string[];
    }>;
  } | null>(null);

  useEffect(() => {
    if (selectedRoute) {
      // Get trips for selected route
      const routeTrips = trips.filter(trip => trip.route_id === selectedRoute);
      const shapeIds = [...new Set(routeTrips.map(trip => trip.shape_id))];
      
      // Get shapes for route
      const routeShapePoints = shapes.filter(shape => shapeIds.includes(shape.shape_id));
      setRouteShapes(routeShapePoints);
      
      // Get stops for this route
      const routeTripIds = routeTrips.map(trip => trip.trip_id);
      const routeStopTimes = stopTimes.filter(st => routeTripIds.includes(st.trip_id));
      const uniqueStopIds = [...new Set(routeStopTimes.map(st => st.stop_id))];
      const stopsForRoute = stops.filter(stop => uniqueStopIds.includes(stop.stop_id));
      
      setRouteStops(stopsForRoute);
      setFilteredStops(stops); // Show all stops but highlight route stops
    } else {
      setFilteredStops(stops);
      setRouteShapes([]);
      setRouteStops([]);
    }
  }, [selectedRoute, stops, shapes, trips, stopTimes]);

  const getStopIcon = (stop: Stop) => {
    if (hoveredStop === stop.stop_id) return selectedStopIcon;
    if (selectedRoute && routeStops.some(rs => rs.stop_id === stop.stop_id)) return routeStopIcon;
    return stop.location_type === 1 ? interchangeIcon : busStopIcon;
  };

  const getAccessibilityInfo = (wheelchairBoarding: number) => {
    switch (wheelchairBoarding) {
      case 1:
        return { text: 'Accessible', color: 'text-green-600', icon: '♿' };
      case 2:
        return { text: 'Not Accessible', color: 'text-red-600', icon: '🚫' };
      default:
        return { text: 'Unknown', color: 'text-gray-600', icon: '❓' };
    }
  };

  // Calculate next bus arrivals for a stop
  const calculateNextArrivals = (stop: Stop) => {
    const currentTime = new Date();
    const currentTimeStr = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}:00`;
    
    // Get all stop times for this stop
    const stopStopTimes = stopTimes.filter(st => st.stop_id === stop.stop_id);
    
    // Group by route
    const routeArrivals = new Map<string, string[]>();
    
    stopStopTimes.forEach(st => {
      const trip = trips.find(t => t.trip_id === st.trip_id);
      if (!trip || !st.departure_time) return;
      
      // Only include future departures
      if (st.departure_time > currentTimeStr) {
        if (!routeArrivals.has(trip.route_id)) {
          routeArrivals.set(trip.route_id, []);
        }
        routeArrivals.get(trip.route_id)!.push(st.departure_time);
      }
    });
    
    // Sort and limit to next 3-5 arrivals per route
    const routeInfo = Array.from(routeArrivals.entries()).map(([routeId, times]) => {
      const route = routes.find(r => r.route_id === routeId);
      if (!route) return null;
      
      const sortedTimes = times.sort().slice(0, 5);
      return {
        route,
        nextArrivals: sortedTimes
      };
    }).filter(Boolean) as Array<{ route: Route; nextArrivals: string[] }>;
    
    return routeInfo;
  };

  const handleStopClick = (stop: Stop) => {
    const routeInfo = calculateNextArrivals(stop);
    setSelectedStopDetails({ stop, routeInfo });
    onStopClick?.(stop);
  };

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

  const calculateMinutesUntil = (timeStr: string): number => {
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const targetTime = new Date();
    targetTime.setHours(hours, minutes, 0, 0);
    
    if (targetTime < now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }
    
    return Math.round((targetTime.getTime() - now.getTime()) / (1000 * 60));
  };

  // Group shapes by shape_id for polylines
  const shapeGroups = routeShapes.reduce((acc, shape) => {
    if (!acc[shape.shape_id]) {
      acc[shape.shape_id] = [];
    }
    acc[shape.shape_id].push(shape);
    return acc;
  }, {} as Record<string, Shape[]>);

  // Get route color
  const getRouteColor = (routeId: string): string => {
    const route = routes.find(r => r.route_id === routeId);
    return route?.route_color ? `#${route.route_color}` : '#8EBF42';
  };

  const selectedRouteData = selectedRoute ? routes.find(r => r.route_id === selectedRoute) : null;

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={[40.6, -3.9]}
        zoom={11}
        className="h-full w-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBounds stops={filteredStops} shapes={routeShapes} selectedRoute={selectedRoute} />
        
        {/* Route Shapes - Highlighted when route is selected */}
        {Object.entries(shapeGroups).map(([shapeId, shapePoints]) => {
          const sortedPoints = shapePoints
            .sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence)
            .map(point => [point.shape_pt_lat, point.shape_pt_lon] as [number, number]);
          
          return (
            <Polyline
              key={shapeId}
              positions={sortedPoints}
              color={selectedRoute ? getRouteColor(selectedRoute) : '#8EBF42'}
              weight={selectedRoute ? 6 : 4}
              opacity={selectedRoute ? 0.9 : 0.6}
              className={selectedRoute ? 'route-highlighted' : ''}
            />
          );
        })}
        
        {/* Stops */}
        {filteredStops.map((stop) => {
          const accessibility = getAccessibilityInfo(stop.wheelchair_boarding);
          const isRouteStop = selectedRoute && routeStops.some(rs => rs.stop_id === stop.stop_id);
          
          return (
            <Marker
              key={stop.stop_id}
              position={[stop.stop_lat, stop.stop_lon]}
              icon={getStopIcon(stop)}
              eventHandlers={{
                mouseover: () => setHoveredStop(stop.stop_id),
                mouseout: () => setHoveredStop(null),
                click: () => handleStopClick(stop)
              }}
            >
              <Popup className="custom-popup" maxWidth={400}>
                <div className="min-w-[320px]">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0 p-2 bg-madrid-primary/10 rounded-lg">
                      {stop.location_type === 1 ? (
                        <Bus className="w-5 h-5 text-madrid-primary" />
                      ) : (
                        <MapPin className="w-5 h-5 text-madrid-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                        {stop.stop_name}
                      </h3>
                      <p className="text-xs text-gray-600 mt-1">
                        Code: {stop.stop_code}
                      </p>
                      {isRouteStop && (
                        <div className="mt-1">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            On Selected Route
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {stop.stop_desc && (
                    <p className="text-xs text-gray-700 mb-3 leading-relaxed">
                      {stop.stop_desc}
                    </p>
                  )}
                  
                  {/* Next Arrivals Section */}
                  {selectedStopDetails?.stop.stop_id === stop.stop_id && selectedStopDetails.routeInfo.length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <h4 className="font-semibold text-blue-900 text-sm">Next Arrivals</h4>
                      </div>
                      <div className="space-y-3">
                        {selectedStopDetails.routeInfo.slice(0, 3).map((routeInfo, index) => (
                          <div key={index} className="bg-white rounded-lg p-2">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`route-badge ${routeInfo.route.route_color === '8EBF42' ? 'route-badge-green' : 'route-badge-red'}`}>
                                  {routeInfo.route.route_short_name}
                                </span>
                                <span className="text-xs text-gray-600 truncate max-w-[120px]">
                                  {routeInfo.route.route_long_name}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              {routeInfo.nextArrivals.slice(0, 3).map((time, timeIndex) => {
                                const minutesUntil = calculateMinutesUntil(time);
                                return (
                                  <div key={timeIndex} className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
                                    <span className="text-xs font-medium text-gray-900">
                                      {formatTime(time)}
                                    </span>
                                    <span className="text-xs text-gray-600">
                                      ({minutesUntil}m)
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Zone:</span>
                      <span className="font-medium text-gray-900">{stop.zone_id}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium text-gray-900">
                        {stop.location_type === 1 ? 'Interchange Hub' : 'Bus Stop'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <Accessibility className="w-3 h-3" />
                        <span className="text-gray-600">Accessibility:</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>{accessibility.icon}</span>
                        <span className={`font-medium ${accessibility.color}`}>
                          {accessibility.text}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Coordinates:</span>
                      <span className="font-medium text-gray-900 font-mono">
                        {stop.stop_lat.toFixed(4)}, {stop.stop_lon.toFixed(4)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                    <a
                      href={stop.stop_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-xs text-madrid-primary hover:text-madrid-primary/80 font-medium text-center py-2 bg-madrid-primary/10 rounded-lg transition-colors"
                    >
                      View on CRTM →
                    </a>
                    <button
                      onClick={() => handleStopClick(stop)}
                      className="flex-1 text-xs text-white bg-madrid-primary hover:bg-madrid-primary/90 font-medium text-center py-2 rounded-lg transition-colors"
                    >
                      <Info className="w-3 h-3 inline mr-1" />
                      Refresh Times
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map Controls */}
      {selectedRoute && selectedRouteData && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 z-[1000] max-w-xs">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: getRouteColor(selectedRoute) }}></div>
            <div>
              <span className="text-sm font-semibold text-gray-900">
                Route {selectedRouteData.route_short_name}
              </span>
              <p className="text-xs text-gray-600 mt-1">
                {selectedRouteData.route_long_name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>{routeStops.length} stops</span>
            </div>
            <div className="flex items-center gap-1">
              <Navigation className="w-3 h-3" />
              <span>Route highlighted</span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
        <h4 className="text-xs font-semibold text-gray-900 mb-2">Map Legend</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-600">Regular Stop</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-600"></div>
            <span className="text-gray-600">Interchange</span>
          </div>
          {selectedRoute && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-gray-600">Route Stop</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};