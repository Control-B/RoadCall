import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

interface SettingsScreenProps {
  onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ChevronLeft size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
          <View style={styles.menuItem}>
            <Text style={styles.menuItemText}>Push Notifications</Text>
            <ChevronRight size={20} color="#C7C7CC" />
          </View>
          <View style={styles.menuItem}>
            <Text style={styles.menuItemText}>Email Notifications</Text>
            <ChevronRight size={20} color="#C7C7CC" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PREFERENCES</Text>
          <View style={styles.menuItem}>
            <Text style={styles.menuItemText}>Language</Text>
            <View style={styles.menuItemRight}>
              <Text style={styles.valueText}>English</Text>
              <ChevronRight size={20} color="#C7C7CC" />
            </View>
          </View>
          <View style={styles.menuItem}>
            <Text style={styles.menuItemText}>Distance Units</Text>
            <View style={styles.menuItemRight}>
              <Text style={styles.valueText}>Miles</Text>
              <ChevronRight size={20} color="#C7C7CC" />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <View style={styles.menuItem}>
            <Text style={styles.menuItemText}>Version</Text>
            <Text style={styles.valueText}>1.0.0</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#C6C6C8',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#C6C6C8',
  },
  menuItemText: {
    fontSize: 17,
    color: '#000000',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    fontSize: 17,
    color: '#8E8E93',
    marginRight: 4,
  },
});
