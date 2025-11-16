import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { fontSize, spacing, moderateScale } from '@/src/utils/responsive';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Chip({ label, selected = false, onPress, style }: ChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.selected, style]}
      onPress={onPress}
      activeOpacity={0.7}>
      <Text style={[styles.label, selected && styles.selectedLabel]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: spacing.md,
    paddingHorizontal: moderateScale(20),
    borderRadius: moderateScale(24),
    backgroundColor: '#F2F2F7',
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  selected: {
    backgroundColor: '#007AFF',
  },
  label: {
    fontSize: fontSize.regular,
    fontWeight: '600',
    color: '#000000',
  },
  selectedLabel: {
    color: '#FFFFFF',
  },
});
