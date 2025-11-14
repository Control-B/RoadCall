import { View, Text, StyleSheet, ScrollView } from 'react-native';

interface TransactionSummary {
  id: string;
  date: string;
  type: string;
  cost: number;
  etaMinutes: number;
  resolvedInMinutes: number;
}

const mockTransactions: TransactionSummary[] = [
  { id: 't1', date: '2025-11-01', type: 'Tire Replacement', cost: 450, etaMinutes: 18, resolvedInMinutes: 42 },
  { id: 't2', date: '2025-10-23', type: 'Tow Service', cost: 650, etaMinutes: 25, resolvedInMinutes: 70 },
  { id: 't3', date: '2025-10-10', type: 'Engine Diagnostics', cost: 520, etaMinutes: 22, resolvedInMinutes: 55 },
];

export default function AnalysisScreen() {
  const avgCost = (mockTransactions.reduce((s, t) => s + t.cost, 0) / mockTransactions.length).toFixed(0);
  const avgETA = (mockTransactions.reduce((s, t) => s + t.etaMinutes, 0) / mockTransactions.length).toFixed(0);
  const avgResolution = (mockTransactions.reduce((s, t) => s + t.resolvedInMinutes, 0) / mockTransactions.length).toFixed(0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Operational Analysis</Text>
      <View style={styles.metricsRow}>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>${avgCost}</Text>
          <Text style={styles.metricLabel}>Avg Cost</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{avgETA}m</Text>
          <Text style={styles.metricLabel}>Avg ETA</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{avgResolution}m</Text>
          <Text style={styles.metricLabel}>Avg Resolution</Text>
        </View>
      </View>
      <Text style={styles.subHeading}>Recent Incidents</Text>
      {mockTransactions.map(t => (
        <View key={t.id} style={styles.card}>
          <Text style={styles.cardTitle}>{t.type}</Text>
          <Text style={styles.cardMeta}>{t.date}</Text>
          <View style={styles.row}>
            <Text style={styles.badge}>ETA {t.etaMinutes}m</Text>
            <Text style={styles.badge}>Resolved {t.resolvedInMinutes}m</Text>
            <Text style={styles.badge}>${t.cost}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 16 },
  heading: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 12 },
  subHeading: { fontSize: 18, fontWeight: '600', color: '#fff', marginTop: 8, marginBottom: 8 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  metricBox: { flex: 1, backgroundColor: '#111', padding: 12, marginHorizontal: 4, borderRadius: 12, alignItems: 'center' },
  metricValue: { fontSize: 20, fontWeight: '700', color: '#60A5FA' },
  metricLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  card: { backgroundColor: '#111', padding: 14, borderRadius: 12, marginBottom: 10 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cardMeta: { color: '#9CA3AF', fontSize: 12, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  badge: { backgroundColor: '#1F2937', color: '#60A5FA', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 12, marginRight: 6, marginBottom: 6 },
});
