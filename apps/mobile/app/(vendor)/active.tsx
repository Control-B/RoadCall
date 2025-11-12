import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useVendorStore } from '../../src/store/vendor-store';
import { useIncidentStore } from '../../src/store/incident-store';
import { updateIncidentStatus } from '../../src/services/api';
import {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
} from '../../src/services/location';

export default function ActiveJobScreen() {
  const { activeOffer } = useVendorStore();
  const { activeIncident, setActiveIncident, trackingSession } = useIncidentStore();
  const [updating, setUpdating] = useState(false);
  const [tracking, setTracking] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (activeOffer && activeOffer.incident) {
      setActiveIncident(activeOffer.incident);
    }
  }, [activeOffer]);

  const handleStartNavigation = async () => {
    if (!activeIncident || !trackingSession) return;

    try {
      await startBackgroundLocationTracking(trackingSession.sessionId);
      setTracking(true);
      Alert.alert('Navigation Started', 'Your location is being tracked');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start navigation');
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!activeIncident) return;

    const statusMessages: Record<string, string> = {
      vendor_en_route: 'Mark as en route?',
      vendor_arrived: 'Mark as arrived?',
      work_in_progress: 'Start work?',
      work_completed: 'Mark work as completed?',
    };

    Alert.alert('Update Status', statusMessages[status], [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setUpdating(true);
          try {
            const updated = await updateIncidentStatus(
              activeIncident.incidentId,
              status
            );
            setActiveIncident(updated);

            if (status === 'work_completed') {
              await stopBackgroundLocationTracking();
              setTracking(false);
            }
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update status');
          } finally {
            setUpdating(false);
          }
        },
      },
    ]);
  };

  if (!activeIncident) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="briefcase-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>No active job</Text>
        </View>
      </SafeAreaView>
    );
  }

  const incidentLocation = activeIncident.location;

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: incidentLocation.lat,
          longitude: incidentLocation.lon,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        <Marker
          coordinate={{
            latitude: incidentLocation.lat,
            longitude: incidentLocation.lon,
          }}
          title="Incident Location"
          pinColor="red"
        />
      </MapView>

      <View style={styles.infoCard}>
        <Text style={styles.incidentType}>
          {activeIncident.type.toUpperCase()}
        </Text>
        <Text style={styles.address}>{incidentLocation.address}</Text>
        <Text style={styles.status}>
          Status: {activeIncident.status.replace(/_/g, ' ').toUpperCase()}
        </Text>

        {activeIncident.status === 'vendor_assigned' && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.navigationButton]}
              onPress={handleStartNavigation}
              disabled={tracking}
            >
              <Ionicons name="navigate" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>
                {tracking ? 'Navigation Active' : 'Start Navigation'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.statusButton]}
              onPress={() => handleUpdateStatus('vendor_en_route')}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>Mark En Route</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {activeIncident.status === 'vendor_en_route' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.statusButton]}
            onPress={() => handleUpdateStatus('vendor_arrived')}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>Mark Arrived</Text>
            )}
          </TouchableOpacity>
        )}

        {activeIncident.status === 'vendor_arrived' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.statusButton]}
            onPress={() => handleUpdateStatus('work_in_progress')}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>Start Work</Text>
            )}
          </TouchableOpacity>
        )}

        {activeIncident.status === 'work_in_progress' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => handleUpdateStatus('work_completed')}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>Complete Work</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 20,
  },
  infoCard: {
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
  incidentType: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  address: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  status: {
    fontSize: 14,
    color: '#999',
    marginBottom: 15,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    gap: 8,
  },
  navigationButton: {
    backgroundColor: '#007AFF',
  },
  statusButton: {
    backgroundColor: '#34C759',
  },
  completeButton: {
    backgroundColor: '#FF9500',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
