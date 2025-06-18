import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Icon, LatLngBounds } from 'leaflet';
import { Stop, Route, Shape, Trip, StopTime } from '../types/gtfs';
import { MapPin, Bus, Accessibility, Navigation, Info, Clock, ArrowRight, Route as RouteIcon } from 'lucide-react';

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

// Enhanced custom marker icons with better visibility
const createCustomIcon = (color: string, size: number = 24, border: boolean = false) => new Icon({
  iconUrl: `data:image/svg+xml;base64,${btoa(`
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="${color}" stroke="${border ? '#ffffff' : color}" stroke-width="${border ? '3' : '1'}"/>
      <circle cx="12" cy="12" r="6" fill="white"/>
      <circle cx="12" cy="12" r="3" fill="${color}"/>
    </svg>
  `)}`,
  iconSize: [size, size],
  iconAnchor: [size/2, size/2],
  popupAnchor: [0, -size/2]
});

const busStopIcon = createCustomIcon('#8EBF42', 20);
const interchangeIcon = createCustomIcon('#E60003', 32, true);
const selectedStopIcon = createCustomIcon('#FFB800', 28, true);
const routeStopIcon = createCustomIcon('#00A8E6', 26, true);
const routeStopHighlighted = createCustomIcon('#0066CC', 30, true);

