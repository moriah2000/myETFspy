import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getETFHoldings, getETFPrice } from '../services/api';

export default function ETFScreen() {
  const [price, setPrice] = useState<any>(null);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [priceData, holdingsData] = await Promise.all([
          getETFPrice('VTI'),
          getETFHoldings('VTI'),
        ]);
        setPrice(priceData);
        setHoldings(holdingsData.slice(0, 5));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: '#0B0F19', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color="#338DFF" size="large" />
    </View>
  );

  return (
    <ScrollView style={styles.container}>

      {/* ETF Hero */}
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.tickerBox}>
            <Text style={styles.tickerText}>VTI</Text>
          </View>
          <View>
            <Text style={styles.etfName}>Vanguard Total Market ETF</Text>
            <Text style={styles.etfMeta}>NYSE Arca · Equity · Blend</Text>
          </View>
        </View>
        <View style={styles.heroStats}>
          <View>
            <Text style={styles.metaLabel}>PRICE</Text>
            <Text style={styles.metaValue}>${price?.price?.toFixed(2) ?? '—'}</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>DAY CHANGE</Text>
            <Text style={[styles.metaValue, { color: price?.change >= 0 ? '#00C896' : '#FF5A5F' }]}>
              {price?.change >= 0 ? '+' : ''}{price?.change?.toFixed(2) ?? '—'}
            </Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>CHANGE %</Text>
            <Text style={[styles.metaValue, { color: price?.changesPercentage >= 0 ? '#00C896' : '#FF5A5F' }]}>
              {price?.changesPercentage >= 0 ? '+' : ''}{price?.changesPercentage?.toFixed(2) ?? '—'}%
            </Text>
          </View>
        </View>
      </View>

      {/* Metrics Grid */}
      <Text style={styles.sectionTitle}>OVERVIEW</Text>
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>MARKET CAP</Text>
          <Text style={styles.metricValue}>${((price?.marketCap ?? 0) / 1e9).toFixed(0)}B</Text>
          <Text style={styles.metricSub}>total market cap</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>52W HIGH</Text>
          <Text style={styles.metricValue}>${price?.yearHigh?.toFixed(2) ?? '—'}</Text>
          <Text style={styles.metricSub}>52 week high</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>52W LOW</Text>
          <Text style={styles.metricValue}>${price?.yearLow?.toFixed(2) ?? '—'}</Text>
          <Text style={styles.metricSub}>52 week low</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>AVG VOLUME</Text>
          <Text style={styles.metricValue}>{((price?.avgVolume ?? 0) / 1e6).toFixed(1)}M</Text>
          <Text style={styles.metricSub}>avg daily volume</Text>
        </View>
      </View>

      {/* Top Holdings */}
      <Text style={styles.sectionTitle}>TOP HOLDINGS</Text>
      {holdings.map((item) => (
        <View key={item.asset} style={styles.holdingRow}>
          <View style={styles.holdingIcon}>
            <Text style={styles.holdingTicker}>{item.asset}</Text>
          </View>
          <Text style={styles.holdingName}>{item.name}</Text>
          <Text style={styles.holdingWeight}>{item.weightPercentage?.toFixed(2)}%</Text>
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
    padding: 20,
    marginTop: 60,
    borderWidth: 0.5,
    borderColor: 'rgba(102,175,255,0.2)',
    marginBottom: 24,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  tickerBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#0D1830',
    borderWidth: 0.5,
    borderColor: 'rgba(51,141,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickerText: {
    fontSize: 13,
    color: '#338DFF',
    fontWeight: '600',
  },
  etfName: {
    fontSize: 15,
    color: '#C8D8F0',
    fontWeight: '500',
    marginBottom: 4,
  },
  etfMeta: {
    fontSize: 11,
    color: '#4A6080',
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 10,
    color: '#3A5070',
    letterSpacing: 1,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 16,
    color: '#E8EEF8',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 11,
    color: '#4A6A9A',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  metricCard: {
    backgroundColor: '#141A26',
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    width: '47.5%',
  },
  metricLabel: {
    fontSize: 10,
    color: '#3A5070',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 20,
    color: '#E8EEF8',
    fontWeight: '500',
    marginBottom: 2,
  },
  metricSub: {
    fontSize: 10,
    color: '#4A6080',
  },
  holdingRow: {
    backgroundColor: '#141A26',
    borderRadius: 10,
    padding: 14,
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
    fontSize: 9,
    color: '#338DFF',
    fontWeight: '600',
  },
  holdingName: {
    flex: 1,
    fontSize: 13,
    color: '#C8D8F0',
  },
  holdingWeight: {
    fontSize: 13,
    color: '#E8EEF8',
    fontWeight: '500',
  },
});