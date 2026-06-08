import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Dimensions, LayoutAnimation, Platform,
  RefreshControl, ScrollView, StatusBar, StyleSheet,
  Text, TouchableOpacity, UIManager, View,
} from 'react-native';
import Svg, { Circle, G, Polyline } from 'react-native-svg';
import { ETFPosition, usePortfolioData } from '../hooks/usePortfolioData';
import { getETFDividends, getETFHistory, getETFTopHoldings } from '../services/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Holding = { symbol: string; name: string; weight: number };
type HoldingsMap = Record<string, Holding[]>;

const PERF_PERIODS = ['Today', '1W', '1M', '3M', '6M', '1Y', '5Y'];
const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - 40; // full width minus horizontal padding
const CHART_H = 110;

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
  const SIZE = 180;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const RADIUS = 70;
  const STROKE_WIDTH = 22;
  const GAP_DEGREES = 3;
  const circumference = 2 * Math.PI * RADIUS;
  const hasValues = totalValue > 0;

  const items = hasValues
    ? positions.filter(p => p.value > 0)
    : positions.map(p => ({ ...p, value: 1 }));
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
            {hasValues
              ? `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
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
                {hasValues
                  ? `$${sl.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  : `${sl.pct}%`}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const dc = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8 },
  chartWrap: { position: 'relative', width: 180, height: 180 },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  centerLabel: { fontSize: 11, color: '#4A6080', marginBottom: 2 },
  centerValue: { fontSize: 13, fontWeight: '700', color: '#E8EEF8', fontVariant: ['tabular-nums'], textAlign: 'center' },
  legend: { flex: 1, paddingLeft: 16, gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendTicker: { fontSize: 12, color: '#E8EEF8', fontWeight: '600' },
  legendValue: { fontSize: 11, color: '#4A6080', fontVariant: ['tabular-nums'] },
});

