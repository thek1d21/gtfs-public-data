import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Icon, LatLngBounds } from 'leaflet';
import { Stop, Route, Shape, Trip } from '../types/gtfs';
import { MapPin, Bus, Accessibility, Navigation, Info } from 'lucide-react';

interface TransitMapProps {
  stops: Stop[];
  routes: Route[];
  shapes: Shape[];
  trips: Trip[];
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
  selectedRoute,
  onStopClick,
  onRouteClick
}) => {
  const [filteredStops, setFilteredStops] = useState<Stop[]>(stops);
  const [routeShapes, setRouteShapes] = useState<Shape[]>([]);
  const [hoveredStop, setHoveredStop] = useState<string | null>(null);

  useEffect(() => {
    if (selectedRoute) {
      // Get trips for selected route
      const routeTrips = trips.filter(trip => trip.route_id === selectedRoute);
      const shapeIds = [...new Set(routeTrips.map(trip => trip.shape_id))];
      
      // Get shapes for route
      const routeShapePoints = shapes.filter(shape => shapeIds.includes(shape.shape_id));
      setRouteShapes(routeShapePoints);
      
      // For now, show all stops (in a real app, you'd filter by route stops)
      setFilteredStops(stops);
    } else {
      setFilteredStops(stops);
      setRouteShapes([]);
    }
  }, [selectedRoute, stops, shapes, trips]);

  const getStopIcon = (stop: Stop) => {
    if (hoveredStop === stop.stop_id) return selectedStopIcon;
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
        
        {/* Route Shapes */}
        {Object.entries(shapeGroups).map(([shapeId, shapePoints]) => {
          const sortedPoints = shapePoints
            .sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence)
            .map(point => [point.shape_pt_lat, point.shape_pt_lon] as [number, number]);
          
          return (
            <Polyline
              key={shapeId}
              positions={sortedPoints}
              color={selectedRoute ? getRouteColor(selectedRoute) : '#8EBF42'}
              weight={4}
              opacity={0.8}
            />
          );
        })}
        
        {/* Stops */}
        {filteredStops.map((stop) => {
          const accessibility = getAccessibilityInfo(stop.wheelchair_boarding);
          
          return (
            <Marker
              key={stop.stop_id}
              position={[stop.stop_lat, stop.stop_lon]}
              icon={getStopIcon(stop)}
              eventHandlers={{
                mouseover: () => setHoveredStop(stop.stop_id),
                mouseout: () => setHoveredStop(null),
                click: () => onStopClick?.(stop)
              }}
            >
              <Popup className="custom-popup">
                <div className="min-w-[280px]">
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
                    </div>
                  </div>
                  
                  {stop.stop_desc && (
                    <p className="text-xs text-gray-700 mb-3 leading-relaxed">
                      {stop.stop_desc}
                    </p>
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
                    {onStopClick && (
                      <button
                        onClick={() => onStopClick(stop)}
                        className="flex-1 text-xs text-white bg-madrid-primary hover:bg-madrid-primary/90 font-medium text-center py-2 rounded-lg transition-colors"
                      >
                        <Info className="w-3 h-3 inline mr-1" />
                        Details
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map Controls */}
      {selectedRoute && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: getRouteColor(selectedRoute) }}></div>
            <span className="text-sm font-medium text-gray-900">
              Route {routes.find(r => r.route_id === selectedRoute)?.route_short_name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};