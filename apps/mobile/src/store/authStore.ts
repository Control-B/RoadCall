import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { User } from '@/src/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  login: (accessToken: string, refreshToken: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
}

const TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

const storage = {
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  },
  deleteItem: async (key: string) => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,

  setUser: (user) => {
    set({ user });
    if (user) {
      storage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      storage.deleteItem(USER_KEY);
    }
  },

  setTokens: async (accessToken, refreshToken) => {
    await storage.setItem(TOKEN_KEY, accessToken);
    await storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    set({ accessToken, refreshToken });
  },

  login: async (accessToken, refreshToken, user) => {
    await storage.setItem(TOKEN_KEY, accessToken);
    await storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    await storage.setItem(USER_KEY, JSON.stringify(user));
    set({ accessToken, refreshToken, user, isLoading: false });
  },

  logout: async () => {
    await storage.deleteItem(TOKEN_KEY);
    await storage.deleteItem(REFRESH_TOKEN_KEY);
    await storage.deleteItem(USER_KEY);
    set({ accessToken: null, refreshToken: null, user: null });
  },

  loadStoredAuth: async () => {
    try {
      const [accessToken, refreshToken, userJson] = await Promise.all([
        storage.getItem(TOKEN_KEY),
        storage.getItem(REFRESH_TOKEN_KEY),
        storage.getItem(USER_KEY),
      ]);

      if (accessToken && refreshToken && userJson) {
        const user = JSON.parse(userJson) as User;
        set({ accessToken, refreshToken, user, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
      set({ isLoading: false });
    }
  },
}));