// ── Performance Line Chart ────────────────────────────────────
function PortfolioLineChart({
  positions,
  period,
  onPeriodChange,
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
      // Fetch history for all tickers in parallel
      const tickersWithQty = positions.filter(p => p.qty > 0);
      if (tickersWithQty.length === 0) {
        // fallback: show price history of first ETF
        const hist = await getETFHistory(positions[0].ticker, period);
        if (cancelled) return;
        buildChart(hist.map(h => ({ ts: h.timestamp, val: h.close })));
        return;
      }

      const histories = await Promise.all(
        tickersWithQty.map(p => getETFHistory(p.ticker, period))
      );
      if (cancelled) return;

      // Align all series by timestamp count (use shortest)
      const minLen = Math.min(...histories.map(h => h.length));
      if (minLen === 0) { setLoading(false); return; }

      // For each time index, compute weighted portfolio value
      const combined: { ts: number; val: number }[] = [];
      for (let i = 0; i < minLen; i++) {
        const val = tickersWithQty.reduce((sum, p, idx) => {
          return sum + (histories[idx][i]?.close ?? 0) * p.qty;
        }, 0);
        combined.push({ ts: histories[0][i].timestamp, val });
      }
      buildChart(combined);
    }

    function buildChart(data: { ts: number; val: number }[]) {
      if (data.length < 2) { setLoading(false); return; }
      const vals = data.map(d => d.val);
      const minV = Math.min(...vals);
      const maxV = Math.max(...vals);
      const range = maxV - minV || 1;
      const PAD = 10;
      const pts = data.map((d, i) => ({
        x: (i / (data.length - 1)) * CHART_W,
        y: PAD + (1 - (d.val - minV) / range) * (CHART_H - PAD * 2),
      }));
      const pct = ((data[data.length - 1].val - data[0].val) / data[0].val) * 100;
      setPoints(pts);
      setPctChange(pct);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [period, positions.map(p => p.ticker + p.qty).join(',')]);

  const isPositive = (pctChange ?? 0) >= 0;
  const lineColor = isPositive ? '#00C896' : '#FF5A5F';
  const polyPoints = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <View style={lc.wrap}>
      {/* Period selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={lc.periodRow}>
          {PERF_PERIODS.map((p) => (
            <TouchableOpacity key={p} style={lc.periodBtn} onPress={() => onPeriodChange(p)}>
              <Text style={[lc.periodText, period === p && lc.periodTextActive]}>{p}</Text>
              {period === p && <View style={lc.periodUnderline} />}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Chart area */}
      <View style={lc.chartArea}>
        {loading ? (
          <ActivityIndicator color="#338DFF" style={{ marginVertical: 30 }} />
        ) : points.length > 1 ? (
          <View>
            <Svg width={CHART_W} height={CHART_H} style={{ overflow: 'visible' }}>
              <Polyline
                points={polyPoints}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            {/* % label at bottom-left, rotated -45deg */}
            <View style={lc.pctWrap}>
              <View style={lc.pctRotate}>
                <Text style={[lc.pctText, { color: lineColor }]}>
                  {isPositive ? '+' : ''}{pctChange?.toFixed(2)}%
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={lc.emptyWrap}>
            <Text style={lc.emptyText}>No data available</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const lc = StyleSheet.create({
  wrap: { paddingBottom: 12 },
  periodRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },
  periodBtn: { paddingHorizontal: 12, paddingBottom: 10, alignItems: 'center' },
  periodText: { fontSize: 13, color: '#4A6080', fontWeight: '500' },
  periodTextActive: { color: '#338DFF', fontWeight: '700' },
  periodUnderline: { height: 2, backgroundColor: '#338DFF', borderRadius: 1, width: '100%', marginTop: 4 },
  chartArea: { paddingHorizontal: 20, paddingTop: 8 },
  pctWrap: {
    position: 'absolute',
    bottom: -18,
    left: 0,
  },
  pctRotate: {
    transform: [{ rotate: '-45deg' }],
  },
  pctText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  emptyWrap: { height: CHART_H, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 12, color: '#4A6080' },
});

// ── Dynamic Health Score ──────────────────────────────────────
function computeHealthMetrics(
  positions: ETFPosition[],
  holdingsMap: HoldingsMap,
  totalValue: number,
): { label: string; score: number; color: string }[] {
  // 1. Diversification: more ETFs + spread = higher score
  const count = positions.filter(p => p.value > 0).length;
  const maxVal = Math.max(...positions.map(p => p.value), 1);
  const concentration = totalValue > 0 ? maxVal / totalValue : 1;
  const diversification = Math.min(100, Math.round((count / 6) * 60 + (1 - concentration) * 40));

  // 2. Concentration Risk: inverse of top holding weight
  const concRisk = Math.round((1 - concentration) * 100);

  // 3. Sector Balance: based on number of ETFs (proxy)
  const sectorBalance = Math.min(100, Math.round(50 + count * 8));

  // 4. Overlap Risk: average overlap across all pairs
  const etfs = Object.keys(holdingsMap);
  let totalOverlap = 0;
  let pairCount = 0;
  for (let i = 0; i < etfs.length; i++) {
    for (let j = i + 1; j < etfs.length; j++) {
      totalOverlap += overlapScore(holdingsMap[etfs[i]], holdingsMap[etfs[j]]);
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

  // Real dividend yields fetched from Yahoo Finance
  const [realYields, setRealYields] = useState<Record<string, number>>({});

  // Fallback yields
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

  // Fetch real dividend yields when positions load
  useEffect(() => {
    if (positions.length === 0) return;
    async function fetchYields() {
      const yields: Record<string, number> = {};
      await Promise.all(
        positions.map(async (p) => {
          try {
            const divs = await getETFDividends(p.ticker);
            if (divs.length >= 2 && p.price > 0) {
              // Sum last 12 months of dividends
              const annual = divs.slice(0, 12).reduce((sum, d) => sum + d.amount, 0);
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

  const getYield = (ticker: string) =>
    realYields[ticker] ?? FALLBACK_YIELDS[ticker] ?? 0;

  const annualIncome = positions.reduce((sum, p) => sum + p.value * getYield(p.ticker), 0);
  const monthlyIncome = annualIncome / 12;

  const myETFs = positions.map(p => p.ticker);

  const loadOverlap = async () => {
    if (Object.keys(holdingsMap).length > 0) return;
    setLoadingOverlap(true);
    const results: HoldingsMap = {};
    await Promise.all(
      myETFs.map(async (ticker) => {
        const h = await getETFTopHoldings(ticker);
        if (h.length) results[ticker] = h;
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

  // Overlap pairs
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

  // Dynamic health metrics
  const healthMetrics = computeHealthMetrics(positions, holdingsMap, totalValue);
  const overallHealth = Math.round(healthMetrics.reduce((a, m) => a + m.score, 0) / healthMetrics.length);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* ── STATIC HEADER ── */}
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

      {/* ── SCROLLABLE CONTENT ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#338DFF"
            colors={['#338DFF']}
          />
        }
      >
        {/* ALLOCATION */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>ALLOCATION</Text>
          <View style={s.card}>
            {loading ? (
              <ActivityIndicator color="#338DFF" style={{ marginVertical: 40 }} />
            ) : (
              <DonutChart positions={positions} totalValue={totalValue} />
            )}
          </View>
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

        {/* PERFORMANCE — no card wrapper, line chart */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>PERFORMANCE</Text>
          <View style={s.perfWrap}>
            <PortfolioLineChart
              positions={positions}
              period={perfPeriod} onPeriodChange={setPerfPeriod}
            />
          </View>
        </View>

        {/* Period selector lives OUTSIDE chart, drives perfPeriod */}
        {/* (moved inside PortfolioLineChart but needs to call setPerfPeriod in parent) */}

        {/* ANALYTICS */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>ANALYTICS</Text>

          {/* Overlap */}
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
                      return (
                        <View key={pairKey} style={s.pairBlock}>
                          <TouchableOpacity
                            style={s.pairHeader}
                            onPress={() => {
                              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                              setExpandedPair(expandedPair === pairKey ? null : pairKey);
                            }}
                            activeOpacity={0.75}
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
                          <View style={s.barBg}>
                            <View style={[s.barFill, { width: `${pair.score}%` as any, backgroundColor: scoreColor(pair.score) }]} />
                          </View>
                          <Text style={s.sharedCount}>{pair.sharedCount} shared holdings · tap to expand</Text>
                          {expandedPair === pairKey && (
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

          {/* Sector */}
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
                {[
                  { name: 'Technology', pct: 28.4, color: '#338DFF' },
                  { name: 'Financials', pct: 18.2, color: '#00C896' },
                  { name: 'Healthcare', pct: 12.7, color: '#A78BFA' },
                  { name: 'Industrials', pct: 10.1, color: '#FF9F43' },
                  { name: 'Consumer Disc.', pct: 9.3, color: '#FF5A5F' },
                  { name: 'Energy', pct: 7.8, color: '#FFD93D' },
                  { name: 'Other', pct: 13.5, color: '#4A6080' },
                ].map((sec) => (
                  <View key={sec.name} style={s.sectorRow}>
                    <View style={[s.sectorDot, { backgroundColor: sec.color }]} />
                    <Text style={s.sectorName}>{sec.name}</Text>
                    <View style={s.barBg}>
                      <View style={[s.barFill, { width: `${(sec.pct / 30) * 100}%` as any, backgroundColor: sec.color }]} />
                    </View>
                    <Text style={s.sectorPct}>{sec.pct}%</Text>
                  </View>
                ))}
                <View style={s.insight}>
                  <Ionicons name="bulb-outline" size={14} color="#FF9F43" />
                  <Text style={s.insightText}>Technology is your largest sector at 28.4%.</Text>
                </View>
              </View>
            )}
          </View>

          {/* Health Score — dynamic */}
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

          {/* Dividend Forecast — real yields */}
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
                    <Text style={s.divStatValue}>
                      {monthlyIncome > 0 ? `$${monthlyIncome.toFixed(2)}` : '—'}
                    </Text>
                  </View>
                  <View style={s.divDivider} />
                  <View style={s.divStat}>
                    <Text style={s.divStatLabel}>Annual</Text>
                    <Text style={s.divStatValue}>
                      {annualIncome > 0 ? `$${annualIncome.toFixed(2)}` : '—'}
                    </Text>
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
                  // Determine frequency from dividend history length
                  const isMonthly = ['JEPI', 'JEPQ', 'QQQI'].includes(p.ticker);
                  const freq = isMonthly ? 'Monthly' : 'Quarterly';
                  return (
                    <View key={p.ticker} style={s.divRow}>
                      <Text style={s.divTicker}>{p.ticker}</Text>
                      <Text style={s.divAnnual}>{annual > 0 ? `$${annual.toFixed(0)}/yr` : '—'}</Text>
                      <Text style={s.divYield}>{y > 0 ? `${(y * 100).toFixed(2)}%` : '—'}</Text>
                      <Text style={s.divFreq}>{freq}</Text>
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
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    backgroundColor: '#0B0F19',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#E8EEF8' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lastUpdated: { fontSize: 10, color: '#4A6080' },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFD93D22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  premiumText: { fontSize: 11, fontWeight: '700', color: '#FFD93D' },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 10, color: '#4A6080', letterSpacing: 1.5, marginBottom: 10 },
  card: { backgroundColor: '#141A26', borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  perfWrap: { paddingHorizontal: 0 },
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
  barBg: { height: 4, backgroundColor: '#1E2A3A', borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  barFill: { height: '100%', borderRadius: 2 },
  sharedCount: { fontSize: 11, color: '#4A6080', marginBottom: 2 },
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
  sectorName: { width: 110, fontSize: 12, color: '#C8D8F0' },
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