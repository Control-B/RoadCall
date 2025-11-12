import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth-store';
import { useIncidentStore } from '../../src/store/incident-store';
import { createIncident } from '../../src/services/api';
import { getCurrentLocation } from '../../src/services/location';
import { IncidentType } from '../../src/types';

export default function DriverHomeScreen() {
  const { user } = useAuthStore();
  const { addIncident, activeIncident } = useIncidentStore();
  const [creating, setCreating] = useState(false);

  const handleSOS = async (type: IncidentType) => {
    Alert.alert(
      'Create Incident',
      `Request ${type} assistance?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => createNewIncident(type),
        },
      ]
    );
  };

  const createNewIncident = async (type: IncidentType) => {
    setCreating(true);
    try {
      // Get current location
      const location = await getCurrentLocation();

      // Create incident
      const incident = await createIncident({
        type,
        location: {
          lat: location.coords.latitude,
          lon: location.coords.longitude,
        },
      });

      addIncident(incident);

      Alert.alert(
        'Incident Created',
        'We are finding the best vendor for you. You will be notified shortly.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create incident');
    } finally {
      setCreating(false);
    }
  };

  if (creating) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Creating incident...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.name}!</Text>
        <Text style={styles.subtitle}>
          {activeIncident
            ? 'You have an active incident'
            : 'Need roadside assistance?'}
        </Text>
      </View>

      {activeIncident ? (
        <View style={styles.activeIncidentCard}>
          <Text style={styles.activeIncidentTitle}>Active Incident</Text>
          <Text style={styles.activeIncidentType}>
            Type: {activeIncident.type.toUpperCase()}
          </Text>
          <Text style={styles.activeIncidentStatus}>
            Status: {activeIncident.status.replace(/_/g, ' ').toUpperCase()}
          </Text>
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => {
              // Navigate to tracking screen
            }}
          >
            <Text style={styles.viewButtonText}>View Details</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.sosContainer}>
          <Text style={styles.sosTitle}>Emergency Assistance</Text>

          <TouchableOpacity
            style={[styles.sosButton, styles.tireButton]}
            onPress={() => handleSOS('tire')}
          >
            <Ionicons name="car" size={40} color="#fff" />
            <Text style={styles.sosButtonText}>Tire Issue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sosButton, styles.engineButton]}
            onPress={() => handleSOS('engine')}
          >
            <Ionicons name="construct" size={40} color="#fff" />
            <Text style={styles.sosButtonText}>Engine Problem</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sosButton, styles.towButton]}
            onPress={() => handleSOS('tow')}
          >
            <Ionicons name="git-pull-request" size={40} color="#fff" />
            <Text style={styles.sosButtonText}>Need Towing</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  activeIncidentCard: {
    margin: 20,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeIncidentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  activeIncidentType: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  activeIncidentStatus: {
    fontSize: 16,
    color: '#007AFF',
    marginBottom: 15,
  },
  viewButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sosContainer: {
    flex: 1,
    padding: 20,
  },
  sosTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tireButton: {
    backgroundColor: '#FF9500',
  },
  engineButton: {
    backgroundColor: '#FF3B30',
  },
  towButton: {
    backgroundColor: '#5856D6',
  },
  sosButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 15,
  },
});
