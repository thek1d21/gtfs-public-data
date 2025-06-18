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

  // Load notifications from localStorage on mount
  useEffect(() => {
    console.log('🔄 Loading notifications from localStorage...');
    
    const savedNotifications = localStorage.getItem('transit-notifications');
    const savedDismissed = localStorage.getItem('transit-dismissed-notifications');
    
    if (savedNotifications) {
      try {
        const parsed = JSON.parse(savedNotifications);
        console.log('📥 Loaded notifications from storage:', parsed);
        
        setNotifications(parsed.map((n: any) => ({
          ...n,
          startDate: n.startDate ? new Date(n.startDate) : undefined,
          endDate: n.endDate ? new Date(n.endDate) : undefined,
          createdAt: new Date(n.createdAt),
          updatedAt: new Date(n.updatedAt)
        })));
      } catch (error) {
        console.error('❌ Error loading notifications:', error);
      }
    } else {
      console.log('📭 No saved notifications found');
    }
    
    if (savedDismissed) {
      try {
        setDismissedNotifications(new Set(JSON.parse(savedDismissed)));
      } catch (error) {
        console.error('❌ Error loading dismissed notifications:', error);
      }
    }
  }, []);

  // Save notifications to localStorage whenever they change
  useEffect(() => {
    if (notifications.length > 0) {
      console.log('💾 Saving notifications to localStorage:', notifications);
      localStorage.setItem('transit-notifications', JSON.stringify(notifications));
    }
  }, [notifications]);

  // Save dismissed notifications to localStorage
  useEffect(() => {
    localStorage.setItem('transit-dismissed-notifications', JSON.stringify(Array.from(dismissedNotifications)));
  }, [dismissedNotifications]);

  const addNotification = useCallback((notificationData: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newNotification: Notification = {
      ...notificationData,
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('➕ Adding new notification:', newNotification);
    
    setNotifications(prev => {
      const updated = [...prev, newNotification];
      console.log('📋 Updated notifications list:', updated);
      return updated;
    });
    
    return newNotification.id;
  }, []);

  const updateNotification = useCallback((id: string, updates: Partial<Notification>) => {
    console.log('✏️ Updating notification:', id, updates);
    
    setNotifications(prev => prev.map(notification => 
      notification.id === id 
        ? { ...notification, ...updates, updatedAt: new Date() }
        : notification
    ));
  }, []);

  const removeNotification = useCallback((id: string) => {
    console.log('🗑️ Removing notification:', id);
    
    setNotifications(prev => prev.filter(notification => notification.id !== id));
    setDismissedNotifications(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
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
    console.log('🔄 Notification context state updated:', {
      totalNotifications: notifications.length,
      activeNotifications: notifications.filter(n => n.isActive).length,
      dismissedCount: dismissedNotifications.size
    });
  }, [notifications, dismissedNotifications]);

  const contextValue: NotificationContextType = {
    notifications: notifications, // Return ALL notifications, not just active ones
    addNotification,
    updateNotification,
    removeNotification,
    dismissNotification,
    getNotificationsForPage,
    getNotificationsForRoute,
    getNotificationsForDeparture
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};