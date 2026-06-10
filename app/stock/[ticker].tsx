import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Dimensions, ScrollView, StatusBar,
    StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import {
    StockSummary, formatMarketCap, formatVolume,
    getETFDividends, getETFHistory, getETFPrice, getStockSummary,
} from '../services/api';

const TABS = ['Overview', 'Financials', 'Dividends', 'Alerts'];
const CHART_PERIODS = ['1D', '1W', '1M', '3M', '1Y', '5Y'];
const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - 32;
const CHART_H = 160;

// ── Area Chart ────────────────────────────────────────────────
function StockAreaChart({ ticker, period }: { ticker: string; period: string }) {
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPoints([]);
    getETFHistory(ticker, period).then((hist) => {
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
        <LinearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={lineColor} stopOpacity="0.0" />
        </LinearGradient>
      </Defs>
      <Path d={areaPath} fill="url(#stockGrad)" />
      <Path d={linePath} fill="none" stroke={lineColor} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Main Screen ───────────────────────────────────────────────
export default function StockDetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('Overview');
  const [chartPeriod, setChartPeriod] = useState('1Y');
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [dividends, setDividends] = useState<{ date: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!ticker) return;

    async function load() {
      const [s, d] = await Promise.all([
        getStockSummary(ticker),
        getETFDividends(ticker),
      ]);
      setSummary(s);
      setDividends(d);
      setLoading(false);
    }
    load();

    // Price refresh every 10s
    intervalRef.current = setInterval(async () => {
      const p = await getETFPrice(ticker);
      if (p) {
        setSummary(prev => prev ? {
          ...prev,
          price: p.price,
          change: p.change,
          changePct: p.changesPercentage,
          yearHigh: p.yearHigh || prev.yearHigh,
          yearLow: p.yearLow || prev.yearLow,
          avgVolume: p.avgVolume || prev.avgVolume,
        } : prev);
      }
    }, 10000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ticker]);

  const isPositive = (summary?.changePct ?? 0) >= 0;
  const changeColor = isPositive ? '#00C896' : '#FF5A5F';
  const paysDividends = dividends.length > 0 || (summary?.dividendYield ?? 0) > 0;

  const formatPE = (v: number) => v > 0 ? v.toFixed(1) + 'x' : '—';
  const formatEPS = (v: number) => v !== 0 ? `$${v.toFixed(2)}` : '—';
  const formatBeta = (v: number) => v > 0 ? v.toFixed(2) : '—';
  const formatYield = (v: number) => v > 0 ? `${(v * 100).toFixed(2)}%` : '—';

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
          <Text style={s.headerTicker}>{ticker}</Text>
          {summary?.name && (
            <Text style={s.headerName} numberOfLines={1}>{summary.name}</Text>
          )}
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
            <Text style={s.price}>
              ${summary?.price?.toLocaleString('en-US', {
                minimumFractionDigits: 2, maximumFractionDigits: 2,
              }) ?? '—'}
            </Text>
            <View style={s.changeRow}>
              <Text style={[s.change, { color: changeColor }]}>
                {isPositive ? '+' : ''}{summary?.change?.toFixed(2) ?? '—'}{' '}
                ({isPositive ? '+' : ''}{summary?.changePct?.toFixed(2) ?? '—'}%) Today
              </Text>
              {summary?.sector ? (
                <View style={s.sectorBadge}>
                  <Text style={s.sectorText}>{summary.sector}</Text>
                </View>
              ) : null}
            </View>
          </>
        )}
      </View>

      {/* TAB BAR */}
      <View style={s.tabRow}>
        {TABS.map((tab) => {
          if (tab === 'Dividends' && !paysDividends && !loading) return null;
          return (
            <TouchableOpacity
              key={tab}
              style={[s.tab, activeTab === tab && s.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* OVERVIEW */}
        {activeTab === 'Overview' && (
          <View>
            <View style={s.chartWrap}>
              <StockAreaChart ticker={ticker} period={chartPeriod} />
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

            {/* Stats grid */}
            <View style={s.statsGrid}>
              {[
                { label: 'Market Cap', value: formatMarketCap(summary?.marketCap ?? 0) },
                { label: 'P/E Ratio', value: formatPE(summary?.peRatio ?? 0) },
                { label: 'EPS', value: formatEPS(summary?.eps ?? 0) },
                { label: 'Beta', value: formatBeta(summary?.beta ?? 0) },
                { label: '52W High', value: summary?.yearHigh ? `$${summary.yearHigh.toFixed(2)}` : '—' },
                { label: '52W Low', value: summary?.yearLow ? `$${summary.yearLow.toFixed(2)}` : '—' },
                { label: 'Avg Volume', value: formatVolume(summary?.avgVolume ?? 0) },
                { label: 'Div. Yield', value: formatYield(summary?.dividendYield ?? 0) },
              ].map((stat) => (
                <View key={stat.label} style={s.statCard}>
                  <Text style={s.statLabel}>{stat.label}</Text>
                  <Text style={s.statValue}>{stat.value}</Text>
                </View>
              ))}
            </View>

            {summary?.industry ? (
              <View style={s.industryRow}>
                <Ionicons name="business-outline" size={13} color="#4A6080" />
                <Text style={s.industryText}>{summary.industry}</Text>
              </View>
            ) : null}
            <View style={{ height: 24 }} />
          </View>
        )}

        {/* FINANCIALS */}
        {activeTab === 'Financials' && (
          <View>
            <Text style={s.sectionLabel}>KEY METRICS</Text>
            <View style={s.metricsCard}>
              {[
                { label: 'Market Capitalization', value: formatMarketCap(summary?.marketCap ?? 0) },
                { label: 'Price / Earnings (P/E)', value: formatPE(summary?.peRatio ?? 0) },
                { label: 'Earnings Per Share', value: formatEPS(summary?.eps ?? 0) },
                { label: 'Beta (Volatility)', value: formatBeta(summary?.beta ?? 0) },
                { label: 'Dividend Yield', value: formatYield(summary?.dividendYield ?? 0) },
                { label: 'Sector', value: summary?.sector || '—' },
                { label: 'Industry', value: summary?.industry || '—' },
              ].map((item, i, arr) => (
                <View key={item.label}
                  style={[s.metricRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={s.metricLabel}>{item.label}</Text>
                  <Text style={s.metricValue}>{item.value}</Text>
                </View>
              ))}
            </View>
            <View style={s.infoCard}>
              <Ionicons name="information-circle-outline" size={14} color="#4A6080" />
              <Text style={s.infoText}>
                Full earnings history and income statements coming in a future update.
              </Text>
            </View>
            <View style={{ height: 24 }} />
          </View>
        )}

        {/* DIVIDENDS */}
        {activeTab === 'Dividends' && (
          <View>
            <View style={s.divHero}>
              <View style={s.divStat}>
                <Text style={s.divStatLabel}>Annual Yield</Text>
                <Text style={s.divStatValue}>{formatYield(summary?.dividendYield ?? 0)}</Text>
              </View>
              <View style={s.divDivider} />
              <View style={s.divStat}>
                <Text style={s.divStatLabel}>Frequency</Text>
                <Text style={s.divStatValue}>Quarterly</Text>
              </View>
            </View>

            {dividends.length > 0 && (
              <>
                <Text style={s.sectionLabel}>RECENT DIVIDENDS</Text>
                <View style={s.divTable}>
                  {dividends.slice(0, 8).map((d, i) => (
                    <View key={i}
                      style={[s.divTableRow,
                        i === Math.min(dividends.length, 8) - 1 && { borderBottomWidth: 0 }]}>
                      <Text style={s.divTableDate}>{d.date}</Text>
                      <Text style={[s.divTableAmt, { color: '#00C896' }]}>
                        ${d.amount.toFixed(4)}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            <View style={{ height: 24 }} />
          </View>
        )}

        {/* ALERTS */}
        {activeTab === 'Alerts' && (
          <View>
            <Text style={s.sectionLabel}>ALERT SETTINGS FOR {ticker}</Text>
            {['Price Change', 'Earnings Release', 'Dividend Change', 'Volume Spike'].map((alert) => (
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
  headerTicker: { fontSize: 18, fontWeight: '700', color: '#E8EEF8' },
  headerName: { fontSize: 11, color: '#4A6080', marginTop: 1 },
  starBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  priceHero: { paddingHorizontal: 16, paddingBottom: 12 },
  price: { fontSize: 34, fontWeight: '700', color: '#E8EEF8', marginBottom: 6, fontVariant: ['tabular-nums'] },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  change: { fontSize: 14, fontWeight: '500' },
  sectorBadge: { backgroundColor: '#338DFF18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 0.5, borderColor: '#338DFF33' },
  sectorText: { fontSize: 10, color: '#338DFF', fontWeight: '600' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 16 },
  tab: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent', marginRight: 4 },
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginTop: 4 },
  statCard: { width: '47%', backgroundColor: '#141A26', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  statLabel: { fontSize: 10, color: '#3A5070', letterSpacing: 0.8, marginBottom: 6 },
  statValue: { fontSize: 15, fontWeight: '600', color: '#E8EEF8' },
  industryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginTop: 12 },
  industryText: { fontSize: 12, color: '#4A6080' },
  sectionLabel: { fontSize: 10, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 12, marginTop: 8, paddingHorizontal: 16 },
  metricsCard: { backgroundColor: '#141A26', borderRadius: 14, marginHorizontal: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)' },
  metricLabel: { fontSize: 13, color: '#4A6080' },
  metricValue: { fontSize: 13, color: '#E8EEF8', fontWeight: '600' },
  infoCard: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#1E2A3A', borderRadius: 10, marginHorizontal: 16, marginTop: 12, padding: 12 },
  infoText: { flex: 1, fontSize: 12, color: '#4A6080', lineHeight: 18 },
  divHero: { flexDirection: 'row', backgroundColor: '#141A26', borderRadius: 14, padding: 16, marginHorizontal: 16, marginBottom: 16, borderWidth: 0.5, borderColor: 'rgba(0,200,150,0.2)' },
  divStat: { flex: 1, alignItems: 'center' },
  divDivider: { width: 0.5, backgroundColor: 'rgba(255,255,255,0.06)' },
  divStatLabel: { fontSize: 10, color: '#3A5070', letterSpacing: 0.8, marginBottom: 6 },
  divStatValue: { fontSize: 18, fontWeight: '600', color: '#00C896' },
  divTable: { backgroundColor: '#141A26', borderRadius: 14, marginHorizontal: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  divTableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)' },
  divTableDate: { fontSize: 13, color: '#C8D8F0' },
  divTableAmt: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  alertRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#141A26', borderRadius: 10, padding: 14, marginHorizontal: 16, marginBottom: 8, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  alertText: { fontSize: 14, color: '#C8D8F0' },
  alertToggle: { backgroundColor: '#2A3A54', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  alertToggleText: { fontSize: 12, color: '#4A6080', fontWeight: '500' },
});