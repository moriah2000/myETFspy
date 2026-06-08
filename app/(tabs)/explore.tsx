import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { getETFPrice } from '../services/api';

const DEFAULT_WATCHLIST = [
  { ticker: 'SCHD', name: 'Schwab US Dividend Equity ETF', yield: '3.65%' },
  { ticker: 'QQQM', name: 'Invesco NASDAQ 100 ETF', yield: '0.64%' },
  { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', yield: '1.52%' },
  { ticker: 'JEPI', name: 'JPMorgan Equity Premium Income ETF', yield: '8.19%' },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', yield: '1.28%' },
];

type WatchItem = {
  ticker: string;
  name: string;
  yield: string;
  price: number;
  pct: number;
};

export default function WatchlistScreen() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPrices = useCallback(async () => {
    try {
      const prices = await Promise.all(
        DEFAULT_WATCHLIST.map((e) => getETFPrice(e.ticker))
      );
      const data: WatchItem[] = DEFAULT_WATCHLIST.map((e, i) => ({
        ...e,
        price: prices[i]?.price ?? 0,
        pct: prices[i]?.changesPercentage ?? 0,
      }));
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPrices();
  }, [fetchPrices]);

  useFocusEffect(
    useCallback(() => {
      setItems([]);
      setLoading(true);
      fetchPrices();
    }, [])
  );

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#338DFF"
          colors={['#338DFF']}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Watchlist</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="add" size={20} color="#338DFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="search" size={18} color="#C8D8F0" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter */}
      <View style={styles.filterRow}>
        {['All ETFs', 'Dividend', 'Growth', 'Index'].map((f, i) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, i === 0 && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, i === 0 && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ETF List */}
      <View style={styles.list}>
        {(loading ? DEFAULT_WATCHLIST.map(e => ({ ...e, price: 0, pct: 0 })) : items).map((item) => (
          <View key={item.ticker} style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={styles.iconBox}>
                <Text style={styles.iconText}>{item.ticker.slice(0, 1)}</Text>
              </View>
              <View>
                <Text style={styles.ticker}>{item.ticker}</Text>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.yieldText}>Yield {item.yield}</Text>
              </View>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.price}>
                {item.price > 0 ? `$${item.price.toFixed(2)}` : '—'}
              </Text>
              <Text style={[styles.change, { color: item.pct >= 0 ? '#00C896' : '#FF5A5F' }]}>
                {item.pct >= 0 ? '+' : ''}{item.pct.toFixed(2)}%
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 60, marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#E8EEF8' },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#141A26', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#141A26', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  filterChipActive: { backgroundColor: '#338DFF22', borderColor: '#338DFF' },
  filterText: { fontSize: 12, color: '#4A6080', fontWeight: '500' },
  filterTextActive: { color: '#338DFF' },
  list: { gap: 8 },
  row: { backgroundColor: '#141A26', borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBox: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#0D1830', borderWidth: 0.5, borderColor: 'rgba(51,141,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 16, fontWeight: '700', color: '#338DFF' },
  ticker: { fontSize: 14, fontWeight: '700', color: '#E8EEF8' },
  name: { fontSize: 11, color: '#4A6080', marginTop: 1, maxWidth: 180 },
  yieldText: { fontSize: 11, color: '#00C896', marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  price: { fontSize: 15, fontWeight: '600', color: '#E8EEF8', fontVariant: ['tabular-nums'] },
  change: { fontSize: 12, fontWeight: '600', marginTop: 2 },
});