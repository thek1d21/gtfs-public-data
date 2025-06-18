export interface Stop {
  stop_id: string;
  stop_code: string;
  stop_name: string;
  stop_desc: string;
  stop_lat: number;
  stop_lon: number;
  zone_id: string;
  stop_url: string;
  location_type: number;
  parent_station: string;
  stop_timezone: string;
  wheelchair_boarding: number;
}

export interface Route {
  route_id: string;
  agency_id: string;
  route_short_name: string;
  route_long_name: string;
  route_desc: string;
  route_type: number;
  route_url: string;
  route_color: string;
  route_text_color: string;
}

export interface Agency {
  agency_id: string;
  agency_name: string;
  agency_url: string;
  agency_timezone: string;
  agency_lang: string;
  agency_phone: string;
  agency_fare_url: string;
}

export interface Calendar {
  service_id: string;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
  start_date: string;
  end_date: string;
}

export interface CalendarDate {
  service_id: string;
  date: string;
  exception_type: number;
}

export interface FeedInfo {
  feed_publisher_name: string;
  feed_publisher_url: string;
  feed_lang: string;
  feed_start_date: string;
  feed_end_date: string;
  feed_version: string;
}

export interface Trip {
  route_id: string;
  service_id: string;
  trip_id: string;
  trip_headsign: string;
  trip_short_name: string;
  direction_id: number;
  block_id: string;
  shape_id: string;
  wheelchair_accessible: number;
  bikes_allowed: number;
}

export interface StopTime {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: number;
  stop_headsign: string;
  pickup_type: number;
  drop_off_type: number;
  shape_dist_traveled: number;
}

export interface Shape {
  shape_id: string;
  shape_pt_lat: number;
  shape_pt_lon: number;
  shape_pt_sequence: number;
  shape_dist_traveled: number;
}

export interface Frequency {
  trip_id: string;
  start_time: string;
  end_time: string;
  headway_secs: number;
  exact_times: number;
}

export interface FareAttribute {
  fare_id: string;
  price: number;
  currency_type: string;
  payment_method: number;
  transfers: number;
  transfer_duration: number;
}

export interface FareRule {
  fare_id: string;
  route_id: string;
  origin_id: string;
  destination_id: string;
  contains_id: string;
}

export interface RouteAnalytics {
  route_id: string;
  total_trips: number;
  total_stops: number;
  service_hours: number;
  frequency_peak: number;
  frequency_offpeak: number;
  coverage_area: number;
  accessibility_score: number;
}

export interface ServicePattern {
  service_id: string;
  days_of_week: string[];
  total_trips: number;
  routes_count: number;
  start_date: Date;
  end_date: Date;
}

export interface StopAnalytics {
  stop_id: string;
  routes_serving: number;
  daily_trips: number;
  peak_frequency: number;
  accessibility_features: string[];
  zone_info: string;
  interchange_connections: number;
}