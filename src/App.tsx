import React, { useState, useEffect } from 'react';
import { Stop } from './types/gtfs';
import { TransitMap } from './components/TransitMap';
import { RouteList } from './components/RouteList';
import { StatsPanel } from './components/StatsPanel';
import { Header } from './components/Header';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StatsCardSkeleton, RouteCardSkeleton, MapSkeleton } from './components/SkeletonLoader';
import { Navigation } from './components/Navigation';
import { ScheduleViewer } from './components/ScheduleViewer';
import { ServiceCalendar } from './components/ServiceCalendar';
import { RouteDetails } from './components/RouteDetails';
import { JourneyPlanner } from './components/JourneyPlanner';
import { NotificationManager } from './components/NotificationManager';
import { NotificationBanner } from './components/NotificationBanner';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useGTFSData } from './hooks/useGTFSData';
import { useRouteSelection } from './hooks/useRouteSelection';
import { useJourneyPlanning } from './hooks/useJourneyPlanning';
import { useNavigation } from './hooks/useNavigation';

interface JourneyResult {
  id: string;
  fromStop: Stop;
  toStop: Stop;
  routes: Array<{
    route: Route;
    fromStop: Stop;
    toStop: Stop;
    departureTime: string;
    arrivalTime: string;
    duration: number;
    stops: Stop[];
  }>;
  totalDuration: number;
  totalDistance: number;
  transfers: number;
  walkingTime: number;
}

