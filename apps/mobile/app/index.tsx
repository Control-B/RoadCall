import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { SplashScreen } from '@/src/screens/auth/SplashScreen';
import { AuthNavigator } from '@/src/navigation/AuthNavigator';
import { MainNavigator } from '@/src/navigation/MainNavigator';
import { useAuthStore } from '@/src/store/authStore';

type AppState = 'splash' | 'auth' | 'main';

export default function Index() {
  const [appState, setAppState] = useState<AppState>('main');
  const { setUser } = useAuthStore();

  useEffect(() => {
    setUser({
      id: 'dev-user-1',
      name: 'John Doe',
      phone: '+1 (555) 123-4567',
      email: 'john.doe@example.com',
      truckingCompany: 'ABC Trucking',
      truckNumber: 'TRK-001',
      truckType: 'Sleeper',
    });
  }, []);

  const handleSplashFinish = (isAuthenticated: boolean) => {
    setAppState(isAuthenticated ? 'main' : 'auth');
  };

  const handleAuthSuccess = () => {
    setAppState('main');
  };

  const handleLogout = () => {
    setAppState('auth');
  };

  if (appState === 'splash') {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (appState === 'auth') {
    return <AuthNavigator onAuthSuccess={handleAuthSuccess} />;
  }

  return <MainNavigator onLogout={handleLogout} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
