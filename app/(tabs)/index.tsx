import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  RefreshControl, ScrollView, StatusBar, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { ETF_COLORS, usePortfolioData } from '../hooks/usePortfolioData';
import { getETFPrice } from '../services/api';

const FALLBACK_COLORS = ['#338DFF','#00C896','#FF9F43','#A78BFA','#FF5A5F','#66AFFF','#FFD93D','#E879F9','#4FC3F7'];

type WatchItem = {
  ticker: string;
  price: number;
  change: number;
  pct: number;
  color: string;
};

export default function HomeScreen() {
  const router = useRouter();
  const {
    positions, loading, refreshing,
    totalValue, totalChange, totalChangePct,
    hasValues, refresh,
  } = usePortfolioData();

  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [watchLoading, setWatchLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadWatchlist();
      // PortfolioDataProvider manages its own interval — no startFetching needed.
    }, [])
  );

  // Re-use portfolio prices for watchlist tickers that are also in portfolio
  // Only fetch separately for pure-watchlist tickers
  async function loadWatchlist() {
  setWatchLoading(true);
  try {
    const raw = await AsyncStorage.getItem('watchlist_items');
    const parsed: { ticker: string; name: string; type: string }[] = raw ? JSON.parse(raw) : [];
    if (parsed.length === 0) { setWatchlist([]); setWatchLoading(false); return; }

    const validItems = parsed.filter(item => item && item.ticker);
    const prices = await Promise.all(validItems.map(item => getETFPrice(item.ticker)));
    const items: WatchItem[] = validItems.map((item, i) => {
      const p = prices[i];
      return {
        ticker: item.ticker,
        price: p?.price ?? 0,
        change: p?.change ?? 0,
        pct: p?.changesPercentage ?? 0,
        color: ETF_COLORS[item.ticker] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
      };
    });
    setWatchlist(items);
  } catch (e) {
    console.error('Watchlist fetch error:', e);
  } finally {
    setWatchLoading(false);
  }
}

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const costBasis = positions.reduce((sum, p) => sum + p.qty * p.avgCost, 0);
  const totalReturn = costBasis > 0 ? ((totalValue - costBasis) / costBasis) * 100 : null;
  const annYield = positions.reduce((sum, p) => {
    const YIELDS: Record<string, number> = {
      SCHD: 0.0365, VTI: 0.0152, QQQM: 0.0064, JEPI: 0.0819,
      JEPQ: 0.0980, SPY: 0.0128, VOO: 0.0128, VXUS: 0.0280, QQQI: 0.0120,
    };
    return sum + p.value * (YIELDS[p.ticker] || 0);
  }, 0);
  const annYieldPct = totalValue > 0 ? (annYield / totalValue) * 100 : null;

  // Watchlist tickers that are NOT in portfolio (pure watchers)
  const portfolioTickers = new Set(positions.map(p => p.ticker));
  const watchlistOnly = watchlist.filter(w => !portfolioTickers.has(w.ticker));
  // Watchlist tickers that ARE in portfolio — pull data from positions (already live)
  const watchlistInPortfolio = watchlist
    .filter(w => portfolioTickers.has(w.ticker))
    .map(w => {
      const pos = positions.find(p => p.ticker === w.ticker);
      return pos ? { ...w, price: pos.price, change: pos.change, pct: pos.pct } : w;
    });
  const allWatchItems = [...watchlistInPortfolio, ...watchlistOnly];

  function handleRefresh() {
    refresh();
    loadWatchlist();
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}, Investor! 👋</Text>
        </View>
        <TouchableOpacity
          style={styles.alertsBell}
          onPress={() => router.push('/(tabs)/alerts')}
          activeOpacity={0.7}>
          <Ionicons name="notifications-outline" size={22} color="#C8D8F0" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#338DFF" colors={['#338DFF']} />
        }
      >
        {/* Hero Card — only shown if user has portfolio holdings */}
        
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>TOTAL PORTFOLIO VALUE</Text>
            <Text style={styles.heroValue}>
              {loading ? '—' : hasValues
                ? `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '$0.00'}
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
              <Text style={styles.noQtyHint}>Add a transaction in Portfolio to see your total value</Text>
            )}
            <View style={styles.heroMeta}>
              <View style={styles.heroMetaItem}>
                <Text style={styles.metaLabel}>TOTAL RETURN</Text>
                <Text style={[styles.metaValue, totalReturn !== null && { color: totalReturn >= 0 ? '#00C896' : '#FF5A5F' }]}>
                  {totalReturn !== null ? `${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%` : '—'}
                </Text>
              </View>
              <View style={styles.heroMetaItem}>
                <Text style={styles.metaLabel}>SINCE INCEPTION</Text>
                <Text style={[styles.metaValue, totalReturn !== null && { color: totalReturn >= 0 ? '#00C896' : '#FF5A5F' }]}>
                  {costBasis > 0
                    ? `$${(totalValue - costBasis).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    : '—'}
                </Text>
              </View>
              <View style={styles.heroMetaItem}>
                <Text style={styles.metaLabel}>ANN. YIELD</Text>
                <Text style={[styles.metaValue, { color: '#00C896' }]}>
                  {annYieldPct !== null ? `${annYieldPct.toFixed(2)}%` : '—'}
                </Text>
              </View>
            </View>
          </View>
        

        {/* YOUR ASSETS + ASSET ALLOCATION — horizontal scroll, side by side */}
        {(positions.filter(p => p.qty > 0).length > 0 || (hasValues && !loading)) && (
          <>
            <Text style={styles.sectionTitle}>OVERVIEW</Text>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.hScroll}
              contentContainerStyle={styles.hScrollContent}
            >
              {/* Panel 1 — Your Assets */}
              {positions.filter(p => p.qty > 0).length > 0 && (
                <View style={styles.hPanel}>
                  <View style={styles.card}>
                    <Text style={styles.panelTitle}>YOUR ASSETS</Text>
                    {(loading ? [] : positions.filter(p => p.qty > 0)).map((etf) => (
                      <View key={etf.ticker} style={styles.etfRow}>
                        <View style={[styles.etfIconBox, { borderColor: etf.color + '44' }]}>
                          <Text style={[styles.etfIconText, { color: etf.color }]}>{etf.ticker.slice(0, 1)}</Text>
                        </View>
                        <View style={styles.etfMid}>
                          <Text style={styles.etfTicker}>{etf.ticker}</Text>
                          <Text style={styles.etfValue}>
                            ${etf.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                        </View>
                        <View style={styles.etfRight}>
                          <Text style={styles.etfPrice}>${etf.price.toFixed(2)}</Text>
                          <Text style={[styles.etfChange, { color: etf.pct >= 0 ? '#00C896' : '#FF5A5F' }]}>
                            {etf.pct >= 0 ? '+' : ''}{etf.pct.toFixed(2)}%
                          </Text>
                        </View>
                      </View>
                    ))}
                    {loading && <Text style={styles.loadingText}>Loading live prices…</Text>}
                  </View>
                </View>
              )}

              {/* Panel 2 — Asset Allocation */}
              {hasValues && !loading && (
                <View style={styles.hPanel}>
                  <View style={[styles.card, styles.lastCard]}>
                    <Text style={styles.panelTitle}>ASSET ALLOCATION</Text>
                    {positions.filter(p => p.value > 0).map((item) => {
                      const pct = Math.round((item.value / totalValue) * 100);
                      return (
                        <View key={item.ticker} style={styles.allocRow}>
                          <Text style={styles.allocLabel}>{item.ticker}</Text>
                          <View style={styles.allocBarWrap}>
                            <View style={[styles.allocBar, { width: `${pct}%` as any, backgroundColor: item.color }]} />
                          </View>
                          <Text style={styles.allocPct}>{pct}%</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
          </>
        )}

        {/* WATCHLIST — all tracked tickers with live prices */}
        {allWatchItems.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>WATCHLIST</Text>
            <View style={styles.card}>
              {(watchLoading && allWatchItems.length === 0)
                ? <Text style={styles.loadingText}>Loading prices…</Text>
                : allWatchItems.map((item) => {
                    const inPortfolio = portfolioTickers.has(item.ticker);
                    const pos = positions.find(p => p.ticker === item.ticker);
                    return (
                      <View key={item.ticker} style={styles.etfRow}>
                        <View style={[styles.etfIconBox, { borderColor: item.color + '44' }]}>
                          <Text style={[styles.etfIconText, { color: item.color }]}>{item.ticker.slice(0, 1)}</Text>
                        </View>
                        <View style={styles.etfMid}>
                          <View style={styles.tickerRow}>
                            <Text style={styles.etfTicker}>{item.ticker}</Text>
                            {inPortfolio && (
                              <View style={styles.ownedBadge}>
                                <Text style={styles.ownedBadgeText}>Owned</Text>
                              </View>
                            )}
                          </View>
                          {inPortfolio && pos && pos.value > 0 && (
                            <Text style={styles.etfValue}>
                              ${pos.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                          )}
                        </View>
                        <View style={styles.etfRight}>
                          <Text style={styles.etfPrice}>
                            {item.price > 0 ? `$${item.price.toFixed(2)}` : '—'}
                          </Text>
                          <Text style={[styles.etfChange, { color: item.pct >= 0 ? '#00C896' : '#FF5A5F' }]}>
                            {item.pct >= 0 ? '+' : ''}{item.pct.toFixed(2)}%
                          </Text>
                        </View>
                      </View>
                    );
                  })}
            </View>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: '#0B0F19',
  },
  scroll: { flex: 1, paddingHorizontal: 20 },
  greeting: { fontSize: 18, fontWeight: '700', color: '#E8EEF8' },
  alertsBell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20 },
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
  lastCard: { marginBottom: 8 },
  loadingText: { fontSize: 13, color: '#4A6080', textAlign: 'center', paddingVertical: 12 },
  etfRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)', gap: 12 },
  etfIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#0D1830', borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
  etfIconText: { fontSize: 16, fontWeight: '700' },
  etfMid: { flex: 1 },
  tickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  etfTicker: { fontSize: 14, fontWeight: '700', color: '#E8EEF8' },
  ownedBadge: { backgroundColor: '#00C89622', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  ownedBadgeText: { fontSize: 9, fontWeight: '700', color: '#00C896' },
  etfValue: { fontSize: 11, color: '#4A6080', marginTop: 2, fontVariant: ['tabular-nums'] },
  etfRight: { alignItems: 'flex-end' },
  etfPrice: { fontSize: 14, color: '#C8D8F0', fontVariant: ['tabular-nums'] },
  etfChange: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  allocRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  allocLabel: { fontSize: 12, color: '#8AA0C0', width: 48 },
  allocBarWrap: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3 },
  allocBar: { height: 6, borderRadius: 3 },
  allocPct: { fontSize: 11, color: '#99C9FF', width: 32, textAlign: 'right' },
  hScroll: { marginBottom: 20 },
  hScrollContent: { gap: 12 },
  hPanel: { width: 340 },
  panelTitle: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 12 },
});