function AppContent() {
  const { data, loading, error, retry } = useGTFSData();
  const { selectedRoute, selectedRouteDetails, handleRouteSelect, handleRouteDetails, clearRouteDetails } = useRouteSelection();
  const { selectedJourney, handleJourneySelect, clearJourney } = useJourneyPlanning();
  const { activeTab, setActiveTab } = useNavigation();

  // Notification system
  const { getNotificationsForPage, getNotificationsForRoute, dismissNotification } = useNotifications();

  const handleStopClick = (stop: Stop) => {
    console.log('Stop clicked:', stop);
    // Additional stop click handling can be added here
  };

  const handleJourneySelectWithRouteUpdate = (journey: JourneyResult) => {
    handleJourneySelect(journey);
    // Clear route selection when planning journey
    handleRouteSelect(undefined);
    
    // Highlight the journey routes on the map
    if (journey.routes.length > 0) {
      // For now, select the first route of the journey
      // In a more advanced implementation, we could highlight all routes
      handleRouteSelect(journey.routes[0].route.route_id);
    }
  };

  const handleRouteSelectWithJourneyClear = (routeId: string | undefined) => {
    handleRouteSelect(routeId);
    clearJourney(); // Clear journey when selecting route
    if (activeTab !== 'overview') {
      setActiveTab('overview');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header Skeleton */}
          <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 mb-6">
            <div className="flex items-center justify-between h-16 px-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                <div>
                  <div className="w-48 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1"></div>
                  <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Panel Skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <StatsCardSkeleton key={i} />
            ))}
          </div>

          {/* Main Content Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="space-y-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <RouteCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            </div>
            <div className="lg:col-span-3">
              <MapSkeleton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Error Loading Data
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error || 'Unable to load transit data'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={retry}
              className="px-4 py-2 bg-madrid-primary text-white rounded-lg hover:bg-madrid-primary/90 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  const feedInfo = data.feedInfo[0];

  // FIXED: Get notifications based on current context
  const getRelevantNotifications = () => {
    // Always get global notifications
    const globalNotifications = getNotificationsForPage('global');
    
    // Get page-specific notifications (but not for overview)
    const pageNotifications = activeTab !== 'overview' ? getNotificationsForPage(activeTab) : [];
    
    // Get route-specific notifications only if a route is selected
    const routeNotifications = selectedRoute ? getNotificationsForRoute(selectedRoute) : [];
    
    // Combine and deduplicate
    const allNotifications = [...globalNotifications, ...pageNotifications, ...routeNotifications];
    const uniqueNotifications = allNotifications.filter((notification, index, self) => 
      index === self.findIndex(n => n.id === notification.id)
    );
    
    return uniqueNotifications;
  };

  const relevantNotifications = getRelevantNotifications();

  const renderContent = () => {
    switch (activeTab) {
      case 'notifications':
        return <NotificationManager />;
      case 'schedule':
        return (
          <ScheduleViewer
            stopTimes={data.stopTimes}
            trips={data.trips}
            stops={data.stops}
            routes={data.routes}
          />
        );
      case 'calendar':
        return (
          <ServiceCalendar
            calendar={data.calendar}
            servicePatterns={data.servicePatterns}
            stops={data.stops}
            routes={data.routes}
            trips={data.trips}
            stopTimes={data.stopTimes}
          />
        );
      case 'planner':
        return (
          <JourneyPlanner
            stops={data.stops}
            routes={data.routes}
            trips={data.trips}
            stopTimes={data.stopTimes}
            onJourneySelect={handleJourneySelect}
          />
        );
      default:
        return (
          <>
            {/* Stats Panel */}
            <div className="mb-6">
              <StatsPanel 
                stops={data.stops} 
                routes={data.routes} 
                calendar={data.calendar}
                trips={data.trips}
                stopTimes={data.stopTimes}
                shapes={data.shapes}
              />
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Sidebar */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                  <RouteList
                    routes={data.routes}
                    selectedRoute={selectedRoute}
                    onRouteSelect={handleRouteSelectWithJourneyClear}
                    onRouteDetails={handleRouteDetails}
                    routeAnalytics={data.routeAnalytics}
                  />
                </div>
              </div>

              {/* Map */}
              <div className="lg:col-span-3">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 h-[600px]">
                  <TransitMap
                    stops={data.stops}
                    routes={data.routes}
                    shapes={data.shapes}
                    trips={data.trips}
                    onJourneySelect={handleJourneySelectWithRouteUpdate}
                    selectedRoute={selectedRoute}
                    onStopClick={handleStopClick}
                  />
                </div>
              </div>
            </div>

            {/* Journey Information Panel */}
            {selectedJourney && (
              <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg">
                      <Navigation className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Selected Journey</h3>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {selectedJourney.fromStop.stop_name} → {selectedJourney.toStop.stop_name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedJourney(null)}
                    className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100 font-medium text-sm"
                  >
                    Clear Journey
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {Math.round(selectedJourney.totalDuration / 60 * 10) / 10}h
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Time</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {selectedJourney.totalDistance}km
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Distance</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {selectedJourney.transfers}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Transfers</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {selectedJourney.routes.length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Routes</div>
                  </div>
                </div>
              </div>
            )}
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header feedInfo={feedInfo} />
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* FIXED: Smart Notification Display */}
        {relevantNotifications.length > 0 && (
          <div className="mb-6">
            <NotificationBanner
              notifications={relevantNotifications}
              onDismiss={dismissNotification}
            />
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
              {selectedRoute && (
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full mr-2">
                  Route {data.routes.find(r => r.route_id === selectedRoute)?.route_short_name} notifications included
                </span>
              )}
              {activeTab !== 'overview' && (
                <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full mr-2">
                  {activeTab} page notifications included
                </span>
              )}
              <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded-full">
                Global notifications included
              </span>
            </div>
          </div>
        )}

        {renderContent()}

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            Data provided by {feedInfo?.feed_publisher_name || 'CRTM'} • 
            Last updated: {feedInfo?.feed_version || 'Unknown'}
          </p>
          <p className="mt-1">
            Enhanced Madrid Transit Dashboard with comprehensive GTFS data analysis and journey planning
          </p>
        </div>
      </main>

      {/* Route Details Modal */}
      {selectedRouteDetails && (
        <RouteDetails
          route={selectedRouteDetails}
          trips={data.trips.filter(trip => trip.route_id === selectedRouteDetails.route_id)}
          stopTimes={data.stopTimes}
          stops={data.stops}
          shapes={data.shapes}
          analytics={data.routeAnalytics.find(ra => ra.route_id === selectedRouteDetails.route_id)!}
          onClose={clearRouteDetails}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;