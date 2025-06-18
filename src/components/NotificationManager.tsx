import React, { useState } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { Notification } from '../types/notifications';
import { Plus, Edit, Trash2, Bell, Settings, Save, X, Calendar, Clock, Bus, Navigation, MapPin, Globe, Eye, EyeOff, AlertCircle, CheckCircle, Info } from 'lucide-react';

export const NotificationManager: React.FC = () => {
  const { notifications, addNotification, updateNotification, removeNotification } = useNotifications();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Notification>>({
    type: 'info',
    priority: 'medium',
    scope: 'global',
    isActive: true,
    dismissible: true,
    autoHide: false,
    showOnMap: true,
    showInSchedules: true,
    showInPlanner: true
  });

  const resetForm = () => {
    setFormData({
      type: 'info',
      priority: 'medium',
      scope: 'global',
      isActive: true,
      dismissible: true,
      autoHide: false,
      showOnMap: true,
      showInSchedules: true,
      showInPlanner: true
    });
    setIsCreating(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.message) {
      alert('Title and message are required');
      return;
    }

    try {
      if (editingId) {
        updateNotification(editingId, formData);
        console.log('✅ Updated notification:', editingId);
      } else {
        const newId = addNotification(formData as Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>);
        console.log('✅ Created notification:', newId);
      }
      
      resetForm();
      
      // Show success message
      alert(editingId ? 'Notification updated successfully!' : 'Notification created successfully!');
    } catch (error) {
      console.error('❌ Error saving notification:', error);
      alert('Error saving notification. Please try again.');
    }
  };

  const handleEdit = (notification: Notification) => {
    setFormData(notification);
    setEditingId(notification.id);
    setIsCreating(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this notification?')) {
      removeNotification(id);
      console.log('🗑️ Deleted notification:', id);
    }
  };

  const toggleNotificationActive = (notification: Notification) => {
    updateNotification(notification.id, { isActive: !notification.isActive });
    console.log(`🔄 Toggled notification ${notification.id} to ${!notification.isActive ? 'active' : 'inactive'}`);
  };

  const getScopeIcon = (scope: Notification['scope']) => {
    switch (scope) {
      case 'route': return Bus;
      case 'direction': return Navigation;
      case 'departure': return Clock;
      case 'page': return MapPin;
      case 'global': return Globe;
      default: return Bell;
    }
  };

  const getScopeDescription = (notification: Notification) => {
    switch (notification.scope) {
      case 'global':
        return 'Shows on all pages and all routes';
      case 'page':
        return `Shows on: ${notification.targetPages?.join(', ') || 'No pages selected'}`;
      case 'route':
        return `Routes: ${notification.targetRoutes?.join(', ') || 'No routes selected'}`;
      case 'direction':
        return `Directions: ${notification.targetDirections?.length || 0} configured`;
      case 'departure':
        return `Departures: ${notification.targetDepartures?.length || 0} configured`;
      default:
        return 'Unknown scope';
    }
  };

  const getAffectedAreas = (notification: Notification) => {
    const areas = [];
    
    if (notification.scope === 'global') {
      areas.push('🌍 All pages', '🚌 All routes', '🗺️ Map view', '📅 Schedules', '🧭 Journey planner');
    } else {
      if (notification.scope === 'page' && notification.targetPages) {
        areas.push(...notification.targetPages.map(page => `📄 ${page.charAt(0).toUpperCase() + page.slice(1)} page`));
      }
      if (notification.scope === 'route' && notification.targetRoutes) {
        areas.push(...notification.targetRoutes.map(route => `🚌 Route ${route}`));
      }
      if (notification.showOnMap) areas.push('🗺️ Map view');
      if (notification.showInSchedules) areas.push('📅 Schedule view');
      if (notification.showInPlanner) areas.push('🧭 Journey planner');
    }
    
    return areas;
  };

  // Debug: Log current notifications
  console.log('🔍 Current notifications in manager:', notifications);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Bell className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Notification Center</h3>
              <p className="text-sm text-gray-600">
                Manage system-wide alerts and warnings • {notifications.length} total notifications
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Notification
          </button>
        </div>

        {/* System Status */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Total</span>
            </div>
            <div className="text-2xl font-bold text-blue-900">{notifications.length}</div>
            <div className="text-xs text-blue-700">All notifications</div>
          </div>
          
          <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">Active</span>
            </div>
            <div className="text-2xl font-bold text-green-900">
              {notifications.filter(n => n.isActive).length}
            </div>
            <div className="text-xs text-green-700">Currently showing</div>
          </div>
          
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Global</span>
            </div>
            <div className="text-2xl font-bold text-purple-900">
              {notifications.filter(n => n.scope === 'global').length}
            </div>
            <div className="text-xs text-purple-700">System-wide alerts</div>
          </div>
          
          <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <Bus className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-900">Route-Specific</span>
            </div>
            <div className="text-2xl font-bold text-orange-900">
              {notifications.filter(n => n.scope === 'route').length}
            </div>
            <div className="text-xs text-orange-700">Route alerts</div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">📋 How Notifications Work</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
            <div>
              <strong>🌍 Global:</strong> Shows everywhere - all pages, all routes, map view
            </div>
            <div>
              <strong>📄 Page-Specific:</strong> Shows only on selected pages (Schedule, Planner, etc.)
            </div>
            <div>
              <strong>🚌 Route-Specific:</strong> Shows when that route is selected or viewed
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Form */}
      {isCreating && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">
              {editingId ? '✏️ Edit Notification' : '➕ Create New Notification'}
            </h4>
            <button
              onClick={resetForm}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title * <span className="text-red-500">Required</span>
                </label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Route 670 Service Alert"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={formData.type || 'info'}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as Notification['type'] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="info">ℹ️ Info</option>
                  <option value="warning">⚠️ Warning</option>
                  <option value="alert">🚨 Alert</option>
                  <option value="maintenance">🔧 Maintenance</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message * <span className="text-red-500">Required</span>
              </label>
              <textarea
                value={formData.message || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="e.g., Route 670 is experiencing delays due to construction work. Expect 10-15 minute delays during peak hours."
                required
              />
            </div>

            {/* Priority and Scope */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  value={formData.priority || 'medium'}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as Notification['priority'] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">🟢 Low</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="high">🟠 High</option>
                  <option value="critical">🔴 Critical</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scope</label>
                <select
                  value={formData.scope || 'global'}
                  onChange={(e) => setFormData(prev => ({ ...prev, scope: e.target.value as Notification['scope'] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="global">🌍 Global (Shows everywhere)</option>
                  <option value="page">📄 Specific Pages</option>
                  <option value="route">🚌 Specific Routes</option>
                  <option value="direction">🧭 Route Directions</option>
                  <option value="departure">🕐 Departure Times</option>
                </select>
              </div>
            </div>

            {/* Conditional Targeting Fields */}
            {formData.scope === 'page' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Pages</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {['overview', 'planner', 'schedule', 'calendar'].map(page => (
                    <label key={page} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.targetPages?.includes(page as any) || false}
                        onChange={(e) => {
                          const pages = formData.targetPages || [];
                          if (e.target.checked) {
                            setFormData(prev => ({ ...prev, targetPages: [...pages, page as any] }));
                          } else {
                            setFormData(prev => ({ ...prev, targetPages: pages.filter(p => p !== page) }));
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm capitalize">{page}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {formData.scope === 'route' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Routes (comma-separated route IDs)
                </label>
                <input
                  type="text"
                  value={formData.targetRoutes?.join(', ') || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    targetRoutes: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 8__670___, 8__671___, 8__672___"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter route IDs separated by commas. Example: 8__670___, 8__671___
                </p>
              </div>
            )}

            {/* Display Settings */}
            <div className="space-y-3">
              <h5 className="font-medium text-gray-900">Display Settings</h5>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">✅ Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.dismissible || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, dismissible: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">❌ Dismissible</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.autoHide || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, autoHide: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">⏰ Auto Hide</span>
                </label>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center gap-3 pt-4">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Save className="w-4 h-4" />
                {editingId ? 'Update Notification' : 'Create Notification'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Notifications List */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-lg font-semibold text-gray-900">
            📋 All Notifications ({notifications.length})
          </h4>
          {notifications.length > 0 && (
            <div className="text-sm text-gray-600">
              {notifications.filter(n => n.isActive).length} active • {notifications.filter(n => !n.isActive).length} inactive
            </div>
          )}
        </div>
        
        {notifications.length === 0 ? (
          <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
            <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h5 className="text-xl font-semibold text-gray-900 mb-2">No Notifications Yet</h5>
            <p className="text-gray-600 mb-4">Create your first notification to get started.</p>
            <button
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Notification
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map(notification => {
              const ScopeIcon = getScopeIcon(notification.scope);
              const affectedAreas = getAffectedAreas(notification);
              
              return (
                <div key={notification.id} className={`p-6 rounded-lg border transition-all ${
                  notification.isActive 
                    ? 'bg-white border-gray-200 shadow-sm' 
                    : 'bg-gray-50 border-gray-300 opacity-75'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <ScopeIcon className="w-5 h-5 text-gray-600" />
                        <h5 className="text-lg font-semibold text-gray-900">{notification.title}</h5>
                        
                        {/* Status Badges */}
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            notification.priority === 'critical' ? 'bg-red-100 text-red-800' :
                            notification.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                            notification.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {notification.priority.toUpperCase()}
                          </span>
                          
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            notification.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                            notification.type === 'alert' ? 'bg-red-100 text-red-800' :
                            notification.type === 'maintenance' ? 'bg-blue-100 text-blue-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {notification.type.toUpperCase()}
                          </span>
                          
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {notification.scope.toUpperCase()}
                          </span>
                          
                          {notification.isActive ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              INACTIVE
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-gray-700 mb-4 text-base leading-relaxed">{notification.message}</p>
                      
                      {/* Affected Areas */}
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <h6 className="text-sm font-semibold text-blue-900 mb-2">📍 Where This Notification Appears:</h6>
                        <div className="flex flex-wrap gap-2">
                          {affectedAreas.map((area, index) => (
                            <span key={index} className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {area}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>📅 Created: {notification.createdAt.toLocaleDateString()} • Updated: {notification.updatedAt.toLocaleDateString()}</div>
                        <div>
                          🎛️ Settings: 
                          {notification.dismissible && ' Dismissible'}
                          {notification.autoHide && ` • Auto-hide (${notification.autoHideDelay}s)`}
                          {notification.showOnMap && ' • Map'}
                          {notification.showInSchedules && ' • Schedules'}
                          {notification.showInPlanner && ' • Planner'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-6">
                      <button
                        onClick={() => toggleNotificationActive(notification)}
                        className={`p-2 rounded-lg transition-colors ${
                          notification.isActive 
                            ? 'text-green-600 hover:text-green-800 hover:bg-green-50' 
                            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                        }`}
                        title={notification.isActive ? 'Deactivate notification' : 'Activate notification'}
                      >
                        {notification.isActive ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => handleEdit(notification)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit notification"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(notification.id)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete notification"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};