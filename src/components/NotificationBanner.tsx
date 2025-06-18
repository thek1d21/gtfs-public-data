import React, { useState, useEffect } from 'react';
import { Notification } from '../types/notifications';
import { AlertTriangle, Info, AlertCircle, Wrench, X, Clock, MapPin, Bus, Navigation } from 'lucide-react';

interface NotificationBannerProps {
  notifications: Notification[];
  onDismiss?: (id: string) => void;
  compact?: boolean;
  showIcons?: boolean;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  notifications,
  onDismiss,
  compact = false,
  showIcons = true
}) => {
  const [visibleNotifications, setVisibleNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    setVisibleNotifications(notifications);
  }, [notifications]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'warning':
        return AlertTriangle;
      case 'alert':
        return AlertCircle;
      case 'maintenance':
        return Wrench;
      case 'info':
      default:
        return Info;
    }
  };

  const getNotificationColors = (notification: Notification) => {
    if (notification.backgroundColor && notification.textColor) {
      return {
        backgroundColor: notification.backgroundColor,
        color: notification.textColor
      };
    }

    switch (notification.type) {
      case 'warning':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'alert':
        return 'bg-red-50 text-red-800 border-red-200';
      case 'maintenance':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'info':
      default:
        return 'bg-blue-50 text-blue-800 border-blue-200';
    }
  };

  const getPriorityBadge = (priority: Notification['priority']) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getScopeIcon = (scope: Notification['scope']) => {
    switch (scope) {
      case 'route':
        return Bus;
      case 'direction':
        return Navigation;
      case 'departure':
        return Clock;
      case 'page':
        return MapPin;
      case 'global':
      default:
        return Info;
    }
  };

  const handleDismiss = (notification: Notification) => {
    if (notification.dismissible && onDismiss) {
      onDismiss(notification.id);
    }
  };

  const handleAutoHide = (notification: Notification) => {
    if (notification.autoHide && notification.autoHideDelay) {
      setTimeout(() => {
        setVisibleNotifications(prev => prev.filter(n => n.id !== notification.id));
      }, notification.autoHideDelay * 1000);
    }
  };

  useEffect(() => {
    visibleNotifications.forEach(notification => {
      if (notification.autoHide) {
        handleAutoHide(notification);
      }
    });
  }, [visibleNotifications]);

  if (visibleNotifications.length === 0) return null;

  return (
    <div className="space-y-2">
      {visibleNotifications.map(notification => {
        const Icon = getNotificationIcon(notification.type);
        const ScopeIcon = getScopeIcon(notification.scope);
        const colors = getNotificationColors(notification);
        
        return (
          <div
            key={notification.id}
            className={`rounded-lg border p-4 ${typeof colors === 'string' ? colors : ''}`}
            style={typeof colors === 'object' ? colors : undefined}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              {showIcons && (
                <div className="flex-shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
              )}
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-sm">{notification.title}</h4>
                  
                  {/* Priority Badge */}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityBadge(notification.priority)}`}>
                    {notification.priority.toUpperCase()}
                  </span>
                  
                  {/* Scope Badge */}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300">
                    <ScopeIcon className="w-3 h-3" />
                    {notification.scope}
                  </span>
                </div>
                
                <p className={`text-sm ${compact ? 'line-clamp-2' : ''}`}>
                  {notification.message}
                </p>
                
                {/* Additional Info */}
                {!compact && (
                  <div className="mt-2 space-y-1">
                    {/* Route targeting */}
                    {notification.targetRoutes && notification.targetRoutes.length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <Bus className="w-3 h-3" />
                        <span>Routes: {notification.targetRoutes.join(', ')}</span>
                      </div>
                    )}
                    
                    {/* Direction targeting */}
                    {notification.targetDirections && notification.targetDirections.length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <Navigation className="w-3 h-3" />
                        <span>
                          Directions: {notification.targetDirections.map(d => 
                            `${d.routeId} (${d.direction === 0 ? 'Outbound' : 'Inbound'})`
                          ).join(', ')}
                        </span>
                      </div>
                    )}
                    
                    {/* Departure targeting */}
                    {notification.targetDepartures && notification.targetDepartures.length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="w-3 h-3" />
                        <span>
                          Departures: {notification.targetDepartures.map(d => {
                            let desc = d.routeId;
                            if (d.direction !== undefined) desc += ` (${d.direction === 0 ? 'Outbound' : 'Inbound'})`;
                            if (d.timeRange) desc += ` ${d.timeRange.start}-${d.timeRange.end}`;
                            if (d.specificTimes) desc += ` at ${d.specificTimes.join(', ')}`;
                            return desc;
                          }).join('; ')}
                        </span>
                      </div>
                    )}
                    
                    {/* Page targeting */}
                    {notification.targetPages && notification.targetPages.length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <MapPin className="w-3 h-3" />
                        <span>Pages: {notification.targetPages.join(', ')}</span>
                      </div>
                    )}
                    
                    {/* Timing info */}
                    {(notification.startDate || notification.endDate) && (
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="w-3 h-3" />
                        <span>
                          {notification.startDate && `From ${notification.startDate.toLocaleDateString()}`}
                          {notification.startDate && notification.endDate && ' '}
                          {notification.endDate && `Until ${notification.endDate.toLocaleDateString()}`}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Dismiss Button */}
              {notification.dismissible && (
                <button
                  onClick={() => handleDismiss(notification)}
                  className="flex-shrink-0 p-1 hover:bg-black/10 rounded transition-colors"
                  aria-label="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};