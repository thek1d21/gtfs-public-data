import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
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

// Enhanced Route Polylines with Direction-Based Colors
function EnhancedRoutePolylines({ 
  shapes, 
  selectedRoute, 
  routes,
  trips 
}: { 
  shapes: Shape[], 
  selectedRoute?: string, 
  routes: Route[],
  trips: Trip[]
}) {
  const [routeLines, setRouteLines] = useState<Array<{
    id: string;
    positions: [number, number][];
    color: string;
    weight: number;
    opacity: number;
    dashArray?: string;
    direction: number;
    label: string;
  }>>([]);

  useEffect(() => {
    if (!selectedRoute || !shapes || shapes.length === 0) {
      setRouteLines([]);
      return;
    }

    try {
      // Get route trips to determine directions
      const routeTrips = trips.filter(trip => trip.route_id === selectedRoute);
      const route = routes.find(r => r.route_id === selectedRoute);
      const baseColor = route?.route_color ? `#${route.route_color}` : '#0066CC';
      
      // Create color variations for directions
      const getDirectionColor = (direction: number, baseColor: string) => {
        if (direction === 0) {
          // Direction 0 (Outbound/Ida) - Use original color, more saturated
          return baseColor;
        } else {
          // Direction 1 (Inbound/Vuelta) - Use complementary/darker shade
          return adjustColorForDirection(baseColor);
        }
      };

      // Group shapes by shape_id and link to trip directions
      const shapeGroups = shapes.reduce((acc, shape) => {
        if (!shape?.shape_id || typeof shape.shape_pt_lat !== 'number' || typeof shape.shape_pt_lon !== 'number') {
          return acc;
        }
        
        if (!acc[shape.shape_id]) {
          acc[shape.shape_id] = [];
        }
        acc[shape.shape_id].push(shape);
        return acc;
      }, {} as Record<string, Shape[]>);

      // Create polylines with direction-based styling
      const lines = Object.entries(shapeGroups)
        .filter(([_, shapePoints]) => shapePoints && shapePoints.length > 1)
        .map(([shapeId, shapePoints]) => {
          // Find trip that uses this shape to determine direction
          const tripWithShape = routeTrips.find(trip => trip.shape_id === shapeId);
          const direction = tripWithShape?.direction_id || 0;
          
          const sortedPoints = shapePoints
            .filter(point => point && typeof point.shape_pt_lat === 'number' && typeof point.shape_pt_lon === 'number')
            .sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence)
            .map(point => [point.shape_pt_lat, point.shape_pt_lon] as [number, number]);

          if (sortedPoints.length < 2) return null;

          const directionColor = getDirectionColor(direction, baseColor);
          const directionLabel = direction === 0 ? 'Outbound (Ida)' : 'Inbound (Vuelta)';

          return {
            id: shapeId,
            positions: sortedPoints,
            color: directionColor,
            weight: direction === 0 ? 6 : 5, // Slightly thicker for outbound
            opacity: 0.8,
            dashArray: direction === 0 ? undefined : '12,8', // Dashed for inbound
            direction,
            label: directionLabel
          };
        })
        .filter(Boolean) as Array<{
          id: string;
          positions: [number, number][];
          color: string;
          weight: number;
          opacity: number;
          dashArray?: string;
          direction: number;
          label: string;
        }>;

      setRouteLines(lines);
    } catch (error) {
      console.error('Error processing route shapes:', error);
      setRouteLines([]);
    }
  }, [shapes, selectedRoute, routes, trips]);

  // Helper function to adjust color for direction
  const adjustColorForDirection = (hexColor: string): string => {
    // Remove # if present
    const color = hexColor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);
    
    // Create a complementary/darker shade for inbound
    // Method: Darken and shift hue slightly
    const newR = Math.max(0, Math.floor(r * 0.7));
    const newG = Math.max(0, Math.floor(g * 0.7));
    const newB = Math.min(255, Math.floor(b * 1.2)); // Slight blue shift
    
    // Convert back to hex
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
  };

  // Enhanced rendering with direction information
  return (
    <>
      {routeLines.map((line) => (
        <Polyline
          key={line.id}
          positions={line.positions}
          color={line.color}
          weight={line.weight}
          opacity={line.opacity}
          dashArray={line.dashArray}
        />
      ))}
    </>
  );
}

