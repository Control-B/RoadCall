import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapWrapper, MarkerWrapper } from '@/src/components/MapWrapper';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Button } from '@/src/components/Button';
import { useRequestStore } from '@/src/store/requestStore';
import { useActiveRequest } from '@/src/hooks/useActiveRequest';
import { fontSize, spacing, moderateScale } from '@/src/utils/responsive';

interface ActiveJobScreenProps {
  requestId: string;
  onJobCompleted: () => void;
}

export function ActiveJobScreen({
  requestId,
  onJobCompleted,
}: ActiveJobScreenProps) {
  const insets = useSafeAreaInsets();
  const { activeRequest, mechanicLocation } = useRequestStore();
  useActiveRequest(requestId);

  React.useEffect(() => {
    if (activeRequest?.status === 'COMPLETED') {
      Alert.alert(
        'Job Completed',
        'Your roadside service has been completed. Thank you for using RoadCall Assist!',
        [{ text: 'OK', onPress: onJobCompleted }]
      );
    }
  }, [activeRequest?.status]);

  const handleCallShop = () => {
    if (activeRequest?.mechanic?.phone) {
      Linking.openURL(`tel:${activeRequest.mechanic.phone}`);
    }
  };

  const handleChat = () => {
    Alert.alert('Chat', 'Chat feature coming soon!');
  };

  const driverLocation = activeRequest?.location;
  const mechLocation = mechanicLocation || activeRequest?.mechanic?.location;

  const getStatusTimeline = () => {
    const statuses = [
      { key: 'REQUESTED', label: 'Requested' },
      { key: 'ACCEPTED', label: 'Accepted' },
      { key: 'EN_ROUTE', label: 'En Route' },
      { key: 'ON_SITE', label: 'On Site' },
      { key: 'COMPLETED', label: 'Completed' },
    ];

    const currentIndex = statuses.findIndex(
      (s) => s.key === activeRequest?.status
    );

    return statuses.map((status, index) => ({
      ...status,
      active: index <= currentIndex,
    }));
  };

  if (!activeRequest) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading job details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapWrapper
        style={styles.map}
        region={{
          latitude: driverLocation?.lat || 0,
          longitude: driverLocation?.lng || 0,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}>
        {driverLocation && (
          <MarkerWrapper
            coordinate={{
              latitude: driverLocation.lat,
              longitude: driverLocation.lng,
            }}
            title="Your Location"
            pinColor="blue"
          />
        )}
        {mechLocation && (
          <MarkerWrapper
            coordinate={{
              latitude: mechLocation.lat,
              longitude: mechLocation.lng,
            }}
            title="Mechanic Location"
            pinColor="red"
          />
        )}
      </MapWrapper>

      <View style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={styles.handle} />

        <Card style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.problemType}>{activeRequest.problemType}</Text>
            <StatusBadge status={activeRequest.status} />
          </View>

          {activeRequest.mechanic && (
            <View style={styles.mechanicSection}>
              <Text style={styles.mechanicName}>
                {activeRequest.mechanic.name}
              </Text>
              <Text style={styles.mechanicCompany}>
                {activeRequest.mechanic.companyName}
              </Text>
              {activeRequest.etaMinutes !== undefined && (
                <View style={styles.etaContainer}>
                  <Text style={styles.eta}>{activeRequest.etaMinutes} min</Text>
                  <Text style={styles.etaLabel}>ETA</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.timeline}>
            {getStatusTimeline().map((status, index) => (
              <View key={status.key} style={styles.timelineItem}>
                <View
                  style={[
                    styles.timelineDot,
                    status.active && styles.timelineDotActive,
                  ]}
                />
                {index < 4 && (
                  <View
                    style={[
                      styles.timelineLine,
                      status.active && styles.timelineLineActive,
                    ]}
                  />
                )}
                <Text
                  style={[
                    styles.timelineLabel,
                    status.active && styles.timelineLabelActive,
                  ]}>
                  {status.label}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <Button
              title="Call Shop"
              onPress={handleCallShop}
              variant="primary"
              style={styles.actionButton}
            />
            <Button
              title="Chat"
              onPress={handleChat}
              variant="secondary"
              style={styles.actionButton}
            />
          </View>
        </Card>
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
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  handle: {
    width: moderateScale(40),
    height: moderateScale(4),
    backgroundColor: '#C7C7CC',
    borderRadius: moderateScale(2),
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  card: {
    margin: spacing.lg,
    marginTop: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  problemType: {
    fontSize: fontSize.large,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
    marginRight: spacing.sm,
  },
  mechanicSection: {
    backgroundColor: '#F2F2F7',
    padding: spacing.md,
    borderRadius: moderateScale(12),
    marginBottom: spacing.lg,
  },
  mechanicName: {
    fontSize: fontSize.medium,
    fontWeight: '600',
    color: '#000000',
    marginBottom: spacing.xs,
  },
  mechanicCompany: {
    fontSize: fontSize.regular,
    color: '#8E8E93',
  },
  etaContainer: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  eta: {
    fontSize: fontSize.xlarge,
    fontWeight: '700',
    color: '#007AFF',
    marginRight: spacing.sm,
  },
  etaLabel: {
    fontSize: fontSize.regular,
    color: '#8E8E93',
  },
  timeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg + spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  timelineItem: {
    alignItems: 'center',
    flex: 1,
  },
  timelineDot: {
    width: moderateScale(12),
    height: moderateScale(12),
    borderRadius: moderateScale(6),
    backgroundColor: '#E5E5EA',
    marginBottom: spacing.sm,
  },
  timelineDotActive: {
    backgroundColor: '#007AFF',
  },
  timelineLine: {
    position: 'absolute',
    top: moderateScale(6),
    left: '50%',
    right: '-50%',
    height: 2,
    backgroundColor: '#E5E5EA',
  },
  timelineLineActive: {
    backgroundColor: '#007AFF',
  },
  timelineLabel: {
    fontSize: fontSize.tiny,
    color: '#8E8E93',
    textAlign: 'center',
  },
  timelineLabelActive: {
    color: '#000000',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    fontSize: fontSize.medium,
    color: '#8E8E93',
  },
});
