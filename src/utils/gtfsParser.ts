import Papa from 'papaparse';
import { 
  Stop, Route, Agency, Calendar, CalendarDate, FeedInfo, 
  Trip, StopTime, Shape, Frequency, FareAttribute, FareRule,
  RouteAnalytics, ServicePattern, StopAnalytics
} from '../types/gtfs';

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

  async loadCalendarDates(): Promise<CalendarDate[]> {
    const calendarDates = await this.parseCSV<any>('calendar_dates.txt');
    return calendarDates.map(cd => ({
      ...cd,
      exception_type: parseInt(cd.exception_type)
    }));
  }

  async loadFeedInfo(): Promise<FeedInfo[]> {
    return this.parseCSV<FeedInfo>('feed_info.txt');
  }

  async loadTrips(): Promise<Trip[]> {
    const trips = await this.parseCSV<any>('trips.txt');
    return trips.map(trip => ({
      ...trip,
      direction_id: parseInt(trip.direction_id) || 0,
      wheelchair_accessible: parseInt(trip.wheelchair_accessible) || 0,
      bikes_allowed: parseInt(trip.bikes_allowed) || 0
    }));
  }

  async loadStopTimes(): Promise<StopTime[]> {
    const stopTimes = await this.parseCSV<any>('stop_times.txt');
    return stopTimes.map(st => ({
      ...st,
      stop_sequence: parseInt(st.stop_sequence),
      pickup_type: parseInt(st.pickup_type) || 0,
      drop_off_type: parseInt(st.drop_off_type) || 0,
      shape_dist_traveled: parseFloat(st.shape_dist_traveled) || 0
    }));
  }

  async loadShapes(): Promise<Shape[]> {
    const shapes = await this.parseCSV<any>('shapes.txt');
    return shapes.map(shape => ({
      ...shape,
      shape_pt_lat: parseFloat(shape.shape_pt_lat),
      shape_pt_lon: parseFloat(shape.shape_pt_lon),
      shape_pt_sequence: parseInt(shape.shape_pt_sequence),
      shape_dist_traveled: parseFloat(shape.shape_dist_traveled) || 0
    }));
  }

  async loadFrequencies(): Promise<Frequency[]> {
    const frequencies = await this.parseCSV<any>('frequencies.txt');
    return frequencies.map(freq => ({
      ...freq,
      headway_secs: parseInt(freq.headway_secs),
      exact_times: parseInt(freq.exact_times) || 0
    }));
  }

  async loadFareAttributes(): Promise<FareAttribute[]> {
    const fareAttributes = await this.parseCSV<any>('fare_attributes.txt');
    return fareAttributes.map(fare => ({
      ...fare,
      price: parseFloat(fare.price) || 0,
      payment_method: parseInt(fare.payment_method) || 0,
      transfers: parseInt(fare.transfers) || 0,
      transfer_duration: parseInt(fare.transfer_duration) || 0
    }));
  }

  async loadFareRules(): Promise<FareRule[]> {
    return this.parseCSV<FareRule>('fare_rules.txt');
  }

  // Analytics and derived data methods
  generateRouteAnalytics(routes: Route[], trips: Trip[], stopTimes: StopTime[], stops: Stop[]): RouteAnalytics[] {
    return routes.map(route => {
      const routeTrips = trips.filter(trip => trip.route_id === route.route_id);
      const routeStopTimes = stopTimes.filter(st => 
        routeTrips.some(trip => trip.trip_id === st.trip_id)
      );
      const uniqueStops = [...new Set(routeStopTimes.map(st => st.stop_id))];
      const routeStops = stops.filter(stop => uniqueStops.includes(stop.stop_id));
      
      // Calculate service hours
      const times = routeStopTimes.map(st => st.departure_time).filter(Boolean);
      const serviceHours = times.length > 0 ? this.calculateServiceHours(times) : 0;
      
      // Calculate accessibility score
      const accessibleStops = routeStops.filter(stop => stop.wheelchair_boarding === 1).length;
      const accessibilityScore = routeStops.length > 0 ? (accessibleStops / routeStops.length) * 100 : 0;

      return {
        route_id: route.route_id,
        total_trips: routeTrips.length,
        total_stops: uniqueStops.length,
        service_hours: serviceHours,
        frequency_peak: this.calculateFrequency(routeStopTimes, 'peak'),
        frequency_offpeak: this.calculateFrequency(routeStopTimes, 'offpeak'),
        coverage_area: this.calculateCoverageArea(routeStops),
        accessibility_score: Math.round(accessibilityScore)
      };
    });
  }

  generateServicePatterns(calendar: Calendar[], trips: Trip[]): ServicePattern[] {
    return calendar.map(service => {
      const serviceTrips = trips.filter(trip => trip.service_id === service.service_id);
      const routes = [...new Set(serviceTrips.map(trip => trip.route_id))];
      
      const daysOfWeek = [];
      if (service.monday) daysOfWeek.push('Monday');
      if (service.tuesday) daysOfWeek.push('Tuesday');
      if (service.wednesday) daysOfWeek.push('Wednesday');
      if (service.thursday) daysOfWeek.push('Thursday');
      if (service.friday) daysOfWeek.push('Friday');
      if (service.saturday) daysOfWeek.push('Saturday');
      if (service.sunday) daysOfWeek.push('Sunday');

      return {
        service_id: service.service_id,
        days_of_week: daysOfWeek,
        total_trips: serviceTrips.length,
        routes_count: routes.length,
        start_date: this.parseGTFSDate(service.start_date),
        end_date: this.parseGTFSDate(service.end_date)
      };
    });
  }

  generateStopAnalytics(stops: Stop[], stopTimes: StopTime[], trips: Trip[]): StopAnalytics[] {
    return stops.map(stop => {
      const stopStopTimes = stopTimes.filter(st => st.stop_id === stop.stop_id);
      const stopTrips = trips.filter(trip => 
        stopStopTimes.some(st => st.trip_id === trip.trip_id)
      );
      const routes = [...new Set(stopTrips.map(trip => trip.route_id))];
      
      const accessibilityFeatures = [];
      if (stop.wheelchair_boarding === 1) accessibilityFeatures.push('Wheelchair Accessible');
      if (stop.location_type === 1) accessibilityFeatures.push('Interchange Hub');

      return {
        stop_id: stop.stop_id,
        routes_serving: routes.length,
        daily_trips: stopStopTimes.length,
        peak_frequency: this.calculateStopPeakFrequency(stopStopTimes),
        accessibility_features: accessibilityFeatures,
        zone_info: stop.zone_id,
        interchange_connections: stop.location_type === 1 ? this.calculateInterchangeConnections(stop, stops) : 0
      };
    });
  }

  private calculateServiceHours(times: string[]): number {
    const validTimes = times.filter(time => time && time.includes(':'));
    if (validTimes.length === 0) return 0;
    
    const hours = validTimes.map(time => {
      const [hour] = time.split(':').map(Number);
      return hour;
    });
    
    return Math.max(...hours) - Math.min(...hours);
  }

  private calculateFrequency(stopTimes: StopTime[], period: 'peak' | 'offpeak'): number {
    const peakHours = period === 'peak' ? [7, 8, 9, 17, 18, 19] : [10, 11, 12, 13, 14, 15, 16];
    const periodTimes = stopTimes.filter(st => {
      if (!st.departure_time) return false;
      const hour = parseInt(st.departure_time.split(':')[0]);
      return peakHours.includes(hour);
    });
    
    return periodTimes.length;
  }

  private calculateCoverageArea(stops: Stop[]): number {
    if (stops.length < 2) return 0;
    
    const lats = stops.map(s => s.stop_lat);
    const lons = stops.map(s => s.stop_lon);
    
    const latRange = Math.max(...lats) - Math.min(...lats);
    const lonRange = Math.max(...lons) - Math.min(...lons);
    
    return Math.round(latRange * lonRange * 10000); // Rough area calculation
  }

  private calculateStopPeakFrequency(stopTimes: StopTime[]): number {
    const peakTimes = stopTimes.filter(st => {
      if (!st.departure_time) return false;
      const hour = parseInt(st.departure_time.split(':')[0]);
      return hour >= 7 && hour <= 9 || hour >= 17 && hour <= 19;
    });
    
    return peakTimes.length;
  }

  private calculateInterchangeConnections(interchange: Stop, allStops: Stop[]): number {
    // Find nearby stops within 500m radius (approximate)
    const nearbyStops = allStops.filter(stop => {
      if (stop.stop_id === interchange.stop_id) return false;
      const distance = this.calculateDistance(
        interchange.stop_lat, interchange.stop_lon,
        stop.stop_lat, stop.stop_lon
      );
      return distance < 0.5; // 500m
    });
    
    return nearbyStops.length;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private parseGTFSDate(dateStr: string): Date {
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  }

  async loadAllData() {
    try {
      const [
        stops, routes, agency, calendar, calendarDates, feedInfo,
        trips, stopTimes, shapes, frequencies, fareAttributes, fareRules
      ] = await Promise.all([
        this.loadStops(),
        this.loadRoutes(),
        this.loadAgency(),
        this.loadCalendar(),
        this.loadCalendarDates(),
        this.loadFeedInfo(),
        this.loadTrips(),
        this.loadStopTimes(),
        this.loadShapes(),
        this.loadFrequencies(),
        this.loadFareAttributes(),
        this.loadFareRules()
      ]);

      // Generate analytics
      const routeAnalytics = this.generateRouteAnalytics(routes, trips, stopTimes, stops);
      const servicePatterns = this.generateServicePatterns(calendar, trips);
      const stopAnalytics = this.generateStopAnalytics(stops, stopTimes, trips);

      return {
        stops,
        routes,
        agency,
        calendar,
        calendarDates,
        feedInfo,
        trips,
        stopTimes,
        shapes,
        frequencies,
        fareAttributes,
        fareRules,
        routeAnalytics,
        servicePatterns,
        stopAnalytics
      };
    } catch (error) {
      console.error('Error loading GTFS data:', error);
      throw error;
    }
  }
}