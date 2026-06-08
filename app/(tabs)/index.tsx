import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import {
  RefreshControl, ScrollView, StyleSheet,
  Text, View,
} from 'react-native';
import { usePortfolioData } from '../hooks/usePortfolioData';

export default function HomeScreen() {
  const {
    positions, loading, refreshing, lastUpdated,
    totalValue, totalChange, totalChangePct,
    hasValues, refresh, reset, startFetching,
  } = usePortfolioData();

  // Reset when leaving, reload when returning
  useFocusEffect(
    useCallback(() => {
      startFetching();
      return () => reset();
    }, [])
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor="#338DFF"
          colors={['#338DFF']}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}, Investor! 👋</Text>
          <Text style={styles.subGreeting}>
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Loading live data…'}
          </Text>
        </View>
        <View style={styles.premiumBadge}>
          <Text style={styles.premiumText}>Premium</Text>
        </View>
      </View>

      {/* Hero Card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>TOTAL PORTFOLIO VALUE</Text>
        <Text style={styles.heroValue}>
          {loading ? '—' : hasValues
            ? `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '—'}
        </Text>
        {hasValues && !loading && (
          <View style={styles.heroRow}>
            <View style={[styles.gainBadge, {
              backgroundColor: totalChange >= 0 ? 'rgba(0,200,150,0.1)' : 'rgba(255,90,95,0.1)'
            }]}>
              <Ionicons
                name={totalChange >= 0 ? 'arrow-up' : 'arrow-down'}
                size={11}
                color={totalChange >= 0 ? '#00C896' : '#FF5A5F'}
              />
              <Text style={[styles.gainText, { color: totalChange >= 0 ? '#00C896' : '#FF5A5F' }]}>
                ${Math.abs(totalChange).toFixed(2)} today
              </Text>
            </View>
            <Text style={[styles.heroPct, { color: totalChangePct >= 0 ? '#00C896' : '#FF5A5F' }]}>
              {totalChangePct >= 0 ? '↑' : '↓'} {Math.abs(totalChangePct).toFixed(2)}%
            </Text>
          </View>
        )}
        {!hasValues && !loading && (
          <Text style={styles.noQtyHint}>Add quantities in Setup to see your total value</Text>
        )}
        <View style={styles.heroMeta}>
          <View style={styles.heroMetaItem}>
            <Text style={styles.metaLabel}>TOTAL RETURN</Text>
            <Text style={styles.metaValue}>—</Text>
          </View>
          <View style={styles.heroMetaItem}>
            <Text style={styles.metaLabel}>SINCE INCEPTION</Text>
            <Text style={styles.metaValue}>—</Text>
          </View>
          <View style={styles.heroMetaItem}>
            <Text style={styles.metaLabel}>ANN. YIELD</Text>
            <Text style={styles.metaValue}>—</Text>
          </View>
        </View>
      </View>

      {/* YOUR ETFs */}
      <Text style={styles.sectionTitle}>YOUR ETFs</Text>
      <View style={styles.card}>
        {(loading ? [] : positions).map((etf) => (
          <View key={etf.ticker} style={styles.etfRow}>
            <View style={[styles.etfIconBox, { borderColor: etf.color + '44' }]}>
              <Text style={[styles.etfIconText, { color: etf.color }]}>{etf.ticker.slice(0, 1)}</Text>
            </View>
            <View style={styles.etfMid}>
              <Text style={styles.etfTicker}>{etf.ticker}</Text>
              {etf.value > 0 && (
                <Text style={styles.etfValue}>
                  ${etf.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              )}
            </View>
            <View style={styles.etfRight}>
              <Text style={styles.etfPrice}>
                {etf.price > 0 ? `$${etf.price.toFixed(2)}` : '—'}
              </Text>
              <Text style={[styles.etfChange, { color: etf.pct >= 0 ? '#00C896' : '#FF5A5F' }]}>
                {etf.pct >= 0 ? '+' : ''}{etf.pct.toFixed(2)}%
              </Text>
            </View>
          </View>
        ))}
        {loading && (
          <Text style={styles.loadingText}>Loading live prices…</Text>
        )}
      </View>

      {/* ASSET ALLOCATION */}
      <Text style={styles.sectionTitle}>ASSET ALLOCATION</Text>
      <View style={styles.card}>
        {positions.map((item) => {
          const pct = totalValue > 0
            ? Math.round((item.value / totalValue) * 100)
            : Math.round(100 / positions.length);
          return (
            <View key={item.ticker} style={styles.allocRow}>
              <Text style={styles.allocLabel}>{item.ticker}</Text>
              <View style={styles.allocBarWrap}>
                <View style={[styles.allocBar, {
                  width: `${pct}%` as any,
                  backgroundColor: item.color
                }]} />
              </View>
              <Text style={styles.allocPct}>{pct}%</Text>
            </View>
          );
        })}
      </View>

      {/* TOP ETFs BY VALUE */}
      <Text style={styles.sectionTitle}>TOP ETFs BY VALUE</Text>
      <View style={{ marginBottom: 100 }}>
        {positions.filter((e) => e.value > 0).length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Enter quantities in Setup to see top holdings</Text>
          </View>
        ) : (
          [...positions]
            .filter((e) => e.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 4)
            .map((etf) => {
              const pct = totalValue > 0 ? Math.round((etf.value / totalValue) * 100) : 0;
              return (
                <View key={etf.ticker} style={styles.holdingRow}>
                  <View style={[styles.holdingIcon, { borderColor: etf.color + '44' }]}>
                    <Text style={[styles.holdingTicker, { color: etf.color }]}>{etf.ticker}</Text>
                  </View>
                  <View style={styles.holdingInfo}>
                    <View style={styles.holdingTopRow}>
                      <Text style={styles.holdingName}>{etf.ticker}</Text>
                      <Text style={styles.holdingPct}>{pct}%</Text>
                    </View>
                    <View style={styles.holdingBarWrap}>
                      <View style={[styles.holdingBar, {
                        width: `${pct}%` as any,
                        backgroundColor: etf.color
                      }]} />
                    </View>
                    <Text style={styles.holdingVal}>
                      ${etf.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>
              );
            })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 60, marginBottom: 20 },
  greeting: { fontSize: 18, fontWeight: '700', color: '#E8EEF8' },
  subGreeting: { fontSize: 11, color: '#4A6080', marginTop: 2 },
  premiumBadge: { backgroundColor: '#FFD93D22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  premiumText: { fontSize: 11, fontWeight: '700', color: '#FFD93D' },
  heroCard: { backgroundColor: '#141A26', borderRadius: 16, padding: 22, marginBottom: 20, borderWidth: 0.5, borderColor: 'rgba(51,141,255,0.25)' },
  heroLabel: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 6 },
  heroValue: { fontSize: 38, color: '#E8EEF8', fontWeight: '600', marginBottom: 10, fontVariant: ['tabular-nums'] },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  gainBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  gainText: { fontSize: 13 },
  heroPct: { fontSize: 14 },
  noQtyHint: { fontSize: 12, color: '#4A6080', marginBottom: 16, fontStyle: 'italic' },
  heroMeta: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 14 },
  heroMetaItem: {},
  metaLabel: { fontSize: 10, color: '#3A5070', letterSpacing: 1, marginBottom: 2 },
  metaValue: { fontSize: 13, color: '#99C9FF' },
  sectionTitle: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 10, marginTop: 4 },
  card: { backgroundColor: '#141A26', borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 20 },
  emptyText: { fontSize: 13, color: '#4A6080', textAlign: 'center', paddingVertical: 8 },
  loadingText: { fontSize: 13, color: '#4A6080', textAlign: 'center', paddingVertical: 12 },
  etfRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)', gap: 12 },
  etfIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#0D1830', borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
  etfIconText: { fontSize: 16, fontWeight: '700' },
  etfMid: { flex: 1 },
  etfTicker: { fontSize: 14, fontWeight: '700', color: '#E8EEF8' },
  etfValue: { fontSize: 11, color: '#4A6080', marginTop: 2, fontVariant: ['tabular-nums'] },
  etfRight: { alignItems: 'flex-end' },
  etfPrice: { fontSize: 14, color: '#C8D8F0', fontVariant: ['tabular-nums'] },
  etfChange: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  allocRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  allocLabel: { fontSize: 12, color: '#8AA0C0', width: 48 },
  allocBarWrap: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3 },
  allocBar: { height: 6, borderRadius: 3 },
  allocPct: { fontSize: 11, color: '#99C9FF', width: 32, textAlign: 'right' },
  holdingRow: { backgroundColor: '#141A26', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  holdingIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#0D1830', borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
  holdingTicker: { fontSize: 10, fontWeight: '700' },
  holdingInfo: { flex: 1 },
  holdingTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  holdingName: { fontSize: 13, color: '#C8D8F0', fontWeight: '600' },
  holdingPct: { fontSize: 13, color: '#E8EEF8', fontWeight: '500' },
  holdingBarWrap: { height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, marginBottom: 4 },
  holdingBar: { height: 3, borderRadius: 2 },
  holdingVal: { fontSize: 11, color: '#4A6080' },
});