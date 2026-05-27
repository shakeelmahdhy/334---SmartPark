import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  User,
  ParkingSpotApi,
  DashboardStats,
  ParkingSettings,
  Booking,
  BookingQuote,
  DetectionEvent,
  RecommendationResponse,
  AnalyticsResponse,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/';
        }
        return Promise.reject(error);
      }
    );
  }

  async register(data: {
    email: string;
    username: string;
    password: string;
    full_name?: string;
    phone?: string;
  }) {
    const response = await this.client.post('/auth/register', data);
    return response.data;
  }

  async login(username: string, password: string) {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    const response = await this.client.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data as { access_token: string; user: User };
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async getUsers(): Promise<User[]> {
    const response = await this.client.get('/auth/users');
    return response.data;
  }

  async updateUserAdmin(
    userId: number,
    data: { email?: string; full_name?: string; phone?: string; is_active?: boolean }
  ): Promise<User> {
    const response = await this.client.put(`/auth/users/${userId}`, data);
    return response.data;
  }

  async deleteUser(userId: number): Promise<void> {
    await this.client.delete(`/auth/users/${userId}`);
  }

  async getParkingSpots(zone?: string, status?: string): Promise<ParkingSpotApi[]> {
    const params = new URLSearchParams();
    if (zone) params.append('zone', zone);
    if (status) params.append('status', status);
    const qs = params.toString();
    const response = await this.client.get(`/api/parking/spots${qs ? `?${qs}` : ''}`);
    return response.data;
  }

  async createParkingSpot(data: {
    spot_number: string;
    zone: string;
    floor?: number;
    is_handicap?: boolean;
    is_ev_charging?: boolean;
  }): Promise<ParkingSpotApi> {
    const response = await this.client.post('/api/parking/spots', data);
    return response.data;
  }

  async updateParkingSpot(
    spotId: number,
    data: { status?: string; is_handicap?: boolean; is_ev_charging?: boolean }
  ): Promise<ParkingSpotApi> {
    const response = await this.client.patch(`/api/parking/spots/${spotId}`, data);
    return response.data;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const response = await this.client.get('/api/parking/dashboard');
    return response.data;
  }

  async getParkingSettings(): Promise<ParkingSettings> {
    const response = await this.client.get('/api/parking/settings');
    return response.data;
  }

  async getDetectionEvents(limit = 25): Promise<DetectionEvent[]> {
    const response = await this.client.get(`/api/parking/detections?limit=${limit}`);
    return response.data;
  }

  async initializeParkingSpots(): Promise<ParkingSpotApi[]> {
    const response = await this.client.post('/api/parking/initialize');
    return response.data;
  }

  async createBooking(data: {
    spot_id: number;
    vehicle_license: string;
    start_time: string;
    end_time: string;
  }): Promise<Booking> {
    const response = await this.client.post('/api/bookings', data);
    return response.data;
  }

  async getBookingQuote(data: {
    spot_id: number;
    start_time: string;
    end_time: string;
  }): Promise<BookingQuote> {
    const response = await this.client.post('/api/bookings/quote', data);
    return response.data;
  }

  async getUserBookings(): Promise<Booking[]> {
    const response = await this.client.get('/api/bookings');
    return response.data;
  }

  async getAllBookings(): Promise<Booking[]> {
    const response = await this.client.get('/api/bookings/all');
    return response.data;
  }

  async cancelBooking(bookingId: number): Promise<Booking> {
    const response = await this.client.delete(`/api/bookings/${bookingId}`);
    return response.data;
  }

  async getRecommendations(data: {
    start_time: string;
    end_time: string;
    zone_preference?: string;
    ev_charging?: boolean;
    handicap?: boolean;
  }): Promise<RecommendationResponse> {
    const response = await this.client.post('/api/bookings/recommendations', data);
    return response.data;
  }

  async getAnalytics(startDate?: string, endDate?: string): Promise<AnalyticsResponse> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const qs = params.toString();
    const response = await this.client.get(`/api/analytics${qs ? `?${qs}` : ''}`);
    return response.data;
  }

  createWebSocket(): WebSocket {
    const wsUrl = API_BASE_URL.replace('http', 'ws');
    return new WebSocket(`${wsUrl}/ws/parking`);
  }
}

export const api = new ApiClient();
export default api;
