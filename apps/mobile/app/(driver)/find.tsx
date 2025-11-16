import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

interface Mechanic {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
}

export default function FindScreen() {
  const [region, setRegion] = useState<null | { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }>(null);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Location permission denied');
          setLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        const base = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setRegion({ ...base, latitudeDelta: 0.05, longitudeDelta: 0.05 });
        // Mock nearby mechanics (would come from API)
        const sample: Mechanic[] = [
          { id: 'm1', name: 'RapidTow', latitude: base.latitude + 0.01, longitude: base.longitude + 0.005, distanceKm: 1.2 },
          { id: 'm2', name: 'FleetFix', latitude: base.latitude - 0.008, longitude: base.longitude - 0.006, distanceKm: 1.0 },
          { id: 'm3', name: 'RoadRescue', latitude: base.latitude + 0.015, longitude: base.longitude - 0.004, distanceKm: 1.8 },
        ];
        setMechanics(sample);
      } catch (e: any) {
        setError(e.message || 'Failed to load location');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}> 
        <ActivityIndicator size="large" color="#60A5FA" />
        <Text style={styles.loadingText}>Locating you...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}> 
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!region) {
    return (
      <View style={styles.center}> 
        <Text style={styles.error}>No region data</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        showsUserLocation
      >
        {mechanics.map(m => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.latitude, longitude: m.longitude }}
            title={m.name}
            description={`${m.distanceKm.toFixed(1)} km away`}
            pinColor="#8B5CF6"
          />
        ))}
      </MapView>
      <View style={styles.overlay}>
        <Text style={styles.title}>Nearby Mechanics</Text>
        {mechanics.map(m => (
          <Text key={m.id} style={styles.item}>{m.name} • {m.distanceKm.toFixed(1)} km</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  loadingText: { marginTop: 12, color: '#9CA3AF' },
  error: { color: '#F87171' },
  overlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 12,
  },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  item: { color: '#60A5FA', fontSize: 14 },
});
