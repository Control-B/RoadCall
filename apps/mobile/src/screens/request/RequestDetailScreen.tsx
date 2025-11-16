import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Button } from '@/src/components/Button';
import { BreakdownRequest } from '@/src/types';

interface RequestDetailScreenProps {
  request: BreakdownRequest;
  onClose: () => void;
}

export function RequestDetailScreen({
  request,
  onClose,
}: RequestDetailScreenProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{request.problemType}</Text>
          <Text style={styles.date}>
            {formatDate(request.createdAt)} at {formatTime(request.createdAt)}
          </Text>
        </View>
        <StatusBadge status={request.status} />
      </View>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Request Details</Text>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Problem Type</Text>
          <Text style={styles.value}>{request.problemType}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Trailer Attached</Text>
          <Text style={styles.value}>{request.hasTrailer ? 'Yes' : 'No'}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Truck Type</Text>
          <Text style={styles.value}>{request.truckType}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.label}>Truck Number</Text>
          <Text style={styles.value}>{request.truckNumber}</Text>
        </View>

        {request.notes && (
          <View style={styles.detailRow}>
            <Text style={styles.label}>Notes</Text>
            <Text style={styles.value}>{request.notes}</Text>
          </View>
        )}
      </Card>

      {request.location && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Location</Text>
          {request.location.address ? (
            <Text style={styles.value}>{request.location.address}</Text>
          ) : (
            <Text style={styles.value}>
              {request.location.lat.toFixed(6)}, {request.location.lng.toFixed(6)}
            </Text>
          )}
        </Card>
      )}

      {request.mechanic && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Service Provider</Text>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Mechanic</Text>
            <Text style={styles.value}>{request.mechanic.name}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Company</Text>
            <Text style={styles.value}>{request.mechanic.companyName}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{request.mechanic.phone}</Text>
          </View>
        </Card>
      )}

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Timeline</Text>

        <View style={styles.timelineRow}>
          <Text style={styles.label}>Created</Text>
          <Text style={styles.value}>
            {formatDate(request.createdAt)} at {formatTime(request.createdAt)}
          </Text>
        </View>

        <View style={styles.timelineRow}>
          <Text style={styles.label}>Last Updated</Text>
          <Text style={styles.value}>
            {formatDate(request.updatedAt)} at {formatTime(request.updatedAt)}
          </Text>
        </View>

        {request.completedAt && (
          <View style={styles.timelineRow}>
            <Text style={styles.label}>Completed</Text>
            <Text style={styles.value}>
              {formatDate(request.completedAt)} at{' '}
              {formatTime(request.completedAt)}
            </Text>
          </View>
        )}
      </Card>

      <Button
        title="Close"
        onPress={onClose}
        variant="secondary"
        style={styles.closeButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 16,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  date: {
    fontSize: 15,
    color: '#8E8E93',
  },
  card: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  detailRow: {
    marginBottom: 12,
  },
  timelineRow: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  value: {
    fontSize: 17,
    color: '#000000',
  },
  closeButton: {
    marginTop: 8,
    marginBottom: 24,
  },
});
