import axios, { AxiosInstance } from 'axios';

export class AdminClient {
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
    const response = await this.client.post('/auth/login', {
      userId,
      role: 'admin',
    });

    this.token = response.data.accessToken;
    return response.data;
  }

  async getIncidentDetails(incidentId: string) {
    const response = await this.client.get(`/admin/incidents/${incidentId}`);
    return response.data;
  }

  async updateMatchingConfig(config: Record<string, any>) {
    const response = await this.client.put('/admin/config/matching', config);
    return response.data;
  }

  async getSystemMetrics() {
    const response = await this.client.get('/admin/metrics');
    return response.data;
  }
}
