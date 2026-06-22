import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, FlatList, LayoutAnimation,
  Modal, Platform, RefreshControl, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, TouchableOpacity, UIManager, View,
} from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import InteractiveChart from '../../components/InteractiveChart';
import { ChartMode, usePortfolioChartPoints } from '../hooks/useChartPoints';
import { ETFPosition, usePortfolioData } from '../hooks/usePortfolioData';
import { usePortfolioSnapshots } from '../hooks/usePortfolioSnapshots';

import { AddTransactionInput, usePortfolioTransactions } from '../hooks/usePortfolioTransactions';
import { getETFDividends, getETFTopHoldings, searchAsset } from '../services/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Holding = { symbol: string; name: string; weight: number };
type HoldingsMap = Record<string, Holding[]>;

const PERF_PERIODS = ['Today', '1W', '1M', '3M', '6M', '1Y', '5Y'];
const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - 30;
const CHART_H = 120;

const USER_ETFS_KEY = 'userETFs';
const USER_HOLDINGS_KEY = 'userHoldings';
const SNAPSHOT_KEY = 'portfolio_value_snapshots';

// STABILIZATION MODE (Rule 5): Performance chart, snapshots, profit and
// contribution calculations, and benchmark comparisons are disabled while
// we verify transactions/positions/quantities/asset survival are solid.
// Flip this back to true once that's confirmed — no other code changes
// needed, the snapshot engine itself also respects this flag.
const PERFORMANCE_ENABLED = false;

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

const ETF_COLORS = ['#338DFF', '#00C896', '#FF9F43', '#A78BFA', '#FF5A5F', '#66AFFF', '#4F8EF7', '#FFD93D', '#E879F9', '#4FC3F7'];

function computeSectorExposure(positions: ETFPosition[], holdingsMap: HoldingsMap, totalValue: number) {
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
  return Object.entries(sectorWeights).sort((a, b) => b[1] - a[1])
    .map(([name, pct]) => ({ name, pct: Math.round(pct * 10) / 10, color: SECTOR_COLORS[name] || '#4A6080' }));
}

function computeShared(h1: Holding[], h2: Holding[]) {
  const map2 = new Map(h2.map((h) => [h.symbol, h]));
  return h1.filter((h) => h.symbol && map2.has(h.symbol))
    .map((h) => ({ symbol: h.symbol, name: h.name, w1: h.weight, w2: map2.get(h.symbol)!.weight }))
    .sort((a, b) => b.w1 + b.w2 - (a.w1 + a.w2));
}

function overlapScore(h1: Holding[], h2: Holding[]): number {
  return Math.min(Math.round(computeShared(h1, h2).reduce((acc, h) => acc + Math.min(h.w1, h.w2), 0)), 100);
}

function scoreColor(score: number) { return score >= 60 ? '#FF5A5F' : score >= 30 ? '#FF9F43' : '#00C896'; }
function scoreLabel(score: number) { return score >= 60 ? 'High Overlap' : score >= 30 ? 'Moderate' : 'Low Overlap'; }

function computeHealthMetrics(positions: ETFPosition[], holdingsMap: HoldingsMap, totalValue: number) {
  const count = positions.filter(p => p.value > 0).length;
  const maxVal = Math.max(...positions.map(p => p.value), 1);
  const concentration = totalValue > 0 ? maxVal / totalValue : 1;
  const diversification = Math.min(100, Math.round((count / 6) * 60 + (1 - concentration) * 40));
  const concRisk = Math.round((1 - concentration) * 100);
  const sectorBalance = Math.min(100, Math.round(50 + count * 8));
  const etfsWithHoldings = Object.keys(holdingsMap);
  let totalOverlap = 0, pairCount = 0;
  for (let i = 0; i < etfsWithHoldings.length; i++)
    for (let j = i + 1; j < etfsWithHoldings.length; j++) {
      totalOverlap += overlapScore(holdingsMap[etfsWithHoldings[i]], holdingsMap[etfsWithHoldings[j]]);
      pairCount++;
    }
  const avgOverlap = pairCount > 0 ? totalOverlap / pairCount : 50;
  return [
    { label: 'Diversification', score: diversification, color: diversification >= 70 ? '#00C896' : '#FF9F43' },
    { label: 'Concentration Risk', score: concRisk, color: concRisk >= 70 ? '#00C896' : '#FF9F43' },
    { label: 'Sector Balance', score: sectorBalance, color: sectorBalance >= 70 ? '#338DFF' : '#FF9F43' },
    { label: 'Overlap Risk', score: Math.round(100 - avgOverlap), color: Math.round(100 - avgOverlap) >= 70 ? '#00C896' : '#FF5A5F' },
  ];
}

