import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Dimensions, ScrollView, StatusBar,
    StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import {
    CryptoSummary, formatCryptoPrice, formatMarketCap,
    formatSupply, formatVolume, getCryptoHistory,
    getCryptoPrice, getCryptoSummary,
} from '../services/api';

const TABS = ['Overview', 'Markets', 'Alerts'];
const CHART_PERIODS = ['1D', '1W', '1M', '3M', '1Y', '5Y'];
const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - 32;
const CHART_H = 160;

const CRYPTO_COLORS: Record<string, string> = {
  BTC: '#F7931A', ETH: '#627EEA', SOL: '#9945FF', XRP: '#00AAE4',
  BNB: '#F3BA2F', ADA: '#0033AD', DOGE: '#C2A633', AVAX: '#E84142',
  LINK: '#2A5ADA', DOT: '#E6007A', MATIC: '#8247E5', LTC: '#BFBBBB',
  UNI: '#FF007A', ATOM: '#2E3148', SHIB: '#FFA409', PEPE: '#00A550',
  TON: '#0088CC', HYPE: '#00D4FF', INJ: '#00BFFF', SUI: '#4DA2FF',
  ARB: '#28A0F0', OP: '#FF0420', WIF: '#9945FF', BONK: '#FF6B35',
};

// ── Area Chart ────────────────────────────────────────────────
function CryptoAreaChart({ ticker, period }: { ticker: string; period: string }) {
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPoints([]);
    getCryptoHistory(ticker, period).then((hist) => {
      if (cancelled || hist.length < 2) { setLoading(false); return; }
      const vals = hist.map(h => h.close);
      const minV = Math.min(...vals);
      const maxV = Math.max(...vals);
      const range = maxV - minV || 1;
      const PAD_TOP = 10, PAD_BOTTOM = 4;
      const pts = hist.map((h, i) => ({
        x: (i / (hist.length - 1)) * CHART_W,
        y: PAD_TOP + (1 - (h.close - minV) / range) * (CHART_H - PAD_TOP - PAD_BOTTOM),
      }));
      setPoints(pts);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [ticker, period]);

  const isPositive = points.length > 1 ? points[points.length - 1].y <= points[0].y : true;
  const lineColor = isPositive ? '#00C896' : '#FF5A5F';
  const linePath = points.length > 1
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    : '';
  const areaPath = points.length > 1
    ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${CHART_H} L0,${CHART_H} Z`
    : '';

  if (loading) return (
    <View style={{ height: CHART_H, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color="#338DFF" />
    </View>
  );
  if (points.length < 2) return (
    <View style={{ height: CHART_H, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#4A6080', fontSize: 12 }}>No chart data</Text>
    </View>
  );
  return (
    <Svg width={CHART_W} height={CHART_H}>
      <Defs>
        <LinearGradient id="cryptoGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={lineColor} stopOpacity="0.0" />
        </LinearGradient>
      </Defs>
      <Path d={areaPath} fill="url(#cryptoGrad)" />
      <Path d={linePath} fill="none" stroke={lineColor} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Main Screen ───────────────────────────────────────────────
export default function CryptoDetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('Overview');
  const [chartPeriod, setChartPeriod] = useState('1Y');
  const [summary, setSummary] = useState<CryptoSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!ticker) return;

    // Initial full load
    getCryptoSummary(ticker).then((s) => {
      setSummary(s);
      setLoading(false);
    });

    // Price refresh every 10s
    intervalRef.current = setInterval(async () => {
      const p = await getCryptoPrice(ticker);
      if (p) {
        setSummary(prev => prev ? {
          ...prev,
          price: p.price,
          change: p.change,
          changePct: p.changesPercentage,
          yearHigh: Math.max(p.yearHigh || 0, prev.yearHigh),
          yearLow: p.yearLow > 0 ? Math.min(p.yearLow, prev.yearLow || p.yearLow) : prev.yearLow,
        } : prev);
      }
    }, 10000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ticker]);

  const cleanTicker = ticker?.toUpperCase().replace('-USD', '') ?? '';
  const isPositive = (summary?.changePct ?? 0) >= 0;
  const changeColor = isPositive ? '#00C896' : '#FF5A5F';
  const accentColor = CRYPTO_COLORS[cleanTicker] || '#338DFF';

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* STATIC HEADER */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()} style={s.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color="#338DFF" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={[s.cryptoIcon, {
            backgroundColor: accentColor + '22',
            borderColor: accentColor + '44',
          }]}>
            <Text style={[s.cryptoIconText, { color: accentColor }]}>
              {cleanTicker.slice(0, 3)}
            </Text>
          </View>
          <Text style={s.headerTicker}>{cleanTicker}</Text>
          <Text style={s.headerName}>{summary?.name || cleanTicker}</Text>
        </View>
        <TouchableOpacity style={s.starBtn}>
          <Ionicons name="star-outline" size={22} color="#FF9F43" />
        </TouchableOpacity>
      </View>

      {/* PRICE HERO */}
      <View style={s.priceHero}>
        {loading ? (
          <ActivityIndicator color="#338DFF" style={{ marginVertical: 16 }} />
        ) : (
          <>
            <Text style={s.price}>{formatCryptoPrice(summary?.price ?? 0)}</Text>
            <Text style={[s.change, { color: changeColor }]}>
              {isPositive ? '+' : ''}{formatCryptoPrice(Math.abs(summary?.change ?? 0))}{' '}
              ({isPositive ? '+' : ''}{summary?.changePct?.toFixed(2) ?? '—'}%) Today
            </Text>
          </>
        )}
      </View>

      {/* TAB BAR */}
      <View style={s.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* OVERVIEW */}
        {activeTab === 'Overview' && (
          <View>
            <View style={s.chartWrap}>
              <CryptoAreaChart ticker={cleanTicker} period={chartPeriod} />
            </View>
            <View style={s.periodRow}>
              {CHART_PERIODS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[s.periodBtn, chartPeriod === p && s.periodBtnActive]}
                  onPress={() => setChartPeriod(p)}
                >
                  <Text style={[s.periodText, chartPeriod === p && s.periodTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Stats — 2 column grid */}
            <View style={s.statsGrid}>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Market Cap</Text>
                <Text style={s.statValue}>{formatMarketCap(summary?.marketCap ?? 0)}</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>24h Volume</Text>
                <Text style={s.statValue}>{formatVolume(summary?.volume24h ?? 0)}</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Circulating Supply</Text>
                <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>
                  {formatSupply(summary?.circulatingSupply ?? 0)} {cleanTicker}
                </Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Asset Type</Text>
                <Text style={s.statValue}>Cryptocurrency</Text>
              </View>
            </View>

            {/* 52W High / Low — single row card */}
            <View style={s.weekRangeCard}>
              <View style={s.weekRangeStat}>
                <Text style={s.statLabel}>52W High</Text>
                <Text style={[s.statValue, { color: '#00C896' }]}>
                  {summary?.yearHigh ? formatCryptoPrice(summary.yearHigh) : '—'}
                </Text>
              </View>
              <View style={s.weekRangeDivider} />
              <View style={s.weekRangeStat}>
                <Text style={s.statLabel}>52W Low</Text>
                <Text style={[s.statValue, { color: '#FF5A5F' }]}>
                  {summary?.yearLow ? formatCryptoPrice(summary.yearLow) : '—'}
                </Text>
              </View>
            </View>

            {/* Disclaimer */}
            <View style={s.disclaimer}>
              <Ionicons name="warning-outline" size={13} color="#FF9F43" />
              <Text style={s.disclaimerText}>
                Cryptocurrency is highly volatile. Past performance does not guarantee future results.
              </Text>
            </View>
            <View style={{ height: 24 }} />
          </View>
        )}

        {/* MARKETS */}
        {activeTab === 'Markets' && (
          <View>
            <Text style={s.sectionLabel}>TOP TRADING PAIRS</Text>
            {[
              { exchange: 'Binance', pair: `${cleanTicker}/USDT`, volume: '$2.4B', change: '+0.8%', positive: true },
              { exchange: 'Coinbase', pair: `${cleanTicker}/USD`, volume: '$890M', change: '+0.7%', positive: true },
              { exchange: 'Kraken', pair: `${cleanTicker}/USD`, volume: '$320M', change: '+0.9%', positive: true },
              { exchange: 'OKX', pair: `${cleanTicker}/USDT`, volume: '$1.1B', change: '+0.6%', positive: true },
              { exchange: 'Bybit', pair: `${cleanTicker}/USDT`, volume: '$750M', change: '+0.8%', positive: true },
            ].map((market, i) => (
              <View key={i} style={s.marketRow}>
                <View style={s.marketLeft}>
                  <View style={[s.exchangeDot, { backgroundColor: accentColor }]} />
                  <View>
                    <Text style={s.exchangeName}>{market.exchange}</Text>
                    <Text style={s.tradingPair}>{market.pair}</Text>
                  </View>
                </View>
                <View style={s.marketRight}>
                  <Text style={s.marketVolume}>{market.volume}</Text>
                  <Text style={[s.marketChange, {
                    color: market.positive ? '#00C896' : '#FF5A5F',
                  }]}>{market.change}</Text>
                </View>
              </View>
            ))}
            <View style={s.infoCard}>
              <Ionicons name="information-circle-outline" size={14} color="#4A6080" />
              <Text style={s.infoText}>
                Market data is indicative. Real-time exchange data coming in a future update.
              </Text>
            </View>
            <View style={{ height: 24 }} />
          </View>
        )}

        {/* ALERTS */}
        {activeTab === 'Alerts' && (
          <View>
            <Text style={s.sectionLabel}>ALERT SETTINGS FOR {cleanTicker}</Text>
            {['Price Change', 'Volume Spike', 'New All-Time High', 'Large Whale Movement'].map((alert) => (
              <View key={alert} style={s.alertRow}>
                <Text style={s.alertText}>{alert}</Text>
                <View style={s.alertToggle}>
                  <Text style={s.alertToggleText}>Off</Text>
                </View>
              </View>
            ))}
            <View style={{ height: 24 }} />
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12,
    backgroundColor: '#0B0F19',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  cryptoIcon: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  cryptoIconText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  headerTicker: { fontSize: 16, fontWeight: '700', color: '#E8EEF8' },
  headerName: { fontSize: 10, color: '#4A6080', marginTop: 1 },
  starBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  priceHero: { paddingHorizontal: 16, paddingBottom: 12 },
  price: {
    fontSize: 34, fontWeight: '700', color: '#E8EEF8',
    marginBottom: 6, fontVariant: ['tabular-nums'],
  },
  change: { fontSize: 14, fontWeight: '500' },
  tabRow: {
    flexDirection: 'row', borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 16,
  },
  tab: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent', marginRight: 4,
  },
  tabActive: { borderBottomColor: '#338DFF' },
  tabText: { fontSize: 13, color: '#4A6080', fontWeight: '500' },
  tabTextActive: { color: '#338DFF', fontWeight: '600' },
  scroll: { flex: 1 },
  chartWrap: { paddingHorizontal: 16, paddingTop: 16 },
  periodRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  periodBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  periodBtnActive: { backgroundColor: '#338DFF22' },
  periodText: { fontSize: 13, color: '#4A6080', fontWeight: '500' },
  periodTextActive: { color: '#338DFF', fontWeight: '700' },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, paddingHorizontal: 16, marginTop: 4,
  },
  statCard: {
    width: '47%', backgroundColor: '#141A26', borderRadius: 12,
    padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  statLabel: { fontSize: 10, color: '#3A5070', letterSpacing: 0.8, marginBottom: 6 },
  statValue: { fontSize: 14, fontWeight: '600', color: '#E8EEF8' },
  // 52W range — single row card
  weekRangeCard: {
    flexDirection: 'row', backgroundColor: '#141A26', borderRadius: 12,
    marginHorizontal: 16, marginTop: 10, padding: 14,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  weekRangeStat: { flex: 1 },
  weekRangeDivider: { width: 0.5, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 12 },
  disclaimer: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#FF9F4311', borderRadius: 10, borderWidth: 0.5,
    borderColor: '#FF9F4333', padding: 12, marginHorizontal: 16, marginTop: 16,
  },
  disclaimerText: { flex: 1, fontSize: 11, color: '#C8D8F0', lineHeight: 17 },
  sectionLabel: {
    fontSize: 10, color: '#4A6A9A', letterSpacing: 1.5,
    marginBottom: 12, marginTop: 8, paddingHorizontal: 16,
  },
  marketRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#141A26', borderRadius: 12, padding: 14,
    marginHorizontal: 16, marginBottom: 8, borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  marketLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exchangeDot: { width: 8, height: 8, borderRadius: 4 },
  exchangeName: { fontSize: 13, fontWeight: '600', color: '#E8EEF8' },
  tradingPair: { fontSize: 11, color: '#4A6080', marginTop: 2 },
  marketRight: { alignItems: 'flex-end' },
  marketVolume: { fontSize: 13, color: '#C8D8F0', fontWeight: '500' },
  marketChange: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  infoCard: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#1E2A3A', borderRadius: 10,
    marginHorizontal: 16, marginTop: 12, padding: 12,
  },
  infoText: { flex: 1, fontSize: 12, color: '#4A6080', lineHeight: 18 },
  alertRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#141A26', borderRadius: 10, padding: 14,
    marginHorizontal: 16, marginBottom: 8, borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  alertText: { fontSize: 14, color: '#C8D8F0' },
  alertToggle: { backgroundColor: '#2A3A54', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  alertToggleText: { fontSize: 12, color: '#4A6080', fontWeight: '500' },
});