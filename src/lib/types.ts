export interface User {
  id: number;
  email: string;
  username: string;
  full_name?: string;
  phone?: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface ParkingSpotApi {
  id: number;
  spot_number: string;
  zone: string;
  status: string;
  floor?: number;
  is_handicap?: boolean;
  is_ev_charging?: boolean;
}

export interface ZoneStats {
  zone: string;
  total_spots: number;
  available: number;
  occupied: number;
  reserved: number;
  occupancy_rate: number;
}

export interface DashboardStats {
  total_spots: number;
  available: number;
  occupied: number;
  reserved: number;
  overall_occupancy_rate: number;
  zone_stats: ZoneStats[];
  recent_bookings: Booking[];
  active_bookings: number;
}

export interface ParkingSettings {
  zones: string[];
  spots_per_zone: number;
  total_parking_spots: number;
  hourly_rate: number;
}

export interface Booking {
  id: number;
  user_id: number;
  spot_id: number;
  vehicle_license: string;
  start_time: string;
  end_time: string;
  status: string;
  price: number;
  created_at: string;
  parking_spot?: ParkingSpotApi;
}

export interface BookingQuote {
  spot_id: number;
  duration_hours: number;
  hourly_rate: number;
  total_price: number;
}

export interface DetectionEvent {
  id: number;
  spot_id: number;
  sensor_id: string;
  event_type: string;
  previous_status: string;
  detected_status: string;
  confidence: number;
  payload?: Record<string, unknown>;
  processed: boolean;
  timestamp: string;
  parking_spot?: ParkingSpotApi;
}

export interface RecommendationResponse {
  recommended_spots: ParkingSpotApi[];
  zone_availability: Record<string, number>;
  predicted_occupancy: Record<string, number>;
}

export interface AnalyticsResponse {
  occupancy_trends: { date: string; occupancy_rate: number; available: number; occupied: number }[];
  revenue_trends: { date: string; revenue: number; bookings: number }[];
  peak_hours: { hour: number; occupancy_rate: number; bookings: number }[];
  zone_performance: { zone: string; total_bookings: number; avg_occupancy_rate: number; revenue: number }[];
  predictions: { timestamp: string; predicted_occupancy: number; confidence?: number }[];
  total_revenue: number;
  total_bookings: number;
  avg_occupancy_rate: number;
}
