import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/src/store/authStore';
import {
  User,
  Settings,
  Shield,
  FileText,
  LogOut,
  ChevronRight,
} from 'lucide-react-native';
import { fontSize, spacing, moderateScale } from '@/src/utils/responsive';

interface MoreScreenProps {
  onNavigateToProfile: () => void;
  onNavigateToSettings: () => void;
  onLogout: () => void;
}

export function MoreScreen({
  onNavigateToProfile,
  onNavigateToSettings,
  onLogout,
}: MoreScreenProps) {
  const { user } = useAuthStore();

  const handlePrivacyPolicy = () => {
    Alert.alert(
      'Privacy Policy',
      'Your privacy is important to us. This app collects location data to enable roadside assistance services even when the app is closed or not in use. This data is used solely to:\n\n• Connect you with nearby mechanics\n• Provide real-time location tracking during service\n• Improve response times\n\nWe do not sell or share your personal information with third parties for marketing purposes. Your data is secured and only accessible to authorized service providers during active requests.\n\nFor questions, contact: support@roadcall.com',
      [{ text: 'OK' }]
    );
  };

  const handleTermsOfUse = () => {
    Alert.alert(
      'Terms of Use',
      'By using this app, you agree to:\n\n• Provide accurate information about your vehicle and location\n• Use the service for legitimate roadside assistance needs\n• Pay for services as agreed with the mechanic\n• Follow safety guidelines during service\n\nThe app connects drivers with independent mechanics. We do not employ mechanics and are not responsible for the quality of service provided. Always verify mechanic credentials and agree on pricing before service begins.\n\nService availability may vary by location. Response times are estimates and not guaranteed.\n\nFor full terms, visit: www.roadcall.com/terms',
      [{ text: 'OK' }]
    );
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: onLogout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>More</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {user?.name} - {user?.truckingCompany}
          </Text>
        </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={onNavigateToProfile}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.iconContainer, styles.blueIcon]}>
              <User size={20} color="#007AFF" />
            </View>
            <Text style={styles.menuItemText}>Profile</Text>
          </View>
          <ChevronRight size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemLast]}
          onPress={onNavigateToSettings}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.iconContainer, styles.grayIcon]}>
              <Settings size={20} color="#8E8E93" />
            </View>
            <Text style={styles.menuItemText}>Settings</Text>
          </View>
          <ChevronRight size={20} color="#C7C7CC" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem} onPress={handlePrivacyPolicy}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.iconContainer, styles.greenIcon]}>
              <Shield size={20} color="#34C759" />
            </View>
            <Text style={styles.menuItemText}>Privacy Policy</Text>
          </View>
          <ChevronRight size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemLast]}
          onPress={handleTermsOfUse}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.iconContainer, styles.purpleIcon]}>
              <FileText size={20} color="#AF52DE" />
            </View>
            <Text style={styles.menuItemText}>Terms of Use</Text>
          </View>
          <ChevronRight size={20} color="#C7C7CC" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemLast]}
          onPress={handleLogout}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.iconContainer, styles.redIcon]}>
              <LogOut size={20} color="#FF3B30" />
            </View>
            <Text style={[styles.menuItemText, styles.logoutText]}>
              Log Out
            </Text>
          </View>
        </TouchableOpacity>
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
    paddingBottom: spacing.xxl,
  },
  header: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.massive,
    fontWeight: '700',
    color: '#000000',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.regular,
    color: '#8E8E93',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: '#E5E5EA',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(8),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  blueIcon: {
    backgroundColor: '#E5F1FF',
  },
  grayIcon: {
    backgroundColor: '#F2F2F7',
  },
  greenIcon: {
    backgroundColor: '#E8F7ED',
  },
  purpleIcon: {
    backgroundColor: '#F5EDFA',
  },
  redIcon: {
    backgroundColor: '#FFE5E5',
  },
  menuItemText: {
    fontSize: fontSize.medium,
    color: '#000000',
    flexShrink: 1,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  logoutText: {
    color: '#FF3B30',
  },
});
