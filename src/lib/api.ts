import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Clear token and redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async register(data: {
    email: string;
    username: string;
    password: string;
    full_name?: string;
    phone?: string;
  }) {
    // FastAPI: POST /auth/register with JSON body
    const response = await this.client.post('/auth/register', data);
    return response.data;
  }

  async login(username: string, password: string) {
    // FastAPI: POST /auth/login expects form data (OAuth2PasswordRequestForm)
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await this.client.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  // Parking endpoints
  async getParkingSpots(zone?: string, status?: string) {
    const params = new URLSearchParams();
    if (zone) params.append('zone', zone);
    if (status) params.append('status', status);

    const response = await this.client.get(`/api/parking/spots?${params.toString()}`);
    return response.data;
  }

  async getParkingSpot(spotId: number) {
    const response = await this.client.get(`/api/parking/spots/${spotId}`);
    return response.data;
  }

  async updateParkingSpot(spotId: number, data: any) {
    const response = await this.client.patch(`/api/parking/spots/${spotId}`, data);
    return response.data;
  }

  async getDashboardStats() {
    const response = await this.client.get('/api/parking/dashboard');
    return response.data;
  }

  async initializeParkingSpots() {
    const response = await this.client.post('/api/parking/initialize');
    return response.data;
  }

  // Booking endpoints
  async createBooking(data: {
    spot_id: number;
    vehicle_license: string;
    start_time: string;
    end_time: string;
  }) {
    const response = await this.client.post('/api/bookings', data);
    return response.data;
  }

  async getUserBookings() {
    const response = await this.client.get('/api/bookings');
    return response.data;
  }

  async getAllBookings() {
    const response = await this.client.get('/api/bookings/all');
    return response.data;
  }

  async getBooking(bookingId: number) {
    const response = await this.client.get(`/api/bookings/${bookingId}`);
    return response.data;
  }

  async updateBooking(bookingId: number, data: any) {
    const response = await this.client.patch(`/api/bookings/${bookingId}`, data);
    return response.data;
  }

  async cancelBooking(bookingId: number) {
    const response = await this.client.delete(`/api/bookings/${bookingId}`);
    return response.data;
  }

  async getRecommendations(data: {
    start_time: string;
    end_time: string;
    zone_preference?: string;
    ev_charging?: boolean;
    handicap?: boolean;
  }) {
    const response = await this.client.post('/api/bookings/recommendations', data);
    return response.data;
  }

  // Analytics endpoints
  async getAnalytics(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const response = await this.client.get(`/api/analytics?${params.toString()}`);
    return response.data;
  }

  async generateDailyAnalytics(targetDate?: string) {
    const params = new URLSearchParams();
    if (targetDate) params.append('target_date', targetDate);

    const response = await this.client.post(`/api/analytics/generate-daily?${params.toString()}`);
    return response.data;
  }

  // WebSocket connection
  createWebSocket(): WebSocket {
    const wsUrl = API_BASE_URL.replace('http', 'ws');
    return new WebSocket(`${wsUrl}/ws/parking`);
  }
}

export const api = new ApiClient();
export default api;
