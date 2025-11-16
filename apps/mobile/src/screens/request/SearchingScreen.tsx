import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MapWrapper, MarkerWrapper } from '@/src/components/MapWrapper';
import { useRequestStore } from '@/src/store/requestStore';
import { useActiveRequest } from '@/src/hooks/useActiveRequest';

interface SearchingScreenProps {
  requestId: string;
  onMechanicAccepted: () => void;
}

export function SearchingScreen({
  requestId,
  onMechanicAccepted,
}: SearchingScreenProps) {
  const { activeRequest } = useRequestStore();
  useActiveRequest(requestId);

  useEffect(() => {
    if (activeRequest?.status === 'ACCEPTED' || activeRequest?.status === 'EN_ROUTE') {
      onMechanicAccepted();
    }
  }, [activeRequest?.status]);

  const driverLocation = activeRequest?.location;

  return (
    <View style={styles.container}>
      {driverLocation && (
        <MapWrapper
          style={styles.map}
          initialRegion={{
            latitude: driverLocation.lat,
            longitude: driverLocation.lng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}>
          <MarkerWrapper
            coordinate={{
              latitude: driverLocation.lat,
              longitude: driverLocation.lng,
            }}
            title="Your Location"
            pinColor="blue"
          />
        </MapWrapper>
      )}

      <View style={styles.overlay}>
        <View style={styles.statusCard}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.title}>Searching for Mechanic...</Text>
          <Text style={styles.subtitle}>
            We're finding the nearest qualified mechanic for your {activeRequest?.problemType || 'issue'}
          </Text>
          {activeRequest?.location.address && (
            <Text style={styles.location}>{activeRequest.location.address}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    margin: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  location: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
  },
});
