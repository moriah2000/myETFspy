import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { getETFPrice, getETFTopHoldings } from '../services/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Holding = { symbol: string; name: string; weight: number };
type HoldingsMap = Record<string, Holding[]>;
type LiveETF = { ticker: string; price: number; change: number; pct: number; value: number };

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

const ETF_COLORS: Record<string, string> = {
  SCHD: '#338DFF', VTI: '#00C896', QQQM: '#FF9F43',
  JEPI: '#A78BFA', JEPQ: '#FF5A5F', SPY: '#66AFFF',
  VOO: '#004F98', VXUS: '#FFD93D', QQQI: '#E879F9',
};

export default function PortfolioScreen() {
  const [myETFs, setMyETFs] = useState<string[]>(['SCHD', 'VTI', 'QQQM', 'JEPI']);
  const [liveETFs, setLiveETFs] = useState<LiveETF[]>([]);
  const [holdingsMap, setHoldingsMap] = useState<HoldingsMap>({});
  const [loadingOverlap, setLoadingOverlap] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [expandedPair, setExpandedPair] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('userETFs').then(async (val) => {
      const tickers: string[] = val ? JSON.parse(val) : ['SCHD', 'VTI', 'QQQM', 'JEPI'];
      if (tickers.length > 0) setMyETFs(tickers);

      const holdingsRaw = await AsyncStorage.getItem('userHoldings');
      const holdingsData = holdingsRaw ? JSON.parse(holdingsRaw) : {};

      const prices = await Promise.all(tickers.map((t) => getETFPrice(t)));
      const data: LiveETF[] = tickers.map((ticker, i) => {
        const p = prices[i];
        const qty = parseFloat(holdingsData[ticker]?.qty || '0');
        return {
          ticker,
          price: p?.price ?? 0,
          change: p?.change ?? 0,
          pct: p?.changesPercentage ?? 0,
          value: qty > 0 ? qty * (p?.price ?? 0) : 0,
        };
      });
      setLiveETFs(data);
    });
  }, []);

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

  const overallHealth = Math.round(
    HEALTH_METRICS.reduce((a, m) => a + m.score, 0) / HEALTH_METRICS.length
  );

  const totalValue = liveETFs.reduce((sum, e) => sum + e.value, 0);
  const totalChange = liveETFs.reduce((sum, e) => sum + e.change, 0);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Portfolio</Text>
          <View style={s.premiumBadge}>
            <Ionicons name="star" size={10} color="#FFD93D" />
            <Text style={s.premiumText}>Premium</Text>
          </View>
        </View>

        {/* Hero */}
        <View style={s.heroCard}>
          <Text style={s.heroLabel}>TOTAL PORTFOLIO VALUE</Text>
          <Text style={s.heroValue}>
            {totalValue > 0
              ? `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
          </Text>
          {totalValue > 0 ? (
            <View style={s.heroRow}>
              <Ionicons name={totalChange >= 0 ? 'arrow-up' : 'arrow-down'} size={12} color={totalChange >= 0 ? '#00C896' : '#FF5A5F'} />
              <Text style={[s.heroChange, { color: totalChange >= 0 ? '#00C896' : '#FF5A5F' }]}>
                {totalChange >= 0 ? '+' : ''}${Math.abs(totalChange).toFixed(2)} Today
              </Text>
            </View>
          ) : (
            <Text style={s.heroHint}>Add quantities in Setup to see your total value</Text>
          )}
          <View style={s.heroStats}>
            <View style={s.heroStat}>
              <Text style={s.heroStatLabel}>Total Return (1Y)</Text>
              <Text style={[s.heroStatValue, { color: '#00C896' }]}>—</Text>
            </View>
            <View style={s.heroStatDivider} />
            <View style={s.heroStat}>
              <Text style={s.heroStatLabel}>Est. Annual Income</Text>
              <Text style={s.heroStatValue}>—</Text>
            </View>
          </View>
        </View>

        {/* ETF List */}
        <View style={s.section}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>YOUR ETFs</Text>
            <TouchableOpacity><Text style={s.viewAll}>View All</Text></TouchableOpacity>
          </View>
          {(liveETFs.length > 0 ? liveETFs : myETFs.map(t => ({ ticker: t, price: 0, change: 0, pct: 0, value: 0 }))).map((etf) => (
            <View key={etf.ticker} style={s.etfRow}>
              <View style={[s.etfDot, { backgroundColor: ETF_COLORS[etf.ticker] || '#338DFF' }]} />
              <Text style={s.etfTicker}>{etf.ticker}</Text>
              <View style={s.etfMid}>
                <Text style={s.etfPrice}>{etf.price > 0 ? `$${etf.price.toFixed(2)}` : '—'}</Text>
                {etf.value > 0 && (
                  <Text style={s.etfHolding}>${etf.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                )}
              </View>
              <Text style={[s.etfChange, { color: etf.pct >= 0 ? '#00C896' : '#FF5A5F' }]}>
                {etf.pct >= 0 ? '+' : ''}{etf.pct.toFixed(2)}%
              </Text>
            </View>
          ))}
        </View>

        {/* Allocation */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>ALLOCATION</Text>
          {(liveETFs.length > 0 ? liveETFs : myETFs.map((t, i) => ({
            ticker: t, pct: Math.round(100 / myETFs.length),
            color: ETF_COLORS[t] || '#338DFF',
          }))).map((item, i) => {
            const total = liveETFs.reduce((sum, e) => sum + e.value, 0);
            const pct = total > 0
              ? Math.round(((liveETFs[i]?.value || 0) / total) * 100)
              : Math.round(100 / myETFs.length);
            return (
              <View key={item.ticker} style={s.allocRow}>
                <Text style={s.allocTicker}>{item.ticker}</Text>
                <View style={s.allocBarBg}>
                  <View style={[s.allocBarFill, {
                    width: `${pct}%` as any,
                    backgroundColor: ETF_COLORS[item.ticker] || '#338DFF'
                  }]} />
                </View>
                <Text style={s.allocPct}>{pct}%</Text>
              </View>
            );
          })}
        </View>

        {/* ── ANALYTICS ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>ANALYTICS</Text>

          {/* ① Overlap Analyzer */}
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
                    <Text style={s.loadingText}>Fetching holdings from Yahoo Finance…</Text>
                  </View>
                ) : pairs.length === 0 ? (
                  <Text style={s.emptyText}>Could not load holdings. Check your connection and try again.</Text>
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

          {/* ② Sector Exposure */}
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
                {SECTOR_DATA.map((sec) => (
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
                  <Text style={s.insightText}>Technology is your largest sector at 28.4%. Consider if you're comfortable with this concentration.</Text>
                </View>
              </View>
            )}
          </View>

          {/* ③ Portfolio Health Score */}
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
                {HEALTH_METRICS.map((m) => (
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
                  <Text style={s.insightText}>Your portfolio scores well on diversification but has moderate concentration risk. Overall health is solid.</Text>
                </View>
              </View>
            )}
          </View>

          {/* ④ Dividend Forecast */}
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
                    <Text style={s.divStatValue}>$478.52</Text>
                  </View>
                  <View style={s.divDivider} />
                  <View style={s.divStat}>
                    <Text style={s.divStatLabel}>Annual</Text>
                    <Text style={s.divStatValue}>$5,742.20</Text>
                  </View>
                  <View style={s.divDivider} />
                  <View style={s.divStat}>
                    <Text style={s.divStatLabel}>Yield</Text>
                    <Text style={[s.divStatValue, { color: '#00C896' }]}>4.61%</Text>
                  </View>
                </View>
                {[
                  { ticker: 'SCHD', annual: '$2,820', yield: '3.65%', freq: 'Quarterly' },
                  { ticker: 'JEPI', annual: '$1,448', yield: '8.19%', freq: 'Monthly' },
                  { ticker: 'VTI', annual: '$964', yield: '1.52%', freq: 'Quarterly' },
                  { ticker: 'QQQM', annual: '$510', yield: '0.64%', freq: 'Quarterly' },
                ].map((d) => (
                  <View key={d.ticker} style={s.divRow}>
                    <Text style={s.divTicker}>{d.ticker}</Text>
                    <Text style={s.divAnnual}>{d.annual}/yr</Text>
                    <Text style={s.divYield}>{d.yield}</Text>
                    <Text style={s.divFreq}>{d.freq}</Text>
                  </View>
                ))}
                <View style={s.insight}>
                  <Ionicons name="bulb-outline" size={14} color="#FF9F43" />
                  <Text style={s.insightText}>JEPI contributes the most dividend income despite being your smallest position. Great yield-per-dollar efficiency.</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#E8EEF8' },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFD93D22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  premiumText: { fontSize: 11, fontWeight: '700', color: '#FFD93D' },
  heroCard: { marginHorizontal: 20, marginBottom: 24, backgroundColor: '#141A26', borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', padding: 20 },
  heroLabel: { fontSize: 10, color: '#4A6080', letterSpacing: 1.5, marginBottom: 6 },
  heroValue: { fontSize: 34, fontWeight: '700', color: '#E8EEF8', fontVariant: ['tabular-nums'], marginBottom: 6 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  heroChange: { fontSize: 13, fontWeight: '600' },
  heroHint: { fontSize: 12, color: '#4A6080', fontStyle: 'italic', marginBottom: 16 },
  heroStats: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 14 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatLabel: { fontSize: 10, color: '#4A6080', marginBottom: 4 },
  heroStatValue: { fontSize: 14, fontWeight: '600', color: '#E8EEF8' },
  heroStatDivider: { width: 0.5, backgroundColor: 'rgba(255,255,255,0.06)' },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 10, color: '#4A6080', letterSpacing: 1.5, marginBottom: 12 },
  viewAll: { fontSize: 12, color: '#338DFF' },
  etfRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)', gap: 8 },
  etfDot: { width: 6, height: 6, borderRadius: 3 },
  etfTicker: { width: 48, fontSize: 14, fontWeight: '700', color: '#E8EEF8' },
  etfMid: { flex: 1 },
  etfPrice: { fontSize: 14, color: '#C8D8F0', fontVariant: ['tabular-nums'] },
  etfHolding: { fontSize: 11, color: '#4A6080', fontVariant: ['tabular-nums'] },
  etfChange: { fontSize: 13, fontWeight: '600', width: 64, textAlign: 'right' },
  allocRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  allocTicker: { width: 44, fontSize: 12, color: '#C8D8F0', fontWeight: '600' },
  allocBarBg: { flex: 1, height: 6, backgroundColor: '#1E2A3A', borderRadius: 3, overflow: 'hidden', marginHorizontal: 10 },
  allocBarFill: { height: '100%', borderRadius: 3 },
  allocPct: { width: 32, fontSize: 12, color: '#4A6080', textAlign: 'right' },
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