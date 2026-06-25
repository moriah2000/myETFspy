import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Dimensions, ScrollView, StatusBar,
  StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';
import InteractiveChart from '../../components/InteractiveChart';
import { useSingleChartPoints } from '../hooks/useChartPoints';
import {
  CryptoSummary, formatCryptoPrice, formatMarketCap,
  formatSupply, formatVolume, getCryptoPrice, getCryptoSummary,
  getETFHistory,
} from '../services/api';

const TABS = ['Overview', 'Markets', 'Alerts'];
const CHART_PERIODS = ['1D', '1W', '1M', '3M', '1Y', '5Y'];
const SCREEN_W = Dimensions.get('window').width;
const CHART_H = 160;

const WATCHLIST_KEY = 'watchlist_items';
const ALERTS_KEY_PREFIX = 'alerts_crypto_';
const ALERT_TYPES = ['Price Change', 'Volume Spike', 'New All-Time High', 'Large Whale Movement'];

const CRYPTO_COLORS: Record<string, string> = {
  BTC: '#F7931A', ETH: '#627EEA', SOL: '#9945FF', XRP: '#00AAE4',
  BNB: '#F3BA2F', ADA: '#0033AD', DOGE: '#C2A633', AVAX: '#E84142',
  LINK: '#2A5ADA', DOT: '#E6007A', MATIC: '#8247E5', LTC: '#BFBBBB',
  UNI: '#FF007A', ATOM: '#2E3148', SHIB: '#FFA409', PEPE: '#00A550',
  TON: '#0088CC', HYPE: '#00D4FF', INJ: '#00BFFF', SUI: '#4DA2FF',
  ARB: '#28A0F0', OP: '#FF0420', WIF: '#9945FF', BONK: '#FF6B35',
};

async function isInWatchlist(ticker: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(WATCHLIST_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return list.some((item: any) => item.ticker === ticker);
  } catch { return false; }
}

async function toggleWatchlist(ticker: string, name: string, price: number): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(WATCHLIST_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((item: any) => item.ticker === ticker);
    if (idx >= 0) { list.splice(idx, 1); await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(list)); return false; }
    else { list.push({ ticker, name, type: 'CRYPTO', price, change: 0, pct: 0, sparkline: [] }); await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(list)); return true; }
  } catch { return false; }
}

async function loadAlerts(ticker: string): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(ALERTS_KEY_PREFIX + ticker);
    if (raw) return JSON.parse(raw);
  } catch {}
  return Object.fromEntries(ALERT_TYPES.map(a => [a, false]));
}

async function saveAlerts(ticker: string, alerts: Record<string, boolean>): Promise<void> {
  await AsyncStorage.setItem(ALERTS_KEY_PREFIX + ticker, JSON.stringify(alerts));
}

function usePeriodChange(yahooTicker: string, period: string) {
  const [pct, setPct] = useState<number | null>(null);
  useEffect(() => {
    if (!yahooTicker) return;
    let cancelled = false;
    getETFHistory(yahooTicker, period === '1D' ? '1D' : period).then((hist) => {
      if (cancelled || hist.length < 2) return;
      const first = hist[0].close, last = hist[hist.length - 1].close;
      if (first > 0) setPct(((last - first) / first) * 100);
    });
    return () => { cancelled = true; };
  }, [yahooTicker, period]);
  return pct;
}

