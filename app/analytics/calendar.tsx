// app/analytics/calendar.tsx
//
// Dividend Calendar — two sections:
//   1. Upcoming Payments (next 12 months, from pay dates in dividendService)
//   2. Dividend History (last 12 months, from getETFDividends via dividendService)
//
// If upcoming section is empty, falls back to history automatically.
// Screen should almost never appear blank when dividend history exists.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { usePortfolioData } from '../../app/hooks/usePortfolioData';
import { getETFDividends } from '../../app/services/api';
import { useDividendData } from '../../hooks/useDividendData';

// ─── Types ────────────────────────────────────────────────────────────────────

type HistoryEntry = {
  ticker: string;
  date: string;           // display string e.g. "Jun 15, 2025"
  isoDate: string;        // YYYY-MM-DD for sorting
  amount: number;         // per share
  incomeReceived: number; // amount × shares held
  month: string;          // e.g. "June 2025"
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIso(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function formatMonth(isoDate: string): string {
  try {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch { return isoDate.slice(0, 7); }
}

function formatDisplayDate(isoDate: string): string {
  try {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return isoDate; }
}

function formatCurrency(v: number): string {
  return `$${v.toFixed(2)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DividendCalendar() {
  const router = useRouter();
  const { positions, loading: portfolioLoading } = usePortfolioData();
  const { calendar, loading: dividendLoading, refresh: refreshDividend } = useDividendData();

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<'upcoming' | 'history'>('upcoming');

  const loading = portfolioLoading || dividendLoading;

  // Build history from getETFDividends for each position
  async function fetchHistory() {
    if (positions.length === 0) return;
    setHistoryLoading(true);

    const twelveMonthsAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const entries: HistoryEntry[] = [];

    await Promise.allSettled(
      positions
        .filter(p => p.qty > 0)
        .map(async p => {
          try {
            const divs = await getETFDividends(p.ticker);
            for (const d of divs) {
              if (!d.timestamp) continue;
              const ts = d.timestamp * 1000;
              if (ts < twelveMonthsAgo) continue;
              const isoDate = toIso(d.timestamp);
              entries.push({
                ticker: p.ticker,
                date: d.date,
                isoDate,
                amount: d.amount,
                incomeReceived: d.amount * p.qty,
                month: formatMonth(isoDate),
              });
            }
          } catch { /* skip failed tickers */ }
        })
    );

    // Sort newest first
    entries.sort((a, b) => b.isoDate.localeCompare(a.isoDate));
    setHistory(entries);
    setHistoryLoading(false);
  }

  useEffect(() => {
    if (!portfolioLoading && positions.length > 0) {
      fetchHistory();
    }
  }, [portfolioLoading, positions.length]);

  // Auto-switch to history if upcoming is empty but history exists
  useEffect(() => {
    if (!loading && !historyLoading && calendar.length === 0 && history.length > 0) {
      setActiveSection('history');
    }
  }, [loading, historyLoading, calendar.length, history.length]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.allSettled([refreshDividend(), fetchHistory()]);
    setRefreshing(false);
  }

  // Group calendar entries by month
  const upcomingByMonth: Record<string, typeof calendar> = {};
  for (const entry of calendar) {
    if (!upcomingByMonth[entry.month]) upcomingByMonth[entry.month] = [];
    upcomingByMonth[entry.month].push(entry);
  }

  // Group history entries by month
  const historyByMonth: Record<string, HistoryEntry[]> = {};
  for (const entry of history) {
    if (!historyByMonth[entry.month]) historyByMonth[entry.month] = [];
    historyByMonth[entry.month].push(entry);
  }

  const upcomingTotal = calendar.reduce((s, e) => s + e.expectedIncome, 0);
  const historyTotal = history.reduce((s, e) => s + e.incomeReceived, 0);

  const showLoading = loading || historyLoading;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#C8D8F0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dividend Calendar</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Section toggle */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeSection === 'upcoming' && styles.tabBtnActive]}
          onPress={() => setActiveSection('upcoming')}>
          <Text style={[styles.tabBtnText, activeSection === 'upcoming' && styles.tabBtnTextActive]}>
            Upcoming
          </Text>
          {calendar.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{calendar.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeSection === 'history' && styles.tabBtnActive]}
          onPress={() => setActiveSection('history')}>
          <Text style={[styles.tabBtnText, activeSection === 'history' && styles.tabBtnTextActive]}>
            History
          </Text>
          {history.length > 0 && (
            <View style={[styles.tabBadge, styles.tabBadgeHistory]}>
              <Text style={styles.tabBadgeText}>{history.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#338DFF" />
        }>

        {showLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#338DFF" />
            <Text style={styles.loadingText}>
              {historyLoading ? 'Loading dividend history…' : 'Loading calendar…'}
            </Text>
          </View>
        )}

        {/* ── UPCOMING SECTION ──────────────────────────────────── */}
        {!showLoading && activeSection === 'upcoming' && (
          <>
            {calendar.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={36} color="#4A6A9A" />
                <Text style={styles.emptyText}>No upcoming payments found</Text>
                <Text style={styles.emptySubtext}>
                  Pay dates for the next 3 months haven't been announced yet.
                </Text>
                {history.length > 0 && (
                  <TouchableOpacity
                    style={styles.switchButton}
                    onPress={() => setActiveSection('history')}>
                    <Text style={styles.switchButtonText}>
                      View {history.length} historical payments instead
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                {/* Summary */}
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Expected next 3 months</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(upcomingTotal)}</Text>
                </View>

                {/* Grouped by month */}
                {Object.keys(upcomingByMonth).map(month => {
                  const entries = upcomingByMonth[month];
                  const monthTotal = entries.reduce((s, e) => s + e.expectedIncome, 0);
                  return (
                    <View key={month}>
                      <View style={styles.monthHeader}>
                        <Text style={styles.monthTitle}>{month}</Text>
                        <Text style={styles.monthTotal}>{formatCurrency(monthTotal)}</Text>
                      </View>
                      <View style={styles.card}>
                        {entries.map((entry, i) => (
                          <View
                            key={`${entry.ticker}-${entry.payDate}`}
                            style={[styles.entryRow, i < entries.length - 1 && styles.rowBorder]}>
                            <View style={styles.entryLeft}>
                              <Text style={styles.entryTicker}>{entry.ticker}</Text>
                              <View style={styles.datesRow}>
                                {entry.exDividendDate && (
                                  <Text style={styles.entryDate}>
                                    Ex: {formatDisplayDate(entry.exDividendDate)}
                                  </Text>
                                )}
                                <Text style={styles.entryDate}>
                                  Pay: {formatDisplayDate(entry.payDate)}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.entryRight}>
                              <Text style={styles.entryIncome}>
                                {formatCurrency(entry.expectedIncome)}
                              </Text>
                              <Text style={styles.entryLabel}>expected</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}

                <Text style={styles.disclaimer}>
                  Expected income is based on the most recent dividend payment and current share count. Actual amounts may vary.
                </Text>
              </>
            )}
          </>
        )}

        {/* ── HISTORY SECTION ───────────────────────────────────── */}
        {!showLoading && activeSection === 'history' && (
          <>
            {history.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="time-outline" size={36} color="#4A6A9A" />
                <Text style={styles.emptyText}>No dividend history found</Text>
                <Text style={styles.emptySubtext}>
                  No dividend payments detected in the last 12 months for your current holdings.
                </Text>
              </View>
            ) : (
              <>
                {/* Summary */}
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Received last 12 months</Text>
                  <Text style={[styles.summaryValue, { color: '#00C896' }]}>
                    {formatCurrency(historyTotal)}
                  </Text>
                </View>

                {/* Grouped by month */}
                {Object.keys(historyByMonth).map(month => {
                  const entries = historyByMonth[month];
                  const monthTotal = entries.reduce((s, e) => s + e.incomeReceived, 0);
                  return (
                    <View key={month}>
                      <View style={styles.monthHeader}>
                        <Text style={styles.monthTitle}>{month}</Text>
                        <Text style={styles.monthTotal}>{formatCurrency(monthTotal)}</Text>
                      </View>
                      <View style={styles.card}>
                        {entries.map((entry, i) => (
                          <View
                            key={`${entry.ticker}-${entry.isoDate}`}
                            style={[styles.entryRow, i < entries.length - 1 && styles.rowBorder]}>
                            <View style={styles.entryLeft}>
                              <Text style={styles.entryTicker}>{entry.ticker}</Text>
                              <Text style={styles.entryDate}>{entry.date}</Text>
                            </View>
                            <View style={styles.entryRight}>
                              <Text style={[styles.entryIncome, { color: '#00C896' }]}>
                                {formatCurrency(entry.incomeReceived)}
                              </Text>
                              <Text style={styles.entryLabel}>
                                ${entry.amount.toFixed(4)}/share
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}

                <Text style={styles.disclaimer}>
                  History shows dividends paid on your current share count. Actual received amounts may differ if your position size changed.
                </Text>
              </>
            )}
          </>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingHorizontal: 16, paddingBottom: 12,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#E8EEF8' },
  tabRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#141A26', borderRadius: 10, padding: 3,
  },
  tabBtn: {
    flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  tabBtnActive: { backgroundColor: '#1E2A3A' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#4A6A9A' },
  tabBtnTextActive: { color: '#E8EEF8' },
  tabBadge: {
    backgroundColor: 'rgba(51,141,255,0.2)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  tabBadgeHistory: { backgroundColor: 'rgba(0,200,150,0.2)' },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: '#C8D8F0' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  loadingContainer: { alignItems: 'center', paddingVertical: 60, gap: 16 },
  loadingText: { fontSize: 14, color: '#4A6A9A' },
  summaryCard: {
    backgroundColor: '#141A26', borderRadius: 12, padding: 16,
    alignItems: 'center', marginBottom: 20,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  summaryLabel: { fontSize: 12, color: '#4A6A9A', marginBottom: 6 },
  summaryValue: { fontSize: 28, fontWeight: '700', color: '#338DFF' },
  monthHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8, marginTop: 4,
  },
  monthTitle: { fontSize: 15, fontWeight: '700', color: '#E8EEF8' },
  monthTotal: { fontSize: 14, fontWeight: '600', color: '#00C896' },
  card: {
    backgroundColor: '#141A26', borderRadius: 14, marginBottom: 20,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  entryRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' },
  entryLeft: { flex: 1 },
  entryTicker: { fontSize: 15, fontWeight: '700', color: '#E8EEF8', marginBottom: 4 },
  datesRow: { flexDirection: 'row', gap: 12 },
  entryDate: { fontSize: 12, color: '#4A6A9A' },
  entryRight: { alignItems: 'flex-end' },
  entryIncome: { fontSize: 16, fontWeight: '700', color: '#338DFF' },
  entryLabel: { fontSize: 11, color: '#4A6080', marginTop: 2 },
  emptyCard: {
    alignItems: 'center', paddingVertical: 48, gap: 10,
    backgroundColor: '#141A26', borderRadius: 14,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 24,
  },
  emptyText: { fontSize: 15, color: '#C8D8F0', fontWeight: '600' },
  emptySubtext: { fontSize: 13, color: '#4A6A9A', textAlign: 'center', lineHeight: 20 },
  switchButton: {
    marginTop: 8, backgroundColor: 'rgba(51,141,255,0.15)',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
  },
  switchButtonText: { fontSize: 13, color: '#338DFF', fontWeight: '600' },
  disclaimer: {
    fontSize: 11, color: '#4A6080', textAlign: 'center',
    lineHeight: 18, paddingHorizontal: 16, marginTop: 4,
  },
});
