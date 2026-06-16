// app/portfolio/transactions.tsx
// Global Transaction History — all tickers, filterable by ticker/type/date.
// Accepts optional ?ticker= param to pre-filter when arriving from an asset detail screen.

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert, FlatList, Modal, StatusBar, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import TransactionRow, { TransactionRowData } from '../../components/TransactionRow';
import { usePortfolioTransactions } from '../hooks/usePortfolioTransactions';

type TypeFilter = 'All' | 'BUY' | 'SELL';
type DateFilter = 'All Time' | 'This Month' | 'Last 3 Months' | 'This Year';

const DATE_FILTERS: DateFilter[] = ['All Time', 'This Month', 'Last 3 Months', 'This Year'];
const TYPE_FILTERS: TypeFilter[] = ['All', 'BUY', 'SELL'];

function withinDateRange(dateStr: string, filter: DateFilter): boolean {
  if (filter === 'All Time') return true;
  const date = new Date(dateStr + 'T00:00:00');
  const now = new Date();

  if (filter === 'This Year') {
    return date.getFullYear() === now.getFullYear();
  }
  if (filter === 'This Month') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }
  if (filter === 'Last 3 Months') {
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);
    return date >= threeMonthsAgo;
  }
  return true;
}

export default function TransactionHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ticker?: string }>();
  const { transactions, deleteTransaction } = usePortfolioTransactions();

  const [tickerFilter, setTickerFilter] = useState<string>(params.ticker?.toUpperCase() ?? 'All');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [dateFilter, setDateFilter] = useState<DateFilter>('All Time');
  const [showTickerDropdown, setShowTickerDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  // Pre-filtered context — hide ticker dropdown if arrived via asset detail "View All"
  const lockedToTicker = !!params.ticker;

  const availableTickers = useMemo(() => {
    const set = new Set(transactions.map(t => t.ticker));
    return ['All', ...Array.from(set).sort()];
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions
      .filter(t => tickerFilter === 'All' || t.ticker === tickerFilter)
      .filter(t => typeFilter === 'All' || t.transactionType === typeFilter)
      .filter(t => withinDateRange(t.date, dateFilter))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [transactions, tickerFilter, typeFilter, dateFilter]);

  function handleDelete(transactionId: string): Promise<void> {
    return new Promise((resolve) => {
      Alert.alert(
        'Delete Transaction',
        'This will permanently remove this transaction and recalculate your position. Continue?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await deleteTransaction(transactionId);
              resolve();
            },
          },
        ]
      );
    });
  }

  const activeFilterCount =
    (tickerFilter !== 'All' ? 1 : 0) +
    (typeFilter !== 'All' ? 1 : 0) +
    (dateFilter !== 'All Time' ? 1 : 0);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#338DFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>
          {lockedToTicker ? `${tickerFilter} Transactions` : 'Transaction History'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Filter row */}
      <View style={s.filterRow}>
        {!lockedToTicker && (
          <TouchableOpacity style={s.filterChip} onPress={() => setShowTickerDropdown(true)}>
            <Text style={s.filterChipText}>{tickerFilter === 'All' ? 'All Tickers' : tickerFilter}</Text>
            <Ionicons name="chevron-down" size={12} color="#338DFF" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.filterChip} onPress={() => setShowTypeDropdown(true)}>
          <Text style={s.filterChipText}>{typeFilter === 'All' ? 'All Types' : typeFilter}</Text>
          <Ionicons name="chevron-down" size={12} color="#338DFF" />
        </TouchableOpacity>
        <TouchableOpacity style={s.filterChip} onPress={() => setShowDateDropdown(true)}>
          <Text style={s.filterChipText}>{dateFilter}</Text>
          <Ionicons name="chevron-down" size={12} color="#338DFF" />
        </TouchableOpacity>
        {activeFilterCount > 0 && (
          <TouchableOpacity
            style={s.clearChip}
            onPress={() => { setTickerFilter(lockedToTicker ? tickerFilter : 'All'); setTypeFilter('All'); setDateFilter('All Time'); }}
          >
            <Ionicons name="close-circle" size={14} color="#4A6080" />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.transactionId}
        contentContainerStyle={s.listContent}
        renderItem={({ item }) => (
          <TransactionRow
            transaction={item as TransactionRowData}
            showTicker={!lockedToTicker}
            onDelete={handleDelete}
          />
        )}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Ionicons name="receipt-outline" size={44} color="#2A3A54" />
            <Text style={s.emptyTitle}>No transactions found</Text>
            <Text style={s.emptyText}>
              {activeFilterCount > 0 ? 'Try adjusting your filters' : 'Tap + on Portfolio to add your first transaction'}
            </Text>
          </View>
        }
      />

      {/* Ticker dropdown */}
      <Modal transparent visible={showTickerDropdown} animationType="fade" onRequestClose={() => setShowTickerDropdown(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowTickerDropdown(false)}>
          <View style={s.dropdown}>
            <FlatList
              data={availableTickers}
              keyExtractor={(t) => t}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.dropdownItem, tickerFilter === item && s.dropdownItemActive]}
                  onPress={() => { setTickerFilter(item); setShowTickerDropdown(false); }}
                >
                  <Text style={[s.dropdownItemText, tickerFilter === item && s.dropdownItemTextActive]}>
                    {item === 'All' ? 'All Tickers' : item}
                  </Text>
                  {tickerFilter === item && <Ionicons name="checkmark" size={14} color="#338DFF" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Type dropdown */}
      <Modal transparent visible={showTypeDropdown} animationType="fade" onRequestClose={() => setShowTypeDropdown(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowTypeDropdown(false)}>
          <View style={s.dropdown}>
            {TYPE_FILTERS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[s.dropdownItem, typeFilter === opt && s.dropdownItemActive]}
                onPress={() => { setTypeFilter(opt); setShowTypeDropdown(false); }}
              >
                <Text style={[s.dropdownItemText, typeFilter === opt && s.dropdownItemTextActive]}>
                  {opt === 'All' ? 'All Types' : opt}
                </Text>
                {typeFilter === opt && <Ionicons name="checkmark" size={14} color="#338DFF" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Date dropdown */}
      <Modal transparent visible={showDateDropdown} animationType="fade" onRequestClose={() => setShowDateDropdown(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowDateDropdown(false)}>
          <View style={s.dropdown}>
            {DATE_FILTERS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[s.dropdownItem, dateFilter === opt && s.dropdownItemActive]}
                onPress={() => { setDateFilter(opt); setShowDateDropdown(false); }}
              >
                <Text style={[s.dropdownItemText, dateFilter === opt && s.dropdownItemTextActive]}>{opt}</Text>
                {dateFilter === opt && <Ionicons name="checkmark" size={14} color="#338DFF" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#E8EEF8' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12, flexWrap: 'wrap' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#141A26', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16, borderWidth: 0.5, borderColor: '#338DFF44',
  },
  filterChipText: { fontSize: 12, color: '#338DFF', fontWeight: '600' },
  clearChip: { padding: 6, justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, color: '#E8EEF8', fontWeight: '600' },
  emptyText: { fontSize: 13, color: '#4A6080', textAlign: 'center', paddingHorizontal: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', paddingTop: 140, paddingHorizontal: 20 },
  dropdown: { backgroundColor: '#141A26', borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  dropdownItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  dropdownItemActive: { backgroundColor: '#338DFF11' },
  dropdownItemText: { fontSize: 14, color: '#C8D8F0' },
  dropdownItemTextActive: { color: '#338DFF', fontWeight: '600' },
});
