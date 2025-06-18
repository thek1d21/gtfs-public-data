export interface Notification {
  id: string;
  type: 'warning' | 'info' | 'alert' | 'maintenance';
  title: string;
  message: string;
  isActive: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  // Targeting options
  scope: 'global' | 'page' | 'route' | 'direction' | 'departure';
  
  // Page targeting
  targetPages?: ('overview' | 'planner' | 'schedule' | 'calendar')[];
  
  // Route targeting
  targetRoutes?: string[]; // route_ids
  
  // Direction targeting (for routes)
  targetDirections?: {
    routeId: string;
    direction: number; // 0 = outbound, 1 = inbound
  }[];
  
  // Departure time targeting
  targetDepartures?: {
    routeId: string;
    direction?: number;
    timeRange?: {
      start: string; // HH:MM format
      end: string;   // HH:MM format
    };
    specificTimes?: string[]; // Specific departure times
  }[];
  
  // Display settings
  showOnMap?: boolean;
  showInSchedules?: boolean;
  showInPlanner?: boolean;
  dismissible?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number; // seconds
  
  // Timing
  startDate?: Date;
  endDate?: Date;
  
  // Styling
  backgroundColor?: string;
  textColor?: string;
  icon?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateNotification: (id: string, updates: Partial<Notification>) => void;
  removeNotification: (id: string) => void;
  dismissNotification: (id: string) => void;
  getNotificationsForPage: (page: string) => Notification[];
  getNotificationsForRoute: (routeId: string, direction?: number) => Notification[];
  getNotificationsForDeparture: (routeId: string, direction: number, time: string) => Notification[];
}