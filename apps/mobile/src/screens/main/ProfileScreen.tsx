import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { useAuthStore } from '@/src/store/authStore';
import { ChevronLeft } from 'lucide-react-native';

interface ProfileScreenProps {
  onEditProfile: () => void;
  onLogout: () => void;
  onBack?: () => void;
}

export function ProfileScreen({
  onEditProfile,
  onLogout,
  onBack,
}: ProfileScreenProps) {
  const { user, logout } = useAuthStore();
  const [shareLocation, setShareLocation] = useState(true);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            onLogout();
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>No user data available</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {onBack && (
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ChevronLeft size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.placeholder} />
        </View>
      )}
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.phone}>{user.phone}</Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Driver Information</Text>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user.email || 'Not provided'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Trucking Company</Text>
          <Text style={styles.value}>{user.truckingCompany}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Truck Number</Text>
          <Text style={styles.value}>{user.truckNumber}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Truck Type</Text>
          <Text style={styles.value}>{user.truckType}</Text>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Settings</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Text style={styles.settingLabel}>Share Live Location</Text>
            <Text style={styles.settingDescription}>
              Automatically share location during requests
            </Text>
          </View>
          <Switch
            value={shareLocation}
            onValueChange={setShareLocation}
            trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
          />
        </View>
      </Card>

      <Button
        title="Edit Profile"
        onPress={onEditProfile}
        variant="secondary"
        style={styles.button}
      />

      <Button
        title="Logout"
        onPress={handleLogout}
        variant="danger"
        style={styles.button}
      />

      <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  headerBar: {
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
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  phone: {
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
  infoRow: {
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
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLeft: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 17,
    color: '#000000',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#8E8E93',
  },
  button: {
    marginBottom: 12,
  },
  version: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  errorText: {
    fontSize: 17,
    color: '#8E8E93',
  },
});
