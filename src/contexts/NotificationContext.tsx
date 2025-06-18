import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Notification, NotificationContextType } from '../types/notifications';

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // 🚀 LOAD STATIC NOTIFICATIONS FROM JSON FILE
  useEffect(() => {
    const loadStaticNotifications = async () => {
      try {
        console.log('📥 Loading static notifications from /notifications.json...');
        
        const response = await fetch('/notifications.json');
        if (!response.ok) {
          throw new Error(`Failed to load notifications: ${response.status}`);
        }
        
        const staticNotifications = await response.json();
        console.log('✅ Loaded static notifications:', staticNotifications);
        
        // Parse dates and set notifications
        const parsedNotifications = staticNotifications.map((n: any) => ({
          ...n,
          startDate: n.startDate ? new Date(n.startDate) : undefined,
          endDate: n.endDate ? new Date(n.endDate) : undefined,
          createdAt: new Date(n.createdAt),
          updatedAt: new Date(n.updatedAt)
        }));
        
        setNotifications(parsedNotifications);
        console.log(`🎯 Set ${parsedNotifications.length} static notifications`);
        
      } catch (error) {
        console.error('❌ Error loading static notifications:', error);
        // Set empty array on error
        setNotifications([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadStaticNotifications();
  }, []);

  // Load dismissed notifications from localStorage
  useEffect(() => {
    const savedDismissed = localStorage.getItem('transit-dismissed-notifications');
    if (savedDismissed) {
      try {
        setDismissedNotifications(new Set(JSON.parse(savedDismissed)));
        console.log('📋 Loaded dismissed notifications from localStorage');
      } catch (error) {
        console.error('❌ Error loading dismissed notifications:', error);
      }
    }
  }, []);

  // Save dismissed notifications to localStorage
  useEffect(() => {
    localStorage.setItem('transit-dismissed-notifications', JSON.stringify(Array.from(dismissedNotifications)));
  }, [dismissedNotifications]);

  // 🚫 REMOVE ADMIN FUNCTIONS - Static notifications are read-only
  const addNotification = useCallback(() => {
    console.warn('⚠️ Cannot add notifications - using static JSON file');
    throw new Error('Notifications are managed via static JSON file');
  }, []);

  const updateNotification = useCallback(() => {
    console.warn('⚠️ Cannot update notifications - using static JSON file');
    throw new Error('Notifications are managed via static JSON file');
  }, []);

  const removeNotification = useCallback(() => {
    console.warn('⚠️ Cannot remove notifications - using static JSON file');
    throw new Error('Notifications are managed via static JSON file');
  }, []);

  const dismissNotification = useCallback((id: string) => {
    console.log('❌ Dismissing notification:', id);
    setDismissedNotifications(prev => new Set([...prev, id]));
  }, []);

  // Check if notification is currently active
  const isNotificationActive = useCallback((notification: Notification): boolean => {
    if (!notification.isActive) return false;
    if (dismissedNotifications.has(notification.id) && notification.dismissible) return false;
    
    const now = new Date();
    if (notification.startDate && now < notification.startDate) return false;
    if (notification.endDate && now > notification.endDate) return false;
    
    return true;
  }, [dismissedNotifications]);

  const getNotificationsForPage = useCallback((page: string): Notification[] => {
    const filtered = notifications.filter(notification => {
      if (!isNotificationActive(notification)) return false;
      
      if (notification.scope === 'global') return true;
      if (notification.scope === 'page' && notification.targetPages?.includes(page as any)) return true;
      
      return false;
    }).sort((a, b) => {
      // Sort by priority: critical > high > medium > low
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    console.log(`🔍 Notifications for page "${page}":`, filtered);
    return filtered;
  }, [notifications, isNotificationActive]);

  const getNotificationsForRoute = useCallback((routeId: string, direction?: number): Notification[] => {
    const filtered = notifications.filter(notification => {
      if (!isNotificationActive(notification)) return false;
      
      if (notification.scope === 'global') return true;
      
      if (notification.scope === 'route' && notification.targetRoutes?.includes(routeId)) return true;
      
      if (notification.scope === 'direction' && notification.targetDirections?.some(target => 
        target.routeId === routeId && (direction === undefined || target.direction === direction)
      )) return true;
      
      return false;
    }).sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    console.log(`🔍 Notifications for route "${routeId}" (direction: ${direction}):`, filtered);
    return filtered;
  }, [notifications, isNotificationActive]);

  const getNotificationsForDeparture = useCallback((routeId: string, direction: number, time: string): Notification[] => {
    const filtered = notifications.filter(notification => {
      if (!isNotificationActive(notification)) return false;
      
      if (notification.scope === 'global') return true;
      
      // Check route-level notifications
      if (notification.scope === 'route' && notification.targetRoutes?.includes(routeId)) return true;
      
      // Check direction-level notifications
      if (notification.scope === 'direction' && notification.targetDirections?.some(target => 
        target.routeId === routeId && target.direction === direction
      )) return true;
      
      // Check departure-specific notifications
      if (notification.scope === 'departure' && notification.targetDepartures?.some(target => {
        if (target.routeId !== routeId) return false;
        if (target.direction !== undefined && target.direction !== direction) return false;
        
        // Check specific times
        if (target.specificTimes?.includes(time)) return true;
        
        // Check time range
        if (target.timeRange) {
          const timeMinutes = timeToMinutes(time);
          const startMinutes = timeToMinutes(target.timeRange.start);
          const endMinutes = timeToMinutes(target.timeRange.end);
          
          if (timeMinutes >= startMinutes && timeMinutes <= endMinutes) return true;
        }
        
        return false;
      })) return true;
      
      return false;
    }).sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    console.log(`🔍 Notifications for departure "${routeId}" (${direction}) at ${time}:`, filtered);
    return filtered;
  }, [notifications, isNotificationActive]);

  // Helper function to convert time string to minutes
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Debug logging
  useEffect(() => {
    if (!isLoading) {
      console.log('🔄 Static notification system ready:', {
        totalNotifications: notifications.length,
        activeNotifications: notifications.filter(n => n.isActive).length,
        dismissedCount: dismissedNotifications.size,
        source: 'Static JSON file (/notifications.json)'
      });
    }
  }, [notifications, dismissedNotifications, isLoading]);

  const contextValue: NotificationContextType = {
    notifications: notifications.filter(isNotificationActive),
    addNotification,
    updateNotification,
    removeNotification,
    dismissNotification,
    getNotificationsForPage,
    getNotificationsForRoute,
    getNotificationsForDeparture
  };

  // Show loading state
  if (isLoading) {
    return (
      <NotificationContext.Provider value={contextValue}>
        {children}
      </NotificationContext.Provider>
    );
  }

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};