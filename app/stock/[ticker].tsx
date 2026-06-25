import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Dimensions, LayoutAnimation, Platform, ScrollView, StatusBar,
  StyleSheet, Switch, Text, TouchableOpacity, UIManager, View,
} from 'react-native';
import TransactionRow, { TransactionRowData } from '../../components/TransactionRow';
import { usePortfolioTransactions } from '../hooks/usePortfolioTransactions';
import { calculatePositionFIFO } from '../hooks/useTransactionEngine';

import InteractiveChart from '../../components/InteractiveChart';
import { useSingleChartPoints } from '../hooks/useChartPoints';
import {
  StockSummary, formatMarketCap, formatVolume,
  getETFDividends, getETFHistory, getETFPrice, getStockSummary,
} from '../services/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TABS = ['Overview', 'Financials', 'Dividends', 'Alerts'];
const CHART_PERIODS = ['1D', '1W', '1M', '3M', '1Y', '5Y'];
const SCREEN_W = Dimensions.get('window').width;
const CHART_H = 160;

const WATCHLIST_KEY = 'watchlist_items';
const ALERTS_KEY_PREFIX = 'alerts_stock_';
const ALERT_TYPES = ['Price Change', 'Earnings Release', 'Dividend Change', 'Volume Spike'];

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
    else { list.push({ ticker, name, type: 'STOCK', price, change: 0, pct: 0, sparkline: [] }); await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(list)); return true; }
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

function usePeriodChange(ticker: string, period: string) {
  const [pct, setPct] = useState<number | null>(null);
  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;
    getETFHistory(ticker, period === '1D' ? '1D' : period).then((hist) => {
      if (cancelled || hist.length < 2) return;
      const first = hist[0].close, last = hist[hist.length - 1].close;
      if (first > 0) setPct(((last - first) / first) * 100);
    });
    return () => { cancelled = true; };
  }, [ticker, period]);
  return pct;
}

