import React, { useEffect, useState } from 'react';
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
import { getVendorOffers } from '../../src/services/api';
import { Offer } from '../../src/types';

export default function HistoryScreen(): React.JSX.Element {
  const { user } = useAuthStore();
  const [history, setHistory] = useState<Offer[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    if (!user) return;

  // removed loading state
    try {
      // Get accepted and completed offers
      const accepted = await getVendorOffers(user.userId, 'accepted');
      const declined = await getVendorOffers(user.userId, 'declined');
      const expired = await getVendorOffers(user.userId, 'expired');

      setHistory([...accepted, ...declined, ...expired].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      // no-op
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const renderHistoryItem = ({ item }: { item: Offer }) => (
    <TouchableOpacity style={styles.historyCard}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyType}>
          {item.incident?.type.toUpperCase() || 'INCIDENT'}
        </Text>
        <Text style={[styles.historyStatus, getStatusStyle(item.status)]}>
          {item.status.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.historyDate}>
        {new Date(item.createdAt).toLocaleDateString()} at{' '}
        {new Date(item.createdAt).toLocaleTimeString()}
      </Text>
      <Text style={styles.historyPayout}>
        ${(item.estimatedPayout / 100).toFixed(2)}
      </Text>
    </TouchableOpacity>
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'accepted':
        return styles.statusAccepted;
      case 'declined':
        return styles.statusDeclined;
      case 'expired':
        return styles.statusExpired;
      default:
        return {};
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Job History</Text>
      </View>

      <FlatList
        data={history}
        renderItem={renderHistoryItem}
        keyExtractor={(item) => item.offerId}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No history yet</Text>
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
  historyCard: {
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
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  historyStatus: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusAccepted: {
    backgroundColor: '#D4EDDA',
    color: '#155724',
  },
  statusDeclined: {
    backgroundColor: '#F8D7DA',
    color: '#721C24',
  },
  statusExpired: {
    backgroundColor: '#E2E3E5',
    color: '#383D41',
  },
  historyDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  historyPayout: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34C759',
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
