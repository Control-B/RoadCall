import axios, { AxiosInstance } from 'axios';

export interface VendorRegistration {
  businessName: string;
  phone: string;
  capabilities: string[];
  location: { lat: number; lon: number };
  rating: number;
  stripeAccountId?: string;
}

export interface LocationUpdate {
  lat: number;
  lon: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

export interface WorkCompletion {
  notes: string;
  photos: string[];
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export class VendorClient {
  private client: AxiosInstance;
  private token?: string;
  private vendorId?: string;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  async register(data: VendorRegistration) {
    const response = await this.client.post('/auth/register', {
      ...data,
      role: 'vendor',
    });

    this.vendorId = response.data.vendorId;

    // Auto-verify for testing
    await this.client.post('/auth/verify', {
      phone: data.phone,
      otp: '123456',
    });

    const authResponse = await this.client.post('/auth/verify', {
      phone: data.phone,
      otp: '123456',
    });

    this.token = authResponse.data.accessToken;

    return { ...response.data, vendorId: this.vendorId };
  }

  async authenticate(vendorId: string) {
    this.vendorId = vendorId;
    // In a real scenario, would need proper auth flow
    return this;
  }

  async setAvailability(status: 'available' | 'busy' | 'offline') {
    const response = await this.client.patch(`/vendors/${this.vendorId}/availability`, {
      status,
    });
    return response.data;
  }

  async getPendingOffers() {
    const response = await this.client.get('/offers', {
      params: {
        vendorId: this.vendorId,
        status: 'pending',
      },
    });
    return response.data;
  }

  async acceptOffer(offerId: string) {
    const response = await this.client.post(`/offers/${offerId}/accept`);
    return response.data;
  }

  async declineOffer(offerId: string, reason: string) {
    const response = await this.client.post(`/offers/${offerId}/decline`, {
      reason,
    });
    return response.data;
  }

  async startNavigation(incidentId: string) {
    const response = await this.client.post(`/incidents/${incidentId}/navigation/start`);
    return response.data;
  }

  async updateLocation(location: LocationUpdate) {
    const response = await this.client.post('/tracking/location', location);
    return response.data;
  }

  async startWork(incidentId: string) {
    const response = await this.client.patch(`/incidents/${incidentId}/status`, {
      status: 'work_in_progress',
    });
    return response.data;
  }

  async completeWork(incidentId: string, data: WorkCompletion) {
    const response = await this.client.post(`/incidents/${incidentId}/complete`, data);
    return response.data;
  }

  async getPayments(filter: Record<string, any>) {
    const response = await this.client.get('/payments', {
      params: { vendorId: this.vendorId, ...filter },
    });
    return response.data;
  }

  async getPayment(paymentId: string) {
    const response = await this.client.get(`/payments/${paymentId}`);
    return response.data;
  }

  async waitForNotification(
    type: string,
    filter: Record<string, any>,
    timeout: number = 30000
  ): Promise<any> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const response = await this.client.get('/notifications', {
        params: { type, ...filter },
      });

      if (response.data.length > 0) {
        return response.data[0];
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(`Timeout waiting for notification: ${type}`);
  }
}
