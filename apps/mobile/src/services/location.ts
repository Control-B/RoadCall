import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import appsyncClient, { UPDATE_VENDOR_LOCATION } from '../config/appsync-client';

const LOCATION_TASK_NAME = 'background-location-task';

// Define the background location task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];

    if (location) {
      try {
        // Get the active tracking session from AsyncStorage
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const sessionId = await AsyncStorage.getItem('activeTrackingSession');

        if (sessionId) {
          // Update vendor location via AppSync
          await appsyncClient.mutate({
            mutation: UPDATE_VENDOR_LOCATION,
            variables: {
              sessionId,
              location: {
                lat: location.coords.latitude,
                lon: location.coords.longitude,
                timestamp: new Date(location.timestamp).toISOString(),
                accuracy: location.coords.accuracy,
              },
            },
          });
        }
      } catch (err) {
        console.error('Failed to update location:', err);
      }
    }
  }
});

export const requestLocationPermissions = async (): Promise<boolean> => {
  const { status: foregroundStatus } =
    await Location.requestForegroundPermissionsAsync();

  if (foregroundStatus !== 'granted') {
    return false;
  }

  const { status: backgroundStatus } =
    await Location.requestBackgroundPermissionsAsync();

  return backgroundStatus === 'granted';
};

export const getCurrentLocation = async (): Promise<Location.LocationObject> => {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    throw new Error('Location permission not granted');
  }

  return await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
};

export const startBackgroundLocationTracking = async (
  sessionId: string
): Promise<void> => {
  const hasPermission = await requestLocationPermissions();

  if (!hasPermission) {
    throw new Error('Background location permission not granted');
  }

  // Store the session ID for the background task
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  await AsyncStorage.setItem('activeTrackingSession', sessionId);

  // Start background location updates
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: 10000, // Update every 10 seconds
    distanceInterval: 50, // Or when moved 50 meters
    foregroundService: {
      notificationTitle: 'Roadcall Active',
      notificationBody: 'Tracking your location for incident navigation',
      notificationColor: '#FF0000',
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  });
};

export const stopBackgroundLocationTracking = async (): Promise<void> => {
  const isTracking = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME
  );

  if (isTracking) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }

  // Clear the session ID
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  await AsyncStorage.removeItem('activeTrackingSession');
};

export const watchPosition = (
  callback: (location: Location.LocationObject) => void
): Location.LocationSubscription => {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 10,
    },
    callback
  );
};
