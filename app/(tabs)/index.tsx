import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getETFPrice } from '../services/api';

type ETFData = {
  ticker: string;
  price: number;
  change: number;
  changesPercentage: number;
  value: number;
};

const ETF_COLORS: Record<string, string> = {
  SCHD: '#338DFF', VTI: '#00C896', QQQM: '#FF9F43',
  JEPI: '#A78BFA', JEPQ: '#FF5A5F', SPY: '#66AFFF',
  VOO: '#004F98', VXUS: '#FFD93D', QQQI: '#E879F9',
};

export default function HomeScreen() {
  const [etfData, setEtfData] = useState<ETFData[]>([]);
  const [holdings, setHoldings] = useState<Record<string, { qty: string; cost: string }>>({});
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good morning');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 12 && hour < 17) setGreeting('Good afternoon');
    else if (hour >= 17) setGreeting('Good evening');

    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [etfsRaw, holdingsRaw] = await Promise.all([
        AsyncStorage.getItem('userETFs'),
        AsyncStorage.getItem('userHoldings'),
      ]);

      const tickers: string[] = etfsRaw ? JSON.parse(etfsRaw) : ['SCHD', 'VTI', 'QQQM', 'JEPI'];
      const holdingsData = holdingsRaw ? JSON.parse(holdingsRaw) : {};
      setHoldings(holdingsData);

      const prices = await Promise.all(tickers.map((t) => getETFPrice(t)));
      const data: ETFData[] = tickers.map((ticker, i) => {
        const p = prices[i];
        const qty = parseFloat(holdingsData[ticker]?.qty || '0');
        return {
          ticker,
          price: p?.price ?? 0,
          change: p?.change ?? 0,
          changesPercentage: p?.changesPercentage ?? 0,
          value: qty > 0 ? qty * (p?.price ?? 0) : 0,
        };
      });
      setEtfData(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const totalValue = etfData.reduce((sum, e) => sum + e.value, 0);
  const hasValues = totalValue > 0;

  const todayGain = etfData.reduce((sum, e) => {
    const qty = parseFloat(holdings[e.ticker]?.qty || '0');
    return sum + qty * e.change;
  }, 0);

  const todayGainPct = hasValues && totalValue > 0
    ? (todayGain / (totalValue - todayGain)) * 100
    : 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      

      {/* Header */}
      <View style={styles.header}>
        <View>
          
          <Text style={styles.greeting}>{greeting}, Investor! 👋</Text>
          <Text style={styles.subGreeting}>Here's your portfolio overview</Text>
        </View>
        <View style={styles.premiumBadge}>
          <Text style={styles.premiumText}>Premium</Text>
        </View>
      </View>

      {/* Hero Card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>TOTAL PORTFOLIO VALUE</Text>
        {loading ? (
          <ActivityIndicator color="#338DFF" style={{ marginVertical: 16 }} />
        ) : (
          <>
            <Text style={styles.heroValue}>
              {hasValues ? `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
            </Text>
            {hasValues && (
              <View style={styles.heroRow}>
                <View style={styles.gainBadge}>
                  <Text style={styles.gainText}>
                    {todayGain >= 0 ? '+' : ''}${Math.abs(todayGain).toFixed(2)} today
                  </Text>
                </View>
                <Text style={styles.heroPct}>
                  {todayGainPct >= 0 ? '↑' : '↓'} {Math.abs(todayGainPct).toFixed(2)}%
                </Text>
              </View>
            )}
            {!hasValues && (
              <Text style={styles.noQtyHint}>Add quantities in Setup to see your total value</Text>
            )}
          </>
        )}
        <View style={styles.heroMeta}>
          <View>
            <Text style={styles.metaLabel}>TOTAL RETURN</Text>
            <Text style={styles.metaValue}>—</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>SINCE INCEPTION</Text>
            <Text style={styles.metaValue}>—</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>ANN. YIELD</Text>
            <Text style={styles.metaValue}>—</Text>
          </View>
        </View>
      </View>

      {/* Your ETFs */}
      <Text style={styles.sectionTitle}>YOUR ETFs</Text>
      {loading ? (
        <ActivityIndicator color="#338DFF" style={{ marginVertical: 20 }} />
      ) : (
        <View style={styles.card}>
          {etfData.map((etf) => {
            const qty = parseFloat(holdings[etf.ticker]?.qty || '0');
            const up = etf.changesPercentage >= 0;
            return (
              <View key={etf.ticker} style={styles.etfRow}>
                <View style={[styles.etfDot, { backgroundColor: ETF_COLORS[etf.ticker] || '#338DFF' }]} />
                <Text style={styles.etfTicker}>{etf.ticker}</Text>
                <View style={styles.etfMid}>
                  <Text style={styles.etfPrice}>
                    {etf.price > 0 ? `$${etf.price.toFixed(2)}` : '—'}
                  </Text>
                  {qty > 0 && (
                    <Text style={styles.etfValue}>
                      ${etf.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  )}
                </View>
                <Text style={[styles.etfChange, { color: up ? '#00C896' : '#FF5A5F' }]}>
                  {up ? '+' : ''}{etf.changesPercentage.toFixed(2)}%
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Asset Allocation */}
      <Text style={styles.sectionTitle}>ASSET ALLOCATION</Text>
      <View style={styles.card}>
        {etfData.length === 0 ? (
          <Text style={styles.emptyText}>No data yet</Text>
        ) : (() => {
          const total = etfData.reduce((s, e) => s + e.value, 0);
          const items = etfData.map((e) => ({
            label: e.ticker,
            pct: total > 0 ? Math.round((e.value / total) * 100) : Math.round(100 / etfData.length),
            color: ETF_COLORS[e.ticker] || '#338DFF',
          }));
          return items.map((item) => (
            <View key={item.label} style={styles.allocRow}>
              <Text style={styles.allocLabel}>{item.label}</Text>
              <View style={styles.allocBarWrap}>
                <View style={[styles.allocBar, { width: `${item.pct}%` as any, backgroundColor: item.color }]} />
              </View>
              <Text style={styles.allocPct}>{item.pct}%</Text>
            </View>
          ));
        })()}
      </View>

      {/* Top Holdings */}
      <Text style={styles.sectionTitle}>TOP ETFs BY VALUE</Text>
      <View style={{ marginBottom: 100 }}>
        {etfData
          .filter((e) => e.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 3)
          .map((etf) => {
            const total = etfData.reduce((s, e) => s + e.value, 0);
            const pct = total > 0 ? Math.round((etf.value / total) * 100) : 0;
            return (
              <View key={etf.ticker} style={styles.holdingRow}>
                <View style={styles.holdingIcon}>
                  <Text style={styles.holdingTicker}>{etf.ticker}</Text>
                </View>
                <View style={styles.holdingInfo}>
                  <Text style={styles.holdingName}>{etf.ticker}</Text>
                  <View style={styles.holdingBarWrap}>
                    <View style={[styles.holdingBar, {
                      width: `${pct}%` as any,
                      backgroundColor: ETF_COLORS[etf.ticker] || '#338DFF'
                    }]} />
                  </View>
                </View>
                <View style={styles.holdingRight}>
                  <Text style={styles.holdingPct}>{pct}%</Text>
                  <Text style={styles.holdingVal}>
                    ${etf.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </Text>
                </View>
              </View>
            );
          })}
        {etfData.filter((e) => e.value > 0).length === 0 && !loading && (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Enter quantities in Setup to see your top holdings</Text>
          </View>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 60, marginBottom: 20 },
  greeting: { fontSize: 18, fontWeight: '700', color: '#E8EEF8' },
  subGreeting: { fontSize: 12, color: '#4A6080', marginTop: 2 },
  premiumBadge: { backgroundColor: '#FFD93D22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  premiumText: { fontSize: 11, fontWeight: '700', color: '#FFD93D' },
  heroCard: { backgroundColor: '#141A26', borderRadius: 16, padding: 22, marginBottom: 20, borderWidth: 0.5, borderColor: 'rgba(51,141,255,0.25)' },
  heroLabel: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 6 },
  heroValue: { fontSize: 38, color: '#E8EEF8', fontWeight: '600', marginBottom: 10, fontVariant: ['tabular-nums'] },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  gainBadge: { backgroundColor: 'rgba(0,200,150,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  gainText: { fontSize: 14, color: '#00C896' },
  heroPct: { fontSize: 14, color: '#00C896' },
  noQtyHint: { fontSize: 12, color: '#4A6080', marginBottom: 16, fontStyle: 'italic' },
  heroMeta: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 14 },
  metaLabel: { fontSize: 10, color: '#3A5070', letterSpacing: 1, marginBottom: 2 },
  metaValue: { fontSize: 13, color: '#99C9FF' },
  sectionTitle: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 10, marginTop: 4 },
  card: { backgroundColor: '#141A26', borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 20 },
  emptyText: { fontSize: 13, color: '#4A6080', textAlign: 'center', paddingVertical: 8 },
  etfRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)', gap: 8 },
  etfDot: { width: 6, height: 6, borderRadius: 3 },
  etfTicker: { width: 48, fontSize: 13, fontWeight: '700', color: '#E8EEF8' },
  etfMid: { flex: 1 },
  etfPrice: { fontSize: 13, color: '#C8D8F0', fontVariant: ['tabular-nums'] },
  etfValue: { fontSize: 11, color: '#4A6080', fontVariant: ['tabular-nums'] },
  etfChange: { fontSize: 13, fontWeight: '600', width: 64, textAlign: 'right' },
  allocRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  allocLabel: { fontSize: 12, color: '#8AA0C0', width: 58 },
  allocBarWrap: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3 },
  allocBar: { height: 6, borderRadius: 3 },
  allocPct: { fontSize: 11, color: '#99C9FF', width: 32, textAlign: 'right' },
  holdingRow: { backgroundColor: '#141A26', borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  holdingIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#0D1830', borderWidth: 0.5, borderColor: 'rgba(51,141,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  holdingTicker: { fontSize: 10, color: '#338DFF', fontWeight: '600' },
  holdingInfo: { flex: 1 },
  holdingName: { fontSize: 13, color: '#C8D8F0', marginBottom: 6 },
  holdingBarWrap: { height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2 },
  holdingBar: { height: 3, borderRadius: 2 },
  holdingRight: { alignItems: 'flex-end' },
  holdingPct: { fontSize: 13, color: '#E8EEF8', fontWeight: '500' },
  holdingVal: { fontSize: 11, color: '#4A6080', marginTop: 2 },
});