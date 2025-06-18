import React from 'react';
import { Route, RouteAnalytics } from '../types/gtfs';
import { Bus, ExternalLink, Info, TrendingUp, MapPin, Clock } from 'lucide-react';

interface RouteListProps {
  routes: Route[];
  selectedRoute?: string;
  onRouteSelect: (routeId: string | undefined) => void;
  onRouteDetails?: (route: Route) => void;
  routeAnalytics: RouteAnalytics[];
}

export const RouteList: React.FC<RouteListProps> = ({ 
  routes, 
  selectedRoute, 
  onRouteSelect, 
  onRouteDetails,
  routeAnalytics 
}) => {
  const getRouteTypeLabel = (type: number): string => {
    switch (type) {
      case 3:
        return 'Bus';
      case 0:
        return 'Tram';
      case 1:
        return 'Metro';
      case 2:
        return 'Rail';
      default:
        return 'Transit';
    }
  };

  const getRouteBadgeClass = (routeColor: string): string => {
    return routeColor === '8EBF42' ? 'route-badge-green' : 'route-badge-red';
  };

  const getRouteAnalytics = (routeId: string) => {
    return routeAnalytics.find(ra => ra.route_id === routeId);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Routes</h3>
        {selectedRoute && (
          <button
            onClick={() => onRouteSelect(undefined)}
            className="text-sm text-madrid-primary hover:text-madrid-primary/80 font-medium"
          >
            Clear Filter
          </button>
        )}
      </div>
      
      <div className="space-y-2 max-h-96 overflow-y-auto sidebar-scroll">
        {routes.map((route) => {
          const analytics = getRouteAnalytics(route.route_id);
          
          return (
            <div
              key={route.route_id}
              className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                selectedRoute === route.route_id
                  ? 'border-madrid-primary bg-madrid-primary/5 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-madrid-primary/50 hover:shadow-sm'
              }`}
              onClick={() => onRouteSelect(selectedRoute === route.route_id ? undefined : route.route_id)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 p-2 bg-gray-100 rounded-lg">
                  <Bus className="w-4 h-4 text-gray-600" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`route-badge ${getRouteBadgeClass(route.route_color)}`}>
                      {route.route_short_name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {getRouteTypeLabel(route.route_type)}
                    </span>
                  </div>
                  
                  <h4 className="font-medium text-gray-900 text-sm leading-tight mb-1">
                    {route.route_long_name}
                  </h4>
                  
                  {route.route_desc && (
                    <p className="text-xs text-gray-600 mb-2">
                      {route.route_desc}
                    </p>
                  )}

                  {/* Analytics Preview */}
                  {analytics && (
                    <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-blue-600" />
                        <span className="text-gray-600">{analytics.total_trips}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-green-600" />
                        <span className="text-gray-600">{analytics.total_stops}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-purple-600" />
                        <span className="text-gray-600">{analytics.service_hours}h</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <a
                      href={route.route_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-madrid-primary hover:text-madrid-primary/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>CRTM</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    
                    {onRouteDetails && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRouteDetails(route);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-madrid-secondary hover:text-madrid-secondary/80"
                      >
                        <Info className="w-3 h-3" />
                        <span>Details</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};