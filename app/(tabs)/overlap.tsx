import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Dimensions, LayoutAnimation, Platform,
  RefreshControl, ScrollView, StatusBar, StyleSheet,
  Text, TouchableOpacity, UIManager, View,
} from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { ETFPosition, usePortfolioData } from '../hooks/usePortfolioData';
import { getETFDividends, getETFHistory, getETFTopHoldings } from '../services/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Holding = { symbol: string; name: string; weight: number };
type HoldingsMap = Record<string, Holding[]>;

const PERF_PERIODS = ['Today', '1W', '1M', '3M', '6M', '1Y', '5Y'];
const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - 80;
const CHART_H = 120;

// ── ETF Sector Mappings ───────────────────────────────────────
const SYMBOL_SECTOR: Record<string, string> = {
  AAPL: 'Technology', MSFT: 'Technology', NVDA: 'Technology', AVGO: 'Technology',
  META: 'Technology', GOOGL: 'Technology', GOOG: 'Technology', AMD: 'Technology',
  ORCL: 'Technology', CSCO: 'Technology', ACN: 'Technology', IBM: 'Technology',
  TXN: 'Technology', QCOM: 'Technology', NOW: 'Technology', ADBE: 'Technology',
  AMAT: 'Technology', MU: 'Technology', KLAC: 'Technology', LRCX: 'Technology',
  AMZN: 'Consumer Disc.', TSLA: 'Consumer Disc.', HD: 'Consumer Disc.',
  MCD: 'Consumer Disc.', NKE: 'Consumer Disc.', SBUX: 'Consumer Disc.',
  TJX: 'Consumer Disc.', LOW: 'Consumer Disc.', BKNG: 'Consumer Disc.',
  JPM: 'Financials', V: 'Financials', MA: 'Financials', BAC: 'Financials',
  WFC: 'Financials', GS: 'Financials', MS: 'Financials', BLK: 'Financials',
  AXP: 'Financials', SPGI: 'Financials', CB: 'Financials', PGR: 'Financials',
  TRV: 'Financials', AFL: 'Financials', PRU: 'Financials',
  LLY: 'Healthcare', UNH: 'Healthcare', JNJ: 'Healthcare', ABBV: 'Healthcare',
  MRK: 'Healthcare', TMO: 'Healthcare', ABT: 'Healthcare', ISRG: 'Healthcare',
  DHR: 'Healthcare', BMY: 'Healthcare', PFE: 'Healthcare', AMGN: 'Healthcare',
  CAT: 'Industrials', DE: 'Industrials', HON: 'Industrials', GE: 'Industrials',
  UPS: 'Industrials', LMT: 'Industrials', RTX: 'Industrials', ETN: 'Industrials',
  ITW: 'Industrials', MMM: 'Industrials', EMR: 'Industrials', FDX: 'Industrials',
  XOM: 'Energy', CVX: 'Energy', COP: 'Energy', SLB: 'Energy', EOG: 'Energy',
  PSX: 'Energy', VLO: 'Energy', MPC: 'Energy',
  PG: 'Consumer Staples', KO: 'Consumer Staples', PEP: 'Consumer Staples',
  WMT: 'Consumer Staples', COST: 'Consumer Staples', PM: 'Consumer Staples',
  MO: 'Consumer Staples', CL: 'Consumer Staples',
  NEE: 'Utilities', DUK: 'Utilities', SO: 'Utilities', D: 'Utilities',
  AEP: 'Utilities', EXC: 'Utilities', XEL: 'Utilities',
  PLD: 'Real Estate', AMT: 'Real Estate', EQIX: 'Real Estate', SPG: 'Real Estate',
  NFLX: 'Communication', DIS: 'Communication', CMCSA: 'Communication',
  T: 'Communication', VZ: 'Communication', TMUS: 'Communication',
  LIN: 'Materials', APD: 'Materials', SHW: 'Materials', ECL: 'Materials',
};

const SECTOR_COLORS: Record<string, string> = {
  'Technology': '#338DFF', 'Financials': '#00C896', 'Healthcare': '#A78BFA',
  'Industrials': '#FF9F43', 'Consumer Disc.': '#FF5A5F', 'Energy': '#FFD93D',
  'Consumer Staples': '#4FC3F7', 'Communication': '#E879F9', 'Utilities': '#81C784',
  'Real Estate': '#F48FB1', 'Materials': '#FFCC02', 'Other': '#4A6080',
};