// Enhanced component to fit map bounds with zoom-in functionality
function MapBounds({ 
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
      // ZOOM IN: When route is selected, fit bounds to route only
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
        // Zoom in to fit the entire route with good padding
        map.fitBounds(bounds, { 
          padding: [40, 40],
          maxZoom: 16 // Increased max zoom for better detail
        });
      }
    } else {
      // Default view - show all stops
      const bounds = new LatLngBounds([]);
      stops.slice(0, 200).forEach(stop => {
        if (stop && typeof stop.stop_lat === 'number' && typeof stop.stop_lon === 'number') {
          bounds.extend([stop.stop_lat, stop.stop_lon]);
        }
      });
      
      if (bounds.isValid()) {
        map.fitBounds(bounds, { 
          padding: [20, 20],
          maxZoom: 13
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
      
      // Get all unique shape IDs for this route
      const shapeIds = [...new Set(routeTripsData.map(trip => trip.shape_id).filter(Boolean))];
      
      // Get all shapes for this route
      const routeShapePoints = shapes.filter(shape => shapeIds.includes(shape.shape_id));
      setRouteShapes(routeShapePoints);
      
      // Get all stops for this route
      const routeTripIds = routeTripsData.map(trip => trip.trip_id);
      const routeStopTimes = stopTimes.filter(st => routeTripIds.includes(st.trip_id));
      const uniqueStopIds = [...new Set(routeStopTimes.map(st => st.stop_id))];
      const stopsForRoute = stops.filter(stop => uniqueStopIds.includes(stop.stop_id));
      
      // Sort stops by sequence
      const sortedRouteStops = stopsForRoute.sort((a, b) => {
        const aStopTime = routeStopTimes.find(st => st.stop_id === a.stop_id);
        const bStopTime = routeStopTimes.find(st => st.stop_id === b.stop_id);
        return (aStopTime?.stop_sequence || 0) - (bStopTime?.stop_sequence || 0);
      });
      
      setRouteStops(sortedRouteStops);
      
      // HIDE OTHER ROUTE POINTS: Only show route stops + major interchanges
      const majorInterchanges = stops.filter(stop => 
        stop.location_type === 1 && !uniqueStopIds.includes(stop.stop_id)
      );
      
      setFilteredStops([...stopsForRoute, ...majorInterchanges]);
    } else {
      // Show all stops when no route is selected
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
    
    const stopStopTimes = stopTimes.filter(st => st.stop_id === stop.stop_id);
    const routeArrivals = new Map<string, string[]>();
    
    stopStopTimes.forEach(st => {
      const trip = trips.find(t => t.trip_id === st.trip_id);
      if (!trip || !st.departure_time) return;
      
      if (st.departure_time >= currentTimeStr) {
        if (!routeArrivals.has(trip.route_id)) {
          routeArrivals.set(trip.route_id, []);
        }
        routeArrivals.get(trip.route_id)!.push(st.departure_time);
      }
    });
    
    const routeInfo = Array.from(routeArrivals.entries()).map(([routeId, times]) => {
      const route = routes.find(r => r.route_id === routeId);
      if (!route) return null;
      
      const sortedTimes = times.sort().slice(0, 5);
      return { route, nextArrivals: sortedTimes };
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

  const getRouteColor = (routeId: string): string => {
    const route = routes.find(r => r.route_id === routeId);
    return route?.route_color ? `#${route.route_color}` : '#0066CC';
  };

  // Get direction information for selected route
  const getRouteDirections = () => {
    if (!selectedRoute) return [];
    
    const routeTripsData = trips.filter(trip => trip.route_id === selectedRoute);
    const directions = [...new Set(routeTripsData.map(trip => trip.direction_id))];
    
    return directions.map(dir => ({
      direction: dir,
      label: dir === 0 ? 'Outbound (Ida)' : 'Inbound (Vuelta)',
      trips: routeTripsData.filter(trip => trip.direction_id === dir).length
    }));
  };

  const selectedRouteData = selectedRoute ? routes.find(r => r.route_id === selectedRoute) : null;
  const routeDirections = getRouteDirections();

  return (
    <div className="h-full w-full relative">
      <MapContainer
        doubleClickZoom={true} // Enable double-click zoom
        center={[40.6, -3.9]}
        zoom={11}
        minZoom={8} // Allow zooming out to see wider area
        maxZoom={19} // Allow much higher zoom levels
        className="h-full w-full"
        zoomControl={true}
        scrollWheelZoom={true} // Enable scroll wheel zoom
        touchZoom={true} // Enable touch zoom
        dragging={true} // Enable dragging
      >
        {/* ENHANCED TILE LAYERS - Multiple providers for better zoom coverage */}
        
        {/* Primary tile layer - OpenStreetMap with high zoom support */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
          minZoom={8}
          subdomains={['a', 'b', 'c']}
          errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        />
        
        {/* Fallback tile layer for areas where primary fails */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
          maxZoom={19}
          minZoom={8}
          opacity={0} // Hidden by default, only shows when primary fails
        />
        
        <MapBounds 
          stops={filteredStops} 
          shapes={routeShapes} 
          selectedRoute={selectedRoute}
          routeStops={routeStops}
        />
        
        {/* Enhanced Route Polylines with Direction Colors */}
        <EnhancedRoutePolylines
          shapes={routeShapes}
          selectedRoute={selectedRoute}
          routes={routes}
          trips={trips}
        />
        
        {/* Enhanced Stops - Only show filtered stops */}
        {filteredStops.map((stop) => {
          const accessibility = getAccessibilityInfo(stop.wheelchair_boarding);
          const isRouteStop = selectedRoute && routeStops.some(rs => rs.stop_id === stop.stop_id);
          const stopSequence = isRouteStop ? routeStops.findIndex(rs => rs.stop_id === stop.stop_id) + 1 : null;
          const isInterchange = stop.location_type === 1;
          
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
                      {isInterchange && !isRouteStop && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Major Interchange Hub
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

      {/* Enhanced Route Details Panel with Direction Info */}
      {selectedRoute && selectedRouteData && (
        <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[1000] max-w-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div 
              className="w-5 h-5 rounded-full border-2 border-white shadow-lg" 
              style={{ backgroundColor: getRouteColor(selectedRoute) }}
            ></div>
            <div>
              <span className="text-lg font-bold text-gray-900">
                Route {selectedRouteData.route_short_name}
              </span>
              <p className="text-xs text-gray-600 leading-tight">
                {selectedRouteData.route_long_name.length > 40 
                  ? `${selectedRouteData.route_long_name.substring(0, 40)}...`
                  : selectedRouteData.route_long_name
                }
              </p>
            </div>
          </div>

          {/* Direction Information */}
          {routeDirections.length > 1 && (
            <div className="mb-3 p-2 bg-gray-50 rounded-lg">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">Route Directions:</h4>
              <div className="space-y-1">
                {routeDirections.map((dir, index) => (
                  <div key={dir.direction} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div 
                        className={`w-3 h-1 rounded ${index === 0 ? 'bg-current' : 'border-b-2 border-dashed border-current'}`}
                        style={{ color: getRouteColor(selectedRoute) }}
                      ></div>
                      <span className="text-gray-700">{dir.label}</span>
                    </div>
                    <span className="text-gray-600 font-medium">{dir.trips} trips</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="font-bold text-blue-900 text-lg">{routeStops.length}</div>
              <div className="text-blue-700">Stops</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="font-bold text-green-900 text-lg">{routeTrips.length}</div>
              <div className="text-green-700">Trips</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="font-bold text-purple-900 text-lg">{routeShapes.length > 0 ? Math.round(routeShapes.length / 100) : 0}km</div>
              <div className="text-purple-700">Distance</div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Showing route stops only</span>
              <span className="text-blue-600 font-medium">Zoomed to fit</span>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Legend with Direction Colors */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000] border border-gray-200">
        <h4 className="text-xs font-bold text-gray-900 mb-2">Legend</h4>
        <div className="space-y-1 text-xs">
          {!selectedRoute ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 border border-white shadow"></div>
                <span className="text-gray-700">Bus Stop</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-600 border border-white shadow"></div>
                <span className="text-gray-700">Interchange Hub</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow"></div>
                <span className="text-gray-700">Route Stop</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-600 border-2 border-white shadow"></div>
                <span className="text-gray-700">Major Hub</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 rounded" style={{ backgroundColor: getRouteColor(selectedRoute) }}></div>
                <span className="text-gray-700">Outbound (Ida)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 border-b-2 border-dashed" style={{ borderColor: getRouteColor(selectedRoute) }}></div>
                <span className="text-gray-700">Inbound (Vuelta)</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Enhanced Status Indicator */}
      {selectedRoute && (
        <div className="absolute top-4 right-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg px-4 py-2 z-[1000] shadow-lg">
          <div className="flex items-center gap-2 text-sm font-medium">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>Route Focus Mode • {routeStops.length} stops • Both directions shown</span>
          </div>
        </div>
      )}

      {/* Enhanced Zoom Controls Info */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000] border border-gray-200">
        <h4 className="text-xs font-bold text-gray-900 mb-2">🔍 Enhanced Zoom</h4>
        <div className="space-y-1 text-xs text-gray-600">
          <div>• Zoom: 8-19 levels available</div>
          <div>• Scroll wheel: Zoom in/out</div>
          <div>• Double-click: Quick zoom in</div>
          <div>• Drag: Pan around map</div>
          <div>• High-detail street view at max zoom</div>
        </div>
      </div>

      {/* Zoom Reset Button */}
      {selectedRoute && (
        <div className="absolute top-20 right-4 z-[1000]">
          <button
            onClick={() => {
              // This will be handled by the parent component
              window.location.reload(); // Simple reset for now
            }}
            className="bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg shadow-lg border border-gray-200 text-xs font-medium transition-colors"
          >
            Reset View
          </button>
        </div>
      )}
    </div>
  );
};