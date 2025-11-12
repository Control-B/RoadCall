import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useAuthStore } from '../../src/store/auth-store';
import { useIncidentStore } from '../../src/store/incident-store';
import { getDriverIncidents } from '../../src/services/api';
import { Incident } from '../../src/types';

export default function IncidentsScreen() {
  const { user } = useAuthStore();
  const { incidents, setIncidents } = useIncidentStore();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await getDriverIncidents(user.userId);
      setIncidents(data);
    } catch (error) {
      console.error('Failed to load incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadIncidents();
    setRefreshing(false);
  };

  const renderIncident = ({ item }: { item: Incident }) => (
    <TouchableOpacity style={styles.incidentCard}>
      <View style={styles.incidentHeader}>
        <Text style={styles.incidentType}>{item.type.toUpperCase()}</Text>
        <Text style={[styles.status, getStatusStyle(item.status)]}>
          {item.status.replace(/_/g, ' ').toUpperCase()}
        </Text>
      </View>
      <Text style={styles.incidentDate}>
        {new Date(item.createdAt).toLocaleDateString()} at{' '}
        {new Date(item.createdAt).toLocaleTimeString()}
      </Text>
      <Text style={styles.incidentLocation}>{item.location.address}</Text>
    </TouchableOpacity>
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'created':
        return styles.statusPending;
      case 'vendor_assigned':
      case 'vendor_en_route':
        return styles.statusActive;
      case 'work_completed':
      case 'closed':
        return styles.statusCompleted;
      case 'cancelled':
        return styles.statusCancelled;
      default:
        return {};
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Incidents</Text>
      </View>

      <FlatList
        data={incidents}
        renderItem={renderIncident}
        keyExtractor={(item) => item.incidentId}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No incidents yet</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  list: {
    padding: 20,
  },
  incidentCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  incidentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  incidentType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: '#FFF3CD',
    color: '#856404',
  },
  statusActive: {
    backgroundColor: '#D1ECF1',
    color: '#0C5460',
  },
  statusCompleted: {
    backgroundColor: '#D4EDDA',
    color: '#155724',
  },
  statusCancelled: {
    backgroundColor: '#F8D7DA',
    color: '#721C24',
  },
  incidentDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  incidentLocation: {
    fontSize: 14,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
  },
});
