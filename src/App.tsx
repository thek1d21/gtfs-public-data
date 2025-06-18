import React, { useState, useEffect } from 'react';
import { GTFSParser } from './utils/gtfsParser';
import { 
  Stop, Route, Agency, Calendar, FeedInfo, Trip, StopTime, Shape, 
  Frequency, FareAttribute, FareRule, RouteAnalytics, ServicePattern, StopAnalytics 
} from './types/gtfs';
import { TransitMap } from './components/TransitMap';
import { RouteList } from './components/RouteList';
import { StatsPanel } from './components/StatsPanel';
import { Header } from './components/Header';
import { LoadingSpinner } from './components/LoadingSpinner';
import { Navigation } from './components/Navigation';
import { ScheduleViewer } from './components/ScheduleViewer';
import { ServiceCalendar } from './components/ServiceCalendar';
import { RouteDetails } from './components/RouteDetails';
import { JourneyPlanner } from './components/JourneyPlanner';

interface GTFSData {
  stops: Stop[];
  routes: Route[];
  agency: Agency[];
  calendar: Calendar[];
  feedInfo: FeedInfo[];
  trips: Trip[];
  stopTimes: StopTime[];
  shapes: Shape[];
  frequencies: Frequency[];
  fareAttributes: FareAttribute[];
  fareRules: FareRule[];
  routeAnalytics: RouteAnalytics[];
  servicePatterns: ServicePattern[];
  stopAnalytics: StopAnalytics[];
}

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

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GTFSData | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedRouteDetails, setSelectedRouteDetails] = useState<Route | null>(null);
  const [selectedJourney, setSelectedJourney] = useState<JourneyResult | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const parser = new GTFSParser();
        const gtfsData = await parser.loadAllData();
        setData(gtfsData as GTFSData);
      } catch (err) {
        console.error('Failed to load GTFS data:', err);
        setError('Failed to load transit data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleRouteSelect = (routeId: string | undefined) => {
    setSelectedRoute(routeId);
    setSelectedJourney(null); // Clear journey when selecting route
    if (activeTab !== 'overview') {
      setActiveTab('overview');
    }
  };

  const handleRouteDetails = (route: Route) => {
    setSelectedRouteDetails(route);
  };

  const handleStopClick = (stop: Stop) => {
    console.log('Stop clicked:', stop);
    // Additional stop click handling can be added here
  };

  const handleJourneySelect = (journey: JourneyResult) => {
    setSelectedJourney(journey);
    setSelectedRoute(undefined); // Clear route selection when planning journey
    
    // Highlight the journey routes on the map
    if (journey.routes.length > 0) {
      // For now, select the first route of the journey
      // In a more advanced implementation, we could highlight all routes
      setSelectedRoute(journey.routes[0].route.route_id);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Error Loading Data
          </h2>
          <p className="text-gray-600 mb-4">
            {error || 'Unable to load transit data'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-madrid-primary text-white rounded-lg hover:bg-madrid-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const feedInfo = data.feedInfo[0];

  const renderContent = () => {
    switch (activeTab) {
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
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <RouteList
                    routes={data.routes}
                    selectedRoute={selectedRoute}
                    onRouteSelect={handleRouteSelect}
                    onRouteDetails={handleRouteDetails}
                    routeAnalytics={data.routeAnalytics}
                  />
                </div>
              </div>

              {/* Map */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 h-[600px]">
                  <TransitMap
                    stops={data.stops}
                    routes={data.routes}
                    shapes={data.shapes}
                    trips={data.trips}
                    stopTimes={data.stopTimes}
                    selectedRoute={selectedRoute}
                    onStopClick={handleStopClick}
                  />
                </div>
              </div>
            </div>

            {/* Journey Information Panel */}
            {selectedJourney && (
              <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Navigation className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-blue-900">Selected Journey</h3>
                      <p className="text-sm text-blue-700">
                        {selectedJourney.fromStop.stop_name} → {selectedJourney.toStop.stop_name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedJourney(null)}
                    className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                  >
                    Clear Journey
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.round(selectedJourney.totalDuration / 60 * 10) / 10}h
                    </div>
                    <div className="text-sm text-gray-600">Total Time</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {selectedJourney.totalDistance}km
                    </div>
                    <div className="text-sm text-gray-600">Distance</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {selectedJourney.transfers}
                    </div>
                    <div className="text-sm text-gray-600">Transfers</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {selectedJourney.routes.length}
                    </div>
                    <div className="text-sm text-gray-600">Routes</div>
                  </div>
                </div>
              </div>
            )}
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header feedInfo={feedInfo} />
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderContent()}

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-600">
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
          onClose={() => setSelectedRouteDetails(null)}
        />
      )}
    </div>
  );
}

export default App;