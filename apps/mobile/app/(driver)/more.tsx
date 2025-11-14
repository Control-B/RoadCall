import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useAuthStore } from '../../src/store/auth-store';
import Constants from 'expo-constants';

export default function MoreScreen() {
  const { user, logout } = useAuthStore();

  const handleSignOut = () => {
    logout();
    Alert.alert('Signed Out', 'You have been signed out.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>More</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profile</Text>
        {user ? (
          <>
            <Text style={styles.label}>ID: <Text style={styles.value}>{user.userId}</Text></Text>
            <Text style={styles.label}>Role: <Text style={styles.value}>{user.role}</Text></Text>
          </>
        ) : (
          <Text style={styles.label}>Not signed in</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>App Info</Text>
        <Text style={styles.label}>Version: <Text style={styles.value}>{Constants.expoConfig?.version || '1.0.0'}</Text></Text>
        <Text style={styles.label}>Build: <Text style={styles.value}>{Constants.nativeBuildVersion || 'N/A'}</Text></Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Legal</Text>
        <TouchableOpacity style={styles.linkButton}>
          <Text style={styles.linkText}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton}>
          <Text style={styles.linkText}>Terms of Use</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton}>
          <Text style={styles.linkText}>Security</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 16 },
  heading: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 12 },
  card: { backgroundColor: '#111', padding: 16, borderRadius: 12, marginBottom: 12 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  label: { color: '#9CA3AF', fontSize: 13, marginBottom: 4 },
  value: { color: '#60A5FA' },
  linkButton: { paddingVertical: 6 },
  linkText: { color: '#60A5FA', fontSize: 14, fontWeight: '500' },
  signOutButton: { backgroundColor: '#1F2937', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  signOutText: { color: '#F87171', fontWeight: '700' },
});
