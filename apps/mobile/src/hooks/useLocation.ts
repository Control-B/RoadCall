import { useState, useEffect } from 'react';
import * as ExpoLocation from 'expo-location';
import { Location } from '@/src/types';

interface UseLocationResult {
  location: Location | null;
  error: string | null;
  loading: boolean;
  requestPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<Location | null>;
  hasPermission: boolean;
}

export function useLocation(): UseLocationResult {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    const { status } = await ExpoLocation.getForegroundPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const requestPermission = async (): Promise<boolean> => {
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setHasPermission(granted);
      if (!granted) {
        setError('Location permission denied');
      }
      return granted;
    } catch (err) {
      setError('Failed to request location permission');
      return false;
    }
  };

  const getCurrentLocation = async (): Promise<Location | null> => {
    setLoading(true);
    setError(null);

    try {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          setLoading(false);
          return null;
        }
      }

      const position = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.High,
      });

      let address: string | undefined;
      try {
        const [result] = await ExpoLocation.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (result) {
          address = `${result.street || ''}, ${result.city || ''}, ${result.region || ''} ${result.postalCode || ''}`.trim();
        }
      } catch {
        address = undefined;
      }

      const loc: Location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        address,
      };

      setLocation(loc);
      setLoading(false);
      return loc;
    } catch (err: any) {
      setError(err.message || 'Failed to get location');
      setLoading(false);
      return null;
    }
  };

  return {
    location,
    error,
    loading,
    requestPermission,
    getCurrentLocation,
    hasPermission,
  };
}