function computeSectorExposure(
  positions: ETFPosition[],
  holdingsMap: HoldingsMap,
  totalValue: number,
): { name: string; pct: number; color: string }[] {
  if (totalValue === 0 || Object.keys(holdingsMap).length === 0) return [];
  const sectorWeights: Record<string, number> = {};
  positions.forEach((pos) => {
    if (pos.value === 0) return;
    const posWeight = pos.value / totalValue;
    const holdings = holdingsMap[pos.ticker] || [];
    const totalHoldingWeight = holdings.reduce((s, h) => s + h.weight, 0) || 100;
    holdings.forEach((h) => {
      const sector = SYMBOL_SECTOR[h.symbol] || 'Other';
      const contribution = posWeight * (h.weight / totalHoldingWeight);
      sectorWeights[sector] = (sectorWeights[sector] || 0) + contribution * 100;
    });
  });
  return Object.entries(sectorWeights)
    .sort((a, b) => b[1] - a[1])
    .map(([name, pct]) => ({ name, pct: Math.round(pct * 10) / 10, color: SECTOR_COLORS[name] || '#4A6080' }));
}

// ── Helpers ───────────────────────────────────────────────────
function computeShared(h1: Holding[], h2: Holding[]) {
  const map2 = new Map(h2.map((h) => [h.symbol, h]));
  return h1
    .filter((h) => h.symbol && map2.has(h.symbol))
    .map((h) => ({ symbol: h.symbol, name: h.name, w1: h.weight, w2: map2.get(h.symbol)!.weight }))
    .sort((a, b) => b.w1 + b.w2 - (a.w1 + a.w2));
}

function overlapScore(h1: Holding[], h2: Holding[]): number {
  const shared = computeShared(h1, h2);
  const score = shared.reduce((acc, h) => acc + Math.min(h.w1, h.w2), 0);
  return Math.min(Math.round(score), 100);
}

function scoreColor(score: number) {
  if (score >= 60) return '#FF5A5F';
  if (score >= 30) return '#FF9F43';
  return '#00C896';
}

function scoreLabel(score: number) {
  if (score >= 60) return 'High Overlap';
  if (score >= 30) return 'Moderate';
  return 'Low Overlap';
}

