import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/src/store/authStore';

interface SplashScreenProps {
  onFinish: (isAuthenticated: boolean) => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const { loadStoredAuth, accessToken, isLoading } = useAuthStore();

  useEffect(() => {
    loadStoredAuth();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => {
        onFinish(!!accessToken);
      }, 500);
    }
  }, [isLoading, accessToken]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RoadCall Assist</Text>
      <Text style={styles.subtitle}>Roadside support when you need it</Text>
      <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  loader: {
    marginTop: 32,
  },
});
