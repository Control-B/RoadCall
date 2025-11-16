import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  User,
  CreateRequestPayload,
  BreakdownRequest,
  ApiError,
} from '@/src/types';
import { useAuthStore } from '@/src/store/authStore';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.roadcall-assist.com';

class RoadCallApi {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        const token = useAuthStore.getState().accessToken;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          await useAuthStore.getState().logout();
        }
        return Promise.reject(this.handleError(error));
      }
    );
  }

  private handleError(error: AxiosError): ApiError {
    if (error.response) {
      return {
        message:
          (error.response.data as any)?.message ||
          'An error occurred on the server',
        code: error.response.status.toString(),
        details: error.response.data,
      };
    } else if (error.request) {
      return {
        message: 'No response from server. Please check your connection.',
        code: 'NETWORK_ERROR',
      };
    } else {
      return {
        message: error.message || 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR',
      };
    }
  }

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>(
      '/auth/login',
      payload
    );
    return response.data;
  }

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>(
      '/auth/register',
      payload
    );
    return response.data;
  }

  async getMe(): Promise<User> {
    const response = await this.client.get<User>('/me');
    return response.data;
  }

  async createRequest(
    payload: CreateRequestPayload
  ): Promise<BreakdownRequest> {
    const response = await this.client.post<BreakdownRequest>(
      '/requests',
      payload
    );
    return response.data;
  }

  async getActiveRequest(): Promise<BreakdownRequest | null> {
    try {
      const response = await this.client.get<BreakdownRequest>(
        '/requests/active'
      );
      return response.data;
    } catch (error: any) {
      if (error.code === '404') {
        return null;
      }
      throw error;
    }
  }

  async getRequestById(id: string): Promise<BreakdownRequest> {
    const response = await this.client.get<BreakdownRequest>(
      `/requests/${id}`
    );
    return response.data;
  }

  async getRequestHistory(): Promise<BreakdownRequest[]> {
    const response = await this.client.get<BreakdownRequest[]>(
      '/requests/history'
    );
    return response.data;
  }

  async cancelRequest(id: string): Promise<BreakdownRequest> {
    const response = await this.client.post<BreakdownRequest>(
      `/requests/${id}/cancel`
    );
    return response.data;
  }

  async updateProfile(updates: Partial<User>): Promise<User> {
    const response = await this.client.patch<User>('/me', updates);
    return response.data;
  }
}

export const roadcallApi = new RoadCallApi();
