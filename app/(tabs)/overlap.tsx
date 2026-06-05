import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function OverlapScreen() {
  return (
    <ScrollView style={styles.container}>

      {/* Overlap Hero */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>PORTFOLIO OVERLAP SCORE</Text>
        <Text style={styles.heroScore}>68%</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>Moderate Overlap</Text>
        </View>
      </View>

      {/* Top Overlapping Holdings */}
      <Text style={styles.sectionTitle}>TOP OVERLAPPING HOLDINGS</Text>
      {[
        { ticker: 'MSFT', name: 'Microsoft Corp', etfs: '4 ETFs', exposure: '8.4% exposure', pct: 84, color: '#FF9F43' },
        { ticker: 'AAPL', name: 'Apple Inc', etfs: '4 ETFs', exposure: '7.1% exposure', pct: 71, color: '#FF9F43' },
        { ticker: 'NVDA', name: 'NVIDIA Corp', etfs: '2 ETFs', exposure: '4.1% exposure', pct: 41, color: '#338DFF' },
      ].map((item) => (
        <View key={item.ticker} style={styles.holdingRow}>
          <View style={[styles.holdingIcon, { borderColor: `${item.color}40` }]}>
            <Text style={[styles.holdingTicker, { color: item.color }]}>{item.ticker}</Text>
          </View>
          <View style={styles.holdingInfo}>
            <Text style={styles.holdingName}>{item.name}</Text>
            <View style={styles.barWrap}>
              <View style={[styles.bar, { width: `${item.pct}%`, backgroundColor: item.color }]} />
            </View>
          </View>
          <View style={styles.holdingRight}>
            <Text style={[styles.etfCount, { color: item.color }]}>{item.etfs}</Text>
            <Text style={styles.exposure}>{item.exposure}</Text>
          </View>
        </View>
      ))}

      {/* Insights */}
      <Text style={styles.sectionTitle}>PORTFOLIO INTELLIGENCE</Text>
      <View style={[styles.insightCard, { borderLeftColor: '#338DFF' }]}>
        <Text style={styles.insightText}><Text style={styles.insightBold}>Microsoft</Text> appears in 4 of your ETFs and represents <Text style={styles.insightBold}>8.4%</Text> of your total portfolio exposure.</Text>
      </View>
      <View style={[styles.insightCard, { borderLeftColor: '#00C896' }]}>
        <Text style={[styles.insightText, { color: '#6AB090' }]}>Your bonds allocation (<Text style={styles.insightBold}>12%</Text>) provides healthy diversification against your US equity concentration.</Text>
      </View>
      <View style={[styles.insightCard, { borderLeftColor: '#FF9F43' }]}>
        <Text style={[styles.insightText, { color: '#A07848' }]}>Consider adding a small-cap or value ETF to reduce mega-cap tech concentration above <Text style={styles.insightBold}>60%</Text>.</Text>
      </View>

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
    borderColor: 'rgba(255,159,67,0.25)',
    marginBottom: 24,
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 11,
    color: '#4A6A9A',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  heroScore: {
    fontSize: 52,
    color: '#FF9F43',
    fontWeight: '600',
    marginBottom: 10,
  },
  statusBadge: {
    backgroundColor: 'rgba(255,159,67,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 13,
    color: '#FF9F43',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 11,
    color: '#4A6A9A',
    letterSpacing: 1.5,
    marginBottom: 10,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdingTicker: {
    fontSize: 10,
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
  barWrap: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
  },
  bar: {
    height: 3,
    borderRadius: 2,
  },
  holdingRight: {
    alignItems: 'flex-end',
  },
  etfCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  exposure: {
    fontSize: 11,
    color: '#4A6080',
    marginTop: 2,
  },
  insightCard: {
    backgroundColor: '#141A26',
    borderLeftWidth: 3,
    borderRadius: 0,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderTopWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRightColor: 'rgba(255,255,255,0.04)',
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  insightText: {
    fontSize: 12,
    color: '#8AA0C0',
    lineHeight: 20,
  },
  insightBold: {
    color: '#99C9FF',
    fontWeight: '500',
  },
});