import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { roadcallApi } from '@/src/api/roadcallApi';
import { BreakdownRequest } from '@/src/types';
import { fontSize, spacing, moderateScale } from '@/src/utils/responsive';

interface HistoryScreenProps {
  onViewDetail: (request: BreakdownRequest) => void;
}

import { SafeAreaView } from 'react-native-safe-area-context';

export function HistoryScreen({ onViewDetail }: HistoryScreenProps) {
  const [requests, setRequests] = useState<BreakdownRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = async () => {
    try {
      const history = await roadcallApi.getRequestHistory();
      setRequests(history);
    } catch (error: any) {
      if (error.code === 'NETWORK_ERROR') {
        setRequests([]);
      } else {
        console.error('Error loading history:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderItem = ({ item }: { item: BreakdownRequest }) => (
    <TouchableOpacity onPress={() => onViewDetail(item)}>
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.problemType}>{item.problemType}</Text>
            <Text style={styles.date}>
              {formatDate(item.createdAt)} at {formatTime(item.createdAt)}
            </Text>
          </View>
          <StatusBadge status={item.status} />
        </View>

        {item.mechanic && (
          <View style={styles.mechanicInfo}>
            <Text style={styles.mechanicName}>{item.mechanic.name}</Text>
            <Text style={styles.mechanicCompany}>
              {item.mechanic.companyName}
            </Text>
          </View>
        )}

        {item.location.address && (
          <Text style={styles.location} numberOfLines={1}>
            {item.location.address}
          </Text>
        )}
      </Card>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top']}>
        <Text style={styles.loadingText}>Loading history...</Text>
      </SafeAreaView>
    );
  }

  if (requests.length === 0) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top']}>
        <Text style={styles.emptyTitle}>No Service History</Text>
        <Text style={styles.emptySubtitle}>
          Your past requests will appear here
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={requests}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  list: {
    padding: spacing.lg,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  problemType: {
    fontSize: fontSize.medium,
    fontWeight: '600',
    color: '#000000',
    marginBottom: spacing.xs,
    flexWrap: 'wrap',
  },
  date: {
    fontSize: fontSize.small,
    color: '#8E8E93',
    flexWrap: 'wrap',
  },
  mechanicInfo: {
    backgroundColor: '#F2F2F7',
    padding: spacing.sm,
    borderRadius: moderateScale(8),
    marginBottom: spacing.sm,
  },
  mechanicName: {
    fontSize: fontSize.regular,
    fontWeight: '600',
    color: '#000000',
  },
  mechanicCompany: {
    fontSize: fontSize.small,
    color: '#8E8E93',
    marginTop: 2,
  },
  location: {
    fontSize: fontSize.small,
    color: '#8E8E93',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.large,
    fontWeight: '700',
    color: '#000000',
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.regular,
    color: '#8E8E93',
    textAlign: 'center',
  },
  loadingText: {
    fontSize: fontSize.medium,
    color: '#8E8E93',
  },
});
