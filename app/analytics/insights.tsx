// app/analytics/insights.tsx
//
// Insights screen — Top Holdings, Diversification Score, Concentration Risk
// Space reserved for: Largest Winner, Largest Loser, Volatility, Income Stability

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { usePortfolioAnalytics } from '../../hooks/usePortfolioAnalytics';

type DiversificationGrade = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'N/A';
type ConcentrationStatus = 'Healthy' | 'Warning' | 'High Risk';

const GRADE_CONFIG: Record<DiversificationGrade, { color: string; bg: string; border: string }> = {
  Excellent: { color: '#00C896', bg: 'rgba(0,200,150,0.1)', border: 'rgba(0,200,150,0.3)' },
  Good:      { color: '#338DFF', bg: 'rgba(51,141,255,0.1)', border: 'rgba(51,141,255,0.3)' },
  Fair:      { color: '#FF9F43', bg: 'rgba(255,159,67,0.1)', border: 'rgba(255,159,67,0.3)' },
  Poor:      { color: '#FF5A5F', bg: 'rgba(255,90,95,0.1)', border: 'rgba(255,90,95,0.3)' },
  'N/A':     { color: '#4A6A9A', bg: 'rgba(74,106,154,0.1)', border: 'rgba(74,106,154,0.3)' },
};

const RISK_CONFIG: Record<ConcentrationStatus, { color: string; icon: string }> = {
  Healthy:    { color: '#00C896', icon: 'checkmark-circle' },
  Warning:    { color: '#FF9F43', icon: 'warning' },
  'High Risk':{ color: '#FF5A5F', icon: 'alert-circle' },
};

