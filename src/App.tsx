import React, { useState, useEffect } from 'react';
import { GTFSParser } from './utils/gtfsParser';
import { Stop, Route, Agency, Calendar, FeedInfo } from './types/gtfs';
import { TransitMap } from './components/TransitMap';
import { RouteList } from './components/RouteList';
import { StatsPanel } from './components/StatsPanel';
import { Header } from './components/Header';
import { LoadingSpinner } from './components/LoadingSpinner';

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    stops: Stop[];
    routes: Route[];
    agency: Agency[];
    calendar: Calendar[];
    feedInfo: FeedInfo[];
  } | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string | undefined>();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const parser = new GTFSParser();
        const gtfsData = await parser.loadAllData();
        setData(gtfsData);
      } catch (err) {
        console.error('Failed to load GTFS data:', err);
        setError('Failed to load transit data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header feedInfo={feedInfo} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Panel */}
        <div className="mb-6">
          <StatsPanel 
            stops={data.stops} 
            routes={data.routes} 
            calendar={data.calendar} 
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
                onRouteSelect={setSelectedRoute}
              />
            </div>
          </div>

          {/* Map */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 h-[600px]">
              <TransitMap
                stops={data.stops}
                routes={data.routes}
                selectedRoute={selectedRoute}
              />
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>
            Data provided by {feedInfo?.feed_publisher_name || 'CRTM'} • 
            Last updated: {feedInfo?.feed_version || 'Unknown'}
          </p>
          <p className="mt-1">
            This dashboard visualizes Madrid's public bus network using GTFS data
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;