// ── Donut Chart ───────────────────────────────────────────────
function DonutChart({ positions, totalValue }: { positions: ETFPosition[]; totalValue: number }) {
  const SIZE = 210;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const RADIUS = 82;
  const STROKE_WIDTH = 24;
  const GAP_DEGREES = 3;
  const circumference = 2 * Math.PI * RADIUS;
  const hasValues = totalValue > 0;
  const items = hasValues ? positions.filter(p => p.value > 0) : positions.map(p => ({ ...p, value: 1 }));
  const total = items.reduce((s, p) => s + p.value, 0);
  let cumulativePct = 0;
  const slices = items.map((p) => {
    const pct = p.value / total;
    const gapFraction = GAP_DEGREES / 360;
    const slicePct = Math.max(0, pct - gapFraction);
    const dash = slicePct * circumference;
    const offset = circumference * 0.25 - cumulativePct * circumference;
    cumulativePct += pct;
    return { ticker: p.ticker, color: p.color, pct: Math.round(pct * 100), value: p.value, dash, offset };
  });
  return (
    <View style={dc.container}>
      <View style={dc.chartWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={CX} cy={CY} r={RADIUS} fill="none" stroke="#1E2A3A" strokeWidth={STROKE_WIDTH} />
          <G>
            {slices.map((sl) => (
              <Circle
                key={sl.ticker} cx={CX} cy={CY} r={RADIUS}
                fill="none" stroke={sl.color} strokeWidth={STROKE_WIDTH}
                strokeDasharray={`${sl.dash} ${circumference - sl.dash}`}
                strokeDashoffset={sl.offset}
              />
            ))}
          </G>
        </Svg>
        <View style={dc.center}>
          <Text style={dc.centerLabel}>Total</Text>
          <Text style={dc.centerValue}>
            {hasValues ? `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
          </Text>
        </View>
      </View>
      <View style={dc.legend}>
        {slices.map((sl) => (
          <View key={sl.ticker} style={dc.legendItem}>
            <View style={[dc.dot, { backgroundColor: sl.color }]} />
            <View>
              <Text style={dc.legendTicker}>{sl.ticker}</Text>
              <Text style={dc.legendValue}>
                {hasValues ? `$${sl.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : `${sl.pct}%`}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const dc = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 0 },
  chartWrap: { position: 'relative', width: 210, height: 210 },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  centerLabel: { fontSize: 12, color: '#4A6080', marginBottom: 2 },
  centerValue: { fontSize: 14, fontWeight: '700', color: '#E8EEF8', fontVariant: ['tabular-nums'], textAlign: 'center' },
  legend: { flex: 1, paddingLeft: 32, gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendTicker: { fontSize: 12, color: '#E8EEF8', fontWeight: '600' },
  legendValue: { fontSize: 11, color: '#4A6080', fontVariant: ['tabular-nums'] },
});

// ── Area Chart ────────────────────────────────────────────────
function PortfolioAreaChart({
  positions, period, onPeriodChange,
}: {
  positions: ETFPosition[];
  period: string;
  onPeriodChange: (p: string) => void;
}) {
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [pctChange, setPctChange] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (positions.length === 0) return;
    let cancelled = false;
    setLoading(true);
    setPoints([]);
    setPctChange(null);

    async function load() {
      const source = positions.filter(p => p.qty > 0).length > 0
        ? positions.filter(p => p.qty > 0)
        : positions;
      const histories = await Promise.all(source.map(p => getETFHistory(p.ticker, period)));
      if (cancelled) return;
      const minLen = Math.min(...histories.map(h => h.length));
      if (minLen < 2) { setLoading(false); return; }
      const combined: { ts: number; val: number }[] = [];
      for (let i = 0; i < minLen; i++) {
        const val = source.reduce((sum, p, idx) => {
          return sum + (histories[idx][i]?.close ?? 0) * (p.qty > 0 ? p.qty : 1);
        }, 0);
        combined.push({ ts: histories[0][i].timestamp, val });
      }
      if (cancelled) return;
      if (combined.length < 2) { setLoading(false); return; }
      const vals = combined.map(d => d.val);
      const minV = Math.min(...vals);
      const maxV = Math.max(...vals);
      const range = maxV - minV || 1;
      const PAD_TOP = 12, PAD_BOTTOM = 4;
      const pts = combined.map((d, i) => ({
        x: (i / (combined.length - 1)) * CHART_W,
        y: PAD_TOP + (1 - (d.val - minV) / range) * (CHART_H - PAD_TOP - PAD_BOTTOM),
      }));
      const pct = ((combined[combined.length - 1].val - combined[0].val) / combined[0].val) * 100;
      setPoints(pts);
      setPctChange(pct);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [period, positions.map(p => p.ticker + p.qty).join(',')]);

  const isPositive = (pctChange ?? 0) >= 0;
  const lineColor = isPositive ? '#00C896' : '#FF5A5F';
  const linePath = points.length > 1
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    : '';
  const areaPath = points.length > 1
    ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${CHART_H} L0,${CHART_H} Z`
    : '';

  return (
    <View style={ac.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={ac.periodRow}>
          {PERF_PERIODS.map((p) => (
            <TouchableOpacity key={p} style={ac.periodBtn} onPress={() => onPeriodChange(p)}>
              <Text style={[ac.periodText, period === p && ac.periodTextActive]}>{p}</Text>
              {period === p && <View style={ac.periodUnderline} />}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      {pctChange !== null && (
        <View style={ac.pctRow}>
          <Text style={[ac.pctText, { color: lineColor }]}>
            {isPositive ? '▲' : '▼'} {isPositive ? '+' : ''}{pctChange.toFixed(2)}%
          </Text>
          <Text style={ac.pctLabel}>{period} return</Text>
        </View>
      )}
      <View style={ac.chartArea}>
        {loading ? (
          <View style={{ height: CHART_H, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator color="#338DFF" />
          </View>
        ) : points.length > 1 ? (
          <Svg width={CHART_W} height={CHART_H}>
            <Defs>
              <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={lineColor} stopOpacity="0.35" />
                <Stop offset="100%" stopColor={lineColor} stopOpacity="0.0" />
              </LinearGradient>
            </Defs>
            <Path d={areaPath} fill="url(#areaGrad)" />
            <Path d={linePath} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        ) : (
          <View style={{ height: CHART_H, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={ac.emptyText}>No data available</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const ac = StyleSheet.create({
  wrap: { paddingBottom: 16 },
  periodRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },
  periodBtn: { paddingHorizontal: 11, paddingBottom: 10, alignItems: 'center' },
  periodText: { fontSize: 13, color: '#4A6080', fontWeight: '500' },
  periodTextActive: { color: '#338DFF', fontWeight: '700' },
  periodUnderline: { height: 2, backgroundColor: '#338DFF', borderRadius: 1, width: '100%', marginTop: 4 },
  pctRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  pctText: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pctLabel: { fontSize: 12, color: '#4A6080' },
  chartArea: { paddingHorizontal: 20 },
  emptyText: { fontSize: 12, color: '#4A6080' },
});

// ── Dynamic Health Score ──────────────────────────────────────
function computeHealthMetrics(
  positions: ETFPosition[],
  holdingsMap: HoldingsMap,
  totalValue: number,
): { label: string; score: number; color: string }[] {
  const count = positions.filter(p => p.value > 0).length;
  const maxVal = Math.max(...positions.map(p => p.value), 1);
  const concentration = totalValue > 0 ? maxVal / totalValue : 1;
  const diversification = Math.min(100, Math.round((count / 6) * 60 + (1 - concentration) * 40));
  const concRisk = Math.round((1 - concentration) * 100);
  const sectorBalance = Math.min(100, Math.round(50 + count * 8));
  const etfsWithHoldings = Object.keys(holdingsMap);
  let totalOverlap = 0, pairCount = 0;
  for (let i = 0; i < etfsWithHoldings.length; i++) {
    for (let j = i + 1; j < etfsWithHoldings.length; j++) {
      totalOverlap += overlapScore(holdingsMap[etfsWithHoldings[i]], holdingsMap[etfsWithHoldings[j]]);
      pairCount++;
    }
  }
  const avgOverlap = pairCount > 0 ? totalOverlap / pairCount : 50;
  const overlapRisk = Math.round(100 - avgOverlap);
  return [
    { label: 'Diversification', score: diversification, color: diversification >= 70 ? '#00C896' : '#FF9F43' },
    { label: 'Concentration Risk', score: concRisk, color: concRisk >= 70 ? '#00C896' : '#FF9F43' },
    { label: 'Sector Balance', score: sectorBalance, color: sectorBalance >= 70 ? '#338DFF' : '#FF9F43' },
    { label: 'Overlap Risk', score: overlapRisk, color: overlapRisk >= 70 ? '#00C896' : '#FF5A5F' },
  ];
}

// ── Main Screen ───────────────────────────────────────────────
export default function PortfolioScreen() {
  const {
    positions, loading, refreshing, lastUpdated,
    totalValue, totalChange, hasValues,
    refresh, reset, startFetching,
  } = usePortfolioData();

  const [holdingsMap, setHoldingsMap] = useState<HoldingsMap>({});
  const [loadingOverlap, setLoadingOverlap] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [expandedPair, setExpandedPair] = useState<string | null>(null);
  const [perfPeriod, setPerfPeriod] = useState('1Y');
  const [realYields, setRealYields] = useState<Record<string, number>>({});

  const FALLBACK_YIELDS: Record<string, number> = {
    SCHD: 0.0365, VTI: 0.0152, QQQM: 0.0064, JEPI: 0.0819,
    JEPQ: 0.0980, SPY: 0.0128, VOO: 0.0128, VXUS: 0.0280, QQQI: 0.0120,
  };

  useFocusEffect(
    useCallback(() => {
      startFetching();
      return () => {
        reset();
        setExpandedCard(null);
        setExpandedPair(null);
        setHoldingsMap({});
      };
    }, [])
  );

  // Fetch real dividend yields
  useEffect(() => {
    if (positions.length === 0) return;
    async function fetchYields() {
      const yields: Record<string, number> = {};
      await Promise.all(
        positions.map(async (p) => {
          try {
            const divs = await getETFDividends(p.ticker);
            if (divs.length >= 2 && p.price > 0) {
              const annual = divs.slice(0, 12).reduce((sum: number, d: any) => sum + d.amount, 0);
              yields[p.ticker] = annual / p.price;
            } else {
              yields[p.ticker] = FALLBACK_YIELDS[p.ticker] || 0;
            }
          } catch {
            yields[p.ticker] = FALLBACK_YIELDS[p.ticker] || 0;
          }
        })
      );
      setRealYields(yields);
    }
    fetchYields();
  }, [positions.map(p => p.ticker).join(',')]);

  // Prefetch holdings for sector + health
  useEffect(() => {
    if (positions.length === 0 || Object.keys(holdingsMap).length > 0) return;
    async function prefetch() {
      const results: HoldingsMap = {};
      await Promise.all(
        positions.map(async (p) => {
          const h = await getETFTopHoldings(p.ticker);
          if (h.length) results[p.ticker] = h;
        })
      );
      setHoldingsMap(results);
    }
    prefetch();
  }, [positions.map(p => p.ticker).join(',')]);

  const getYield = (ticker: string) => realYields[ticker] ?? FALLBACK_YIELDS[ticker] ?? 0;
  const annualIncome = positions.reduce((sum, p) => sum + p.value * getYield(p.ticker), 0);
  const monthlyIncome = annualIncome / 12;

  const loadOverlap = async () => {
    if (Object.keys(holdingsMap).length > 0) return;
    setLoadingOverlap(true);
    const results: HoldingsMap = {};
    await Promise.all(
      positions.map(async (p) => {
        const h = await getETFTopHoldings(p.ticker);
        if (h.length) results[p.ticker] = h;
      })
    );
    setHoldingsMap(results);
    setLoadingOverlap(false);
  };

  function toggleCard(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (id === 'overlap') loadOverlap();
    setExpandedCard(expandedCard === id ? null : id);
  }

  // Build overlap pairs
  const etfs = Object.keys(holdingsMap);
  const pairs: {
    etf1: string; etf2: string; score: number;
    sharedCount: number;
    sharedHoldings: { symbol: string; name: string; w1: number; w2: number }[];
  }[] = [];
  for (let i = 0; i < etfs.length; i++) {
    for (let j = i + 1; j < etfs.length; j++) {
      const e1 = etfs[i], e2 = etfs[j];
      const shared = computeShared(holdingsMap[e1], holdingsMap[e2]);
      pairs.push({
        etf1: e1, etf2: e2,
        score: overlapScore(holdingsMap[e1], holdingsMap[e2]),
        sharedCount: shared.length,
        sharedHoldings: shared,
      });
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  const allSymbols = new Map<string, { name: string; etfs: string[] }>();
  etfs.forEach((ticker) => {
    holdingsMap[ticker]?.forEach((h) => {
      if (!h.symbol) return;
      const ex = allSymbols.get(h.symbol);
      if (ex) ex.etfs.push(ticker);
      else allSymbols.set(h.symbol, { name: h.name, etfs: [ticker] });
    });
  });
  const overlappingHoldings = Array.from(allSymbols.entries())
    .filter(([, v]) => v.etfs.length > 1)
    .sort((a, b) => b[1].etfs.length - a[1].etfs.length)
    .slice(0, 8);

  const sectorData = computeSectorExposure(positions, holdingsMap, totalValue);
  const topSector = sectorData[0];
  const healthMetrics = computeHealthMetrics(positions, holdingsMap, totalValue);
  const overallHealth = Math.round(healthMetrics.reduce((a, m) => a + m.score, 0) / healthMetrics.length);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* STATIC HEADER */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Portfolio</Text>
        <View style={s.headerRight}>
          {lastUpdated && (
            <Text style={s.lastUpdated}>
              {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
          <View style={s.premiumBadge}>
            <Ionicons name="star" size={10} color="#FFD93D" />
            <Text style={s.premiumText}>Premium</Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#338DFF" colors={['#338DFF']} />
        }
      >
        {/* ALLOCATION */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>ALLOCATION</Text>
          {loading
            ? <ActivityIndicator color="#338DFF" style={{ marginVertical: 40 }} />
            : <DonutChart positions={positions} totalValue={totalValue} />
          }
        </View>
        

        {/* INCOME */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>INCOME</Text>
          <View style={s.card}>
            <View style={s.incomeRow}>
              <View style={s.incomeStat}>
                <Text style={s.incomeLabel}>Monthly</Text>
                <Text style={s.incomeValue}>
                  {monthlyIncome > 0
                    ? `$${monthlyIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '—'}
                </Text>
              </View>
              <View style={s.incomeDivider} />
              <View style={s.incomeStat}>
                <Text style={s.incomeLabel}>Annual</Text>
                <Text style={s.incomeValue}>
                  {annualIncome > 0
                    ? `$${annualIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* PERFORMANCE */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>PERFORMANCE</Text>
          <PortfolioAreaChart
            positions={positions}
            period={perfPeriod}
            onPeriodChange={setPerfPeriod}
          />
        </View>
        

        {/* ANALYTICS */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>ANALYTICS</Text>

          {/* Overlap Analyzer */}
          <View style={s.card}>
            <TouchableOpacity style={s.cardHeader} onPress={() => toggleCard('overlap')} activeOpacity={0.75}>
              <View style={[s.cardIcon, { backgroundColor: '#338DFF22' }]}>
                <Ionicons name="git-merge-outline" size={22} color="#338DFF" />
              </View>
              <View style={s.cardText}>
                <View style={s.cardTitleRow}>
                  <Text style={s.cardTitle}>Overlap Analyzer</Text>
                  <View style={s.newBadge}><Text style={s.newBadgeText}>NEW</Text></View>
                </View>
                <Text style={s.cardSub}>See how much your ETFs share the same holdings</Text>
              </View>
              <Ionicons name={expandedCard === 'overlap' ? 'chevron-up' : 'chevron-down'} size={16} color="#4A6080" />
            </TouchableOpacity>

            {expandedCard === 'overlap' && (
              <View style={s.expanded}>
                {loadingOverlap ? (
                  <View style={s.loadingRow}>
                    <ActivityIndicator size="small" color="#338DFF" />
                    <Text style={s.loadingText}>Fetching holdings…</Text>
                  </View>
                ) : pairs.length === 0 ? (
                  <Text style={s.emptyText}>Could not load holdings. Check your connection.</Text>
                ) : (
                  <>
                    {pairs.map((pair) => {
                      const pairKey = pair.etf1 + pair.etf2;
                      const isExpanded = expandedPair === pairKey;
                      return (
                        <View key={pairKey} style={s.pairBlock}>
                          {/* Score row — tappable */}
                          <TouchableOpacity
                            style={s.pairHeader}
                            onPress={() => {
                              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                              setExpandedPair(isExpanded ? null : pairKey);
                            }}
                            activeOpacity={0.75}
                            hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}
                          >
                            <View style={s.pairLeft}>
                              <View style={s.chip}><Text style={s.chipText}>{pair.etf1}</Text></View>
                              <Ionicons name="git-merge-outline" size={12} color="#4A6080" style={{ marginHorizontal: 4 }} />
                              <View style={s.chip}><Text style={s.chipText}>{pair.etf2}</Text></View>
                            </View>
                            <View style={s.pairRight}>
                              <Text style={[s.pairScore, { color: scoreColor(pair.score) }]}>{pair.score}</Text>
                              <Text style={[s.pairLabel, { color: scoreColor(pair.score) }]}>{scoreLabel(pair.score)}</Text>
                            </View>
                          </TouchableOpacity>

                          {/* Progress bar */}
                          <View style={s.barBg}>
                            <View style={[s.barFill, { width: `${pair.score}%` as any, backgroundColor: scoreColor(pair.score) }]} />
                          </View>

                          {/* "tap to expand" row — also tappable */}
                          <TouchableOpacity
                            onPress={() => {
                              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                              setExpandedPair(isExpanded ? null : pairKey);
                            }}
                            activeOpacity={0.7}
                            hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}
                          >
                            <Text style={s.sharedCount}>
                              {pair.sharedCount} shared holdings · {isExpanded ? 'tap to collapse ▲' : 'tap to expand ▼'}
                            </Text>
                          </TouchableOpacity>

                          {/* Expanded holdings table */}
                          {isExpanded && (
                            <View style={s.table}>
                              <View style={s.tableHead}>
                                <Text style={[s.tableCell, { flex: 2 }]}>Holding</Text>
                                <Text style={s.tableCell}>{pair.etf1}</Text>
                                <Text style={s.tableCell}>{pair.etf2}</Text>
                              </View>
                              {pair.sharedHoldings.map((h) => (
                                <View key={h.symbol} style={s.tableRow}>
                                  <View style={{ flex: 2 }}>
                                    <Text style={s.tableSymbol}>{h.symbol}</Text>
                                    <Text style={s.tableName} numberOfLines={1}>{h.name}</Text>
                                  </View>
                                  <Text style={s.tableWeight}>{h.w1.toFixed(1)}%</Text>
                                  <Text style={s.tableWeight}>{h.w2.toFixed(1)}%</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}

                    {overlappingHoldings.length > 0 && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[s.sectionTitle, { marginBottom: 8 }]}>IN MULTIPLE ETFs</Text>
                        {overlappingHoldings.map(([symbol, info]) => (
                          <View key={symbol} style={s.overlapRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={s.overlapSymbol}>{symbol}</Text>
                              <Text style={s.overlapName} numberOfLines={1}>{info.name}</Text>
                            </View>
                            <View style={s.chips}>
                              {info.etfs.map((e) => (
                                <View key={e} style={s.miniChip}><Text style={s.miniChipText}>{e}</Text></View>
                              ))}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {pairs[0] && (
                      <View style={s.insight}>
                        <Ionicons name="bulb-outline" size={14} color="#FF9F43" />
                        <Text style={s.insightText}>
                          {pairs[0].score >= 60
                            ? `${pairs[0].etf1} & ${pairs[0].etf2} have high overlap (${pairs[0].score}). Consider whether you need both.`
                            : pairs[0].score >= 30
                            ? `Moderate overlap between ${pairs[0].etf1} & ${pairs[0].etf2} (${pairs[0].score}). Reasonable diversification overall.`
                            : `Great diversification! All ETF pairs show low overlap.`}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </View>

          {/* Sector Exposure */}
          <View style={s.card}>
            <TouchableOpacity style={s.cardHeader} onPress={() => toggleCard('sector')} activeOpacity={0.75}>
              <View style={[s.cardIcon, { backgroundColor: '#00C89622' }]}>
                <Ionicons name="pie-chart-outline" size={22} color="#00C896" />
              </View>
              <View style={s.cardText}>
                <Text style={s.cardTitle}>Sector Exposure</Text>
                <Text style={s.cardSub}>Breakdown by sector across your entire portfolio</Text>
              </View>
              <Ionicons name={expandedCard === 'sector' ? 'chevron-up' : 'chevron-down'} size={16} color="#4A6080" />
            </TouchableOpacity>
            {expandedCard === 'sector' && (
              <View style={s.expanded}>
                {sectorData.length === 0 ? (
                  <View style={s.loadingRow}>
                    <ActivityIndicator size="small" color="#00C896" />
                    <Text style={s.loadingText}>Computing sector weights…</Text>
                  </View>
                ) : (
                  <>
                    {sectorData.map((sec) => (
                      <View key={sec.name} style={s.sectorRow}>
                        <View style={[s.sectorDot, { backgroundColor: sec.color }]} />
                        <Text style={s.sectorName}>{sec.name}</Text>
                        <View style={s.barBg}>
                          <View style={[s.barFill, {
                            width: `${Math.min((sec.pct / (sectorData[0]?.pct || 1)) * 100, 100)}%` as any,
                            backgroundColor: sec.color,
                          }]} />
                        </View>
                        <Text style={s.sectorPct}>{sec.pct}%</Text>
                      </View>
                    ))}
                    {topSector && (
                      <View style={s.insight}>
                        <Ionicons name="bulb-outline" size={14} color="#FF9F43" />
                        <Text style={s.insightText}>
                          {topSector.name} is your largest sector at {topSector.pct}%.
                          {topSector.pct > 35 ? ' Consider diversifying to reduce concentration.' : ' Sector allocation looks balanced.'}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </View>

          {/* Health Score */}
          <View style={s.card}>
            <TouchableOpacity style={s.cardHeader} onPress={() => toggleCard('health')} activeOpacity={0.75}>
              <View style={[s.cardIcon, { backgroundColor: '#FF9F4322' }]}>
                <Ionicons name="fitness-outline" size={22} color="#FF9F43" />
              </View>
              <View style={s.cardText}>
                <Text style={s.cardTitle}>Portfolio Health Score</Text>
                <Text style={s.cardSub}>Diversification, risk, and concentration rating</Text>
              </View>
              <View style={s.healthPill}>
                <Text style={[s.healthPillText, { color: overallHealth >= 70 ? '#00C896' : '#FF9F43' }]}>{overallHealth}</Text>
              </View>
              <Ionicons name={expandedCard === 'health' ? 'chevron-up' : 'chevron-down'} size={16} color="#4A6080" />
            </TouchableOpacity>
            {expandedCard === 'health' && (
              <View style={s.expanded}>
                {healthMetrics.map((m) => (
                  <View key={m.label} style={s.healthRow}>
                    <Text style={s.healthLabel}>{m.label}</Text>
                    <View style={s.barBg}>
                      <View style={[s.barFill, { width: `${m.score}%` as any, backgroundColor: m.color }]} />
                    </View>
                    <Text style={[s.healthScore, { color: m.color }]}>{m.score}</Text>
                  </View>
                ))}
                <View style={s.insight}>
                  <Ionicons name="bulb-outline" size={14} color="#FF9F43" />
                  <Text style={s.insightText}>
                    {overallHealth >= 80
                      ? 'Excellent portfolio health. Well diversified with low overlap.'
                      : overallHealth >= 60
                      ? 'Good diversification with moderate concentration risk.'
                      : 'Consider spreading across more ETFs to improve health score.'}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Dividend Forecast */}
          <View style={s.card}>
            <TouchableOpacity style={s.cardHeader} onPress={() => toggleCard('dividend')} activeOpacity={0.75}>
              <View style={[s.cardIcon, { backgroundColor: '#A78BFA22' }]}>
                <Ionicons name="trending-up-outline" size={22} color="#A78BFA" />
              </View>
              <View style={s.cardText}>
                <Text style={s.cardTitle}>Dividend Forecast</Text>
                <Text style={s.cardSub}>Projected income over the next 12 months</Text>
              </View>
              <Ionicons name={expandedCard === 'dividend' ? 'chevron-up' : 'chevron-down'} size={16} color="#4A6080" />
            </TouchableOpacity>
            {expandedCard === 'dividend' && (
              <View style={s.expanded}>
                <View style={s.divSummary}>
                  <View style={s.divStat}>
                    <Text style={s.divStatLabel}>Monthly</Text>
                    <Text style={s.divStatValue}>{monthlyIncome > 0 ? `$${monthlyIncome.toFixed(2)}` : '—'}</Text>
                  </View>
                  <View style={s.divDivider} />
                  <View style={s.divStat}>
                    <Text style={s.divStatLabel}>Annual</Text>
                    <Text style={s.divStatValue}>{annualIncome > 0 ? `$${annualIncome.toFixed(2)}` : '—'}</Text>
                  </View>
                  <View style={s.divDivider} />
                  <View style={s.divStat}>
                    <Text style={s.divStatLabel}>Yield</Text>
                    <Text style={[s.divStatValue, { color: '#00C896' }]}>
                      {totalValue > 0 ? `${((annualIncome / totalValue) * 100).toFixed(2)}%` : '—'}
                    </Text>
                  </View>
                </View>
                {positions.map((p) => {
                  const y = getYield(p.ticker);
                  const annual = p.value * y;
                  const isMonthly = ['JEPI', 'JEPQ', 'QQQI'].includes(p.ticker);
                  return (
                    <View key={p.ticker} style={s.divRow}>
                      <Text style={s.divTicker}>{p.ticker}</Text>
                      <Text style={s.divAnnual}>{annual > 0 ? `$${annual.toFixed(0)}/yr` : '—'}</Text>
                      <Text style={s.divYield}>{y > 0 ? `${(y * 100).toFixed(2)}%` : '—'}</Text>
                      <Text style={s.divFreq}>{isMonthly ? 'Monthly' : 'Quarterly'}</Text>
                    </View>
                  );
                })}
                <View style={s.insight}>
                  <Ionicons name="bulb-outline" size={14} color="#FF9F43" />
                  <Text style={s.insightText}>
                    {annualIncome > 0
                      ? `Est. annual income of $${annualIncome.toFixed(2)} based on trailing 12-month yields.`
                      : 'Add quantities in Setup to see your dividend forecast.'}
                  </Text>
                </View>
              </View>
            )}
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19' },
  scroll: { paddingBottom: 100 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: '#0B0F19',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#E8EEF8' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lastUpdated: { fontSize: 10, color: '#4A6080' },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFD93D22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  premiumText: { fontSize: 11, fontWeight: '700', color: '#FFD93D' },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 10, color: '#4A6080', letterSpacing: 1.5, marginBottom: 10 },
  card: { backgroundColor: '#141A26', borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  incomeRow: { flexDirection: 'row', padding: 20 },
  incomeStat: { flex: 1, alignItems: 'center' },
  incomeLabel: { fontSize: 11, color: '#4A6080', letterSpacing: 1, marginBottom: 6 },
  incomeValue: { fontSize: 22, fontWeight: '700', color: '#E8EEF8', fontVariant: ['tabular-nums'] },
  incomeDivider: { width: 0.5, backgroundColor: 'rgba(255,255,255,0.06)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  cardIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardText: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#E8EEF8' },
  cardSub: { fontSize: 11, color: '#4A6080', lineHeight: 16 },
  newBadge: { backgroundColor: '#338DFF22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  newBadgeText: { fontSize: 9, fontWeight: '700', color: '#338DFF', letterSpacing: 0.5 },
  expanded: { borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)', padding: 16 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  loadingText: { fontSize: 12, color: '#4A6080' },
  emptyText: { fontSize: 12, color: '#4A6080', paddingVertical: 8 },
  pairBlock: { marginBottom: 16 },
  pairHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pairLeft: { flexDirection: 'row', alignItems: 'center' },
  chip: { backgroundColor: '#1E2A3A', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: '700', color: '#E8EEF8' },
  pairRight: { alignItems: 'flex-end' },
  pairScore: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pairLabel: { fontSize: 10, fontWeight: '600' },
  barBg: { flex: 1, height: 4, backgroundColor: '#1E2A3A', borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  barFill: { height: '100%', borderRadius: 2 },
  sharedCount: { fontSize: 11, color: '#4A6080', marginBottom: 2, paddingVertical: 4 },
  table: { marginTop: 10, backgroundColor: '#0B0F19', borderRadius: 10, padding: 12 },
  tableHead: { flexDirection: 'row', marginBottom: 8 },
  tableCell: { flex: 1, fontSize: 10, color: '#4A6080', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)' },
  tableSymbol: { fontSize: 12, fontWeight: '700', color: '#E8EEF8' },
  tableName: { fontSize: 10, color: '#4A6080' },
  tableWeight: { flex: 1, fontSize: 12, color: '#C8D8F0', textAlign: 'right', fontVariant: ['tabular-nums'] },
  overlapRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)' },
  overlapSymbol: { fontSize: 12, fontWeight: '700', color: '#E8EEF8' },
  overlapName: { fontSize: 10, color: '#4A6080' },
  chips: { flexDirection: 'row', gap: 4 },
  miniChip: { backgroundColor: '#338DFF22', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  miniChipText: { fontSize: 9, fontWeight: '700', color: '#338DFF' },
  insight: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#FF9F4311', borderRadius: 10, borderWidth: 0.5, borderColor: '#FF9F4333', padding: 12, marginTop: 12 },
  insightText: { flex: 1, fontSize: 12, color: '#C8D8F0', lineHeight: 18 },
  sectorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectorDot: { width: 8, height: 8, borderRadius: 4 },
  sectorName: { width: 120, fontSize: 12, color: '#C8D8F0' },
  sectorPct: { width: 40, fontSize: 12, color: '#4A6080', textAlign: 'right' },
  healthPill: { backgroundColor: '#00C89622', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginRight: 4 },
  healthPillText: { fontSize: 16, fontWeight: '700' },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  healthLabel: { width: 130, fontSize: 12, color: '#C8D8F0' },
  healthScore: { width: 28, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  divSummary: { flexDirection: 'row', backgroundColor: '#0B0F19', borderRadius: 10, padding: 14, marginBottom: 14 },
  divStat: { flex: 1, alignItems: 'center' },
  divStatLabel: { fontSize: 10, color: '#4A6080', marginBottom: 4 },
  divStatValue: { fontSize: 15, fontWeight: '700', color: '#E8EEF8' },
  divDivider: { width: 0.5, backgroundColor: 'rgba(255,255,255,0.06)' },
  divRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)' },
  divTicker: { flex: 1, fontSize: 13, fontWeight: '700', color: '#E8EEF8' },
  divAnnual: { fontSize: 12, color: '#C8D8F0', width: 72 },
  divYield: { fontSize: 12, color: '#00C896', fontWeight: '600', width: 48 },
  divFreq: { fontSize: 11, color: '#4A6080', width: 64, textAlign: 'right' },
});