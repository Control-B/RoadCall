import React from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { fontSize, spacing, moderateScale } from '@/src/utils/responsive';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor="#8E8E93"
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.regular,
    fontWeight: '600',
    color: '#000000',
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: moderateScale(12),
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.medium,
    color: '#000000',
    minHeight: moderateScale(56),
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  error: {
    fontSize: fontSize.small,
    color: '#FF3B30',
    marginTop: spacing.xs,
  },
});