// ── Donut Chart ───────────────────────────────────────────────
function DonutChart({ positions, totalValue }: { positions: ETFPosition[]; totalValue: number }) {
  const SIZE = 210, CX = SIZE / 2, CY = SIZE / 2, RADIUS = 82, STROKE_WIDTH = 24, GAP_DEGREES = 3;
  const circumference = 2 * Math.PI * RADIUS;
  const hasValues = totalValue > 0;
  const items = hasValues ? positions.filter(p => p.value > 0) : positions.map(p => ({ ...p, value: 1 }));
  const total = items.reduce((s, p) => s + p.value, 0);
  let cumulativePct = 0;
  const slices = items.map((p) => {
    const pct = p.value / total;
    const slicePct = Math.max(0, pct - GAP_DEGREES / 360);
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
          <G>{slices.map((sl) => <Circle key={sl.ticker} cx={CX} cy={CY} r={RADIUS} fill="none" stroke={sl.color} strokeWidth={STROKE_WIDTH} strokeDasharray={`${sl.dash} ${circumference - sl.dash}`} strokeDashoffset={sl.offset} />)}</G>
        </Svg>
        <View style={dc.center}>
          <Text style={dc.centerLabel}>Total</Text>
          <Text style={dc.centerValue}>{hasValues ? `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</Text>
        </View>
      </View>
      <View style={dc.legend}>
        {slices.map((sl) => (
          <View key={sl.ticker} style={dc.legendItem}>
            <View style={[dc.dot, { backgroundColor: sl.color }]} />
            <View>
              <Text style={dc.legendTicker}>{sl.ticker}</Text>
              <Text style={dc.legendValue}>{hasValues ? `$${sl.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : `${sl.pct}%`}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const dc = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  chartWrap: { position: 'relative', width: 210, height: 210 },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  centerLabel: { fontSize: 12, color: '#4A6080', marginBottom: 2 },
  centerValue: { fontSize: 14, fontWeight: '700', color: '#E8EEF8', fontVariant: ['tabular-nums'], textAlign: 'center' },
  legend: { flex: 1, paddingLeft: 44, gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendTicker: { fontSize: 12, color: '#E8EEF8', fontWeight: '600' },
  legendValue: { fontSize: 11, color: '#4A6080', fontVariant: ['tabular-nums'] },
});

// ── Add / Update Asset Modal ──────────────────────────────────
interface AddAssetModalProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
  existingPositions: ETFPosition[];
  addTransaction: (input: AddTransactionInput) => Promise<any>;
}

function AddAssetModal({ visible, onClose, onAdded, existingPositions, addTransaction }: AddAssetModalProps) {
  const [step, setStep] = useState<'search' | 'details'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [qty, setQty] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [isExisting, setIsExisting] = useState(false);
  const [transactionType, setTransactionType] = useState<'BUY' | 'SELL'>('BUY');
  
  
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
    if (visible) { setStep('search'); setQuery(''); setResults([]); setSelected(null); setQty(''); setAvgCost(''); setPurchaseDate(''); setIsExisting(false); setTransactionType('BUY'); }
  }, [visible]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 1) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try { setResults(await searchAsset(query)); } catch { setResults([]); }
      setSearching(false);
    }, 400);
  }, [query]);

  function handleSelect(item: any) {
    const existing = existingPositions.find(p => p.ticker === item.ticker);
    setSelected(item);
    setIsExisting(!!existing);
    setQty('');
    setAvgCost('');
    setStep('details');
  }

  
