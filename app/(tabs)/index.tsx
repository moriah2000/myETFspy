import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container}>

      {/* Hero Card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>PORTFOLIO VALUE</Text>
        <Text style={styles.heroValue}>$13,918</Text>
        <View style={styles.heroRow}>
          <Text style={styles.heroGain}>+$812 today</Text>
          <Text style={styles.heroPct}>↑ +6.2%</Text>
        </View>
        <View style={styles.heroMeta}>
          <View>
            <Text style={styles.metaLabel}>TOTAL RETURN</Text>
            <Text style={styles.metaValue}>+$2,318</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>SINCE INCEPTION</Text>
            <Text style={styles.metaValue}>+16.2%</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>ANN. YIELD</Text>
            <Text style={styles.metaValue}>3.4%</Text>
          </View>
        </View>
      </View>

      {/* Asset Allocation */}
      <Text style={styles.sectionTitle}>ASSET ALLOCATION</Text>
      <View style={styles.card}>
        {[
          { label: 'US Equity', pct: 62, color: '#338DFF' },
          { label: 'Intl Eq.', pct: 18, color: '#66AFFF' },
          { label: 'Bonds', pct: 12, color: '#004F98' },
          { label: 'Other', pct: 8, color: '#2A3A54' },
        ].map((item) => (
          <View key={item.label} style={styles.allocRow}>
            <Text style={styles.allocLabel}>{item.label}</Text>
            <View style={styles.allocBarWrap}>
              <View style={[styles.allocBar, { width: `${item.pct}%`, backgroundColor: item.color }]} />
            </View>
            <Text style={styles.allocPct}>{item.pct}%</Text>
          </View>
        ))}
      </View>

      {/* Top Holdings */}
      <Text style={styles.sectionTitle}>TOP HOLDINGS</Text>
      {[
        { ticker: 'VTI', name: 'Vanguard Total Mkt', pct: 38, value: '$5,289' },
        { ticker: 'SCHD', name: 'Schwab US Dividend', pct: 28, value: '$3,897' },
        { ticker: 'VXUS', name: 'Vanguard Total Intl', pct: 18, value: '$2,505' },
      ].map((item) => (
        <View key={item.ticker} style={styles.holdingRow}>
          <View style={styles.holdingIcon}>
            <Text style={styles.holdingTicker}>{item.ticker}</Text>
          </View>
          <View style={styles.holdingInfo}>
            <Text style={styles.holdingName}>{item.name}</Text>
            <View style={styles.holdingBarWrap}>
              <View style={[styles.holdingBar, { width: `${item.pct}%` }]} />
            </View>
          </View>
          <View style={styles.holdingRight}>
            <Text style={styles.holdingPct}>{item.pct}%</Text>
            <Text style={styles.holdingVal}>{item.value}</Text>
          </View>
        </View>
      ))}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
    padding: 16,
  },
  heroCard: {
    backgroundColor: '#141A26',
    borderRadius: 16,
    padding: 22,
    marginTop: 60,
    borderWidth: 0.5,
    borderColor: 'rgba(51,141,255,0.25)',
    marginBottom: 20,
  },
  heroLabel: {
    fontSize: 11,
    color: '#4A6A9A',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  heroValue: {
    fontSize: 38,
    color: '#E8EEF8',
    fontWeight: '600',
    marginBottom: 10,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  heroGain: {
    fontSize: 14,
    color: '#00C896',
    backgroundColor: 'rgba(0,200,150,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  heroPct: {
    fontSize: 14,
    color: '#00C896',
  },
  heroMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 10,
    color: '#3A5070',
    letterSpacing: 1,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 13,
    color: '#99C9FF',
  },
  sectionTitle: {
    fontSize: 11,
    color: '#4A6A9A',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#141A26',
    borderRadius: 14,
    padding: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 20,
  },
  allocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  allocLabel: {
    fontSize: 12,
    color: '#8AA0C0',
    width: 58,
  },
  allocBarWrap: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
  },
  allocBar: {
    height: 6,
    borderRadius: 3,
  },
  allocPct: {
    fontSize: 11,
    color: '#99C9FF',
    width: 32,
    textAlign: 'right',
  },
  holdingRow: {
    backgroundColor: '#141A26',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  holdingIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#0D1830',
    borderWidth: 0.5,
    borderColor: 'rgba(51,141,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdingTicker: {
    fontSize: 10,
    color: '#338DFF',
    fontWeight: '600',
  },
  holdingInfo: {
    flex: 1,
  },
  holdingName: {
    fontSize: 13,
    color: '#C8D8F0',
    marginBottom: 6,
  },
  holdingBarWrap: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
  },
  holdingBar: {
    height: 3,
    borderRadius: 2,
    backgroundColor: '#338DFF',
  },
  holdingRight: {
    alignItems: 'flex-end',
  },
  holdingPct: {
    fontSize: 13,
    color: '#E8EEF8',
    fontWeight: '500',
  },
  holdingVal: {
    fontSize: 11,
    color: '#4A6080',
    marginTop: 2,
  },
});