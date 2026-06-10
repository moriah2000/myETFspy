import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Dimensions, FlatList, Modal,
  RefreshControl, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import {
  AssetSearchResult, AssetType, CRYPTO_TICKERS,
  getCryptoPrice,
  getETFHistory, getETFPrice,
  searchAsset,
} from '../services/api';

const SCREEN_W = Dimensions.get('window').width;
const SPARK_W = 80;
const SPARK_H = 36;

const FILTER_OPTIONS = ['All', 'ETF', 'Stock', 'Crypto'];

const CRYPTO_COLORS: Record<string, string> = {
  BTC: '#F7931A', ETH: '#627EEA', SOL: '#9945FF', XRP: '#00AAE4',
  BNB: '#F3BA2F', ADA: '#0033AD', DOGE: '#C2A633', AVAX: '#E84142',
  LINK: '#2A5ADA', DOT: '#E6007A', MATIC: '#8247E5', LTC: '#BFBBBB',
  SHIB: '#FFA409', PEPE: '#00A550', TON: '#0088CC',
};

const ETF_COLORS: Record<string, string> = {
  SCHD: '#338DFF', VTI: '#00C896', QQQM: '#FF9F43', JEPI: '#A78BFA',
  JEPQ: '#FF5A5F', SPY: '#66AFFF', VOO: '#4F8EF7', VXUS: '#FFD93D', QQQI: '#E879F9',
};

type WatchlistItem = {
  ticker: string;
  name: string;
  type: AssetType;
  price: number;
  pct: number;
  sparkPoints: { x: number; y: number }[];
};

const STORAGE_KEY = 'watchlist_items';

