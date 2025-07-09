import { useState, useEffect } from 'react';
import { GTFSParser } from '../utils/gtfsParser';
import { 
  Stop, Route, Agency, Calendar, FeedInfo, Trip, StopTime, Shape, 
  Frequency, FareAttribute, FareRule, RouteAnalytics, ServicePattern, StopAnalytics 
} from '../types/gtfs';

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

interface UseGTFSDataReturn {
  data: GTFSData | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export const useGTFSData = (): UseGTFSDataReturn => {
  const [data, setData] = useState<GTFSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
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

  useEffect(() => {
    loadData();
  }, []);

  const retry = () => {
    loadData();
  };

  return { data, loading, error, retry };
};