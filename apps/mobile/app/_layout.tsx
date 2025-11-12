import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { configureAmplify } from '../src/config/aws-config';
import { useAuthStore } from '../src/store/auth-store';
import { getCurrentUserInfo } from '../src/services/auth';
import { registerForPushNotifications, sendTokenToPinpoint } from '../src/services/notifications';

// Configure AWS Amplify
configureAmplify();

export default function RootLayout() {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Check if user is authenticated
      const user = await getCurrentUserInfo();
      setUser(user);

      if (user) {
        // Register for push notifications
        const token = await registerForPushNotifications();
        if (token) {
          await sendTokenToPinpoint(token, user.userId);
        }
      }
    } catch (error) {
      console.error('App initialization error:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(driver)" />
        <Stack.Screen name="(vendor)" />
      </Stack>
    </>
  );
}
