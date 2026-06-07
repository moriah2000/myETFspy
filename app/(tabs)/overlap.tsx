import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator, LayoutAnimation, Platform,
  RefreshControl, ScrollView, StatusBar, StyleSheet,
  Text, TouchableOpacity, UIManager, View,
} from 'react-native';
import Svg, { Circle, G, Polyline } from 'react-native-svg';
import { ETFPosition, usePortfolioData } from '../hooks/usePortfolioData';
import { getETFTopHoldings } from '../services/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Holding = { symbol: string; name: string; weight: number };
type HoldingsMap = Record<string, Holding[]>;

function computeShared(h1: Holding[], h2: Holding[]) {
  const map2 = new Map(h2.map((h) => [h.symbol, h]));
  return h1
    .filter((h) => h.symbol && map2.has(h.symbol))
    .map((h) => ({ symbol: h.symbol, name: h.name, w1: h.weight, w2: map2.get(h.symbol)!.weight }))
    .sort((a, b) => b.w1 + b.w2 - (a.w1 + a.w2));
}

function overlapScore(h1: Holding[], h2: Holding[]): number {
  const shared = computeShared(h1, h2);
  return Math.min(Math.round(shared.reduce((acc, h) => acc + Math.min(h.w1, h.w2), 0)), 100);
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

const SECTOR_DATA = [
  { name: 'Technology', pct: 28.4, color: '#338DFF' },
  { name: 'Financials', pct: 18.2, color: '#00C896' },
  { name: 'Healthcare', pct: 12.7, color: '#A78BFA' },
  { name: 'Industrials', pct: 10.1, color: '#FF9F43' },
  { name: 'Consumer Disc.', pct: 9.3, color: '#FF5A5F' },
  { name: 'Energy', pct: 7.8, color: '#FFD93D' },
  { name: 'Other', pct: 13.5, color: '#4A6080' },
];

const HEALTH_METRICS = [
  { label: 'Diversification', score: 82, color: '#00C896' },
  { label: 'Concentration Risk', score: 34, color: '#FF9F43' },
  { label: 'Sector Balance', score: 71, color: '#338DFF' },
  { label: 'Overlap Risk', score: 45, color: '#FF9F43' },
];

// ── Sparkline ────────────────────────────────────────────────
function Sparkline({ color = '#00C896', width = 120, height = 36 }: { color?: string; width?: number; height?: number }) {
  const points = [0, 4, 2, 8, 5, 10, 7, 14, 11, 16, 13, 18, 15, 20, 18, 24, 20, 28, 22, 26, 25, 30, 28, 34, 30, 36];
  const max = Math.max(...points.filter((_, i) => i % 2 === 1));
  const coords = points.reduce((acc, val, i) => {
    if (i % 2 === 0) return acc;
    const x = (points[i - 1] / 30) * width;
    const y = height - (val / max) * (height - 4) - 2;
    return acc + `${x},${y} `;
  }, '');
  return (
    <Svg width={width} height={height}>
      <Polyline points={coords.trim()} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Donut Chart ──────────────────────────────────────────────
function DonutChart({ positions, totalValue }: { positions: ETFPosition[]; totalValue: number }) {
  const SIZE = 160;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const STROKE = 22;
  const R = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const GAP = 3;

  const hasValues = totalValue > 0;
  const items = hasValues
    ? positions.filter(p => p.value > 0)
    : positions;

  const slices: { color: string; ticker: string; pct: number; dash: number; offset: number }[] = [];
  let cumulative = 0;

  items.forEach((p) => {
    const pct = hasValues ? p.value / totalValue : 1 / items.length;
    const dash = Math.max(pct * CIRCUMFERENCE - GAP, 0);
    const offset = CIRCUMFERENCE * 0.25 - cumulative * CIRCUMFERENCE;
    slices.push({ color: p.color, ticker: p.ticker, pct: Math.round(pct * 100), dash, offset });
    cumulative += pct;
  });

  return (
    <View style={dStyles.row}>
      {/* Chart */}
      <View style={dStyles.chartWrap}>
        <Svg width={SIZE} height={SIZE}>
          <G>
            {slices.map((sl) => (
              <Circle
                key={sl.ticker}
                cx={cx} cy={cy} r={R}
                fill="none"
                stroke={sl.color}
                strokeWidth={STROKE}
                strokeDasharray={`${sl.dash} ${CIRCUMFERENCE - sl.dash}`}
                strokeDashoffset={sl.offset}
                strokeLinecap="butt"
              />
            ))}
          </G>
        </Svg>
        <View style={dStyles.center}>
          <Text style={dStyles.centerLabel}>Total</Text>
          <Text style={dStyles.centerValue}>
            {hasValues
              ? `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
          </Text>
        </View>
      </View>

      {/* Legend */}
      <View style={dStyles.legend}>
        {slices.map((sl) => (
          <View key={sl.ticker} style={dStyles.legendItem}>
            <View style={[dStyles.legendDot, { backgroundColor: sl.color }]} />
            <View>
              <Text style={dStyles.legendTicker}>{sl.ticker}</Text>
              <Text style={dStyles.legendPct}>{sl.pct}%</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const dStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  chartWrap: { width: 160, height: 160, position: 'relative' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  centerLabel: { fontSize: 11, color: '#4A6080', marginBottom: 2 },
  centerValue: { fontSize: 13, fontWeight: '700', color: '#E8EEF8', fontVariant: ['tabular-nums'], textAlign: 'center' },
  legend: { flex: 1, paddingLeft: 16, gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendTicker: { fontSize: 12, fontWeight: '600', color: '#E8EEF8' },
  legendPct: { fontSize: 10, color: '#4A6080' },
});

// ── Main ─────────────────────────────────────────────────────
export default function PortfolioScreen() {
  const { positions, loading, totalValue, totalChange, hasValues, refresh } = usePortfolioData();
  const [refreshing, setRefreshing] = useState(false);
  const [holdingsMap, setHoldingsMap] = useState<HoldingsMap>({});
  const [loadingOverlap, setLoadingOverlap] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [expandedPair, setExpandedPair] = useState<string | null>(null);
  const [period, setPeriod] = useState<'Annual' | 'Monthly'>('Annual');

  const myETFs = positions.map(p => p.ticker);

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  const loadOverlap = async () => {
    if (Object.keys(holdingsMap).length > 0) return;
    setLoadingOverlap(true);
    const results: HoldingsMap = {};
    await Promise.all(myETFs.map(async (ticker) => {
      const h = await getETFTopHoldings(ticker);
      if (h.length) results[ticker] = h;
    }));
    setHoldingsMap(results);
    setLoadingOverlap(false);
  };

  function toggleCard(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (id === 'overlap') loadOverlap();
    setExpandedCard(expandedCard === id ? null : id);
  }

  const etfs = Object.keys(holdingsMap);
  const pairs: { etf1: string; etf2: string; score: number; sharedCount: number; sharedHoldings: { symbol: string; name: string; w1: number; w2: number }[] }[] = [];
  for (let i = 0; i < etfs.length; i++) {
    for (let j = i + 1; j < etfs.length; j++) {
      const e1 = etfs[i], e2 = etfs[j];
      const shared = computeShared(holdingsMap[e1], holdingsMap[e2]);
      pairs.push({ etf1: e1, etf2: e2, score: overlapScore(holdingsMap[e1], holdingsMap[e2]), sharedCount: shared.length, sharedHoldings: shared });
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  const allSymbols = new Map<string, { name: string; etfs: string[] }>();
  etfs.forEach((ticker) => {
    holdingsMap[ticker]?.forEach((h) => {
      if (!h.symbol) return;
      const ex = allSymbols.get(h.symbol);
      if (ex) ex.etfs.push(ticker); else allSymbols.set(h.symbol, { name: h.name, etfs: [ticker] });
    });
  });
  const overlappingHoldings = Array.from(allSymbols.entries()).filter(([, v]) => v.etfs.length > 1).sort((a, b) => b[1].etfs.length - a[1].etfs.length).slice(0, 8);
  const overallHealth = Math.round(HEALTH_METRICS.reduce((a, m) => a + m.score, 0) / HEALTH_METRICS.length);

  // Income (real dividend yields × position values)
  const YIELDS: Record<string, number> = { SCHD: 0.0365, VTI: 0.0152, QQQM: 0.0064, JEPI: 0.0819, JEPQ: 0.0950, SPY: 0.0128, VOO: 0.0128, VXUS: 0.0280, QQQI: 0.0120 };
  const annualIncome = positions.reduce((sum, p) => sum + p.value * (YIELDS[p.ticker] || 0.02), 0);
  const monthlyIncome = annualIncome / 12;

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#338DFF" colors={['#338DFF']} />}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Portfolio</Text>
          <TouchableOpacity style={s.periodToggle} onPress={() => setPeriod(p => p === 'Annual' ? 'Monthly' : 'Annual')}>
            <Text style={s.periodText}>{period}</Text>
            <Ionicons name="chevron-down" size={12} color="#C8D8F0" />
          </TouchableOpacity>
        </View>

        {/* Allocation Card */}
        <View style={s.allocationCard}>
          <Text style={s.cardSectionTitle}>Allocation</Text>
          {loading ? (
            <ActivityIndicator color="#338DFF" style={{ marginVertical: 40 }} />
          ) : (
            <DonutChart positions={positions} totalValue={totalValue} />
          )}
        </View>

        {/* Income Card */}
        <View style={s.incomeCard}>
          <Text style={s.cardSectionTitle}>Income</Text>
          <View style={s.incomeRow}>
            <View style={s.incomeStat}>
              <Text style={s.incomeLabel}>Monthly</Text>
              <Text style={s.incomeValue}>
                {monthlyIncome > 0 ? `$${monthlyIncome.toFixed(2)}` : '—'}
              </Text>
            </View>
            <View style={s.incomeStatDivider} />
            <View style={s.incomeStat}>
              <Text style={s.incomeLabel}>Annual</Text>
              <Text style={s.incomeValue}>
                {annualIncome > 0 ? `$${annualIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Performance Card */}
        <View style={s.performanceCard}>
          <Text style={s.cardSectionTitle}>Performance (1Y)</Text>
          <View style={s.perfRow}>
            <View>
              <Text style={s.perfValue}>
                {hasValues
                  ? `${totalChange >= 0 ? '+' : ''}${((totalChange / totalValue) * 100).toFixed(2)}%`
                  : '—'}
              </Text>
            </View>
            <Sparkline color="#00C896" width={140} height={40} />
          </View>
        </View>

        {/* YOUR ETFs */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>YOUR ETFs</Text>
          <View style={s.etfCard}>
            {positions.map((etf) => (
              <View key={etf.ticker} style={s.etfRow}>
                <View style={[s.etfDot, { backgroundColor: etf.color }]} />
                <Text style={s.etfTicker}>{etf.ticker}</Text>
                <View style={s.etfMid}>
                  <Text style={s.etfPrice}>{etf.price > 0 ? `$${etf.price.toFixed(2)}` : '—'}</Text>
                  {etf.value > 0 && <Text style={s.etfHolding}>${etf.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>}
                </View>
                <Text style={[s.etfChange, { color: etf.pct >= 0 ? '#00C896' : '#FF5A5F' }]}>
                  {etf.pct >= 0 ? '+' : ''}{etf.pct.toFixed(2)}%
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ANALYTICS */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>ANALYTICS</Text>

          {/* ① Overlap */}
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
                  <View style={s.loadingRow}><ActivityIndicator size="small" color="#338DFF" /><Text style={s.loadingText}>Fetching holdings…</Text></View>
                ) : pairs.length === 0 ? (
                  <Text style={s.emptyText}>Could not load holdings. Check your connection.</Text>
                ) : (
                  <>
                    {pairs.map((pair) => {
                      const pairKey = pair.etf1 + pair.etf2;
                      return (
                        <View key={pairKey} style={s.pairBlock}>
                          <TouchableOpacity style={s.pairHeader} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpandedPair(expandedPair === pairKey ? null : pairKey); }} activeOpacity={0.75}>
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
                          <View style={s.barBg}><View style={[s.barFill, { width: `${pair.score}%` as any, backgroundColor: scoreColor(pair.score) }]} /></View>
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
                                  <View style={{ flex: 2 }}><Text style={s.tableSymbol}>{h.symbol}</Text><Text style={s.tableName} numberOfLines={1}>{h.name}</Text></View>
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
                            <View style={{ flex: 1 }}><Text style={s.overlapSymbol}>{symbol}</Text><Text style={s.overlapName} numberOfLines={1}>{info.name}</Text></View>
                            <View style={s.chips}>{info.etfs.map((e) => (<View key={e} style={s.miniChip}><Text style={s.miniChipText}>{e}</Text></View>))}</View>
                          </View>
                        ))}
                      </View>
                    )}
                    {pairs[0] && (
                      <View style={s.insight}>
                        <Ionicons name="bulb-outline" size={14} color="#FF9F43" />
                        <Text style={s.insightText}>
                          {pairs[0].score >= 60 ? `${pairs[0].etf1} & ${pairs[0].etf2} have high overlap (${pairs[0].score}). Consider whether you need both.`
                            : pairs[0].score >= 30 ? `Moderate overlap between ${pairs[0].etf1} & ${pairs[0].etf2} (${pairs[0].score}). Reasonable diversification overall.`
                            : `Great diversification! All ETF pairs show low overlap.`}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </View>

          {/* ② Sector */}
          <View style={s.card}>
            <TouchableOpacity style={s.cardHeader} onPress={() => toggleCard('sector')} activeOpacity={0.75}>
              <View style={[s.cardIcon, { backgroundColor: '#00C89622' }]}><Ionicons name="pie-chart-outline" size={22} color="#00C896" /></View>
              <View style={s.cardText}><Text style={s.cardTitle}>Sector Exposure</Text><Text style={s.cardSub}>Breakdown by sector across your entire portfolio</Text></View>
              <Ionicons name={expandedCard === 'sector' ? 'chevron-up' : 'chevron-down'} size={16} color="#4A6080" />
            </TouchableOpacity>
            {expandedCard === 'sector' && (
              <View style={s.expanded}>
                {SECTOR_DATA.map((sec) => (
                  <View key={sec.name} style={s.sectorRow}>
                    <View style={[s.sectorDot, { backgroundColor: sec.color }]} />
                    <Text style={s.sectorName}>{sec.name}</Text>
                    <View style={s.barBg}><View style={[s.barFill, { width: `${(sec.pct / 30) * 100}%` as any, backgroundColor: sec.color }]} /></View>
                    <Text style={s.sectorPct}>{sec.pct}%</Text>
                  </View>
                ))}
                <View style={s.insight}><Ionicons name="bulb-outline" size={14} color="#FF9F43" /><Text style={s.insightText}>Technology is your largest sector at 28.4%.</Text></View>
              </View>
            )}
          </View>

          {/* ③ Health */}
          <View style={s.card}>
            <TouchableOpacity style={s.cardHeader} onPress={() => toggleCard('health')} activeOpacity={0.75}>
              <View style={[s.cardIcon, { backgroundColor: '#FF9F4322' }]}><Ionicons name="fitness-outline" size={22} color="#FF9F43" /></View>
              <View style={s.cardText}><Text style={s.cardTitle}>Portfolio Health Score</Text><Text style={s.cardSub}>Diversification, risk, and concentration rating</Text></View>
              <View style={s.healthPill}><Text style={[s.healthPillText, { color: overallHealth >= 70 ? '#00C896' : '#FF9F43' }]}>{overallHealth}</Text></View>
              <Ionicons name={expandedCard === 'health' ? 'chevron-up' : 'chevron-down'} size={16} color="#4A6080" />
            </TouchableOpacity>
            {expandedCard === 'health' && (
              <View style={s.expanded}>
                {HEALTH_METRICS.map((m) => (
                  <View key={m.label} style={s.healthRow}>
                    <Text style={s.healthLabel}>{m.label}</Text>
                    <View style={s.barBg}><View style={[s.barFill, { width: `${m.score}%` as any, backgroundColor: m.color }]} /></View>
                    <Text style={[s.healthScore, { color: m.color }]}>{m.score}</Text>
                  </View>
                ))}
                <View style={s.insight}><Ionicons name="bulb-outline" size={14} color="#FF9F43" /><Text style={s.insightText}>Your portfolio scores well on diversification but has moderate concentration risk.</Text></View>
              </View>
            )}
          </View>

          {/* ④ Dividend */}
          <View style={s.card}>
            <TouchableOpacity style={s.cardHeader} onPress={() => toggleCard('dividend')} activeOpacity={0.75}>
              <View style={[s.cardIcon, { backgroundColor: '#A78BFA22' }]}><Ionicons name="trending-up-outline" size={22} color="#A78BFA" /></View>
              <View style={s.cardText}><Text style={s.cardTitle}>Dividend Forecast</Text><Text style={s.cardSub}>Projected income over the next 12 months</Text></View>
              <Ionicons name={expandedCard === 'dividend' ? 'chevron-up' : 'chevron-down'} size={16} color="#4A6080" />
            </TouchableOpacity>
            {expandedCard === 'dividend' && (
              <View style={s.expanded}>
                <View style={s.divSummary}>
                  <View style={s.divStat}><Text style={s.divStatLabel}>Monthly</Text><Text style={s.divStatValue}>{monthlyIncome > 0 ? `$${monthlyIncome.toFixed(2)}` : '—'}</Text></View>
                  <View style={s.divDivider} />
                  <View style={s.divStat}><Text style={s.divStatLabel}>Annual</Text><Text style={s.divStatValue}>{annualIncome > 0 ? `$${annualIncome.toFixed(2)}` : '—'}</Text></View>
                  <View style={s.divDivider} />
                  <View style={s.divStat}><Text style={s.divStatLabel}>Yield</Text><Text style={[s.divStatValue, { color: '#00C896' }]}>{totalValue > 0 ? `${((annualIncome / totalValue) * 100).toFixed(2)}%` : '—'}</Text></View>
                </View>
                {positions.map((p) => {
                  const yld = YIELDS[p.ticker] || 0.02;
                  const ann = p.value * yld;
                  return (
                    <View key={p.ticker} style={s.divRow}>
                      <Text style={s.divTicker}>{p.ticker}</Text>
                      <Text style={s.divAnnual}>{ann > 0 ? `$${ann.toFixed(0)}/yr` : '—'}</Text>
                      <Text style={s.divYield}>{(yld * 100).toFixed(2)}%</Text>
                      <Text style={s.divFreq}>{['JEPI', 'JEPQ'].includes(p.ticker) ? 'Monthly' : 'Quarterly'}</Text>
                    </View>
                  );
                })}
                <View style={s.insight}><Ionicons name="bulb-outline" size={14} color="#FF9F43" /><Text style={s.insightText}>Income calculated using current dividend yields × your position values.</Text></View>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#E8EEF8' },
  periodToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1E2A3A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  periodText: { fontSize: 13, color: '#C8D8F0', fontWeight: '500' },
  allocationCard: { marginHorizontal: 20, marginBottom: 12, backgroundColor: '#141A26', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', padding: 20 },
  incomeCard: { marginHorizontal: 20, marginBottom: 12, backgroundColor: '#141A26', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', padding: 20 },
  performanceCard: { marginHorizontal: 20, marginBottom: 24, backgroundColor: '#141A26', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', padding: 20 },
  cardSectionTitle: { fontSize: 13, fontWeight: '600', color: '#C8D8F0', marginBottom: 16 },
  incomeRow: { flexDirection: 'row' },
  incomeStat: { flex: 1, alignItems: 'center' },
  incomeLabel: { fontSize: 11, color: '#4A6080', marginBottom: 6 },
  incomeValue: { fontSize: 22, fontWeight: '700', color: '#E8EEF8', fontVariant: ['tabular-nums'] },
  incomeStatDivider: { width: 0.5, backgroundColor: 'rgba(255,255,255,0.06)' },
  perfRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  perfValue: { fontSize: 28, fontWeight: '700', color: '#00C896' },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 10, color: '#4A6080', letterSpacing: 1.5, marginBottom: 12 },
  etfCard: { backgroundColor: '#141A26', borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 16, overflow: 'hidden' },
  etfRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)', gap: 8 },
  etfDot: { width: 6, height: 6, borderRadius: 3 },
  etfTicker: { width: 48, fontSize: 14, fontWeight: '700', color: '#E8EEF8' },
  etfMid: { flex: 1 },
  etfPrice: { fontSize: 14, color: '#C8D8F0', fontVariant: ['tabular-nums'] },
  etfHolding: { fontSize: 11, color: '#4A6080', fontVariant: ['tabular-nums'] },
  etfChange: { fontSize: 13, fontWeight: '600', width: 64, textAlign: 'right' },
  card: { backgroundColor: '#141A26', borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 10, overflow: 'hidden' },
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