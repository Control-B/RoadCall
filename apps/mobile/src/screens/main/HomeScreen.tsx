import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { useAuthStore } from '@/src/store/authStore';
import { useRequestStore } from '@/src/store/requestStore';
import { roadcallApi } from '@/src/api/roadcallApi';
import { fontSize, spacing, moderateScale } from '@/src/utils/responsive';

interface HomeScreenProps {
  onRequestHelp: () => void;
  onViewActiveJob: () => void;
}

export function HomeScreen({ onRequestHelp, onViewActiveJob }: HomeScreenProps) {
  const { user } = useAuthStore();
  const { activeRequest, setActiveRequest } = useRequestStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadActiveRequest = async () => {
    try {
      const request = await roadcallApi.getActiveRequest();
      setActiveRequest(request);
    } catch (error: any) {
      if (error.code === 'NETWORK_ERROR') {
        return;
      }
      console.error('Error loading active request:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActiveRequest();
    setRefreshing(false);
  };

  useEffect(() => {
    loadActiveRequest();
  }, []);

  const handleCallRoadsideCenter = () => {
    const phoneNumber = '1-800-ROADSIDE';
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Error', 'Unable to make phone call');
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.name || 'Driver'}</Text>
        <Text style={styles.subtitle}>
          {user?.truckingCompany} - Truck {user?.truckNumber}
        </Text>
      </View>

      {activeRequest ? (
        <Card style={styles.activeCard}>
          <View style={styles.activeHeader}>
            <Text style={styles.activeTitle}>Active Request</Text>
            <StatusBadge status={activeRequest.status} />
          </View>

          <View style={styles.activeDetails}>
            <Text style={styles.problemType}>{activeRequest.problemType}</Text>
            {activeRequest.mechanic && (
              <View style={styles.mechanicInfo}>
                <Text style={styles.mechanicName}>
                  {activeRequest.mechanic.name}
                </Text>
                <Text style={styles.mechanicCompany}>
                  {activeRequest.mechanic.companyName}
                </Text>
                {activeRequest.etaMinutes !== undefined && (
                  <Text style={styles.eta}>
                    ETA: {activeRequest.etaMinutes} minutes
                  </Text>
                )}
              </View>
            )}
          </View>

          <Button
            title="View Details"
            onPress={onViewActiveJob}
            style={styles.viewButton}
          />
        </Card>
      ) : (
        <Card style={styles.helpCard}>
          <Text style={styles.helpTitle}>Need Roadside Help?</Text>
          <Text style={styles.helpDescription}>
            Connect with nearby mechanics and tow services instantly
          </Text>
          <Button
            title="Call Roadside Center"
            onPress={handleCallRoadsideCenter}
            variant="secondary"
            style={styles.callButton}
          />
          <Button
            title="Request Roadside Help"
            onPress={onRequestHelp}
            style={styles.requestButton}
          />
        </Card>
      )}

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>How it works</Text>
        <View style={styles.infoItem}>
          <Text style={styles.infoNumber}>1</Text>
          <Text style={styles.infoText}>
            Describe your problem and share your location
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoNumber}>2</Text>
          <Text style={styles.infoText}>
            We find the nearest qualified mechanic
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoNumber}>3</Text>
          <Text style={styles.infoText}>
            Track their arrival and get help fast
          </Text>
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  greeting: {
    fontSize: fontSize.xxlarge,
    fontWeight: '700',
    color: '#000000',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.regular,
    color: '#8E8E93',
  },
  helpCard: {
    marginBottom: spacing.xl,
  },
  helpTitle: {
    fontSize: fontSize.xlarge,
    fontWeight: '700',
    color: '#000000',
    marginBottom: spacing.sm,
  },
  helpDescription: {
    fontSize: fontSize.regular,
    color: '#8E8E93',
    marginBottom: spacing.lg,
    lineHeight: moderateScale(22),
  },
  callButton: {
    marginTop: spacing.sm,
  },
  requestButton: {
    marginTop: spacing.md,
  },
  activeCard: {
    marginBottom: spacing.xl,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  activeTitle: {
    fontSize: fontSize.large,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
    marginRight: spacing.sm,
  },
  activeDetails: {
    marginBottom: spacing.lg,
  },
  problemType: {
    fontSize: fontSize.medium,
    fontWeight: '600',
    color: '#000000',
    marginBottom: spacing.md,
  },
  mechanicInfo: {
    backgroundColor: '#F2F2F7',
    padding: spacing.md,
    borderRadius: moderateScale(8),
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
  eta: {
    fontSize: fontSize.regular,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: spacing.sm,
  },
  viewButton: {
    marginTop: spacing.sm,
  },
  infoSection: {
    marginTop: spacing.sm,
  },
  infoTitle: {
    fontSize: fontSize.large,
    fontWeight: '700',
    color: '#000000',
    marginBottom: spacing.lg,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  infoNumber: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: moderateScale(14),
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    fontSize: fontSize.regular,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: moderateScale(28),
    marginRight: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: fontSize.regular,
    color: '#000000',
    lineHeight: moderateScale(22),
  },
});
