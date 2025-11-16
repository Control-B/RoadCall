import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { JobStatus } from '@/src/types';
import { fontSize, spacing, moderateScale } from '@/src/utils/responsive';

interface StatusBadgeProps {
  status: JobStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = getStatusConfig(status);

  return (
    <View style={[styles.badge, { backgroundColor: config.backgroundColor }]}>
      <Text style={[styles.text, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

function getStatusConfig(status: JobStatus) {
  switch (status) {
    case 'REQUESTED':
      return { label: 'Requested', color: '#007AFF', backgroundColor: '#E5F1FF' };
    case 'SEARCHING':
      return { label: 'Searching', color: '#FF9500', backgroundColor: '#FFF3E5' };
    case 'ACCEPTED':
      return { label: 'Accepted', color: '#34C759', backgroundColor: '#E8F8EC' };
    case 'EN_ROUTE':
      return { label: 'En Route', color: '#5856D6', backgroundColor: '#EEECFF' };
    case 'ON_SITE':
      return { label: 'On Site', color: '#FF2D55', backgroundColor: '#FFE5EC' };
    case 'COMPLETED':
      return { label: 'Completed', color: '#34C759', backgroundColor: '#E8F8EC' };
    case 'CANCELED':
      return { label: 'Canceled', color: '#8E8E93', backgroundColor: '#F2F2F7' };
    default:
      return { label: status, color: '#000000', backgroundColor: '#F2F2F7' };
  }
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: moderateScale(8),
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: fontSize.small,
    fontWeight: '600',
  },
});