// Enhanced component to fit map bounds to selected route with smooth animation
function RouteMapBounds({ 
  stops, 
  shapes, 
  selectedRoute, 
  routeStops 
}: { 
  stops: Stop[], 
  shapes: Shape[], 
  selectedRoute?: string,
  routeStops: Stop[]
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedRoute && (routeStops.length > 0 || shapes.length > 0)) {
      const bounds = new LatLngBounds([]);
      
      // Add route stops bounds with priority
      routeStops.forEach(stop => {
        bounds.extend([stop.stop_lat, stop.stop_lon]);
      });
      
      // Add shape bounds for complete route coverage
      shapes.forEach(shape => {
        bounds.extend([shape.shape_pt_lat, shape.shape_pt_lon]);
      });
      
      if (bounds.isValid()) {
        // Smooth zoom to route with padding
        map.fitBounds(bounds, { 
          padding: [50, 50],
          maxZoom: 14,
          animate: true,
          duration: 1.5
        });
      }
    } else {
      // Default view showing all stops
      const bounds = new LatLngBounds([]);
      stops.slice(0, 100).forEach(stop => { // Limit for performance
        bounds.extend([stop.stop_lat, stop.stop_lon]);
      });
      
      if (bounds.isValid()) {
        map.fitBounds(bounds, { 
          padding: [20, 20],
          maxZoom: 12,
          animate: true,
          duration: 1
        });
      }
    }
  }, [stops, shapes, selectedRoute, routeStops, map]);

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
  const [routeTrips, setRouteTrips] = useState<Trip[]>([]);
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
      // Get all trips for selected route
      const routeTripsData = trips.filter(trip => trip.route_id === selectedRoute);
      setRouteTrips(routeTripsData);
      
      // Get all unique shape IDs for this route (handles multiple itineraries)
      const shapeIds = [...new Set(routeTripsData.map(trip => trip.shape_id).filter(Boolean))];
      
      // Get all shapes for all itineraries of this route
      const routeShapePoints = shapes.filter(shape => shapeIds.includes(shape.shape_id));
      setRouteShapes(routeShapePoints);
      
      // Get all stops for this route from stop_times
      const routeTripIds = routeTripsData.map(trip => trip.trip_id);
      const routeStopTimes = stopTimes.filter(st => routeTripIds.includes(st.trip_id));
      const uniqueStopIds = [...new Set(routeStopTimes.map(st => st.stop_id))];
      const stopsForRoute = stops.filter(stop => uniqueStopIds.includes(stop.stop_id));
      
      // Sort stops by their sequence in the route
      const sortedRouteStops = stopsForRoute.sort((a, b) => {
        const aStopTime = routeStopTimes.find(st => st.stop_id === a.stop_id);
        const bStopTime = routeStopTimes.find(st => st.stop_id === b.stop_id);
        return (aStopTime?.stop_sequence || 0) - (bStopTime?.stop_sequence || 0);
      });
      
      setRouteStops(sortedRouteStops);
      setFilteredStops(stops); // Show all stops but highlight route stops
    } else {
      setFilteredStops(stops);
      setRouteShapes([]);
      setRouteStops([]);
      setRouteTrips([]);
    }
  }, [selectedRoute, stops, shapes, trips, stopTimes]);

  const getStopIcon = (stop: Stop) => {
    if (hoveredStop === stop.stop_id) return selectedStopIcon;
    if (selectedRoute && routeStops.some(rs => rs.stop_id === stop.stop_id)) {
      return routeStopHighlighted;
    }
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

  // Enhanced next bus arrivals calculation
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
      
      // Only include future departures (next 24 hours)
      if (st.departure_time >= currentTimeStr) {
        if (!routeArrivals.has(trip.route_id)) {
          routeArrivals.set(trip.route_id, []);
        }
        routeArrivals.get(trip.route_id)!.push(st.departure_time);
      }
    });
    
    // Sort and limit to next 5 arrivals per route
    const routeInfo = Array.from(routeArrivals.entries()).map(([routeId, times]) => {
      const route = routes.find(r => r.route_id === routeId);
      if (!route) return null;
      
      const sortedTimes = times.sort().slice(0, 5);
      return {
        route,
        nextArrivals: sortedTimes
      };
    }).filter(Boolean) as Array<{ route: Route; nextArrivals: string[] }>;
    
    return routeInfo.sort((a, b) => a.route.route_short_name.localeCompare(b.route.route_short_name));
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

  // Enhanced shape grouping by shape_id and direction for multiple itineraries
  const shapeGroups = routeShapes.reduce((acc, shape) => {
    if (!acc[shape.shape_id]) {
      acc[shape.shape_id] = [];
    }
    acc[shape.shape_id].push(shape);
    return acc;
  }, {} as Record<string, Shape[]>);

  // Get route color with enhanced visibility
  const getRouteColor = (routeId: string): string => {
    const route = routes.find(r => r.route_id === routeId);
    return route?.route_color ? `#${route.route_color}` : '#8EBF42';
  };

  const selectedRouteData = selectedRoute ? routes.find(r => r.route_id === selectedRoute) : null;

  // Get itinerary information
  const getItineraryInfo = () => {
    if (!selectedRoute || routeTrips.length === 0) return [];
    
    const itineraries = new Map<string, { direction: number; trips: number; shapeId: string }>();
    
    routeTrips.forEach(trip => {
      const key = `${trip.direction_id}-${trip.shape_id}`;
      if (!itineraries.has(key)) {
        itineraries.set(key, {
          direction: trip.direction_id,
          trips: 0,
          shapeId: trip.shape_id
        });
      }
      itineraries.get(key)!.trips++;
    });
    
    return Array.from(itineraries.values());
  };

  const itineraryInfo = getItineraryInfo();

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
        
        <RouteMapBounds 
          stops={filteredStops} 
          shapes={routeShapes} 
          selectedRoute={selectedRoute}
          routeStops={routeStops}
        />
        
        {/* Enhanced Route Shapes - Multiple itineraries with different styling */}
        {Object.entries(shapeGroups).map(([shapeId, shapePoints], index) => {
          const sortedPoints = shapePoints
            .sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence)
            .map(point => [point.shape_pt_lat, point.shape_pt_lon] as [number, number]);
          
          const baseColor = selectedRoute ? getRouteColor(selectedRoute) : '#8EBF42';
          const isMainItinerary = index === 0;
          
          return (
            <Polyline
              key={shapeId}
              positions={sortedPoints}
              color={baseColor}
              weight={selectedRoute ? (isMainItinerary ? 8 : 6) : 4}
              opacity={selectedRoute ? (isMainItinerary ? 0.95 : 0.8) : 0.6}
              className={selectedRoute ? 'route-highlighted' : ''}
              dashArray={isMainItinerary ? undefined : '10, 5'}
            />
          );
        })}
        
        {/* Route Stop Connections - Connect stops with lines */}
        {selectedRoute && routeStops.length > 1 && (
          <Polyline
            positions={routeStops.map(stop => [stop.stop_lat, stop.stop_lon])}
            color={getRouteColor(selectedRoute)}
            weight={3}
            opacity={0.6}
            dashArray="5, 10"
          />
        )}
        
        {/* Enhanced Stops with better visibility */}
        {filteredStops.map((stop) => {
          const accessibility = getAccessibilityInfo(stop.wheelchair_boarding);
          const isRouteStop = selectedRoute && routeStops.some(rs => rs.stop_id === stop.stop_id);
          const stopSequence = isRouteStop ? routeStops.findIndex(rs => rs.stop_id === stop.stop_id) + 1 : null;
          
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
              <Popup className="custom-popup" maxWidth={450}>
                <div className="min-w-[350px]">
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
                      {isRouteStop && stopSequence && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Stop #{stopSequence} on Route {selectedRouteData?.route_short_name}
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
                  
                  {/* Enhanced Next Arrivals Section */}
                  {selectedStopDetails?.stop.stop_id === stop.stop_id && selectedStopDetails.routeInfo.length > 0 && (
                    <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <h4 className="font-semibold text-blue-900 text-sm">Next Bus Arrivals</h4>
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                          {selectedStopDetails.routeInfo.length} routes
                        </span>
                      </div>
                      <div className="space-y-3 max-h-48 overflow-y-auto">
                        {selectedStopDetails.routeInfo.map((routeInfo, index) => (
                          <div key={index} className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`route-badge ${routeInfo.route.route_color === '8EBF42' ? 'route-badge-green' : 'route-badge-red'}`}>
                                  {routeInfo.route.route_short_name}
                                </span>
                                <span className="text-xs text-gray-600 truncate max-w-[150px]">
                                  {routeInfo.route.route_long_name}
                                </span>
                              </div>
                              {routeInfo.route.route_id === selectedRoute && (
                                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                                  Selected Route
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {routeInfo.nextArrivals.slice(0, 4).map((time, timeIndex) => {
                                const minutesUntil = calculateMinutesUntil(time);
                                const isUrgent = minutesUntil <= 5;
                                const isSoon = minutesUntil <= 15;
                                
                                return (
                                  <div key={timeIndex} className={`flex items-center justify-between gap-1 rounded px-2 py-1 text-xs ${
                                    isUrgent ? 'bg-red-50 text-red-800' : 
                                    isSoon ? 'bg-yellow-50 text-yellow-800' : 
                                    'bg-gray-50 text-gray-800'
                                  }`}>
                                    <span className="font-medium">
                                      {formatTime(time)}
                                    </span>
                                    <span className="font-bold">
                                      {minutesUntil}m
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
                      <Clock className="w-3 h-3 inline mr-1" />
                      Refresh Times
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Enhanced Route Control Panel */}
      {selectedRoute && selectedRouteData && (
        <div className="absolute top-4 left-4 bg-white rounded-xl shadow-xl p-4 z-[1000] max-w-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div 
              className="w-6 h-6 rounded-full border-2 border-white shadow-lg" 
              style={{ backgroundColor: getRouteColor(selectedRoute) }}
            ></div>
            <div>
              <span className="text-lg font-bold text-gray-900">
                Route {selectedRouteData.route_short_name}
              </span>
              <p className="text-sm text-gray-600 mt-1 leading-tight">
                {selectedRouteData.route_long_name}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-blue-50 rounded-lg p-2">
              <div className="flex items-center gap-1 mb-1">
                <MapPin className="w-3 h-3 text-blue-600" />
                <span className="text-xs font-medium text-blue-900">Stops</span>
              </div>
              <p className="text-lg font-bold text-blue-900">{routeStops.length}</p>
            </div>
            
            <div className="bg-green-50 rounded-lg p-2">
              <div className="flex items-center gap-1 mb-1">
                <RouteIcon className="w-3 h-3 text-green-600" />
                <span className="text-xs font-medium text-green-900">Itineraries</span>
              </div>
              <p className="text-lg font-bold text-green-900">{itineraryInfo.length}</p>
            </div>
          </div>
          
          {itineraryInfo.length > 0 && (
            <div className="text-xs text-gray-600">
              <p className="font-medium mb-1">Route Variants:</p>
              {itineraryInfo.map((itinerary, index) => (
                <div key={index} className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-blue-500' : 'bg-blue-300'}`}></div>
                  <span>Direction {itinerary.direction} ({itinerary.trips} trips)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Enhanced Legend */}
      <div className="absolute bottom-4 right-4 bg-white rounded-xl shadow-xl p-4 z-[1000] border border-gray-200">
        <h4 className="text-sm font-bold text-gray-900 mb-3">Map Legend</h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow"></div>
            <span className="text-gray-700">Regular Stop</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-red-600 border-2 border-white shadow"></div>
            <span className="text-gray-700">Interchange Hub</span>
          </div>
          {selectedRoute && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow"></div>
                <span className="text-gray-700">Route Stop</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-1 bg-blue-600 rounded"></div>
                <span className="text-gray-700">Main Route</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-1 bg-blue-400 rounded border-dashed border border-blue-600"></div>
                <span className="text-gray-700">Route Variant</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Route Status Indicator */}
      {selectedRoute && (
        <div className="absolute top-4 right-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg px-3 py-2 z-[1000] shadow-lg">
          <div className="flex items-center gap-2 text-sm font-medium">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>Route Highlighted & Zoomed</span>
          </div>
        </div>
      )}
    </div>
  );
};