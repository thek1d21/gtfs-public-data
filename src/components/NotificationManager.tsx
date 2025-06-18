import React, { useState } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { Notification } from '../types/notifications';
import { Bell, Settings, Calendar, Clock, Bus, Navigation, MapPin, Globe, Eye, EyeOff, AlertCircle, CheckCircle, Info, FileText, Code, Download, Upload } from 'lucide-react';

export const NotificationManager: React.FC = () => {
  const { notifications } = useNotifications();
  const [showJsonCode, setShowJsonCode] = useState(false);

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

  const downloadNotificationsJson = () => {
    const dataStr = JSON.stringify(notifications, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'notifications.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const copyJsonToClipboard = () => {
    const jsonString = JSON.stringify(notifications, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      alert('JSON copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy JSON to clipboard');
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Static Notification System</h3>
              <p className="text-sm text-gray-600">
                📁 Loaded from <code className="bg-gray-100 px-2 py-1 rounded text-xs">/public/notifications.json</code> • {notifications.length} notifications
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowJsonCode(!showJsonCode)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              <Code className="w-4 h-4" />
              {showJsonCode ? 'Hide JSON' : 'View JSON'}
            </button>
            <button
              onClick={downloadNotificationsJson}
              className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>

        {/* System Status */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Static File</span>
            </div>
            <div className="text-2xl font-bold text-blue-900">{notifications.length}</div>
            <div className="text-xs text-blue-700">From JSON file</div>
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
          <h4 className="text-sm font-semibold text-gray-900 mb-2">📋 Static Notification System</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
            <div>
              <strong>📁 File-Based:</strong> Notifications are stored in <code>/public/notifications.json</code>
            </div>
            <div>
              <strong>🚀 Build-Time:</strong> Loaded when the app starts, shared by all users
            </div>
            <div>
              <strong>✏️ Edit JSON:</strong> Modify the JSON file to add/edit/remove notifications
            </div>
            <div>
              <strong>🔄 Deploy:</strong> Changes take effect when you redeploy the app
            </div>
          </div>
        </div>
      </div>

      {/* JSON Code Viewer */}
      {showJsonCode && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">📄 notifications.json Content</h4>
            <button
              onClick={copyJsonToClipboard}
              className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
            >
              <Upload className="w-4 h-4" />
              Copy to Clipboard
            </button>
          </div>
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
            <pre className="text-sm font-mono whitespace-pre-wrap">
              {JSON.stringify(notifications, null, 2)}
            </pre>
          </div>
          <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-800">
              <strong>💡 To edit notifications:</strong> Copy this JSON, modify it, and replace the content in <code>/public/notifications.json</code>. 
              Then redeploy your app for changes to take effect.
            </p>
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-lg font-semibold text-gray-900">
            📋 Current Notifications ({notifications.length})
          </h4>
          {notifications.length > 0 && (
            <div className="text-sm text-gray-600">
              {notifications.filter(n => n.isActive).length} active • {notifications.filter(n => !n.isActive).length} inactive
            </div>
          )}
        </div>
        
        {notifications.length === 0 ? (
          <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h5 className="text-xl font-semibold text-gray-900 mb-2">No Notifications Found</h5>
            <p className="text-gray-600 mb-4">The <code>/public/notifications.json</code> file is empty or missing.</p>
            <div className="text-sm text-gray-500 space-y-2">
              <p>To add notifications:</p>
              <p>1. Create or edit <code>/public/notifications.json</code></p>
              <p>2. Add notification objects to the JSON array</p>
              <p>3. Redeploy your application</p>
            </div>
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
                        <div>🆔 ID: <code className="bg-gray-100 px-1 rounded">{notification.id}</code></div>
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
                      <div className={`p-2 rounded-lg ${
                        notification.isActive 
                          ? 'text-green-600 bg-green-50' 
                          : 'text-gray-600 bg-gray-100'
                      }`}>
                        {notification.isActive ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <h4 className="text-lg font-semibold text-blue-900 mb-4">📝 How to Manage Notifications</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-3">
            <h5 className="font-semibold text-blue-800">✏️ Adding/Editing Notifications:</h5>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Edit the <code>/public/notifications.json</code> file</li>
              <li>Add/modify notification objects in the JSON array</li>
              <li>Set <code>"isActive": true</code> to show the notification</li>
              <li>Deploy your changes</li>
            </ol>
          </div>
          <div className="space-y-3">
            <h5 className="font-semibold text-blue-800">🎯 Targeting Options:</h5>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li><strong>Global:</strong> Shows everywhere</li>
              <li><strong>Page:</strong> Specific pages only</li>
              <li><strong>Route:</strong> When route is selected</li>
              <li><strong>Direction:</strong> Route direction specific</li>
              <li><strong>Departure:</strong> Time-based alerts</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-white rounded-lg border border-blue-300">
          <p className="text-sm text-blue-800">
            <strong>💡 Pro Tip:</strong> Use the "Download" button above to get the current JSON structure, 
            then modify it and replace your <code>/public/notifications.json</code> file.
          </p>
        </div>
      </div>
    </div>
  );
};