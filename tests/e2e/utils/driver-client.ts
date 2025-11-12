import axios, { AxiosInstance } from 'axios';

export interface DriverRegistration {
  name: string;
  phone: string;
  companyId: string;
  truckNumber: string;
  paymentType?: 'company' | 'independent_contractor';
  stripeCustomerId?: string;
}

export interface IncidentCreate {
  type: 'tire' | 'engine' | 'tow';
  location: { lat: number; lon: number };
  description: string;
}

export class DriverClient {
  private client: AxiosInstance;
  private token?: string;
  private userId?: string;
  private notifications: any[] = [];

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth interceptor
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  async register(data: DriverRegistration) {
    const response = await this.client.post('/auth/register', {
      ...data,
      role: 'driver',
    });

    this.userId = response.data.userId;
    return response.data;
  }

  async verifyOTP(phone: string, otp: string) {
    const response = await this.client.post('/auth/verify', {
      phone,
      otp,
    });

    this.token = response.data.accessToken;
    return response.data;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  async createIncident(data: IncidentCreate) {
    const response = await this.client.post('/incidents', data);
    return response.data;
  }

  async getIncident(incidentId: string) {
    const response = await this.client.get(`/incidents/${incidentId}`);
    return response.data;
  }

  async cancelIncident(incidentId: string, reason: string) {
    const response = await this.client.patch(`/incidents/${incidentId}/status`, {
      status: 'cancelled',
      reason,
    });
    return response.data;
  }

  async getPayment(paymentId: string) {
    const response = await this.client.get(`/payments/${paymentId}`);
    return response.data;
  }

  async authorizePayment(paymentId: string, data: { paymentMethodId: string }) {
    const response = await this.client.post(`/payments/${paymentId}/authorize`, data);
    return response.data;
  }

  async waitForNotification(
    type: string,
    filter: Record<string, any>,
    timeout: number = 30000
  ): Promise<any> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Poll for notifications
      const response = await this.client.get('/notifications', {
        params: { type, ...filter },
      });

      if (response.data.length > 0) {
        const notification = response.data[0];
        this.notifications.push(notification);
        return notification;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(`Timeout waiting for notification: ${type}`);
  }

  async checkNotification(type: string, filter: Record<string, any>): Promise<any | null> {
    const response = await this.client.get('/notifications', {
      params: { type, ...filter },
    });

    return response.data.length > 0 ? response.data[0] : null;
  }
}
