import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/store/auth-store';

export default function Index() {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated || !user) {
    return <Redirect href="/(auth)/welcome" />;
  }

  // Redirect based on user role
  if (user.role === 'driver') {
    return <Redirect href="/(driver)/home" />;
  } else if (user.role === 'vendor') {
    return <Redirect href="/(vendor)/home" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}