const DEFAULT_WATCHLIST: { ticker: string; name: string; type: AssetType }[] = [
  { ticker: 'SCHD', name: 'Schwab US Dividend Equity ETF', type: 'ETF' },
  { ticker: 'QQQM', name: 'Invesco NASDAQ 100 ETF', type: 'ETF' },
  { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', type: 'ETF' },
  { ticker: 'JEPI', name: 'JPMorgan Equity Premium Income ETF', type: 'ETF' },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', type: 'ETF' },
  { ticker: 'AAPL', name: 'Apple Inc.', type: 'STOCK' },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', type: 'STOCK' },
  { ticker: 'BTC', name: 'Bitcoin', type: 'CRYPTO' },
  { ticker: 'ETH', name: 'Ethereum', type: 'CRYPTO' },
];

// ── Sparkline ─────────────────────────────────────────────────
type SparklineProps = {
  points: { x: number; y: number }[];
  isPositive: boolean;
  id: string;
};

const Sparkline = React.memo(({ points, isPositive, id }: SparklineProps) => {
  if (points.length < 2) return <View style={{ width: SPARK_W, height: SPARK_H }} />;
  const color = isPositive ? '#00C896' : '#FF5A5F';
  const gradId = `sg_${id}`;
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${SPARK_H} L0,${SPARK_H} Z`;
  return (
    <Svg width={SPARK_W} height={SPARK_H}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </LinearGradient>
      </Defs>
      <Path d={areaPath} fill={`url(#${gradId})`} />
      <Path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
});

  

// ── Type badge ────────────────────────────────────────────────
function TypeBadge({ type }: { type: AssetType }) {
  const config = {
    ETF: { color: '#338DFF', bg: '#338DFF18' },
    STOCK: { color: '#00C896', bg: '#00C89618' },
    CRYPTO: { color: '#FF9F43', bg: '#FF9F4318' },
  }[type];
  return (
    <View style={[tb.badge, { backgroundColor: config.bg, borderColor: config.color + '44' }]}>
      <Text style={[tb.text, { color: config.color }]}>{type}</Text>
    </View>
  );
}

const tb = StyleSheet.create({
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 0.5 },
  text: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
});

// ── Get icon color for any asset ──────────────────────────────
function getIconColor(ticker: string, type: AssetType): string {
  if (type === 'CRYPTO') return CRYPTO_COLORS[ticker.toUpperCase()] || '#FF9F43';
  if (type === 'ETF') return ETF_COLORS[ticker.toUpperCase()] || '#338DFF';
  return '#00C896';
}

// ── Main Screen ───────────────────────────────────────────────
export default function WatchlistScreen() {
  const router = useRouter();
  const searchInputRef = useRef<TextInput>(null);

  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [savedList, setSavedList] = useState<{ ticker: string; name: string; type: AssetType }[]>([]);
  const savedListRef = useRef<{ ticker: string; name: string; type: AssetType }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('All');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AssetSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Load saved watchlist from AsyncStorage
  const loadSavedList = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as { ticker: string; name: string; type: AssetType }[];
      }
    } catch { }
    // First time — seed with defaults and save
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WATCHLIST));
    return DEFAULT_WATCHLIST;
  }, []);

  // Fetch live prices + sparklines for a list
  const fetchPricesFor = useCallback(async (
    list: { ticker: string; name: string; type: AssetType }[]
  ): Promise<WatchlistItem[]> => {
    return Promise.all(
      list.map(async (e) => {
        try {
          const yahooTicker = e.type === 'CRYPTO' ? `${e.ticker}-USD` : e.ticker;
          const [priceData, history] = await Promise.all([
            e.type === 'CRYPTO' ? getCryptoPrice(e.ticker) : getETFPrice(e.ticker),
            getETFHistory(yahooTicker, '1W'),
          ]);

          const price = priceData?.price ?? 0;
          const pct = priceData?.changesPercentage ?? 0;

          let sparkPoints: { x: number; y: number }[] = [];
          if (history.length >= 2) {
            const vals = history.map(h => h.close);
            const minV = Math.min(...vals);
            const maxV = Math.max(...vals);
            const range = maxV - minV || 1;
            const PAD = 3;
            sparkPoints = history.map((h, i) => ({
              x: (i / (history.length - 1)) * SPARK_W,
              y: PAD + (1 - (h.close - minV) / range) * (SPARK_H - PAD * 2),
            }));
          }
          return { ...e, price, pct, sparkPoints };
        } catch {
          return { ...e, price: 0, pct: 0, sparkPoints: [] };
        }
      })
    );
  }, []);

  const fetchAll = useCallback(async () => {
    const list = await loadSavedList();
    setSavedList(list);
    savedListRef.current = list;
    const results = await fetchPricesFor(list);
    setItems(results);
    setRefreshing(false);
  }, [loadSavedList, fetchPricesFor]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchAll().finally(() => setLoading(false));

      const fullInterval = setInterval(() => {
        fetchAll();
      }, 60000);

      const priceInterval = setInterval(async () => {
        if (savedListRef.current.length === 0) return;
        const updated = await Promise.all(
          savedListRef.current.map(async (e) => {
            const priceData = e.type === 'CRYPTO'
              ? await getCryptoPrice(e.ticker)
              : await getETFPrice(e.ticker);
            return {
              ticker: e.ticker,
              price: priceData?.price ?? 0,
              pct: priceData?.changesPercentage ?? 0,
            };
          })
        );
        setItems(prev => prev.map(item => {
          const u = updated.find(u => u.ticker === item.ticker);
          return u ? { ...item, price: u.price, pct: u.pct } : item;
        }));
      }, 5000);

      return () => {
        clearInterval(fullInterval);
        clearInterval(priceInterval);
      };
    }, [fetchAll])
  );

  // Search debounce
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const results = await searchAsset(searchQuery.trim());
      setSearchResults(results);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Add asset to watchlist
  const addToWatchlist = useCallback(async (asset: AssetSearchResult) => {
    const exists = savedList.some(i => i.ticker === asset.ticker);
    if (exists) {
      setShowSearch(false);
      setSearchQuery('');
      return;
    }
    const newItem = { ticker: asset.ticker, name: asset.name, type: asset.type };
    const newList = [...savedList, newItem];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
    setSavedList(newList);
    savedListRef.current = newList;

    // Fetch price for new item
    const [fetched] = await fetchPricesFor([newItem]);
    setItems(prev => [...prev, fetched]);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  }, [savedList, fetchPricesFor]);

  // Remove asset from watchlist
  const removeFromWatchlist = useCallback(async (ticker: string) => {
    const newList = savedList.filter(i => i.ticker !== ticker);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
    setSavedList(newList);
    savedListRef.current = newList;
    setItems(prev => prev.filter(i => i.ticker !== ticker));
  }, [savedList]);

  // Navigate to correct detail screen
  const navigateTo = useCallback((item: WatchlistItem) => {
    if (item.type === 'ETF') router.push(`/etf/${item.ticker}`);
    else if (item.type === 'STOCK') router.push(`/stock/${item.ticker}` as any);
    else router.push(`/crypto/${item.ticker}` as any);
  }, [router]);

  // Format price for display (handles crypto micro-prices)
  const formatPrice = (price: number, type: AssetType) => {
    if (price === 0) return '—';
    if (type === 'CRYPTO') {
      if (price >= 1000) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (price >= 1) return `$${price.toFixed(4)}`;
      return `$${price.toFixed(6)}`;
    }
    return `$${price.toFixed(2)}`;
  };

  const filtered = filter === 'All'
    ? items
    : items.filter(i => i.type === filter.toUpperCase() as AssetType);

  const displayList = loading
    ? savedList.map(e => ({ ...e, price: 0, pct: 0, sparkPoints: [] }))
    : filtered;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* STATIC HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Watchlist</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              setShowSearch(true);
              setTimeout(() => searchInputRef.current?.focus(), 100);
            }}
          >
            <Ionicons name="add" size={20} color="#338DFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              setShowSearch(true);
              setTimeout(() => searchInputRef.current?.focus(), 100);
            }}
          >
            <Ionicons name="search" size={18} color="#C8D8F0" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchAll(); }}
            tintColor="#338DFF"
            colors={['#338DFF']}
          />
        }
      >
        {/* Filter dropdown */}
        <TouchableOpacity
          style={styles.dropdownBtn}
          onPress={() => setShowDropdown(true)}
          activeOpacity={0.75}
        >
          <Text style={styles.dropdownText}>{filter === 'All' ? 'All Assets' : filter + 's'}</Text>
          <Ionicons name="chevron-down" size={14} color="#338DFF" />
        </TouchableOpacity>

        {/* Watchlist rows */}
        <View style={styles.list}>
          {displayList.map((item) => {
            const iconColor = getIconColor(item.ticker, item.type);
            return (
              <TouchableOpacity
                key={item.ticker}
                style={styles.row}
                activeOpacity={0.75}
                onPress={() => navigateTo(item as WatchlistItem)}
                onLongPress={() => removeFromWatchlist(item.ticker)}
              >
                {/* Left: icon + info */}
                <View style={styles.rowLeft}>
                  <View style={[styles.iconBox, { borderColor: iconColor + '44' }]}>
                    <Text style={[styles.iconText, { color: iconColor }]}>
                      {item.ticker.slice(0, 3)}
                    </Text>
                  </View>
                  <View style={styles.rowMid}>
                    <View style={styles.tickerRow}>
                      <Text style={styles.ticker}>{item.ticker}</Text>
                      <TypeBadge type={item.type} />
                    </View>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  </View>
                </View>

                {/* Center: sparkline */}
                <View style={styles.sparkWrap}>
                  {loading
                    ? <ActivityIndicator size="small" color="#338DFF" />
                    : <Sparkline points={item.sparkPoints} isPositive={item.pct >= 0} id={item.ticker} />
                  }
                </View>

                {/* Right: price + change */}
                <View style={styles.rowRight}>
                  <Text style={styles.price}>
                    {formatPrice(item.price, item.type)}
                  </Text>
                  <Text style={[styles.change, { color: item.pct >= 0 ? '#00C896' : '#FF5A5F' }]}>
                    {item.pct >= 0 ? '+' : ''}{item.pct.toFixed(2)}%
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {displayList.length === 0 && !loading && (
          <View style={styles.emptyWrap}>
            <Ionicons name="eye-off-outline" size={40} color="#2A3A54" />
            <Text style={styles.emptyTitle}>No assets yet</Text>
            <Text style={styles.emptyText}>Tap + to add ETFs, stocks, or crypto</Text>
          </View>
        )}

        <Text style={styles.hintText}>Long press to remove from watchlist</Text>
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── FILTER DROPDOWN MODAL ── */}
      <Modal
        transparent
        visible={showDropdown}
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDropdown(false)}
        >
          <View style={styles.dropdown}>
            {FILTER_OPTIONS.map((opt) => {
              const label = opt === 'All' ? 'All Assets' : opt + 's';
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.dropdownItem, filter === opt && styles.dropdownItemActive]}
                  onPress={() => { setFilter(opt); setShowDropdown(false); }}
                >
                  <Text style={[styles.dropdownItemText, filter === opt && styles.dropdownItemTextActive]}>
                    {label}
                  </Text>
                  {filter === opt && <Ionicons name="checkmark" size={14} color="#338DFF" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── SEARCH MODAL ── */}
      <Modal
        visible={showSearch}
        animationType="slide"
        onRequestClose={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
      >
        <View style={styles.searchModal}>
          <StatusBar barStyle="light-content" />

          {/* Search header */}
          <View style={styles.searchHeader}>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search" size={16} color="#4A6080" style={{ marginRight: 8 }} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search ETFs, stocks, crypto..."
                placeholderTextColor="#4A6080"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                  <Ionicons name="close-circle" size={16} color="#4A6080" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Search results */}
          {searching ? (
            <View style={styles.searchLoading}>
              <ActivityIndicator color="#338DFF" />
              <Text style={styles.searchLoadingText}>Searching…</Text>
            </View>
          ) : searchQuery.length === 0 ? (
            <View style={styles.searchEmpty}>
              <Text style={styles.searchEmptyTitle}>Search any asset</Text>
              <Text style={styles.searchEmptyText}>
                Type a ticker (AAPL, BTC, VOO) or name to find ETFs, stocks, and crypto
              </Text>
              {/* Quick add suggestions */}
              <Text style={[styles.searchEmptyTitle, { marginTop: 24, fontSize: 11, letterSpacing: 1.5, color: '#4A6A9A' }]}>
                POPULAR
              </Text>
              <View style={styles.suggestions}>
                {['QQQ', 'MSFT', 'TSLA', 'BTC', 'ETH', 'SOL', 'IVV', 'ARKK'].map((t) => {
                  const isCrypto = CRYPTO_TICKERS.has(t);
                  const type: AssetType = isCrypto ? 'CRYPTO' : 'ETF';
                  return (
                    <TouchableOpacity
                      key={t}
                      style={styles.suggestionChip}
                      onPress={() => setSearchQuery(t)}
                    >
                      <Text style={styles.suggestionText}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : searchResults.length === 0 ? (
            <View style={styles.searchEmpty}>
              <Text style={styles.searchEmptyText}>No results for "{searchQuery}"</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.ticker}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}
              renderItem={({ item }) => {
                const alreadyAdded = savedList.some(i => i.ticker === item.ticker);
                const iconColor = getIconColor(item.ticker, item.type);
                return (
                  <TouchableOpacity
                    style={styles.searchResultRow}
                    onPress={() => addToWatchlist(item)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.searchResultIcon, { borderColor: iconColor + '44' }]}>
                      <Text style={[styles.searchResultIconText, { color: iconColor }]}>
                        {item.ticker.slice(0, 3)}
                      </Text>
                    </View>
                    <View style={styles.searchResultMid}>
                      <View style={styles.tickerRow}>
                        <Text style={styles.searchResultTicker}>{item.ticker}</Text>
                        <TypeBadge type={item.type} />
                      </View>
                      <Text style={styles.searchResultName} numberOfLines={1}>{item.name}</Text>
                    </View>
                    <View style={styles.searchResultRight}>
                      {alreadyAdded ? (
                        <Ionicons name="checkmark-circle" size={20} color="#00C896" />
                      ) : (
                        <View style={styles.addBtn}>
                          <Ionicons name="add" size={16} color="#338DFF" />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: '#0B0F19',
  },
  scroll: { flex: 1, paddingHorizontal: 16 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#E8EEF8' },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#141A26', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#141A26', alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 0.5, borderColor: '#338DFF', marginBottom: 16 },
  dropdownText: { fontSize: 13, color: '#338DFF', fontWeight: '600' },
  list: { gap: 8 },
  row: { backgroundColor: '#141A26', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', gap: 8 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#0D1830', borderWidth: 0.5, justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 10, fontWeight: '800' },
  rowMid: { flex: 1 },
  tickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  ticker: { fontSize: 14, fontWeight: '700', color: '#E8EEF8' },
  name: { fontSize: 10, color: '#4A6080' },
  sparkWrap: { width: SPARK_W, alignItems: 'center', justifyContent: 'center' },
  rowRight: { alignItems: 'flex-end', minWidth: 70 },
  price: { fontSize: 13, fontWeight: '600', color: '#E8EEF8', fontVariant: ['tabular-nums'] },
  change: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, color: '#E8EEF8', fontWeight: '600' },
  emptyText: { fontSize: 13, color: '#4A6080' },
  hintText: { fontSize: 10, color: '#2A3A54', textAlign: 'center', marginTop: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', paddingTop: 160, paddingHorizontal: 20 },
  dropdown: { backgroundColor: '#141A26', borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)' },
  dropdownItemActive: { backgroundColor: '#338DFF11' },
  dropdownItemText: { fontSize: 14, color: '#C8D8F0' },
  dropdownItemTextActive: { color: '#338DFF', fontWeight: '600' },
  // Search modal
  searchModal: { flex: 1, backgroundColor: '#0B0F19', paddingTop: 60 },
  searchHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#141A26', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  searchInput: { flex: 1, fontSize: 15, color: '#E8EEF8', padding: 0 },
  cancelBtn: { paddingVertical: 8, paddingLeft: 4 },
  cancelText: { fontSize: 14, color: '#338DFF', fontWeight: '500' },
  searchLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  searchLoadingText: { fontSize: 13, color: '#4A6080' },
  searchEmpty: { flex: 1, alignItems: 'center', paddingTop: 40, paddingHorizontal: 32 },
  searchEmptyTitle: { fontSize: 16, color: '#E8EEF8', fontWeight: '600', marginBottom: 8 },
  searchEmptyText: { fontSize: 13, color: '#4A6080', textAlign: 'center', lineHeight: 20 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'center' },
  suggestionChip: { backgroundColor: '#141A26', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  suggestionText: { fontSize: 13, color: '#C8D8F0', fontWeight: '600' },
  searchResultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  searchResultIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#0D1830', borderWidth: 0.5, justifyContent: 'center', alignItems: 'center' },
  searchResultIconText: { fontSize: 10, fontWeight: '800' },
  searchResultMid: { flex: 1 },
  searchResultTicker: { fontSize: 14, fontWeight: '700', color: '#E8EEF8' },
  searchResultName: { fontSize: 11, color: '#4A6080', marginTop: 2 },
  searchResultRight: { width: 32, alignItems: 'center' },
  addBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#338DFF18', borderWidth: 0.5, borderColor: '#338DFF44', justifyContent: 'center', alignItems: 'center' },
});