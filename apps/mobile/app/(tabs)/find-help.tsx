import { StyleSheet, View, Text, Pressable, ScrollView, SafeAreaView, TextInput } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { GradientColors } from '@/constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function FindHelpScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'dark'];

  const providers = [
    { id: 1, name: 'Joe\'s Auto Repair', type: 'Mechanic', distance: '0.8 mi', rating: 4.9, available: true },
    { id: 2, name: 'Fast Towing Co', type: 'Towing', distance: '1.2 mi', rating: 4.8, available: true },
    { id: 3, name: 'Downtown Auto', type: 'Mechanic', distance: '1.5 mi', rating: 4.7, available: false },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Search & Filter */}
        <View style={styles.headerSection}>
          <TextInput
            placeholder="Search services..."
            placeholderTextColor={isDark ? '#888' : '#999'}
            style={[styles.searchInput, { backgroundColor: isDark ? '#111' : '#f3f4f6', color: colors.text, borderColor: isDark ? '#333' : '#e5e7eb' }]}
          />
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          <Pressable style={[styles.filterTab, { backgroundColor: GradientColors.light.blue }]}>
            <Text style={styles.filterTabText}>All</Text>
          </Pressable>
          <Pressable style={[styles.filterTab, { backgroundColor: isDark ? '#222' : '#e5e7eb' }]}>
            <Text style={[styles.filterTabText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>Mechanic</Text>
          </Pressable>
          <Pressable style={[styles.filterTab, { backgroundColor: isDark ? '#222' : '#e5e7eb' }]}>
            <Text style={[styles.filterTabText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>Towing</Text>
          </Pressable>
        </View>

        {/* Providers List */}
        <View style={styles.providersSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Available Nearby</Text>
          {providers.map((provider) => (
            <Pressable
              key={provider.id}
              style={[styles.providerCard, { backgroundColor: isDark ? '#111' : '#f9fafb', borderColor: isDark ? '#333' : '#e5e7eb' }]}
            >
              <View style={styles.providerHeader}>
                <View style={styles.providerInfo}>
                  <Text style={[styles.providerName, { color: colors.text }]}>{provider.name}</Text>
                  <Text style={[styles.providerType, { color: isDark ? '#9ca3af' : '#6b7280' }]}>{provider.type}</Text>
                </View>
                <View style={styles.providerMeta}>
                  <Text style={[styles.rating, { color: colors.text }]}>{provider.rating}★</Text>
                  <Text style={[styles.distance, { color: isDark ? '#9ca3af' : '#6b7280' }]}>{provider.distance}</Text>
                </View>
              </View>
              {provider.available && (
                <Pressable
                  style={[styles.requestButton, { backgroundColor: GradientColors.light.blue }]}
                  onPress={() => alert(`Requesting ${provider.name}...`)}
                >
                  <FontAwesome name="arrow-right" size={16} color="#fff" />
                  <Text style={styles.requestButtonText}>Request</Text>
                </Pressable>
              )}
              {!provider.available && (
                <Text style={[styles.unavailable, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Unavailable</Text>
              )}
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
    paddingVertical: 16,
  },
  searchInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 24,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterTabText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  providersSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  providerCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  providerType: {
    fontSize: 13,
  },
  providerMeta: {
    alignItems: 'flex-end',
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
  },
  distance: {
    fontSize: 12,
    marginTop: 4,
  },
  requestButton: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  unavailable: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 10,
  },
});
