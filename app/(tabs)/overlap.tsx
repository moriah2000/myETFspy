import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function PortfolioScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Portfolio</Text>
        <TouchableOpacity style={styles.periodButton}>
          <Text style={styles.periodText}>Annual ▾</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>TOTAL PORTFOLIO VALUE</Text>
        <Text style={styles.heroValue}>$124,560.78</Text>
        <View style={styles.heroRow}>
          <Text style={styles.heroGain}>↑ +12.45%</Text>
          <Text style={styles.heroSub}>1 Year Return</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>ALLOCATION</Text>
      <View style={styles.card}>
        {[
          { ticker: 'SCHD', pct: 32, color: '#338DFF' },
          { ticker: 'VTI', pct: 26, color: '#66AFFF' },
          { ticker: 'QQQM', pct: 23, color: '#004F98' },
          { ticker: 'JEPI', pct: 9, color: '#99C9FF' },
          { ticker: 'Cash', pct: 10, color: '#2A3A54' },
        ].map((item) => (
          <View key={item.ticker} style={styles.allocRow}>
            <Text style={styles.allocLabel}>{item.ticker}</Text>
            <View style={styles.allocBarWrap}>
              <View style={[styles.allocBar, { width: `${item.pct}%`, backgroundColor: item.color }]} />
            </View>
            <Text style={styles.allocPct}>{item.pct}%</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>INCOME</Text>
      <View style={styles.incomeRow}>
        <View style={styles.incomeCard}>
          <Text style={styles.incomeLabel}>Monthly</Text>
          <Text style={styles.incomeValue}>$478.52</Text>
        </View>
        <View style={styles.incomeCard}>
          <Text style={styles.incomeLabel}>Annual</Text>
          <Text style={styles.incomeValue}>$5,742.20</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>PERFORMANCE (1Y)</Text>
      <View style={styles.card}>
        <Text style={styles.perfValue}>+12.45%</Text>
        <Text style={styles.perfSub}>vs S&P 500 +10.21%</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 60, marginBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#E8EEF8' },
  periodButton: { backgroundColor: '#141A26', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  periodText: { color: '#8AA0C0', fontSize: 12, fontWeight: '500' },
  heroCard: { backgroundColor: '#141A26', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 0.5, borderColor: 'rgba(51,141,255,0.25)' },
  heroLabel: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 6 },
  heroValue: { fontSize: 34, fontWeight: '700', color: '#E8EEF8', marginBottom: 8 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroGain: { fontSize: 15, color: '#00C896', fontWeight: '600' },
  heroSub: { fontSize: 12, color: '#4A6080' },
  sectionTitle: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 10 },
  card: { backgroundColor: '#141A26', borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 20 },
  allocRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  allocLabel: { fontSize: 12, color: '#8AA0C0', width: 44 },
  allocBarWrap: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3 },
  allocBar: { height: 6, borderRadius: 3 },
  allocPct: { fontSize: 11, color: '#99C9FF', width: 32, textAlign: 'right' },
  incomeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  incomeCard: { flex: 1, backgroundColor: '#141A26', borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  incomeLabel: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1, marginBottom: 6 },
  incomeValue: { fontSize: 20, fontWeight: '600', color: '#00C896' },
  perfValue: { fontSize: 28, fontWeight: '700', color: '#00C896', marginBottom: 4 },
  perfSub: { fontSize: 13, color: '#4A6080' },
});