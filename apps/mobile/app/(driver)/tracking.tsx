import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useIncidentStore } from '../../src/store/incident-store';
import appsyncClient, { ON_INCIDENT_TRACKING } from '../../src/config/appsync-client';

export default function TrackingScreen() {
  const { activeIncident, trackingSession, setTrackingSession, updateTrackingSession } =
    useIncidentStore();
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<MapView>(null);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (activeIncident && activeIncident.assignedVendorId) {
      subscribeToTracking();
    }

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [activeIncident]);

  const subscribeToTracking = () => {
    try {
      const subscription = appsyncClient
        .subscribe({
          query: ON_INCIDENT_TRACKING,
          variables: {
            incidentId: activeIncident?.incidentId,
          },
        })
        .subscribe({
          next: ({ data }: any) => {
            if (data?.onIncidentTracking) {
              const session = data.onIncidentTracking;
              if (trackingSession) {
                updateTrackingSession(session);
              } else {
                setTrackingSession(session);
              }
              setLoading(false);

              // Fit map to show both locations
              if (mapRef.current && session.vendorLocation) {
                mapRef.current.fitToCoordinates(
                  [
                    {
                      latitude: session.driverLocation.lat,
                      longitude: session.driverLocation.lon,
                    },
                    {
                      latitude: session.vendorLocation.lat,
                      longitude: session.vendorLocation.lon,
                    },
                  ],
                  {
                    edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
                    animated: true,
                  }
                );
              }
            }
          },
          error: (error: any) => {
            console.error('Tracking subscription error:', error);
            setLoading(false);
          },
        });

      subscriptionRef.current = subscription;
    } catch (error) {
      console.error('Failed to subscribe to tracking:', error);
      setLoading(false);
    }
  };

  if (!activeIncident || !activeIncident.assignedVendorId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No active tracking session</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading || !trackingSession) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading tracking...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const driverLocation = trackingSession.driverLocation;
  const vendorLocation = trackingSession.vendorLocation;
  const vendorRoute = trackingSession.vendorRoute || [];

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: driverLocation.lat,
          longitude: driverLocation.lon,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* Driver marker */}
        <Marker
          coordinate={{
            latitude: driverLocation.lat,
            longitude: driverLocation.lon,
          }}
          title="Your Location"
          pinColor="blue"
        />

        {/* Vendor marker */}
        {vendorLocation && (
          <Marker
            coordinate={{
              latitude: vendorLocation.lat,
              longitude: vendorLocation.lon,
            }}
            title="Vendor Location"
            pinColor="green"
          />
        )}

        {/* Vendor route */}
        {vendorRoute.length > 0 && (
          <Polyline
            coordinates={vendorRoute.map((point) => ({
              latitude: point.lat,
              longitude: point.lon,
            }))}
            strokeColor="#007AFF"
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* ETA Card */}
      <View style={styles.etaCard}>
        <Text style={styles.etaTitle}>Vendor En Route</Text>
        {trackingSession.eta && (
          <>
            <Text style={styles.etaTime}>
              ETA: {trackingSession.eta.minutes} minutes
            </Text>
            <Text style={styles.etaDistance}>
              Distance: {trackingSession.eta.distance.toFixed(1)} miles
            </Text>
          </>
        )}
        <Text style={styles.status}>
          Status: {activeIncident.status.replace(/_/g, ' ').toUpperCase()}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
  },
  map: {
    flex: 1,
  },
  etaCard: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  etaTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  etaTime: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 5,
  },
  etaDistance: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  status: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
  },
});