export default function StockDetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('Overview');
  const [chartPeriod, setChartPeriod] = useState('1Y');
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [dividends, setDividends] = useState<{ date: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [starred, setStarred] = useState(false);
  const [alerts, setAlerts] = useState<Record<string, boolean>>({});
  const [posExpanded, setPosExpanded] = useState(false);
  const { transactions } = usePortfolioTransactions();
  const tickerTransactions = transactions
    .filter(t => t.ticker === ticker)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const position = tickerTransactions.length > 0
    ? calculatePositionFIFO(ticker ?? '', transactions, summary?.price ?? 0)
    : null;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { points: chartPoints, loading: chartLoading, isPositive: chartPositive } = useSingleChartPoints({
    ticker: ticker ?? '', period: chartPeriod, chartW: SCREEN_W - 32, chartH: CHART_H,
  });

  const periodPct = usePeriodChange(ticker ?? '', chartPeriod);
  const displayPct = chartPeriod === '1D' ? (summary?.changePct ?? 0) : (periodPct ?? summary?.changePct ?? 0);
  const displayChange = chartPeriod === '1D' ? (summary?.change ?? 0) : null;
  const isPositiveDisplay = displayPct >= 0;
  const changeColor = isPositiveDisplay ? '#00C896' : '#FF5A5F';
  const lineColor = chartPositive ? '#00C896' : '#FF5A5F';
  const periodLabel = chartPeriod === '1D' ? 'Today' : chartPeriod;

  useEffect(() => {
    if (!ticker) return;
    isInWatchlist(ticker).then(setStarred);
    loadAlerts(ticker).then(setAlerts);
    async function load() {
      const [s, d] = await Promise.all([getStockSummary(ticker), getETFDividends(ticker)]);
      setSummary(s); setDividends(d); setLoading(false);
    }
    load();
    intervalRef.current = setInterval(async () => {
      const p = await getETFPrice(ticker);
      if (p) setSummary(prev => prev ? { ...prev, price: p.price, change: p.change, changePct: p.changesPercentage, yearHigh: p.yearHigh || prev.yearHigh, yearLow: p.yearLow || prev.yearLow, avgVolume: p.avgVolume || prev.avgVolume } : prev);
    }, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [ticker]);

  async function handleStarPress() {
    const nowInList = await toggleWatchlist(ticker, summary?.name ?? ticker, summary?.price ?? 0);
    setStarred(nowInList);
  }

  async function handleAlertToggle(alertType: string) {
    const updated = { ...alerts, [alertType]: !alerts[alertType] };
    setAlerts(updated); await saveAlerts(ticker, updated);
  }

  const paysDividends = dividends.length > 0 || (summary?.dividendYield ?? 0) > 0;
  const formatPE = (v: number) => v > 0 ? v.toFixed(1) + 'x' : '—';
  const formatEPS = (v: number) => v !== 0 ? `$${v.toFixed(2)}` : '—';
  const formatBeta = (v: number) => v > 0 ? v.toFixed(2) : '—';
  const formatYield = (v: number) => v > 0 ? `${(v * 100).toFixed(2)}%` : '—';

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#338DFF" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTicker}>{ticker}</Text>
          {summary?.name && <Text style={s.headerName} numberOfLines={1}>{summary.name}</Text>}
        </View>
        <TouchableOpacity style={s.starBtn} onPress={handleStarPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={starred ? 'star' : 'star-outline'} size={22} color="#FF9F43" />
        </TouchableOpacity>
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
        {activeTab === 'Overview' && (
          <View>
            {/* PRICE HERO */}
    {/* PRICE HERO */}
    <View style={s.priceHero}>
      {loading ? <ActivityIndicator color="#338DFF" style={{ marginVertical: 16 }} /> : (
        <>
          <Text style={s.price}>${summary?.price?.toFixed(2) ?? '—'}</Text>
          <View style={s.changeRow}>
            {displayChange !== null && <Text style={[s.change, { color: changeColor }]}>{isPositiveDisplay ? '+' : ''}{displayChange.toFixed(2)} </Text>}
            <Text style={[s.changePct, { color: changeColor }]}>{isPositiveDisplay ? '+' : ''}{displayPct.toFixed(2)}%</Text>
            <View style={[s.periodPill, { backgroundColor: changeColor + '22' }]}>
              <Text style={[s.periodPillText, { color: changeColor }]}>{periodLabel}</Text>
            </View>
          </View>
        </>
      )}
    </View>

    {/* Chart */}
    <View style={s.chartWrap}>
              <InteractiveChart points={chartPoints} height={CHART_H} color={lineColor} loading={chartLoading}
                formatValue={(v) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            </View>
            <View style={s.periodRow}>
              {CHART_PERIODS.map((p) => (
                <TouchableOpacity key={p} style={[s.periodBtn, chartPeriod === p && s.periodBtnActive]} onPress={() => setChartPeriod(p)}>
                  <Text style={[s.periodText, chartPeriod === p && s.periodTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

           {/* POSITION SUMMARY — collapsible, only shown if user holds this ticker */}
            {position && position.totalShares > 0 && (
              <View style={s.posSummaryCard}>
                <TouchableOpacity
                  style={s.posSummaryHeader}
                  onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setPosExpanded(!posExpanded); }}
                  activeOpacity={0.75}
                >
                  <View style={[s.posIcon, { backgroundColor: '#338DFF22' }]}>
                    <Ionicons name="briefcase-outline" size={20} color="#338DFF" />
                  </View>
                  <View style={s.posHeaderText}>
                    <Text style={s.posSummaryTitle}>POSITION SUMMARY</Text>
                    <Text style={s.posHeaderSub}>
                      {position.totalShares.toLocaleString('en-US', { maximumFractionDigits: 4 })} shares · ${position.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <Text style={[s.posHeaderReturn, { color: position.unrealizedGainPct >= 0 ? '#00C896' : '#FF5A5F' }]}>
                    {position.unrealizedGainPct >= 0 ? '+' : ''}{position.unrealizedGainPct.toFixed(2)}%
                  </Text>
                  <Ionicons name={posExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#4A6080" />
                </TouchableOpacity>

                {posExpanded && (
                  <View style={s.posExpanded}>
                    <View style={s.posSummaryRow}>
                      <View style={s.posSummaryItem}>
                        <Text style={s.posSummaryLabel}>Shares</Text>
                        <Text style={s.posSummaryValue}>{position.totalShares.toLocaleString('en-US', { maximumFractionDigits: 4 })}</Text>
                      </View>
                      <View style={s.posSummaryItem}>
                        <Text style={s.posSummaryLabel}>Avg Cost</Text>
                        <Text style={s.posSummaryValue}>${position.avgCost.toFixed(2)}</Text>
                      </View>
                      <View style={s.posSummaryItem}>
                        <Text style={s.posSummaryLabel}>Market Value</Text>
                        <Text style={s.posSummaryValue}>${position.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                      </View>
                    </View>
                    <View style={s.posSummaryDivider} />
                    <View style={s.posSummaryRow}>
                      <View style={s.posSummaryItem}>
                        <Text style={s.posSummaryLabel}>Unrealized Gain</Text>
                        <Text style={[s.posSummaryValue, { color: position.unrealizedGain >= 0 ? '#00C896' : '#FF5A5F' }]}>
                          {position.unrealizedGain >= 0 ? '+' : ''}${position.unrealizedGain.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      </View>
                      <View style={s.posSummaryItem}>
                        <Text style={s.posSummaryLabel}>Return</Text>
                        <Text style={[s.posSummaryValue, { color: position.unrealizedGainPct >= 0 ? '#00C896' : '#FF5A5F' }]}>
                          {position.unrealizedGainPct >= 0 ? '+' : ''}{position.unrealizedGainPct.toFixed(2)}%
                        </Text>
                      </View>
                    </View>

                    {tickerTransactions.length > 0 && (
                      <>
                        <View style={s.posSummaryDivider} />
                        <View style={s.txHeaderRow}>
                          <Text style={s.posSummaryLabel}>RECENT TRANSACTIONS</Text>
                          <TouchableOpacity onPress={() => router.push(`/portfolio/transactions?ticker=${ticker}`)}>
                            <Text style={s.viewAllTxText}>View All →</Text>
                          </TouchableOpacity>
                        </View>
                        {tickerTransactions.slice(0, 3).map((txn) => (
                          <TransactionRow key={txn.transactionId} transaction={txn as TransactionRowData} showTicker={false} />
                        ))}
                      </>
                    )}
                  </View>
                )}
              </View>
            )} 
            <View style={s.statsCard}>
              {[
                { label: 'Market Cap', value: formatMarketCap(summary?.marketCap ?? 0) },
                { label: 'P/E Ratio', value: formatPE(summary?.peRatio ?? 0) },
                { label: 'EPS', value: formatEPS(summary?.eps ?? 0) },
                { label: 'Beta', value: formatBeta(summary?.beta ?? 0) },
                { label: 'Div. Yield', value: formatYield(summary?.dividendYield ?? 0), color: '#00C896' },
                { label: '52W High', value: summary?.yearHigh ? `$${summary.yearHigh.toFixed(2)}` : '—', color: '#00C896' },
                { label: '52W Low', value: summary?.yearLow ? `$${summary.yearLow.toFixed(2)}` : '—', color: '#FF5A5F' },
                { label: 'Avg Volume', value: formatVolume(summary?.avgVolume ?? 0) },
              ].map((stat: any, i, arr) => (
                <View key={stat.label} style={[s.statRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={s.statLabel}>{stat.label}</Text>
                  <Text style={[s.statValue, stat.color ? { color: stat.color } : {}]}>{stat.value}</Text>
                </View>
              ))}
            </View>
            {summary?.industry && (
              <View style={s.industryRow}>
                <Ionicons name="business-outline" size={13} color="#4A6080" />
                <Text style={s.industryText}>{summary.industry}</Text>
              </View>
            )}
            <View style={{ height: 24 }} />
          </View>
        )}

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
                <View key={item.label} style={[s.statRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={s.statLabel}>{item.label}</Text>
                  <Text style={s.statValue}>{item.value}</Text>
                </View>
              ))}
            </View>
            <View style={s.infoCard}>
              <Ionicons name="information-circle-outline" size={14} color="#4A6080" />
              <Text style={s.infoText}>Full earnings history and income statements coming in a future update.</Text>
            </View>
            <View style={{ height: 24 }} />
          </View>
        )}

        {activeTab === 'Dividends' && (
          <View>
            <View style={s.divHero}>
              <View style={s.divStat}><Text style={s.divStatLabel}>Annual Yield</Text><Text style={s.divStatValue}>{formatYield(summary?.dividendYield ?? 0)}</Text></View>
              <View style={s.divDivider} />
              <View style={s.divStat}><Text style={s.divStatLabel}>Frequency</Text><Text style={s.divStatValue}>Quarterly</Text></View>
            </View>
            {dividends.length > 0 && (
              <>
                <Text style={s.sectionLabel}>RECENT DIVIDENDS</Text>
                <View style={s.divTable}>
                  {dividends.slice(0, 8).map((d, i) => (
                    <View key={i} style={[s.divTableRow, i === Math.min(dividends.length, 8) - 1 && { borderBottomWidth: 0 }]}>
                      <Text style={s.divTableDate}>{d.date}</Text>
                      <Text style={[s.divTableAmt, { color: '#00C896' }]}>${d.amount.toFixed(4)}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            <View style={{ height: 24 }} />
          </View>
        )}

        {activeTab === 'Alerts' && (
          <View>
            <Text style={s.sectionLabel}>ALERT SETTINGS FOR {ticker}</Text>
            {ALERT_TYPES.map((alertType) => (
              <View key={alertType} style={s.alertRow}>
                <View style={s.alertLeft}>
                  <Ionicons name={alertType === 'Price Change' ? 'trending-up-outline' : alertType === 'Earnings Release' ? 'bar-chart-outline' : alertType === 'Dividend Change' ? 'cash-outline' : 'pulse-outline'} size={18} color={alerts[alertType] ? '#338DFF' : '#4A6080'} style={{ marginRight: 10 }} />
                  <Text style={[s.alertText, alerts[alertType] && { color: '#E8EEF8' }]}>{alertType}</Text>
                </View>
                <Switch value={!!alerts[alertType]} onValueChange={() => handleAlertToggle(alertType)} trackColor={{ false: '#1E2A3A', true: '#338DFF44' }} thumbColor={alerts[alertType] ? '#338DFF' : '#4A6080'} ios_backgroundColor="#1E2A3A" />
              </View>
            ))}
            <Text style={s.alertsNote}>Alerts are saved per stock and will notify you when enabled.</Text>
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
  headerTicker: { fontSize: 18, fontWeight: '700', color: '#E8EEF8' },
  headerName: { fontSize: 11, color: '#4A6080', marginTop: 1 },
  starBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  priceHero: { paddingHorizontal: 16, paddingBottom: 12 },
  price: { fontSize: 34, fontWeight: '700', color: '#E8EEF8', marginBottom: 6, fontVariant: ['tabular-nums'] },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  change: { fontSize: 14, fontWeight: '500' },
  changePct: { fontSize: 14, fontWeight: '600' },
  periodPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  periodPillText: { fontSize: 11, fontWeight: '700' },
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
  statsCard: { backgroundColor: '#141A26', borderRadius: 14, marginHorizontal: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: 4 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)' },
  statLabel: { fontSize: 13, color: '#4A6080' },
  statValue: { fontSize: 13, fontWeight: '600', color: '#E8EEF8' },
  industryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginTop: 12 },
  industryText: { fontSize: 12, color: '#4A6080' },
  sectionLabel: { fontSize: 10, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 12, marginTop: 8, paddingHorizontal: 16 },
  metricsCard: { backgroundColor: '#141A26', borderRadius: 14, marginHorizontal: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
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
  alertRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#141A26', borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  alertLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  alertText: { fontSize: 14, color: '#4A6080' },
  alertsNote: { fontSize: 11, color: '#4A6080', paddingHorizontal: 16, marginTop: 4, lineHeight: 16 },
  posSummaryCard: { backgroundColor: '#141A26', borderRadius: 14, marginHorizontal: 16, marginBottom: 16, borderWidth: 0.5, borderColor: 'rgba(51,141,255,0.2)', overflow: 'hidden' },
  posSummaryHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  posIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  posHeaderText: { flex: 1 },
  posSummaryTitle: { fontSize: 10, color: '#4A6A9A', letterSpacing: 1.2, marginBottom: 2 },
  posHeaderSub: { fontSize: 12, color: '#C8D8F0' },
  posHeaderReturn: { fontSize: 13, fontWeight: '700', marginRight: 4 },
  posExpanded: { borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)', padding: 16 },
  posSummaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  posSummaryItem: { flex: 1 },
  posSummaryLabel: { fontSize: 10, color: '#4A6080', marginBottom: 4, letterSpacing: 0.5 },
  posSummaryValue: { fontSize: 14, fontWeight: '600', color: '#E8EEF8', fontVariant: ['tabular-nums'] },
  posSummaryDivider: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 14 },
  txHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  viewAllTxText: { fontSize: 11, color: '#338DFF', fontWeight: '600' },
});
