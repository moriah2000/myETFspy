// app/analytics/insights.tsx
//
// Portfolio Insights screen — Top Holdings, Diversification, Concentration Risk,
// and Insights cards from insightsEngine.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { usePortfolioAnalytics } from '../../hooks/usePortfolioAnalytics';
import { useInsights } from '../../hooks/useInsights';
import { InsightCard, InsightSeverity, InsightType } from '../../services/insightsEngine';

// ─── Severity config ──────────────────────────────────────────────────────────

type SeverityConfig = { color: string; bg: string; border: string; icon: string };

const SEVERITY: Record<InsightSeverity, SeverityConfig> = {
  alert:    { color: '#FF5A5F', bg: 'rgba(255,90,95,0.08)',   border: 'rgba(255,90,95,0.25)',   icon: 'alert-circle' },
  warning:  { color: '#FF9F43', bg: 'rgba(255,159,67,0.08)',  border: 'rgba(255,159,67,0.25)',  icon: 'warning' },
  positive: { color: '#00C896', bg: 'rgba(0,200,150,0.08)',   border: 'rgba(0,200,150,0.25)',   icon: 'checkmark-circle' },
  info:     { color: '#338DFF', bg: 'rgba(51,141,255,0.08)',  border: 'rgba(51,141,255,0.25)',  icon: 'information-circle' },
};

const TYPE_LABELS: Record<InsightType, string> = {
  CONCENTRATION:   'Risk',
  DIVERSIFICATION: 'Diversification',
  SECTOR:          'Sector',
  INCOME:          'Income',
  YIELD:           'Yield',
  INCOME_GROWTH:   'Income',
  TOP_EARNER:      'Dividend',
  FIRE_PROGRESS:   'FIRE',
  BEST_PERFORMER:  'Performance',
  WORST_PERFORMER: 'Performance',
  ASSET_MIX:       'Allocation',
  MILESTONE:       'Milestone',
  ACHIEVEMENT:     'Achievement',
};

// ─── Shared styles ────────────────────────────────────────────────────────────

type DiversificationGrade = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'N/A';
type ConcentrationStatus = 'Healthy' | 'Warning' | 'High Risk';

const GRADE_CONFIG: Record<DiversificationGrade, { color: string; bg: string; border: string }> = {
  Excellent: { color: '#00C896', bg: 'rgba(0,200,150,0.1)',   border: 'rgba(0,200,150,0.3)' },
  Good:      { color: '#338DFF', bg: 'rgba(51,141,255,0.1)',  border: 'rgba(51,141,255,0.3)' },
  Fair:      { color: '#FF9F43', bg: 'rgba(255,159,67,0.1)',  border: 'rgba(255,159,67,0.3)' },
  Poor:      { color: '#FF5A5F', bg: 'rgba(255,90,95,0.1)',   border: 'rgba(255,90,95,0.3)' },
  'N/A':     { color: '#4A6A9A', bg: 'rgba(74,106,154,0.1)', border: 'rgba(74,106,154,0.3)' },
};

const RISK_CONFIG: Record<ConcentrationStatus, { color: string; icon: string }> = {
  Healthy:     { color: '#00C896', icon: 'checkmark-circle' },
  Warning:     { color: '#FF9F43', icon: 'warning' },
  'High Risk': { color: '#FF5A5F', icon: 'alert-circle' },
};

const ASSET_COLORS: Record<string, string> = {
  ETF: '#338DFF', STOCK: '#00C896', CRYPTO: '#FF9F43',
};

function formatCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

// ─── Insight card component ───────────────────────────────────────────────────

