import { StyleSheet, View, Text, SafeAreaView, ScrollView } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { GradientColors } from '@/constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function TrackScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'dark'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Active Service */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Service</Text>
          
          <View style={[styles.activeCard, { backgroundColor: isDark ? '#111' : '#f9fafb', borderColor: GradientColors.light.blue }]}>
            {/* Provider Info */}
            <View style={styles.providerSection}>
              <View style={[styles.providerAvatar, { backgroundColor: GradientColors.light.blue }]}>
                <FontAwesome name="user" size={24} color="#fff" />
              </View>
              <View style={styles.providerDetails}>
                <Text style={[styles.providerName, { color: colors.text }]}>Mike Johnson</Text>
                <Text style={[styles.providerRole, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Certified Mechanic • 4.9★</Text>
              </View>
              <View style={styles.callButton}>
                <FontAwesome name="phone" size={20} color={GradientColors.light.blue} />
              </View>
            </View>

            {/* Map Placeholder */}
            <View style={[styles.mapPlaceholder, { backgroundColor: isDark ? '#000' : '#e5e7eb' }]}>
              <FontAwesome name="map-marker" size={32} color={GradientColors.light.blue} />
              <Text style={[styles.mapText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Live Map</Text>
            </View>

            {/* ETA & Distance */}
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <FontAwesome name="clock-o" size={16} color={GradientColors.light.purple} />
                <View style={styles.statContent}>
                  <Text style={[styles.statLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>ETA</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>8 minutes</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.stat}>
                <FontAwesome name="location-arrow" size={16} color={GradientColors.light.pink} />
                <View style={styles.statContent}>
                  <Text style={[styles.statLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>Distance</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>2.3 mi</Text>
                </View>
              </View>
            </View>

            {/* Status */}
            <View style={[styles.statusBadge, { backgroundColor: isDark ? '#062f46' : '#dbeafe' }]}>
              <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
              <Text style={[styles.statusText, { color: isDark ? '#86efac' : '#047857' }]}>On the way</Text>
            </View>
          </View>
        </View>

        {/* Service Details */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Service Details</Text>
          
          <View style={[styles.detailCard, { backgroundColor: isDark ? '#111' : '#f9fafb', borderColor: isDark ? '#333' : '#e5e7eb' }]}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>Service Type</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>Tire Change</Text>
            </View>
            <View style={[styles.detailDivider, { backgroundColor: isDark ? '#333' : '#e5e7eb' }]} />
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>Incident ID</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>RC-2024-1152</Text>
            </View>
            <View style={[styles.detailDivider, { backgroundColor: isDark ? '#333' : '#e5e7eb' }]} />
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>Estimated Cost</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>$85.00</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Actions</Text>
          <Text style={[styles.infoText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
            The service provider is on their way. You can track their location and contact them directly.
          </Text>
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
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  activeCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
  },
  providerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  providerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerDetails: {
    flex: 1,
    marginLeft: 12,
  },
  providerName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  providerRole: {
    fontSize: 13,
  },
  callButton: {
    padding: 8,
  },
  mapPlaceholder: {
    height: 200,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  mapText: {
    fontSize: 13,
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailDivider: {
    height: 1,
  },
  actionsSection: {
    paddingHorizontal: 20,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
