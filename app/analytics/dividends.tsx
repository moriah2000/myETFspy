// app/analytics/dividends.tsx
//
// Dividend Intelligence Dashboard
// Accessible from Settings → Analytics → Dividend Intelligence

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useDividendData } from '../../hooks/useDividendData';

function formatCurrency(v: number): string {
  if (v >= 1000) return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${v.toFixed(2)}`;
}

function formatPct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

const SOURCE_LABEL: Record<string, string> = {
  'history-12m': '12-month history',
  'history-annualized': 'annualized',
  'yield-price': 'yield estimate',
  'none': 'no data',
  'pending': 'loading…',
};

export default function DividendDashboard() {
  const router = useRouter();
  const {
    annualIncome, monthlyIncome, next12MonthsIncome,
    portfolioYield, yieldOnCost, byTicker, loading, error, refresh,
  } = useDividendData();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#C8D8F0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dividend Intelligence</Text>
        <TouchableOpacity onPress={() => router.push('/analytics/calendar')} style={styles.calendarButton}>
          <Ionicons name="calendar-outline" size={22} color="#338DFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#338DFF" />}
      >
        {loading && byTicker.length === 0 && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#338DFF" />
            <Text style={styles.loadingText}>Loading dividend data…</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#FF5A5F" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && byTicker.length === 0 && !error && (
          <View style={styles.emptyCard}>
            <Ionicons name="cash-outline" size={36} color="#4A6A9A" />
            <Text style={styles.emptyText}>No positions found.</Text>
            <Text style={styles.emptySubtext}>Add transactions to see dividend income.</Text>
          </View>
        )}

        {byTicker.length > 0 && (
          <>
            {/* ── Summary metrics ───────────────────────────────── */}
            <Text style={styles.sectionLabel}>INCOME SUMMARY</Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Annual Income</Text>
                <Text style={styles.metricValue}>{formatCurrency(annualIncome)}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Monthly Income</Text>
                <Text style={styles.metricValue}>{formatCurrency(monthlyIncome)}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Next 12 Months</Text>
                <Text style={[styles.metricValue, { color: '#00C896' }]}>{formatCurrency(next12MonthsIncome)}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Portfolio Yield</Text>
                <Text style={styles.metricValue}>{formatPct(portfolioYield)}</Text>
              </View>
              <View style={[styles.metricCard, styles.metricCardWide]}>
                <Text style={styles.metricLabel}>Yield on Cost</Text>
                <Text style={styles.metricValue}>{formatPct(yieldOnCost)}</Text>
                <Text style={styles.metricSub}>Based on FIFO cost basis</Text>
              </View>
            </View>

            {/* ── Per-ticker breakdown ──────────────────────────── */}
            <Text style={styles.sectionLabel}>BY POSITION</Text>
            <View style={styles.card}>
              {byTicker
                .sort((a, b) => b.annualIncome - a.annualIncome)
                .map((t, i, arr) => (
                  <View key={t.ticker} style={[styles.tickerRow, i < arr.length - 1 && styles.rowBorder]}>
                    <View style={styles.tickerLeft}>
                      <Text style={styles.tickerSymbol}>{t.ticker}</Text>
                      <Text style={styles.tickerFreq}>
                        {t.dividendFrequency === 'None' || t.dividendFrequency === 'Unknown'
                          ? 'No dividend'
                          : `${t.dividendFrequency} · ${SOURCE_LABEL[t.source] ?? t.source}`
                        }
                      </Text>
                    </View>
                    <View style={styles.tickerRight}>
                      <Text style={styles.tickerAnnual}>{formatCurrency(t.annualIncome)}<Text style={styles.tickerPer}>/yr</Text></Text>
                      <Text style={styles.tickerMonthly}>{formatCurrency(t.monthlyIncome)}/mo</Text>
                    </View>
                  </View>
                ))}
            </View>

            {/* ── Calendar shortcut ─────────────────────────────── */}
            <TouchableOpacity
              style={styles.calendarCard}
              onPress={() => router.push('/analytics/calendar')}
              activeOpacity={0.8}>
              <Ionicons name="calendar-outline" size={20} color="#338DFF" />
              <Text style={styles.calendarCardText}>View Dividend Calendar</Text>
              <Ionicons name="chevron-forward" size={18} color="#4A6080" />
            </TouchableOpacity>
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
    paddingTop: 60, paddingHorizontal: 16, paddingBottom: 16,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  calendarButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#E8EEF8' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  loadingContainer: { alignItems: 'center', paddingVertical: 60, gap: 16 },
  loadingText: { fontSize: 14, color: '#4A6A9A' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,90,95,0.1)', borderRadius: 10, padding: 12,
    marginBottom: 16, borderWidth: 0.5, borderColor: 'rgba(255,90,95,0.3)',
  },
  errorText: { fontSize: 13, color: '#FF5A5F', flex: 1 },
  emptyCard: {
    alignItems: 'center', paddingVertical: 48, gap: 8,
    backgroundColor: '#141A26', borderRadius: 14,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyText: { fontSize: 15, color: '#C8D8F0', fontWeight: '600' },
  emptySubtext: { fontSize: 13, color: '#4A6A9A' },
  sectionLabel: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 10 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  metricCard: {
    flex: 1, minWidth: '45%', backgroundColor: '#141A26', borderRadius: 12, padding: 14,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  metricCardWide: { minWidth: '100%' },
  metricLabel: { fontSize: 11, color: '#4A6A9A', letterSpacing: 0.5, marginBottom: 6 },
  metricValue: { fontSize: 20, fontWeight: '700', color: '#E8EEF8' },
  metricSub: { fontSize: 11, color: '#4A6080', marginTop: 4 },
  card: {
    backgroundColor: '#141A26', borderRadius: 14, marginBottom: 20,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  tickerRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' },
  tickerLeft: { flex: 1 },
  tickerSymbol: { fontSize: 15, fontWeight: '700', color: '#E8EEF8', marginBottom: 2 },
  tickerFreq: { fontSize: 12, color: '#4A6A9A' },
  tickerRight: { alignItems: 'flex-end' },
  tickerAnnual: { fontSize: 15, fontWeight: '600', color: '#E8EEF8' },
  tickerPer: { fontSize: 12, fontWeight: '400', color: '#4A6A9A' },
  tickerMonthly: { fontSize: 12, color: '#4A6080', marginTop: 2 },
  calendarCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#141A26', borderRadius: 12, padding: 16,
    borderWidth: 0.5, borderColor: 'rgba(51,141,255,0.2)',
  },
  calendarCardText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#C8D8F0' },
});