function InsightCardView({ card }: { card: InsightCard }) {
  const cfg = SEVERITY[card.severity];
  const [expanded, setExpanded] = useState(false);
  const hasRecommendation = card.recommendation.length > 0;

  return (
    <TouchableOpacity
      style={[styles.insightCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
      onPress={() => hasRecommendation && setExpanded(e => !e)}
      activeOpacity={hasRecommendation ? 0.75 : 1}>
      <View style={styles.insightTop}>
        <View style={styles.insightLeft}>
          <View style={styles.insightMeta}>
            <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
            <Text style={[styles.insightTypeLabel, { color: cfg.color }]}>
              {TYPE_LABELS[card.type]}
            </Text>
          </View>
          <Text style={styles.insightTitle}>{card.title}</Text>
          <Text style={styles.insightBody}>{card.body}</Text>
          {expanded && hasRecommendation && (
            <View style={styles.recommendationBox}>
              <Ionicons name="bulb-outline" size={13} color="#FF9F43" />
              <Text style={styles.recommendationText}>{card.recommendation}</Text>
            </View>
          )}
          {!expanded && hasRecommendation && (
            <Text style={[styles.tapHint, { color: cfg.color }]}>Tap for recommendation</Text>
          )}
        </View>
        <View style={styles.insightRight}>
          <Text style={[styles.insightMetric, { color: cfg.color }]}>{card.metric}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const router = useRouter();
  const { topHoldings, concentrationRisk, diversification, loading: analyticsLoading } =
    usePortfolioAnalytics();
  const { cards, loading: insightsLoading, alertCount, warningCount } = useInsights();

  const gradeConfig = GRADE_CONFIG[diversification.grade];
  const riskConfig = RISK_CONFIG[concentrationRisk.status];
  const loading = analyticsLoading || insightsLoading;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#C8D8F0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Portfolio Insights</Text>
        <View style={styles.headerBadges}>
          {alertCount > 0 && (
            <View style={[styles.headerBadge, { backgroundColor: 'rgba(255,90,95,0.2)' }]}>
              <Text style={[styles.headerBadgeText, { color: '#FF5A5F' }]}>{alertCount}</Text>
            </View>
          )}
          {warningCount > 0 && (
            <View style={[styles.headerBadge, { backgroundColor: 'rgba(255,159,67,0.2)' }]}>
              <Text style={[styles.headerBadgeText, { color: '#FF9F43' }]}>{warningCount}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#338DFF" />
            <Text style={styles.loadingText}>Generating insights…</Text>
          </View>
        )}

        {!loading && (
          <>
            {/* ── Insights cards ─────────────────────────────────── */}
            {cards.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>INSIGHTS</Text>
                {cards.map(card => (
                  <InsightCardView key={card.id} card={card} />
                ))}
              </>
            )}

            {/* ── Diversification ────────────────────────────────── */}
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

            {/* ── Concentration risk ─────────────────────────────── */}
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

            {/* ── Top Holdings ───────────────────────────────────── */}
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
                      <View style={[styles.assetBadge,
                        { backgroundColor: `${ASSET_COLORS[h.assetType] ?? '#4A6A9A'}22` }]}>
                        <Text style={[styles.assetBadgeText,
                          { color: ASSET_COLORS[h.assetType] ?? '#4A6A9A' }]}>
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

            {/* ── Coming soon ────────────────────────────────────── */}
            <Text style={styles.sectionLabel}>COMING SOON</Text>
            <View style={styles.card}>
              {['Volatility Analysis', 'Income Stability Score', 'Benchmark Comparison', 'Tax Efficiency'].map((item, i, arr) => (
                <View key={item} style={[styles.comingSoonRow, i < arr.length - 1 && styles.rowBorder]}>
                  <Text style={styles.comingSoonText}>{item}</Text>
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonBadgeText}>Phase 4</Text>
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
  headerBadges: { flexDirection: 'row', gap: 6, width: 80, justifyContent: 'flex-end' },
  headerBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  headerBadgeText: { fontSize: 12, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  loadingContainer: { alignItems: 'center', paddingVertical: 60, gap: 16 },
  loadingText: { fontSize: 14, color: '#4A6A9A' },
  sectionLabel: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 10 },
  // Insight cards
  insightCard: {
    borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 0.5,
  },
  insightTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  insightLeft: { flex: 1 },
  insightMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  insightTypeLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  insightTitle: { fontSize: 14, fontWeight: '700', color: '#E8EEF8', marginBottom: 4 },
  insightBody: { fontSize: 13, color: '#C8D8F0', lineHeight: 18 },
  insightRight: { alignItems: 'flex-end', minWidth: 56 },
  insightMetric: { fontSize: 16, fontWeight: '700', textAlign: 'right' },
  tapHint: { fontSize: 11, marginTop: 6, opacity: 0.7 },
  recommendationBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  recommendationText: { flex: 1, fontSize: 12, color: '#FF9F43', lineHeight: 17 },
  // Diversification
  gradeCard: { borderRadius: 14, padding: 20, marginBottom: 20, borderWidth: 0.5 },
  gradeLabel: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  reasonsList: { gap: 6 },
  reasonRow: { flexDirection: 'row', gap: 8 },
  reasonBullet: { fontSize: 13, color: '#4A6A9A' },
  reasonText: { fontSize: 13, color: '#C8D8F0', flex: 1 },
  // Concentration risk
  card: {
    backgroundColor: '#141A26', borderRadius: 14, marginBottom: 20,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', padding: 16,
  },
  riskHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  riskStatus: { fontSize: 16, fontWeight: '700' },
  riskMessage: { fontSize: 13, color: '#4A6A9A', marginBottom: 12, lineHeight: 18 },
  riskMetrics: { flexDirection: 'row', gap: 16 },
  riskMetric: { flex: 1 },
  riskMetricLabel: { fontSize: 11, color: '#4A6080', marginBottom: 4 },
  riskMetricValue: { fontSize: 14, fontWeight: '600', color: '#E8EEF8' },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' },
  // Top holdings
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
  // Empty + coming soon
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
