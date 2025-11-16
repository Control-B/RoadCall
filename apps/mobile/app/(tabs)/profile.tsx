import { StyleSheet, View, Text, SafeAreaView, ScrollView, Pressable, Switch } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { GradientColors } from '@/constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState } from 'react';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'dark'];
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View
            style={[
              styles.profileAvatar,
              { backgroundColor: GradientColors.light.blue },
            ]}
          >
            <FontAwesome name="user" size={48} color="#fff" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>
              Alex Johnson
            </Text>
            <Text
              style={[
                styles.profileEmail,
                { color: isDark ? '#9ca3af' : '#6b7280' },
              ]}
            >
              alex@example.com
            </Text>
            <View style={styles.membershipBadge}>
              <FontAwesome name="star" size={12} color="#fbbf24" />
              <Text style={styles.membershipText}>Premium Member</Text>
            </View>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Account
          </Text>
          <Pressable
            style={[
              styles.settingRow,
              {
                backgroundColor: isDark ? '#111' : '#f9fafb',
                borderColor: isDark ? '#333' : '#e5e7eb',
              },
            ]}
          >
            <View style={styles.settingContent}>
              <FontAwesome
                name="user"
                size={18}
                color={GradientColors.light.blue}
              />
              <View style={styles.settingLabel}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>
                  Edit Profile
                </Text>
                <Text
                  style={[
                    styles.settingDescription,
                    { color: isDark ? '#9ca3af' : '#6b7280' },
                  ]}
                >
                  Update your personal information
                </Text>
              </View>
            </View>
            <FontAwesome name="chevron-right" size={18} color={GradientColors.light.purple} />
          </Pressable>

          <Pressable
            style={[
              styles.settingRow,
              {
                backgroundColor: isDark ? '#111' : '#f9fafb',
                borderColor: isDark ? '#333' : '#e5e7eb',
              },
            ]}
          >
            <View style={styles.settingContent}>
              <FontAwesome
                name="credit-card"
                size={18}
                color={GradientColors.light.blue}
              />
              <View style={styles.settingLabel}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>
                  Payment Methods
                </Text>
                <Text
                  style={[
                    styles.settingDescription,
                    { color: isDark ? '#9ca3af' : '#6b7280' },
                  ]}
                >
                  Manage your cards and payments
                </Text>
              </View>
            </View>
            <FontAwesome name="chevron-right" size={18} color={GradientColors.light.purple} />
          </Pressable>

          <Pressable
            style={[
              styles.settingRow,
              {
                backgroundColor: isDark ? '#111' : '#f9fafb',
                borderColor: isDark ? '#333' : '#e5e7eb',
              },
            ]}
          >
            <View style={styles.settingContent}>
              <FontAwesome
                name="key"
                size={18}
                color={GradientColors.light.blue}
              />
              <View style={styles.settingLabel}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>
                  Change Password
                </Text>
                <Text
                  style={[
                    styles.settingDescription,
                    { color: isDark ? '#9ca3af' : '#6b7280' },
                  ]}
                >
                  Update your security password
                </Text>
              </View>
            </View>
            <FontAwesome name="chevron-right" size={18} color={GradientColors.light.purple} />
          </Pressable>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Preferences
          </Text>

          <View
            style={[
              styles.settingRow,
              {
                backgroundColor: isDark ? '#111' : '#f9fafb',
                borderColor: isDark ? '#333' : '#e5e7eb',
              },
            ]}
          >
            <View style={styles.settingContent}>
              <FontAwesome
                name="bell"
                size={18}
                color={GradientColors.light.blue}
              />
              <View style={styles.settingLabel}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>
                  Notifications
                </Text>
                <Text
                  style={[
                    styles.settingDescription,
                    { color: isDark ? '#9ca3af' : '#6b7280' },
                  ]}
                >
                  Service & dispatch alerts
                </Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: isDark ? '#444' : '#d1d5db', true: GradientColors.light.blue + '60' }}
              thumbColor={notificationsEnabled ? GradientColors.light.blue : '#999'}
            />
          </View>

          <View
            style={[
              styles.settingRow,
              {
                backgroundColor: isDark ? '#111' : '#f9fafb',
                borderColor: isDark ? '#333' : '#e5e7eb',
              },
            ]}
          >
            <View style={styles.settingContent}>
              <FontAwesome
                name="location-arrow"
                size={18}
                color={GradientColors.light.blue}
              />
              <View style={styles.settingLabel}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>
                  Location Services
                </Text>
                <Text
                  style={[
                    styles.settingDescription,
                    { color: isDark ? '#9ca3af' : '#6b7280' },
                  ]}
                >
                  Allow tracking during service
                </Text>
              </View>
            </View>
            <Switch
              value={locationEnabled}
              onValueChange={setLocationEnabled}
              trackColor={{ false: isDark ? '#444' : '#d1d5db', true: GradientColors.light.blue + '60' }}
              thumbColor={locationEnabled ? GradientColors.light.blue : '#999'}
            />
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Support
          </Text>

          <Pressable
            style={[
              styles.settingRow,
              {
                backgroundColor: isDark ? '#111' : '#f9fafb',
                borderColor: isDark ? '#333' : '#e5e7eb',
              },
            ]}
          >
            <View style={styles.settingContent}>
              <FontAwesome
                name="question-circle"
                size={18}
                color={GradientColors.light.blue}
              />
              <View style={styles.settingLabel}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>
                  Help & Support
                </Text>
                <Text
                  style={[
                    styles.settingDescription,
                    { color: isDark ? '#9ca3af' : '#6b7280' },
                  ]}
                >
                  FAQs and contact support
                </Text>
              </View>
            </View>
            <FontAwesome name="chevron-right" size={18} color={GradientColors.light.purple} />
          </Pressable>

          <Pressable
            style={[
              styles.settingRow,
              {
                backgroundColor: isDark ? '#111' : '#f9fafb',
                borderColor: isDark ? '#333' : '#e5e7eb',
              },
            ]}
          >
            <View style={styles.settingContent}>
              <FontAwesome
                name="shield"
                size={18}
                color={GradientColors.light.blue}
              />
              <View style={styles.settingLabel}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>
                  Privacy & Terms
                </Text>
                <Text
                  style={[
                    styles.settingDescription,
                    { color: isDark ? '#9ca3af' : '#6b7280' },
                  ]}
                >
                  Legal agreements
                </Text>
              </View>
            </View>
            <FontAwesome name="chevron-right" size={18} color={GradientColors.light.purple} />
          </Pressable>
        </View>

        {/* Logout Button */}
        <View style={styles.section}>
          <Pressable
            style={[
              styles.logoutButton,
              { backgroundColor: isDark ? '#7f1d1d' : '#fee2e2' },
            ]}
          >
            <FontAwesome name="sign-out" size={18} color="#ef4444" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'flex-start',
    gap: 16,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  membershipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fef3c7',
    width: '100%',
  },
  membershipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingLabel: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
});
