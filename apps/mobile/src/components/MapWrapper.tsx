import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

interface MapWrapperProps {
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  region?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  style?: any;
  children?: React.ReactNode;
}

export function MapWrapper({ initialRegion, region, style, children }: MapWrapperProps) {
  return (
    <View style={[styles.webMapPlaceholder, style]}>
      <Text style={styles.placeholderText}>
        Map view available on mobile devices
      </Text>
      {(initialRegion || region) && (
        <Text style={styles.coordinates}>
          Location: {(initialRegion?.latitude || region?.latitude || 0).toFixed(4)}, {(initialRegion?.longitude || region?.longitude || 0).toFixed(4)}
        </Text>
      )}
    </View>
  );
}

interface MarkerWrapperProps {
  coordinate: {
    latitude: number;
    longitude: number;
  };
  title?: string;
  pinColor?: string;
}

export function MarkerWrapper({ coordinate, title, pinColor }: MarkerWrapperProps) {
  return null;
}

const styles = StyleSheet.create({
  webMapPlaceholder: {
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 17,
    color: '#8E8E93',
    marginBottom: 8,
  },
  coordinates: {
    fontSize: 13,
    color: '#8E8E93',
  },
});