export default function CryptoDetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const router = useRouter();

  const cleanTicker = ticker?.toUpperCase().replace('-USD', '') ?? '';
  const yahooTicker = `${cleanTicker}-USD`;

  const [activeTab, setActiveTab] = useState('Overview');
  const [chartPeriod, setChartPeriod] = useState('1Y');
  const [summary, setSummary] = useState<CryptoSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [starred, setStarred] = useState(false);
  const [alerts, setAlerts] = useState<Record<string, boolean>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { points: chartPoints, loading: chartLoading, isPositive: chartPositive } = useSingleChartPoints({
    ticker: yahooTicker, period: chartPeriod, chartW: SCREEN_W - 32, chartH: CHART_H,
  });

  const periodPct = usePeriodChange(yahooTicker, chartPeriod);
  const displayPct = chartPeriod === '1D' ? (summary?.changePct ?? 0) : (periodPct ?? summary?.changePct ?? 0);
  const isPositiveDisplay = displayPct >= 0;
  const changeColor = isPositiveDisplay ? '#00C896' : '#FF5A5F';
  const lineColor = chartPositive ? '#00C896' : '#FF5A5F';
  const accentColor = CRYPTO_COLORS[cleanTicker] || '#338DFF';
  const periodLabel = chartPeriod === '1D' ? 'Today' : chartPeriod;

  useEffect(() => {
    if (!cleanTicker) return;
    isInWatchlist(cleanTicker).then(setStarred);
    loadAlerts(cleanTicker).then(setAlerts);
    getCryptoSummary(cleanTicker).then((s) => { setSummary(s); setLoading(false); });
    intervalRef.current = setInterval(async () => {
      const p = await getCryptoPrice(cleanTicker);
      if (p) setSummary(prev => prev ? { ...prev, price: p.price, change: p.change, changePct: p.changesPercentage, yearHigh: Math.max(p.yearHigh || 0, prev.yearHigh), yearLow: p.yearLow > 0 ? Math.min(p.yearLow, prev.yearLow || p.yearLow) : prev.yearLow } : prev);
    }, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [cleanTicker]);

  async function handleStarPress() {
    const nowInList = await toggleWatchlist(cleanTicker, summary?.name ?? cleanTicker, summary?.price ?? 0);
    setStarred(nowInList);
  }

  async function handleAlertToggle(alertType: string) {
    const updated = { ...alerts, [alertType]: !alerts[alertType] };
    setAlerts(updated); await saveAlerts(cleanTicker, updated);
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#338DFF" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={[s.cryptoIcon, { backgroundColor: accentColor + '22', borderColor: accentColor + '44' }]}>
            <Text style={[s.cryptoIconText, { color: accentColor }]}>{cleanTicker.slice(0, 3)}</Text>
          </View>
          <Text style={s.headerTicker}>{cleanTicker}</Text>
          <Text style={s.headerName}>{summary?.name || cleanTicker}</Text>
        </View>
        <TouchableOpacity style={s.starBtn} onPress={handleStarPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={starred ? 'star' : 'star-outline'} size={22} color="#FF9F43" />
        </TouchableOpacity>
      </View>

      <View style={s.priceHero}>
        {loading ? <ActivityIndicator color="#338DFF" style={{ marginVertical: 16 }} /> : (
          <>
            <Text style={s.price}>{formatCryptoPrice(summary?.price ?? 0)}</Text>
            <View style={s.changeRow}>
              <Text style={[s.changePct, { color: changeColor }]}>
                {isPositiveDisplay ? '+' : ''}{displayPct.toFixed(2)}%
              </Text>
              <View style={[s.periodPill, { backgroundColor: changeColor + '22' }]}>
                <Text style={[s.periodPillText, { color: changeColor }]}>{periodLabel}</Text>
              </View>
            </View>
          </>
        )}
      </View>

      <View style={s.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity key={tab} style={[s.tab, activeTab === tab && s.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {activeTab === 'Overview' && (
          <View>
            <View style={s.chartWrap}>
              <InteractiveChart points={chartPoints} height={CHART_H} color={lineColor} loading={chartLoading} formatValue={(v) => formatCryptoPrice(v)} />
            </View>
            <View style={s.periodRow}>
              {CHART_PERIODS.map((p) => (
                <TouchableOpacity key={p} style={[s.periodBtn, chartPeriod === p && s.periodBtnActive]} onPress={() => setChartPeriod(p)}>
                  <Text style={[s.periodText, chartPeriod === p && s.periodTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Clean stat rows */}
            <View style={s.statsCard}>
              {[
                { label: 'Market Cap', value: formatMarketCap(summary?.marketCap ?? 0) },
                { label: '24h Volume', value: formatVolume(summary?.volume24h ?? 0) },
                { label: 'Circulating Supply', value: `${formatSupply(summary?.circulatingSupply ?? 0)} ${cleanTicker}` },
                { label: '52W High', value: summary?.yearHigh ? formatCryptoPrice(summary.yearHigh) : '—', color: '#00C896' },
                { label: '52W Low', value: summary?.yearLow ? formatCryptoPrice(summary.yearLow) : '—', color: '#FF5A5F' },
                { label: 'Asset Type', value: 'Cryptocurrency' },
              ].map((stat: any, i, arr) => (
                <View key={stat.label} style={[s.statRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={s.statLabel}>{stat.label}</Text>
                  <Text style={[s.statValue, stat.color ? { color: stat.color } : {}]}>{stat.value}</Text>
                </View>
              ))}
            </View>

            <View style={s.disclaimer}>
              <Ionicons name="warning-outline" size={13} color="#FF9F43" />
              <Text style={s.disclaimerText}>Cryptocurrency is highly volatile. Past performance does not guarantee future results.</Text>
            </View>
            <View style={{ height: 24 }} />
          </View>
        )}

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
                  <Text style={[s.marketChange, { color: market.positive ? '#00C896' : '#FF5A5F' }]}>{market.change}</Text>
                </View>
              </View>
            ))}
            <View style={s.infoCard}>
              <Ionicons name="information-circle-outline" size={14} color="#4A6080" />
              <Text style={s.infoText}>Market data is indicative. Real-time exchange data coming in a future update.</Text>
            </View>
            <View style={{ height: 24 }} />
          </View>
        )}

        {activeTab === 'Alerts' && (
          <View>
            <Text style={s.sectionLabel}>ALERT SETTINGS FOR {cleanTicker}</Text>
            {ALERT_TYPES.map((alertType) => (
              <View key={alertType} style={s.alertRow}>
                <View style={s.alertLeft}>
                  <Ionicons
                    name={alertType === 'Price Change' ? 'trending-up-outline' : alertType === 'Volume Spike' ? 'pulse-outline' : alertType === 'New All-Time High' ? 'trophy-outline' : 'fish-outline'}
                    size={18} color={alerts[alertType] ? '#338DFF' : '#4A6080'} style={{ marginRight: 10 }}
                  />
                  <Text style={[s.alertText, alerts[alertType] && { color: '#E8EEF8' }]}>{alertType}</Text>
                </View>
                <Switch value={!!alerts[alertType]} onValueChange={() => handleAlertToggle(alertType)}
                  trackColor={{ false: '#1E2A3A', true: '#338DFF44' }} thumbColor={alerts[alertType] ? '#338DFF' : '#4A6080'} ios_backgroundColor="#1E2A3A" />
              </View>
            ))}
            <Text style={s.alertsNote}>Alerts are saved per asset and will notify you when enabled.</Text>
            <View style={{ height: 24 }} />
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12, backgroundColor: '#0B0F19' },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  cryptoIcon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  cryptoIconText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  headerTicker: { fontSize: 16, fontWeight: '700', color: '#E8EEF8' },
  headerName: { fontSize: 10, color: '#4A6080', marginTop: 1 },
  starBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  priceHero: { paddingHorizontal: 16, paddingBottom: 12 },
  price: { fontSize: 34, fontWeight: '700', color: '#E8EEF8', marginBottom: 6, fontVariant: ['tabular-nums'] },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  changePct: { fontSize: 16, fontWeight: '700' },
  periodPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  periodPillText: { fontSize: 11, fontWeight: '700' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 16 },
  tab: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent', marginRight: 4 },
  tabActive: { borderBottomColor: '#338DFF' },
  tabText: { fontSize: 13, color: '#4A6080', fontWeight: '500' },
  tabTextActive: { color: '#338DFF', fontWeight: '600' },
  scroll: { flex: 1 },
  chartWrap: { paddingHorizontal: 16, paddingTop: 16 },
  periodRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16, paddingVertical: 12 },
  periodBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  periodBtnActive: { backgroundColor: '#338DFF22' },
  periodText: { fontSize: 13, color: '#4A6080', fontWeight: '500' },
  periodTextActive: { color: '#338DFF', fontWeight: '700' },
  statsCard: { backgroundColor: '#141A26', borderRadius: 14, marginHorizontal: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: 4 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)' },
  statLabel: { fontSize: 13, color: '#4A6080' },
  statValue: { fontSize: 13, fontWeight: '600', color: '#E8EEF8' },
  disclaimer: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#FF9F4311', borderRadius: 10, borderWidth: 0.5, borderColor: '#FF9F4333', padding: 12, marginHorizontal: 16, marginTop: 16 },
  disclaimerText: { flex: 1, fontSize: 11, color: '#C8D8F0', lineHeight: 17 },
  sectionLabel: { fontSize: 10, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 12, marginTop: 8, paddingHorizontal: 16 },
  marketRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#141A26', borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 8, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  marketLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exchangeDot: { width: 8, height: 8, borderRadius: 4 },
  exchangeName: { fontSize: 13, fontWeight: '600', color: '#E8EEF8' },
  tradingPair: { fontSize: 11, color: '#4A6080', marginTop: 2 },
  marketRight: { alignItems: 'flex-end' },
  marketVolume: { fontSize: 13, color: '#C8D8F0', fontWeight: '500' },
  marketChange: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  infoCard: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#1E2A3A', borderRadius: 10, marginHorizontal: 16, marginTop: 12, padding: 12 },
  infoText: { flex: 1, fontSize: 12, color: '#4A6080', lineHeight: 18 },
  alertRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#141A26', borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  alertLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  alertText: { fontSize: 14, color: '#4A6080' },
  alertsNote: { fontSize: 11, color: '#4A6080', paddingHorizontal: 16, marginTop: 4, lineHeight: 16 },
});