async function handleSave() {
  if (!selected || !qty) return;
  const qtyNum = parseFloat(qty);
  const costNum = parseFloat(avgCost) || 0;
  if (isNaN(qtyNum) || qtyNum <= 0) return;
  setSaving(true);
  try {
    await addTransaction({
      ticker: selected.ticker,
      assetType: selected.type ?? 'ETF',
      transactionType,
      quantity: qtyNum,
      pricePerShare: costNum,
      date: purchaseDate || undefined,
      notes: transactionType === 'SELL' ? 'Sold' : isExisting ? 'Added to existing position' : '',
    });
    onAdded();
    onClose();
  } catch (e) { console.error('Save error:', e); }
  setSaving(false);
}


  const typeBadgeColor = (type: string) => type === 'ETF' ? '#338DFF' : type === 'STOCK' ? '#00C896' : '#FF9F43';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <View style={modal.handle} />
          {step === 'search' ? (
            <>
              <View style={modal.titleRow}>
                <Text style={modal.title}>Add Asset</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color="#4A6080" />
                </TouchableOpacity>
              </View>
              <View style={modal.searchRow}>
                <Ionicons name="search" size={16} color="#4A6080" style={{ marginRight: 8 }} />
                <TextInput style={modal.searchInput} placeholder="Search ETF, stock, or crypto…" placeholderTextColor="#4A6080" value={query} onChangeText={setQuery} autoCapitalize="characters" autoFocus />
                {searching && <ActivityIndicator size="small" color="#338DFF" />}
              </View>
              {results.length > 0 ? (
                <FlatList data={results} keyExtractor={(item) => item.ticker} style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const alreadyOwned = existingPositions.some(p => p.ticker === item.ticker);
                    return (
                      <TouchableOpacity style={modal.resultRow} onPress={() => handleSelect(item)}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={modal.resultTicker}>{item.ticker}</Text>
                            {alreadyOwned && <View style={modal.ownedBadge}><Text style={modal.ownedBadgeText}>Owned</Text></View>}
                          </View>
                          <Text style={modal.resultName} numberOfLines={1}>{item.name}</Text>
                        </View>
                        <View style={[modal.typeBadge, { backgroundColor: typeBadgeColor(item.type) + '22' }]}>
                          <Text style={[modal.typeBadgeText, { color: typeBadgeColor(item.type) }]}>{item.type}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              ) : query.length > 0 && !searching ? (
                <Text style={modal.emptyText}>No results for "{query}"</Text>
              ) : null}
            </>
          ) : (
            <>
              <View style={modal.titleRow}>
                <TouchableOpacity onPress={() => setStep('search')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="chevron-back" size={22} color="#338DFF" />
                </TouchableOpacity>
                <Text style={modal.title}>{selected?.ticker}</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color="#4A6080" />
                </TouchableOpacity>
              </View>
              <Text style={modal.selectedName} numberOfLines={2}>{selected?.name}</Text>

              {/* BUY / SELL toggle */}
              <View style={modal.txTypeRow}>
                <TouchableOpacity
                  style={[modal.txTypeBtn, transactionType === 'BUY' && modal.txTypeBtnActiveBuy]}
                  onPress={() => setTransactionType('BUY')}
                >
                  <Text style={[modal.txTypeBtnText, transactionType === 'BUY' && { color: '#00C896' }]}>BUY</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[modal.txTypeBtn, transactionType === 'SELL' && modal.txTypeBtnActiveSell]}
                  onPress={() => setTransactionType('SELL')}
                >
                  <Text style={[modal.txTypeBtnText, transactionType === 'SELL' && { color: '#FF5A5F' }]}>SELL</Text>
                </TouchableOpacity>
              </View>

              {isExisting && transactionType === 'BUY' && (
                <View style={modal.updateBanner}>
                  <Ionicons name="add-circle-outline" size={14} color="#00C896" />
                  <Text style={[modal.updateBannerText, { color: '#00C896' }]}>Adding to existing position</Text>
                </View>
              )}
              {transactionType === 'SELL' && (
                <View style={[modal.updateBanner, { backgroundColor: '#FF5A5F22' }]}>
                  <Ionicons name="trending-down-outline" size={14} color="#FF5A5F" />
                  <Text style={[modal.updateBannerText, { color: '#FF5A5F' }]}>Recording a sell — FIFO cost basis applied</Text>
                </View>
              )}

              <Text style={modal.inputLabel}>Shares / Units</Text>
              <TextInput style={modal.input} placeholder="e.g. 10.5" placeholderTextColor="#4A6080" value={qty} onChangeText={setQty} keyboardType="decimal-pad" autoFocus />
              <Text style={modal.inputLabel}>{transactionType === 'SELL' ? 'Sale Price per Share' : 'Avg Cost per Share (optional)'}</Text>
              <TextInput style={modal.input} placeholder="e.g. 27.50" placeholderTextColor="#4A6080" value={avgCost} onChangeText={setAvgCost} keyboardType="decimal-pad" />
              <Text style={modal.inputLabel}>Date (optional)</Text>
              <TextInput style={modal.input} placeholder="e.g. 2024-01-15" placeholderTextColor="#4A6080" value={purchaseDate} onChangeText={setPurchaseDate} />
              <TouchableOpacity
                style={[modal.saveBtn, { backgroundColor: transactionType === 'SELL' ? '#FF5A5F' : '#338DFF' }, (!qty || saving) && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={!qty || saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <Text style={modal.saveBtnText}>
                    {transactionType === 'SELL' ? 'Record Sale' : isExisting ? 'Add to Position' : 'Add to Portfolio'}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Manage Portfolio Modal ────────────────────────────────────
interface ManageModalProps {
  visible: boolean;
  onClose: () => void;
  positions: ETFPosition[];
  onRemoved: () => void;
  onDeleteAll: () => void;
  deleteAllForTicker: (ticker: string) => Promise<void>;
  resetAll: () => Promise<void>;
}

function ManagePortfolioModal({ visible, onClose, positions, onRemoved, onDeleteAll, deleteAllForTicker, resetAll }: ManageModalProps) {
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleRemove(ticker: string) {
  setRemoving(ticker);
  try {
    // Rule 2: the transaction store is the only writer. Deleting a ticker
    // means deleting its transactions — there is no separate holdings list
    // to keep in sync anymore.
    await deleteAllForTicker(ticker);
    onRemoved();
  } catch (e) { console.error('Remove error:', e); }
  setRemoving(null);
}

  async function handleDeleteAll() {
  Alert.alert('Delete Portfolio', 'This will remove all positions and reset your portfolio. This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete All', style: 'destructive', onPress: async () => {
      await resetAll();
      // Defensive cleanup of legacy/orphaned keys from older versions —
      // nothing should write these anymore, but a full reset should leave
      // no stale data behind for anything that might still read them.
      await AsyncStorage.multiRemove([
        USER_ETFS_KEY,
        USER_HOLDINGS_KEY,
        SNAPSHOT_KEY,
        'portfolio_daily_snapshots',
        'portfolio_daily_snapshots_meta',
      ]);
      onDeleteAll();
      onClose();
    }},
  ]);
}

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <View style={modal.handle} />
          <View style={modal.titleRow}>
            <Text style={modal.title}>Manage Portfolio</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#4A6080" />
            </TouchableOpacity>
          </View>
          {positions.length === 0 ? (
            <Text style={modal.emptyText}>No positions to manage.</Text>
          ) : (
            <FlatList data={positions} keyExtractor={(item) => item.ticker} style={{ maxHeight: 340 }}
              renderItem={({ item }) => (
                <View style={modal.manageRow}>
                  <View style={[modal.manageDot, { backgroundColor: item.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={modal.manageTicker}>{item.ticker}</Text>
                    <Text style={modal.manageDetail}>
                      {item.qty > 0 ? `${item.qty} shares` : 'No quantity set'}
                      {item.value > 0 ? ` · $${item.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity style={modal.removeBtn} onPress={() => handleRemove(item.ticker)} disabled={removing === item.ticker} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    {removing === item.ticker ? <ActivityIndicator size="small" color="#FF5A5F" /> : <Ionicons name="trash-outline" size={18} color="#FF5A5F" />}
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
          <TouchableOpacity style={modal.deleteAllBtn} onPress={handleDeleteAll}>
            <Ionicons name="trash-outline" size={16} color="#FF5A5F" />
            <Text style={modal.deleteAllText}>Delete Entire Portfolio</Text>
          </TouchableOpacity>
          <TouchableOpacity style={modal.closeBtn} onPress={onClose}>
            <Text style={modal.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Action Sheet ──────────────────────────────────────────────
function PortfolioActionSheet({ visible, onClose, onAddAsset, onManage, onHistory }: { visible: boolean; onClose: () => void; onAddAsset: () => void; onManage: () => void; onHistory: () => void; }) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity style={modal.overlay} activeOpacity={1} onPress={onClose}>
        <View style={modal.actionSheet}>
          <View style={modal.handle} />
          <TouchableOpacity style={modal.actionRow} onPress={() => { onClose(); onAddAsset(); }}>
            <View style={[modal.actionIcon, { backgroundColor: '#338DFF22' }]}><Ionicons name="add-circle-outline" size={22} color="#338DFF" /></View>
            <View><Text style={modal.actionTitle}>Add Asset</Text><Text style={modal.actionSub}>Search and add or update a position</Text></View>
          </TouchableOpacity>
          <View style={modal.actionDivider} />
          <TouchableOpacity style={modal.actionRow} onPress={() => { onClose(); onHistory(); }}>
            <View style={[modal.actionIcon, { backgroundColor: '#A78BFA22' }]}><Ionicons name="receipt-outline" size={22} color="#A78BFA" /></View>
            <View><Text style={modal.actionTitle}>Transaction History</Text><Text style={modal.actionSub}>View, edit, or delete past transactions</Text></View>
          </TouchableOpacity>
          <View style={modal.actionDivider} />
          <TouchableOpacity style={modal.actionRow} onPress={() => { onClose(); onManage(); }}>
            <View style={[modal.actionIcon, { backgroundColor: '#FF9F4322' }]}><Ionicons name="list-outline" size={22} color="#FF9F43" /></View>
            <View><Text style={modal.actionTitle}>Manage Portfolio</Text><Text style={modal.actionSub}>Remove positions or delete portfolio</Text></View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#141A26', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, minHeight: 200 },
  actionSheet: { backgroundColor: '#141A26', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  handle: { width: 36, height: 4, backgroundColor: '#2A3A54', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 17, fontWeight: '700', color: '#E8EEF8' },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0B0F19', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15, color: '#E8EEF8' },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' },
  resultTicker: { fontSize: 15, fontWeight: '700', color: '#E8EEF8' },
  resultName: { fontSize: 12, color: '#4A6080', maxWidth: SCREEN_W - 140, marginTop: 2 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  ownedBadge: { backgroundColor: '#00C89622', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  ownedBadgeText: { fontSize: 9, fontWeight: '700', color: '#00C896' },
  emptyText: { fontSize: 13, color: '#4A6080', textAlign: 'center', marginTop: 20 },
  selectedName: { fontSize: 13, color: '#4A6080', marginBottom: 16, lineHeight: 18 },
  updateBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF9F4322', borderRadius: 8, padding: 10, marginBottom: 16 },
  updateBannerText: { fontSize: 12, color: '#FF9F43', fontWeight: '600' },
  inputLabel: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: '#0B0F19', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#E8EEF8', marginBottom: 16 },
  saveBtn: { backgroundColor: '#338DFF', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  manageRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)', gap: 12 },
  manageDot: { width: 10, height: 10, borderRadius: 5 },
  manageTicker: { fontSize: 15, fontWeight: '700', color: '#E8EEF8' },
  manageDetail: { fontSize: 12, color: '#4A6080', marginTop: 2 },
  removeBtn: { padding: 6 },
  deleteAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FF5A5F22', borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 0.5, borderColor: '#FF5A5F44' },
  deleteAllText: { fontSize: 14, fontWeight: '600', color: '#FF5A5F' },
  closeBtn: { backgroundColor: '#1E2A3A', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10 },
  closeBtnText: { fontSize: 15, fontWeight: '600', color: '#C8D8F0' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  actionIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  actionTitle: { fontSize: 15, fontWeight: '600', color: '#E8EEF8', marginBottom: 2 },
  actionSub: { fontSize: 12, color: '#4A6080' },
  actionDivider: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: -20 },
  txTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
txTypeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#0B0F19', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
txTypeBtnActiveBuy: { backgroundColor: '#00C89618', borderColor: '#00C896' },
txTypeBtnActiveSell: { backgroundColor: '#FF5A5F18', borderColor: '#FF5A5F' },
txTypeBtnText: { fontSize: 14, fontWeight: '700', color: '#4A6080' },
});

// ── Main Screen ───────────────────────────────────────────────
export default function PortfolioScreen() {
  const { positions, loading, refreshing, totalValue, hasValues, refresh } = usePortfolioData();
  const router = useRouter();
  const [holdingsMap, setHoldingsMap] = useState<HoldingsMap>({});
  const [loadingOverlap, setLoadingOverlap] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [expandedPair, setExpandedPair] = useState<string | null>(null);
  const [perfPeriod, setPerfPeriod] = useState('1Y');
  const [realYields, setRealYields] = useState<Record<string, number>>({});
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const { transactions, ready: transactionsReady, addTransaction, deleteAllForTicker, resetAll } = usePortfolioTransactions();
  const { snapshots, rebuilding: snapshotsRebuilding } = usePortfolioSnapshots(transactions, transactionsReady, PERFORMANCE_ENABLED);
  const [chartMode, setChartMode] = useState<ChartMode>('performance');

  useEffect(() => {
    AsyncStorage.getItem('chart_mode_preference').then((saved) => {
      if (saved) setChartMode(saved as ChartMode);
    });
  }, []);
  useEffect(() => {
    AsyncStorage.setItem('chart_mode_preference', chartMode);
  }, [chartMode]);

  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  const FALLBACK_YIELDS: Record<string, number> = {
    SCHD: 0.0365, VTI: 0.0152, QQQM: 0.0064, JEPI: 0.0819,
    JEPQ: 0.0980, SPY: 0.0128, VOO: 0.0128, VXUS: 0.0280, QQQI: 0.0120,
  };

  useFocusEffect(useCallback(() => {
    // PortfolioDataProvider manages its own interval app-wide — no need to
    // start/stop it here. Just clear local UI state when leaving the tab.
    return () => { setExpandedCard(null); setExpandedPair(null); setHoldingsMap({}); };
  }, []));

  const { points: chartPoints, loading: chartLoading, isPositive: chartPositive, pctChange } =
  usePortfolioChartPoints({
    snapshots,
    rebuilding: snapshotsRebuilding,
    period: perfPeriod,
    mode: chartMode,
    chartW: CHART_W,
    chartH: CHART_H,
    liveTotal: totalValue,
  });

  const chartLiveValue = perfPeriod === 'Today' && totalValue > 0 ? totalValue : undefined;
  const lineColor = chartPositive ? '#00C896' : '#FF5A5F';

  // Fixed dividend yield fetch
  useEffect(() => {
    if (positions.length === 0) return;
    async function fetchYields() {
      const yields: Record<string, number> = {};
      await Promise.all(positions.map(async (p) => {
        try {
          const divs = await getETFDividends(p.ticker);
          if (divs.length >= 2 && p.price > 0) {
          const isMonthly = ['JEPI', 'JEPQ', 'QQQI'].includes(p.ticker);
          const numPayments = isMonthly ? 12 : 4;
          const annual = divs.slice(0, numPayments).reduce((sum: number, d: any) => sum + d.amount, 0);
          const calculated = annual / p.price;
          const fallback = FALLBACK_YIELDS[p.ticker] || 0;
          if (fallback > 0) {
            // Use live if within 30% of fallback, else use fallback
            yields[p.ticker] = (calculated >= fallback * 0.7 && calculated <= fallback * 1.3)
              ? calculated
              : fallback;
          } else {
            yields[p.ticker] = calculated;
          }
        } else {
  
            yields[p.ticker] = FALLBACK_YIELDS[p.ticker] || 0;
          }
        } catch { yields[p.ticker] = FALLBACK_YIELDS[p.ticker] || 0; }
      }));
      setRealYields(yields);
    }
    fetchYields();
  }, [positions.map(p => p.ticker).join(',')]);

  useEffect(() => {
    if (positions.length === 0 || Object.keys(holdingsMap).length > 0) return;
    async function prefetch() {
      const results: HoldingsMap = {};
      await Promise.all(positions.map(async (p) => { const h = await getETFTopHoldings(p.ticker); if (h.length) results[p.ticker] = h; }));
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
    await Promise.all(positions.map(async (p) => { const h = await getETFTopHoldings(p.ticker); if (h.length) results[p.ticker] = h; }));
    setHoldingsMap(results);
    setLoadingOverlap(false);
  };

  function toggleCard(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (id === 'overlap') loadOverlap();
    setExpandedCard(expandedCard === id ? null : id);
  }

  function handlePortfolioChange() {
    // STABILIZATION FIX: usePortfolioData already reacts automatically
    // whenever the shared transaction store updates (its internal effect
    // depends on `transactions`), so it refetches/recomputes on its own
    // the moment addTransaction/deleteAllForTicker/resetAll finish. Calling
    // reset()+startFetching() here as well raced against that automatic
    // refetch — reset() wiped positions to empty immediately, then
    // startFetching() re-fetched using a closure that could still be one
    // render behind the real transaction update, producing a visible
    // "disappears, then flip-flops between two values" pattern.
    // holdingsMap (used for overlap/sector analytics) isn't derived from
    // the transaction store, so it still needs an explicit clear here.
    setHoldingsMap({});
  }

  const etfs = Object.keys(holdingsMap);
  const pairs: { etf1: string; etf2: string; score: number; sharedCount: number; sharedHoldings: { symbol: string; name: string; w1: number; w2: number }[]; }[] = [];
  for (let i = 0; i < etfs.length; i++)
    for (let j = i + 1; j < etfs.length; j++) {
      const shared = computeShared(holdingsMap[etfs[i]], holdingsMap[etfs[j]]);
      pairs.push({ etf1: etfs[i], etf2: etfs[j], score: overlapScore(holdingsMap[etfs[i]], holdingsMap[etfs[j]]), sharedCount: shared.length, sharedHoldings: shared });
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
  const overlappingHoldings = Array.from(allSymbols.entries()).filter(([, v]) => v.etfs.length > 1).sort((a, b) => b[1].etfs.length - a[1].etfs.length).slice(0, 8);

  const sectorData = computeSectorExposure(positions, holdingsMap, totalValue);
  const healthMetrics = computeHealthMetrics(positions, holdingsMap, totalValue);
  const overallHealth = Math.round(healthMetrics.reduce((a, m) => a + m.score, 0) / healthMetrics.length);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <Text style={s.headerTitle}>Portfolio</Text>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowActionSheet(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="add" size={20} color="#338DFF" />
          </TouchableOpacity>
          <View style={s.premiumBadge}><Ionicons name="star" size={10} color="#FFD93D" /><Text style={s.premiumText}>Premium</Text></View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#338DFF" colors={['#338DFF']} />}>

        <View style={s.section}>
          <Text style={s.sectionTitle}>ALLOCATION</Text>
          {loading ? (
            <ActivityIndicator color="#338DFF" style={{ marginVertical: 40 }} />
          ) : positions.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
              <Ionicons name="pie-chart-outline" size={44} color="#2A3A54" />
              <Text style={{ fontSize: 14, color: '#4A6080' }}>No positions yet</Text>
              <Text style={{ fontSize: 12, color: '#2A3A54' }}>Tap + to add your first asset</Text>
            </View>
          ) : (
            <DonutChart positions={positions} totalValue={totalValue} />
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>INCOME</Text>
          <View style={s.card}>
            <View style={s.incomeRow}>
              <View style={s.incomeStat}><Text style={s.incomeLabel}>Monthly</Text><Text style={s.incomeValue}>{monthlyIncome > 0 ? `$${monthlyIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</Text></View>
              <View style={s.incomeDivider} />
              <View style={s.incomeStat}><Text style={s.incomeLabel}>Annual</Text><Text style={s.incomeValue}>{annualIncome > 0 ? `$${annualIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</Text></View>
            </View>
          </View>
        </View>

        <View style={s.section}>
        <Text style={s.sectionTitle}>PERFORMANCE</Text>
        {!PERFORMANCE_ENABLED ? (
          <View style={{ alignItems: 'center', paddingVertical: 30, gap: 8 }}>
            <Ionicons name="construct-outline" size={28} color="#2A3A54" />
            <Text style={{ fontSize: 13, color: '#4A6080', textAlign: 'center' }}>
              Performance tracking is temporarily paused while we stabilize the data layer.
            </Text>
          </View>
        ) : positions.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 30 }}>
            <Text style={{ fontSize: 14, color: '#4A6080', textAlign: 'center' }}>
              Add your first investment to start tracking performance.
            </Text>
          </View>
        ) : snapshotsRebuilding ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator color="#007FFF" />
            <Text style={{ fontSize: 12, color: '#4A6080', marginTop: 10 }}>Calculating performance history…</Text>
          </View>
        ) : snapshots.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 30 }}>
            <Text style={{ fontSize: 13, color: '#4A6080', textAlign: 'center' }}>
              Performance data is unavailable.
            </Text>
          </View>
        ) : (
          <>
            <View style={s.modeRow}>
              {([
                { key: 'performance', label: 'Performance %' },
                { key: 'value', label: 'Value' },
                { key: 'profit', label: 'Profit' },
                { key: 'contributions', label: 'Contributions' },
                { key: 'dividends', label: 'Dividends' },
              ] as { key: ChartMode; label: string }[]).map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[s.modeChip, chartMode === m.key && s.modeChipActive]}
                  onPress={() => setChartMode(m.key)}
                >
                  <Text style={[s.modeChipText, chartMode === m.key && s.modeChipTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.periodRow}>
              {PERF_PERIODS.map((p) => (
                <TouchableOpacity key={p} style={s.periodBtn} onPress={() => setPerfPeriod(p)}>
                  <Text style={[s.periodText, perfPeriod === p && s.periodTextActive]}>{p}</Text>
                  {perfPeriod === p && <View style={s.periodUnderline} />}
                </TouchableOpacity>
              ))}
            </View>

            {pctChange !== null && (
              <View style={s.pctRow}>
                <Text style={[s.pctText, { color: lineColor }]}>
                  {(pctChange ?? 0) >= 0 ? '▲' : '▼'} {(pctChange ?? 0) >= 0 ? '+' : ''}{(pctChange ?? 0).toFixed(2)}%
                </Text>
                <Text style={s.pctLabel}>{perfPeriod} return</Text>
              </View>
            )}

            <View style={s.chartArea}>
              <InteractiveChart
                points={chartPoints}
                width={CHART_W}
                height={CHART_H}
                color={lineColor}
                loading={chartLoading}
                liveValue={chartMode === 'value' ? chartLiveValue : undefined}
                liveLabel="Now"
                formatValue={(v) =>
                  chartMode === 'performance'
                    ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
                    : `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                }
              />
            </View>

            {latestSnapshot && (
              <View style={s.metricsGrid}>
                <View style={s.metricCell}>
                  <Text style={s.metricLabel}>Portfolio Value</Text>
                  <Text style={s.metricValue}>${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
                <View style={s.metricCell}>
                  <Text style={s.metricLabel}>Contributions</Text>
                  <Text style={[s.metricValue, { color: '#004F98' }]}>${latestSnapshot.contributions.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text>
                </View>
                <View style={s.metricCell}>
                  <Text style={s.metricLabel}>Profit</Text>
                  <Text style={[s.metricValue, { color: latestSnapshot.profit >= 0 ? '#00C896' : '#FF5A5F' }]}>
                    {latestSnapshot.profit >= 0 ? '+' : ''}${latestSnapshot.profit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </Text>
                </View>
                <View style={s.metricCell}>
                  <Text style={s.metricLabel}>Return</Text>
                  <Text style={[s.metricValue, { color: latestSnapshot.cumulativeReturn >= 0 ? '#00C896' : '#FF5A5F' }]}>
                    {latestSnapshot.cumulativeReturn >= 0 ? '+' : ''}{(latestSnapshot.cumulativeReturn * 100).toFixed(2)}%
                  </Text>
                </View>
                <View style={s.metricCell}>
                  <Text style={s.metricLabel}>Dividends</Text>
                  <Text style={[s.metricValue, { color: '#338DFF' }]}>${latestSnapshot.dividendIncome.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text>
                </View>
              </View>
            )}
          </>
        )}
      </View>

        {positions.length > 0 && <View style={s.section}>
          <Text style={s.sectionTitle}>ANALYTICS</Text>

          {/* Overlap */}
          <View style={s.card}>
            <TouchableOpacity style={s.cardHeader} onPress={() => toggleCard('overlap')} activeOpacity={0.75}>
              <View style={[s.cardIcon, { backgroundColor: '#338DFF22' }]}><Ionicons name="git-merge-outline" size={22} color="#338DFF" /></View>
              <View style={s.cardText}><View style={s.cardTitleRow}><Text style={s.cardTitle}>Overlap Analyzer</Text><View style={s.newBadge}><Text style={s.newBadgeText}>NEW</Text></View></View><Text style={s.cardSub}>See how much your ETFs share the same holdings</Text></View>
              <Ionicons name={expandedCard === 'overlap' ? 'chevron-up' : 'chevron-down'} size={16} color="#4A6080" />
            </TouchableOpacity>
            {expandedCard === 'overlap' && (
              <View style={s.expanded}>
                {loadingOverlap ? (<View style={s.loadingRow}><ActivityIndicator size="small" color="#338DFF" /><Text style={s.loadingText}>Fetching holdings…</Text></View>)
                  : pairs.length === 0 ? <Text style={s.emptyText}>Could not load holdings. Check your connection.</Text>
                  : (
                    <>
                      {pairs.map((pair) => {
                        const pairKey = pair.etf1 + pair.etf2;
                        const isExp = expandedPair === pairKey;
                        return (
                          <View key={pairKey} style={s.pairBlock}>
                            <TouchableOpacity style={s.pairHeader} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpandedPair(isExp ? null : pairKey); }} activeOpacity={0.75} hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}>
                              <View style={s.pairLeft}><View style={s.chip}><Text style={s.chipText}>{pair.etf1}</Text></View><Ionicons name="git-merge-outline" size={12} color="#4A6080" style={{ marginHorizontal: 4 }} /><View style={s.chip}><Text style={s.chipText}>{pair.etf2}</Text></View></View>
                              <View style={s.pairRight}><Text style={[s.pairScore, { color: scoreColor(pair.score) }]}>{pair.score}</Text><Text style={[s.pairLabel, { color: scoreColor(pair.score) }]}>{scoreLabel(pair.score)}</Text></View>
                            </TouchableOpacity>
                            <View style={s.barBg}><View style={[s.barFill, { width: `${pair.score}%` as any, backgroundColor: scoreColor(pair.score) }]} /></View>
                            <TouchableOpacity onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpandedPair(isExp ? null : pairKey); }} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}>
                              <Text style={s.sharedCount}>{pair.sharedCount} shared holdings · {isExp ? 'tap to collapse ▲' : 'tap to expand ▼'}</Text>
                            </TouchableOpacity>
                            {isExp && (
                              <View style={s.table}>
                                <View style={s.tableHead}><Text style={[s.tableCell, { flex: 2 }]}>Holding</Text><Text style={s.tableCell}>{pair.etf1}</Text><Text style={s.tableCell}>{pair.etf2}</Text></View>
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
                              <View style={s.chips}>{info.etfs.map((e) => <View key={e} style={s.miniChip}><Text style={s.miniChipText}>{e}</Text></View>)}</View>
                            </View>
                          ))}
                        </View>
                      )}
                      {pairs[0] && (
                        <View style={s.insight}><Ionicons name="bulb-outline" size={14} color="#FF9F43" /><Text style={s.insightText}>{pairs[0].score >= 60 ? `${pairs[0].etf1} & ${pairs[0].etf2} have high overlap (${pairs[0].score}). Consider whether you need both.` : pairs[0].score >= 30 ? `Moderate overlap between ${pairs[0].etf1} & ${pairs[0].etf2} (${pairs[0].score}). Reasonable diversification overall.` : `Great diversification! All ETF pairs show low overlap.`}</Text></View>
                      )}
                    </>
                  )}
              </View>
            )}
          </View>

          

          {/* Sector */}
          <View style={[s.card, { marginTop: 10 }]}>
            <TouchableOpacity style={s.cardHeader} onPress={() => toggleCard('sector')} activeOpacity={0.75}>
              <View style={[s.cardIcon, { backgroundColor: '#00C89622' }]}><Ionicons name="pie-chart-outline" size={22} color="#00C896" /></View>
              <View style={s.cardText}><Text style={s.cardTitle}>Sector Exposure</Text><Text style={s.cardSub}>Breakdown by sector across your entire portfolio</Text></View>
              <Ionicons name={expandedCard === 'sector' ? 'chevron-up' : 'chevron-down'} size={16} color="#4A6080" />
            </TouchableOpacity>
            {expandedCard === 'sector' && (
              <View style={s.expanded}>
                {sectorData.length === 0 ? <View style={s.loadingRow}><ActivityIndicator size="small" color="#00C896" /><Text style={s.loadingText}>Computing sector weights…</Text></View> : (
                  <>
                    {sectorData.map((sec) => (
                      <View key={sec.name} style={s.sectorRow}>
                        <View style={[s.sectorDot, { backgroundColor: sec.color }]} />
                        <Text style={s.sectorName}>{sec.name}</Text>
                        <View style={s.barBg}><View style={[s.barFill, { width: `${Math.min((sec.pct / (sectorData[0]?.pct || 1)) * 100, 100)}%` as any, backgroundColor: sec.color }]} /></View>
                        <Text style={s.sectorPct}>{sec.pct}%</Text>
                      </View>
                    ))}
                    {sectorData[0] && <View style={s.insight}><Ionicons name="bulb-outline" size={14} color="#FF9F43" /><Text style={s.insightText}>{sectorData[0].name} is your largest sector at {sectorData[0].pct}%.{sectorData[0].pct > 35 ? ' Consider diversifying to reduce concentration.' : ' Sector allocation looks balanced.'}</Text></View>}
                  </>
                )}
              </View>
            )}
          </View>

          {/* Health */}
          <View style={[s.card, { marginTop: 10 }]}>
            <TouchableOpacity style={s.cardHeader} onPress={() => toggleCard('health')} activeOpacity={0.75}>
              <View style={[s.cardIcon, { backgroundColor: '#FF9F4322' }]}><Ionicons name="fitness-outline" size={22} color="#FF9F43" /></View>
              <View style={s.cardText}><Text style={s.cardTitle}>Portfolio Health Score</Text><Text style={s.cardSub}>Diversification, risk, and concentration rating</Text></View>
              <View style={s.healthPill}><Text style={[s.healthPillText, { color: overallHealth >= 70 ? '#00C896' : '#FF9F43' }]}>{overallHealth}</Text></View>
              <Ionicons name={expandedCard === 'health' ? 'chevron-up' : 'chevron-down'} size={16} color="#4A6080" />
            </TouchableOpacity>
            {expandedCard === 'health' && (
              <View style={s.expanded}>
                {healthMetrics.map((m) => (<View key={m.label} style={s.healthRow}><Text style={s.healthLabel}>{m.label}</Text><View style={s.barBg}><View style={[s.barFill, { width: `${m.score}%` as any, backgroundColor: m.color }]} /></View><Text style={[s.healthScore, { color: m.color }]}>{m.score}</Text></View>))}
                <View style={s.insight}><Ionicons name="bulb-outline" size={14} color="#FF9F43" /><Text style={s.insightText}>{overallHealth >= 80 ? 'Excellent portfolio health. Well diversified with low overlap.' : overallHealth >= 60 ? 'Good diversification with moderate concentration risk.' : 'Consider spreading across more ETFs to improve health score.'}</Text></View>
              </View>
            )}
          </View>

          {/* Dividend */}
          <View style={[s.card, { marginTop: 10 }]}>
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
                <View style={s.insight}><Ionicons name="bulb-outline" size={14} color="#FF9F43" /><Text style={s.insightText}>{annualIncome > 0 ? `Est. annual income of $${annualIncome.toFixed(2)} based on trailing 12-month yields.` : 'Add quantities in Setup to see your dividend forecast.'}</Text></View>
              </View>
            )}
          </View>
        </View>}
        <View style={{ height: 24 }} />
      </ScrollView>

      <PortfolioActionSheet
      visible={showActionSheet}
      onClose={() => setShowActionSheet(false)}
      onAddAsset={() => setShowAddAsset(true)}
      onManage={() => setShowManage(true)}
      onHistory={() => router.push('/portfolio/transactions')}
    />
      <AddAssetModal visible={showAddAsset} onClose={() => setShowAddAsset(false)} onAdded={handlePortfolioChange} existingPositions={positions} addTransaction={addTransaction} />
      <ManagePortfolioModal visible={showManage} onClose={() => setShowManage(false)} positions={positions} onRemoved={handlePortfolioChange} onDeleteAll={handlePortfolioChange} deleteAllForTicker={deleteAllForTicker} resetAll={resetAll} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19' },
  scroll: { paddingBottom: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: '#0B0F19' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#E8EEF8' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#338DFF22', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(51,141,255,0.3)' },
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
  periodRow: { flexDirection: 'row', paddingTop: 4, paddingBottom: 2, justifyContent: 'space-between' },
  periodBtn: { flex: 1, paddingBottom: 10, alignItems: 'center' },
  periodText: { fontSize: 13, color: '#4A6080', fontWeight: '500' },
  periodTextActive: { color: '#338DFF', fontWeight: '700' },
  periodUnderline: { height: 2, backgroundColor: '#338DFF', borderRadius: 1, width: '100%', marginTop: 4 },
  pctRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingBottom: 8 },
  pctText: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pctLabel: { fontSize: 12, color: '#4A6080' },
  chartArea: {},
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
  posSummaryCard: { backgroundColor: '#141A26', borderRadius: 14, marginHorizontal: 16, marginBottom: 16, borderWidth: 0.5, borderColor: 'rgba(51,141,255,0.2)', overflow: 'hidden' },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  modeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#0B0F19', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  modeChipActive: { backgroundColor: '#007FFF18', borderColor: '#007FFF' },
  modeChipText: { fontSize: 11, color: '#4A6080', fontWeight: '600' },
  modeChipTextActive: { color: '#007FFF' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)' },
  metricCell: { minWidth: '28%' },
  metricLabel: { fontSize: 10, color: '#4A6080', marginBottom: 3, letterSpacing: 0.3 },
  metricValue: { fontSize: 14, fontWeight: '700', color: '#E8EEF8', fontVariant: ['tabular-nums'] },
});