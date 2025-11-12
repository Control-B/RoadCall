import axios, { AxiosInstance } from 'axios';

export class BackOfficeClient {
  private client: AxiosInstance;
  private token?: string;

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

  async authenticate(userId: string) {
    // In test environment, use test credentials
    const response = await this.client.post('/auth/login', {
      userId,
      role: 'dispatcher',
    });

    this.token = response.data.accessToken;
    return response.data;
  }

  async getPendingPayments() {
    const response = await this.client.get('/payments/pending');
    return response.data;
  }

  async approvePayment(paymentId: string, data: { reviewNotes: string }) {
    const response = await this.client.post(`/payments/${paymentId}/approve`, data);
    return response.data;
  }

  async rejectPayment(paymentId: string, data: { reason: string }) {
    const response = await this.client.post(`/payments/${paymentId}/reject`, data);
    return response.data;
  }

  async getFraudReviewQueue() {
    const response = await this.client.get('/payments/fraud-review');
    return response.data;
  }

  async getPendingPayment(incidentId: string) {
    const response = await this.client.get('/payments', {
      params: {
        incidentId,
        status: 'pending_approval',
      },
    });

    return response.data[0];
  }
}
