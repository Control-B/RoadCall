import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth-store';
import { useVendorStore } from '../../src/store/vendor-store';
import { getVendorOffers, acceptOffer, declineOffer } from '../../src/services/api';
import { Offer } from '../../src/types';

export default function VendorHomeScreen() {
  const { user } = useAuthStore();
  const { offers, setOffers, updateOffer } = useVendorStore();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [processingOffer, setProcessingOffer] = useState<string | null>(null);

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await getVendorOffers(user.userId, 'pending');
      setOffers(data);
    } catch (error) {
      console.error('Failed to load offers:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOffers();
    setRefreshing(false);
  };

  const handleAccept = async (offerId: string) => {
    Alert.alert('Accept Offer', 'Accept this job?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          setProcessingOffer(offerId);
          try {
            const updatedOffer = await acceptOffer(offerId);
            updateOffer(offerId, updatedOffer);
            Alert.alert('Success', 'Offer accepted! Navigate to the incident location.');
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to accept offer');
          } finally {
            setProcessingOffer(null);
          }
        },
      },
    ]);
  };

  const handleDecline = async (offerId: string) => {
    Alert.alert('Decline Offer', 'Decline this job?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setProcessingOffer(offerId);
          try {
            const updatedOffer = await declineOffer(offerId, 'Not available');
            updateOffer(offerId, updatedOffer);
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to decline offer');
          } finally {
            setProcessingOffer(null);
          }
        },
      },
    ]);
  };

  const renderOffer = ({ item }: { item: Offer }) => {
    const isProcessing = processingOffer === item.offerId;
    const timeRemaining = Math.max(
      0,
      Math.floor((item.expiresAt - Date.now()) / 1000)
    );
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    return (
      <View style={styles.offerCard}>
        <View style={styles.offerHeader}>
          <Text style={styles.offerType}>
            {item.incident?.type.toUpperCase() || 'INCIDENT'}
          </Text>
          <Text style={styles.timer}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </Text>
        </View>

        <Text style={styles.payout}>
          Estimated Payout: ${(item.estimatedPayout / 100).toFixed(2)}
        </Text>

        {item.incident && (
          <Text style={styles.location}>{item.incident.location.address}</Text>
        )}

        <Text style={styles.matchScore}>
          Match Score: {(item.matchScore * 100).toFixed(0)}%
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.declineButton]}
            onPress={() => handleDecline(item.offerId)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="close-circle" size={20} color="#fff" />
                <Text style={styles.buttonText}>Decline</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.acceptButton]}
            onPress={() => handleAccept(item.offerId)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.buttonText}>Accept</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Job Offers</Text>
        <Text style={styles.subtitle}>
          {offers.length} pending {offers.length === 1 ? 'offer' : 'offers'}
        </Text>
      </View>

      <FlatList
        data={offers}
        renderItem={renderOffer}
        keyExtractor={(item) => item.offerId}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="briefcase-outline" size={80} color="#ccc" />
            <Text style={styles.emptyText}>No pending offers</Text>
            <Text style={styles.emptySubtext}>
              You'll be notified when new jobs are available
            </Text>
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
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  list: {
    padding: 20,
  },
  offerCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  offerType: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  timer: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
  payout: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 10,
  },
  location: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  matchScore: {
    fontSize: 14,
    color: '#999',
    marginBottom: 15,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
  declineButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
  },
});
