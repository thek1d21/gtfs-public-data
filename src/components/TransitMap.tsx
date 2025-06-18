import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { Icon, LatLngBounds } from 'leaflet';
import { Stop, Route, Shape, Trip, StopTime } from '../types/gtfs';
import { MapPin, Bus, Accessibility, Navigation, Info, Clock, ArrowRight, Router as RouteIcon } from 'lucide-react';

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

// Enhanced Route Polyline Component with smooth rendering
function RoutePolylines({ 
  shapes, 
  selectedRoute, 
  routes 
}: { 
  shapes: Shape[], 
  selectedRoute?: string, 
  routes: Route[] 
}) {
  const [routeLines, setRouteLines] = useState<Array<{
    id: string;
    positions: [number, number][];
    color: string;
    weight: number;
    opacity: number;
    dashArray?: string;
    isMain: boolean;
  }>>([]);

  useEffect(() => {
    if (selectedRoute && shapes.length > 0) {
      // Group shapes by shape_id for different itineraries
      const shapeGroups = shapes.reduce((acc, shape) => {
        if (!acc[shape.shape_id]) {
          acc[shape.shape_id] = [];
        }
        acc[shape.shape_id].push(shape);
        return acc;
      }, {} as Record<string, Shape[]>);

      // Get route color
      const route = routes.find(r => r.route_id === selectedRoute);
      const baseColor = route?.route_color ? `#${route.route_color}` : '#0066CC';

      // Create polyline data for each shape/itinerary
      const lines = Object.entries(shapeGroups).map(([shapeId, shapePoints], index) => {
        const sortedPoints = shapePoints
          .sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence)
          .map(point => [point.shape_pt_lat, point.shape_pt_lon] as [number, number]);

        const isMainItinerary = index === 0;
        
        return {
          id: shapeId,
          positions: sortedPoints,
          color: baseColor,
          weight: isMainItinerary ? 8 : 6,
          opacity: 0.9,
          dashArray: isMainItinerary ? undefined : '15,10',
          isMain: isMainItinerary
        };
      });

      setRouteLines(lines);
    } else {
      setRouteLines([]);
    }
  }, [shapes, selectedRoute, routes]);

  return (
    <>
      {routeLines.map((line) => (
        <Polyline
          key={line.id}
          positions={line.positions}
          pathOptions={{
            color: line.color,
            weight: line.weight,
            opacity: line.opacity,
            dashArray: line.dashArray,
            lineCap: 'round',
            lineJoin: 'round',
            smoothFactor: 1.5, // Smooth the line
            interactive: false // Prevent interaction issues
          }}
          eventHandlers={{
            add: (e) => {
              // Ensure proper z-index
              const layer = e.target;
              if (layer._path) {
                layer._path.style.zIndex = line.isMain ? '300' : '299';
              }
            }
          }}
        />
      ))}
    </>
  );
}

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

  // Get route color with enhanced visibility
  const getRouteColor = (routeId: string): string => {
    const route = routes.find(r => r.route_id === routeId);
    return route?.route_color ? `#${route.route_color}` : '#0066CC';
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
        preferCanvas={true} // Use canvas for better performance
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
        
        {/* Enhanced Route Polylines - Smooth, Road-Integrated Rendering */}
        <RoutePolylines
          shapes={routeShapes}
          selectedRoute={selectedRoute}
          routes={routes}
        />
        
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

      {/* Compact Route Details Panel - Bottom Right */}
      {selectedRoute && selectedRouteData && (
        <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 z-[1000] max-w-xs border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div 
              className="w-4 h-4 rounded-full border border-white shadow" 
              style={{ backgroundColor: getRouteColor(selectedRoute) }}
            ></div>
            <div>
              <span className="text-sm font-bold text-gray-900">
                Route {selectedRouteData.route_short_name}
              </span>
              <p className="text-xs text-gray-600 leading-tight">
                {selectedRouteData.route_long_name.length > 30 
                  ? `${selectedRouteData.route_long_name.substring(0, 30)}...`
                  : selectedRouteData.route_long_name
                }
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-blue-50 rounded p-2 text-center">
              <div className="font-bold text-blue-900">{routeStops.length}</div>
              <div className="text-blue-700">Stops</div>
            </div>
            <div className="bg-green-50 rounded p-2 text-center">
              <div className="font-bold text-green-900">{itineraryInfo.length}</div>
              <div className="text-green-700">Variants</div>
            </div>
          </div>
          
          {itineraryInfo.length > 0 && (
            <div className="mt-2 text-xs text-gray-600">
              {itineraryInfo.map((itinerary, index) => (
                <div key={index} className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${index === 0 ? 'bg-blue-500' : 'bg-blue-300'}`}></div>
                  <span>Dir {itinerary.direction} ({itinerary.trips})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compact Legend - Bottom Left */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000] border border-gray-200">
        <h4 className="text-xs font-bold text-gray-900 mb-2">Legend</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 border border-white shadow"></div>
            <span className="text-gray-700">Stop</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-600 border border-white shadow"></div>
            <span className="text-gray-700">Hub</span>
          </div>
          {selectedRoute && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-600 border border-white shadow"></div>
                <span className="text-gray-700">Route Stop</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-blue-600 rounded"></div>
                <span className="text-gray-700">Main Route</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-blue-400 rounded border-dashed border border-blue-400"></div>
                <span className="text-gray-700">Variant</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Route Status Indicator - Top Right */}
      {selectedRoute && (
        <div className="absolute top-4 right-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg px-3 py-1.5 z-[1000] shadow-lg">
          <div className="flex items-center gap-2 text-xs font-medium">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
            <span>Route Active • {routeShapes.length > 0 ? Math.round(routeShapes.length / 100) : 0}km</span>
          </div>
        </div>
      )}
    </div>
  );
};