function formatCurrency(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

const ASSET_COLORS: Record<string, string> = {
  ETF: '#338DFF', STOCK: '#00C896', CRYPTO: '#FF9F43',
};

export default function InsightsScreen() {
  const router = useRouter();
  const { topHoldings, concentrationRisk, diversification, loading, error } =
    usePortfolioAnalytics();

  const gradeConfig = GRADE_CONFIG[diversification.grade];
  const riskConfig = RISK_CONFIG[concentrationRisk.status];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#C8D8F0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Portfolio Insights</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#338DFF" />
            <Text style={styles.loadingText}>Analysing portfolio…</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#FF5A5F" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && (
          <>
            {/* ── Diversification Score ─────────────────────────── */}
            <Text style={styles.sectionLabel}>DIVERSIFICATION</Text>
            <View style={[styles.gradeCard, { backgroundColor: gradeConfig.bg, borderColor: gradeConfig.border }]}>
              <Text style={[styles.gradeLabel, { color: gradeConfig.color }]}>
                {diversification.grade}
              </Text>
              <View style={styles.reasonsList}>
                {diversification.reasons.map((r, i) => (
                  <View key={i} style={styles.reasonRow}>
                    <Text style={styles.reasonBullet}>•</Text>
                    <Text style={styles.reasonText}>{r}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ── Concentration Risk ────────────────────────────── */}
            <Text style={styles.sectionLabel}>CONCENTRATION RISK</Text>
            <View style={styles.card}>
              <View style={styles.riskHeader}>
                <Ionicons name={riskConfig.icon as any} size={22} color={riskConfig.color} />
                <Text style={[styles.riskStatus, { color: riskConfig.color }]}>
                  {concentrationRisk.status}
                </Text>
              </View>
              <Text style={styles.riskMessage}>{concentrationRisk.message}</Text>
              {concentrationRisk.largestHolding !== '—' && (
                <View style={styles.riskMetrics}>
                  <View style={styles.riskMetric}>
                    <Text style={styles.riskMetricLabel}>Largest Position</Text>
                    <Text style={styles.riskMetricValue}>
                      {concentrationRisk.largestHolding} · {concentrationRisk.largestHoldingWeight.toFixed(1)}%
                    </Text>
                  </View>
                  <View style={styles.riskMetric}>
                    <Text style={styles.riskMetricLabel}>Top 3 Combined</Text>
                    <Text style={styles.riskMetricValue}>
                      {concentrationRisk.top3Weight.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* ── Top Holdings ──────────────────────────────────── */}
            <Text style={styles.sectionLabel}>TOP HOLDINGS</Text>
            {topHoldings.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No positions found.</Text>
              </View>
            ) : (
              <View style={styles.card}>
                {topHoldings.map((h, i) => (
                  <View key={h.ticker}
                    style={[styles.holdingRow, i < topHoldings.length - 1 && styles.rowBorder]}>
                    <View style={styles.holdingRank}>
                      <Text style={styles.holdingRankText}>{i + 1}</Text>
                    </View>
                    <View style={styles.holdingInfo}>
                      <Text style={styles.holdingTicker}>{h.ticker}</Text>
                      <View style={[styles.assetBadge, { backgroundColor: `${ASSET_COLORS[h.assetType] ?? '#4A6A9A'}22` }]}>
                        <Text style={[styles.assetBadgeText, { color: ASSET_COLORS[h.assetType] ?? '#4A6A9A' }]}>
                          {h.assetType}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.holdingRight}>
                      <Text style={styles.holdingValue}>{formatCurrency(h.value)}</Text>
                      <Text style={styles.holdingWeight}>{h.weight.toFixed(1)}%</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── Future metrics placeholder ────────────────────── */}
            <Text style={styles.sectionLabel}>COMING SOON</Text>
            <View style={styles.card}>
              {['Largest Winner', 'Largest Loser', 'Volatility', 'Income Stability'].map((item, i, arr) => (
                <View key={item} style={[styles.comingSoonRow, i < arr.length - 1 && styles.rowBorder]}>
                  <Text style={styles.comingSoonText}>{item}</Text>
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonBadgeText}>Phase 3C</Text>
                  </View>
                </View>
              ))}
            </View>
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
  sectionLabel: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 10 },
  card: {
    backgroundColor: '#141A26', borderRadius: 14, marginBottom: 20,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
    padding: 16,
  },
  gradeCard: {
    borderRadius: 14, padding: 20, marginBottom: 20, borderWidth: 0.5,
  },
  gradeLabel: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  reasonsList: { gap: 6 },
  reasonRow: { flexDirection: 'row', gap: 8 },
  reasonBullet: { fontSize: 13, color: '#4A6A9A' },
  reasonText: { fontSize: 13, color: '#C8D8F0', flex: 1 },
  riskHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  riskStatus: { fontSize: 16, fontWeight: '700' },
  riskMessage: { fontSize: 13, color: '#4A6A9A', marginBottom: 12, lineHeight: 18 },
  riskMetrics: { flexDirection: 'row', gap: 16 },
  riskMetric: { flex: 1 },
  riskMetricLabel: { fontSize: 11, color: '#4A6080', marginBottom: 4 },
  riskMetricValue: { fontSize: 14, fontWeight: '600', color: '#E8EEF8' },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' },
  holdingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  holdingRank: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  holdingRankText: { fontSize: 11, fontWeight: '700', color: '#4A6A9A' },
  holdingInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  holdingTicker: { fontSize: 14, fontWeight: '700', color: '#E8EEF8' },
  assetBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  assetBadgeText: { fontSize: 10, fontWeight: '700' },
  holdingRight: { alignItems: 'flex-end' },
  holdingValue: { fontSize: 14, fontWeight: '600', color: '#E8EEF8' },
  holdingWeight: { fontSize: 12, color: '#4A6A9A', marginTop: 2 },
  emptyCard: {
    backgroundColor: '#141A26', borderRadius: 14, padding: 24,
    alignItems: 'center', marginBottom: 20,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyText: { fontSize: 13, color: '#4A6A9A' },
  comingSoonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  comingSoonText: { flex: 1, fontSize: 14, color: '#4A6A9A' },
  comingSoonBadge: { backgroundColor: 'rgba(42,58,84,0.5)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  comingSoonBadgeText: { fontSize: 10, fontWeight: '700', color: '#4A6080' },
});
