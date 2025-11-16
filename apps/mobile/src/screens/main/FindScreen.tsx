import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fontSize, spacing } from '@/src/utils/responsive';

export function FindScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Find Services</Text>
          <Text style={styles.subtitle}>Coming soon</Text>
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
    marginTop: spacing.xxl + spacing.sm,
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.xxlarge,
    fontWeight: '700',
    color: '#000000',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.regular,
    color: '#8E8E93',
  },
});
