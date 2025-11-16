import { StyleSheet, View, Text, Pressable, ScrollView, SafeAreaView } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { GradientColors } from '@/constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function HelpScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'dark'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero Section with Gradient */}
        <View style={[styles.heroSection, { backgroundColor: isDark ? '#000' : '#f3f4f6' }]}>
          <View style={styles.heroContent}>
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              One Call,
            </Text>
            <Text style={[styles.heroGradientTitle, { color: GradientColors.light.blue }]}>
              Instant Help
            </Text>
            <Text style={[styles.heroSubtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Help is on the way
            </Text>
          </View>
        </View>

        {/* Emergency Call Button */}
        <View style={styles.mainCTAContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.emergencyButton,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => alert('Calling dispatch center...')}
          >
            <FontAwesome name="phone" size={48} color="#fff" />
            <Text style={styles.emergencyButtonText}>Call for Help</Text>
            <Text style={styles.emergencyButtonSubtext}>Tap to call 24/7</Text>
          </Pressable>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: isDark ? '#111' : '#f9fafb', borderColor: isDark ? '#333' : '#e5e7eb' }]}>
            <FontAwesome name="clock-o" size={24} color={GradientColors.light.blue} />
            <Text style={[styles.statValue, { color: colors.text }]}>{'<2 min'}</Text>
            <Text style={[styles.statLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>Avg Call</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: isDark ? '#111' : '#f9fafb', borderColor: isDark ? '#333' : '#e5e7eb' }]}>
            <FontAwesome name="car" size={24} color={GradientColors.light.purple} />
            <Text style={[styles.statValue, { color: colors.text }]}>15 min</Text>
            <Text style={[styles.statLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>Dispatch</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: isDark ? '#111' : '#f9fafb', borderColor: isDark ? '#333' : '#e5e7eb' }]}>
            <FontAwesome name="star" size={24} color={GradientColors.light.pink} />
            <Text style={[styles.statValue, { color: colors.text }]}>4.9★</Text>
            <Text style={[styles.statLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>Rating</Text>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent</Text>
          <View style={[styles.activityCard, { backgroundColor: isDark ? '#111' : '#f9fafb', borderColor: isDark ? '#333' : '#e5e7eb' }]}>
            <View style={styles.activityHeader}>
              <FontAwesome name="wrench" size={20} color={GradientColors.light.blue} />
              <Text style={[styles.activityTitle, { color: colors.text }]}>Tire Change Service</Text>
            </View>
            <Text style={[styles.activityTime, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Completed 2 hours ago</Text>
          </View>
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
  heroSection: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  heroContent: {
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '600',
    marginBottom: 4,
  },
  heroGradientTitle: {
    fontSize: 40,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
  },
  mainCTAContainer: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  emergencyButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
  },
  emergencyButtonSubtext: {
    color: '#fee2e2',
    fontSize: 12,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  activityCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  activityTime: {
    fontSize: 12,
    marginLeft: 32,
  },
});
