import { StyleSheet, View, Text, SafeAreaView, ScrollView, Pressable } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { GradientColors } from '@/constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'dark'];

  const history = [
    {
      id: 1,
      type: 'Tire Change',
      provider: 'Joe\'s Auto Repair',
      date: 'Nov 14, 2024',
      cost: '$85.00',
      status: 'Completed',
      rating: 5,
    },
    {
      id: 2,
      type: 'Towing',
      provider: 'Fast Towing Co',
      date: 'Nov 10, 2024',
      cost: '$125.00',
      status: 'Completed',
      rating: 4.8,
    },
    {
      id: 3,
      type: 'Engine Diagnostic',
      provider: 'Downtown Auto',
      date: 'Nov 5, 2024',
      cost: '$45.00',
      status: 'Completed',
      rating: 4.7,
    },
    {
      id: 4,
      type: 'Battery Replacement',
      provider: 'Metro Mechanics',
      date: 'Oct 28, 2024',
      cost: '$95.00',
      status: 'Completed',
      rating: 4.9,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return '#10b981';
      case 'Pending':
        return '#f59e0b';
      case 'Cancelled':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getServiceIcon = (type: string) => {
    switch (type) {
      case 'Tire Change':
        return 'car';
      case 'Towing':
        return 'truck';
      case 'Engine Diagnostic':
        return 'wrench';
      case 'Battery Replacement':
        return 'plug';
      default:
        return 'cog';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerSection}>
          <Text style={[styles.title, { color: colors.text }]}>Service History</Text>
          <Text style={[styles.subtitle, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
            All completed and past services
          </Text>
        </View>

        <View style={styles.historyList}>
          {history.map((item, index) => (
            <Pressable
              key={item.id}
              style={[
                styles.historyCard,
                {
                  backgroundColor: isDark ? '#111' : '#f9fafb',
                  borderColor: isDark ? '#333' : '#e5e7eb',
                },
                index !== history.length - 1 && styles.cardMargin,
              ]}
            >
              {/* Timeline Line */}
              {index !== history.length - 1 && (
                <View
                  style={[
                    styles.timelineLine,
                    { backgroundColor: isDark ? '#333' : '#e5e7eb' },
                  ]}
                />
              )}

              {/* Timeline Dot */}
              <View
                style={[
                  styles.timelineDot,
                  { backgroundColor: GradientColors.light.blue },
                ]}
              />

              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <View style={styles.serviceInfo}>
                    <View
                      style={[
                        styles.serviceIcon,
                        { backgroundColor: isDark ? '#222' : '#e5e7eb' },
                      ]}
                    >
                      <FontAwesome
                        name={getServiceIcon(item.type)}
                        size={20}
                        color={GradientColors.light.blue}
                      />
                    </View>
                    <View style={styles.serviceDetails}>
                      <Text style={[styles.serviceType, { color: colors.text }]}>
                        {item.type}
                      </Text>
                      <Text style={[styles.provider, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                        {item.provider}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.costBadge}>
                    <Text style={[styles.cost, { color: colors.text }]}>{item.cost}</Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.dateSection}>
                    <FontAwesome
                      name="calendar"
                      size={13}
                      color={isDark ? '#9ca3af' : '#6b7280'}
                    />
                    <Text style={[styles.date, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                      {item.date}
                    </Text>
                  </View>

                  <View style={styles.ratingSection}>
                    <FontAwesome name="star" size={13} color="#fbbf24" />
                    <Text style={[styles.rating, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                      {item.rating}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(item.status) + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(item.status) },
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
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
  headerSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  historyList: {
    paddingHorizontal: 20,
  },
  historyCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 0,
    position: 'relative',
  },
  cardMargin: {
    marginBottom: 16,
  },
  timelineLine: {
    position: 'absolute',
    left: 29,
    top: 64,
    bottom: -16,
    width: 2,
  },
  timelineDot: {
    position: 'absolute',
    left: 15,
    top: 22,
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  cardContent: {
    marginLeft: 52,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  serviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceDetails: {
    flex: 1,
  },
  serviceType: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  provider: {
    fontSize: 12,
  },
  costBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cost: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'space-between',
  },
  dateSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  date: {
    fontSize: 12,
  },
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
