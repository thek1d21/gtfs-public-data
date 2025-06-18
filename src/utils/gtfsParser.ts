import Papa from 'papaparse';
import { Stop, Route, Agency, Calendar, FeedInfo } from '../types/gtfs';

export class GTFSParser {
  private basePath = '/20250528_google_transit_M89_025/';

  async parseCSV<T>(filename: string): Promise<T[]> {
    try {
      const response = await fetch(`${this.basePath}${filename}`);
      const csvText = await response.text();
      
      return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
          transform: (value) => value.trim(),
          complete: (results) => {
            if (results.errors.length > 0) {
              console.warn(`Parsing warnings for ${filename}:`, results.errors);
            }
            resolve(results.data as T[]);
          },
          error: (error) => reject(error)
        });
      });
    } catch (error) {
      console.error(`Error loading ${filename}:`, error);
      throw error;
    }
  }

  async loadStops(): Promise<Stop[]> {
    const stops = await this.parseCSV<any>('stops.txt');
    return stops.map(stop => ({
      ...stop,
      stop_lat: parseFloat(stop.stop_lat),
      stop_lon: parseFloat(stop.stop_lon),
      location_type: parseInt(stop.location_type) || 0,
      wheelchair_boarding: parseInt(stop.wheelchair_boarding) || 0
    }));
  }

  async loadRoutes(): Promise<Route[]> {
    const routes = await this.parseCSV<any>('routes.txt');
    return routes.map(route => ({
      ...route,
      route_type: parseInt(route.route_type) || 0
    }));
  }

  async loadAgency(): Promise<Agency[]> {
    return this.parseCSV<Agency>('agency.txt');
  }

  async loadCalendar(): Promise<Calendar[]> {
    const calendar = await this.parseCSV<any>('calendar.txt');
    return calendar.map(cal => ({
      ...cal,
      monday: parseInt(cal.monday),
      tuesday: parseInt(cal.tuesday),
      wednesday: parseInt(cal.wednesday),
      thursday: parseInt(cal.thursday),
      friday: parseInt(cal.friday),
      saturday: parseInt(cal.saturday),
      sunday: parseInt(cal.sunday)
    }));
  }

  async loadFeedInfo(): Promise<FeedInfo[]> {
    return this.parseCSV<FeedInfo>('feed_info.txt');
  }

  async loadAllData() {
    try {
      const [stops, routes, agency, calendar, feedInfo] = await Promise.all([
        this.loadStops(),
        this.loadRoutes(),
        this.loadAgency(),
        this.loadCalendar(),
        this.loadFeedInfo()
      ]);

      return {
        stops,
        routes,
        agency,
        calendar,
        feedInfo
      };
    } catch (error) {
      console.error('Error loading GTFS data:', error);
      throw error;
    }
  }
}