// app/settings/health.tsx
//
// Portfolio Health screen — Settings → Data & Backup → Portfolio Health
// Read-only diagnostics. Reads from TransactionStoreProvider context only.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { usePortfolioTransactions } from '../hooks/usePortfolioTransactions';
import { HealthCheck, HealthReport, runHealthChecks } from '../../services/healthService';

type CheckStatus = 'healthy' | 'warning' | 'error';

const STATUS_ICON: Record<CheckStatus, { name: string; color: string }> = {
  healthy: { name: 'checkmark-circle', color: '#00C896' },
  warning: { name: 'warning', color: '#FF9F43' },
  error: { name: 'alert-circle', color: '#FF5A5F' },
};

const OVERALL_CONFIG: Record<CheckStatus, { label: string; color: string; bg: string; border: string }> = {
  healthy: { label: 'Healthy', color: '#00C896', bg: 'rgba(0,200,150,0.1)', border: 'rgba(0,200,150,0.3)' },
  warning: { label: 'Warning', color: '#FF9F43', bg: 'rgba(255,159,67,0.1)', border: 'rgba(255,159,67,0.3)' },
  error: { label: 'Error', color: '#FF5A5F', bg: 'rgba(255,90,95,0.1)', border: 'rgba(255,90,95,0.3)' },
};

export default function HealthScreen() {
  const router = useRouter();
  const { transactions, ready } = usePortfolioTransactions();
  const [report, setReport] = useState<HealthReport | null>(null);

  useEffect(() => {
    if (!ready) return;
    const r = runHealthChecks(transactions);
    setReport(r);
  }, [ready, transactions]);

  function formatRunAt(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#C8D8F0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Portfolio Health</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Loading */}
        {(!ready || !report) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#338DFF" />
            <Text style={styles.loadingText}>Running diagnostics…</Text>
          </View>
        )}

        {/* Report */}
        {ready && report && (() => {
          const overall = OVERALL_CONFIG[report.overallStatus];
          return (
            <>
              {/* Overall status card */}
              <View style={[styles.overallCard, { backgroundColor: overall.bg, borderColor: overall.border }]}>
                <Ionicons
                  name={STATUS_ICON[report.overallStatus].name as any}
                  size={40}
                  color={overall.color}
                />
                <Text style={[styles.overallLabel, { color: overall.color }]}>
                  {overall.label}
                </Text>
                <Text style={styles.overallSub}>
                  {report.transactionCount} transaction(s) · Checked at {formatRunAt(report.runAt)}
                </Text>
              </View>

              {/* Check results */}
              <Text style={styles.sectionLabel}>DIAGNOSTIC CHECKS</Text>
              <View style={styles.card}>
                {report.checks.map((check: HealthCheck, i: number) => {
                  const icon = STATUS_ICON[check.status];
                  const isLast = i === report.checks.length - 1;
                  return (
                    <View key={check.id} style={[styles.checkRow, !isLast && styles.rowBorder]}>
                      <Ionicons name={icon.name as any} size={20} color={icon.color} style={styles.checkIcon} />
                      <View style={styles.checkText}>
                        <Text style={styles.checkLabel}>{check.label}</Text>
                        <Text style={styles.checkMessage}>{check.message}</Text>
                        {check.affectedIds && check.affectedIds.length > 0 && (
                          <Text style={styles.affectedIds}>
                            Affected: {check.affectedIds.slice(0, 3).join(', ')}
                            {check.affectedIds.length > 3 ? ` +${check.affectedIds.length - 3} more` : ''}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Summary counts */}
              <Text style={styles.sectionLabel}>SUMMARY</Text>
              <View style={styles.card}>
                {[
                  {
                    label: 'Errors',
                    value: report.checks.filter((c: HealthCheck) => c.status === 'error').length,
                    color: '#FF5A5F',
                  },
                  {
                    label: 'Warnings',
                    value: report.checks.filter((c: HealthCheck) => c.status === 'warning').length,
                    color: '#FF9F43',
                  },
                  {
                    label: 'Passed',
                    value: report.checks.filter((c: HealthCheck) => c.status === 'healthy').length,
                    color: '#00C896',
                  },
                ].map((row, i, arr) => (
                  <View key={row.label} style={[styles.summaryRow, i < arr.length - 1 && styles.rowBorder]}>
                    <Text style={styles.summaryLabel}>{row.label}</Text>
                    <Text style={[styles.summaryValue, { color: row.color }]}>{row.value}</Text>
                  </View>
                ))}
              </View>

              {/* Re-run button */}
              <TouchableOpacity
                style={styles.rerunButton}
                onPress={() => setReport(runHealthChecks(transactions))}
                activeOpacity={0.8}>
                <Ionicons name="refresh-outline" size={18} color="#C8D8F0" />
                <Text style={styles.rerunText}>Re-run Diagnostics</Text>
              </TouchableOpacity>
            </>
          );
        })()}

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
  overallCard: {
    borderRadius: 14, padding: 24, alignItems: 'center',
    marginBottom: 24, borderWidth: 0.5,
  },
  overallLabel: { fontSize: 22, fontWeight: '700', marginTop: 10, marginBottom: 4 },
  overallSub: { fontSize: 12, color: '#4A6A9A', textAlign: 'center' },
  sectionLabel: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 10 },
  card: {
    backgroundColor: '#141A26', borderRadius: 14, marginBottom: 20,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' },
  checkIcon: { marginRight: 12, marginTop: 1 },
  checkText: { flex: 1 },
  checkLabel: { fontSize: 14, fontWeight: '600', color: '#E8EEF8', marginBottom: 2 },
  checkMessage: { fontSize: 13, color: '#4A6A9A', lineHeight: 18 },
  affectedIds: { fontSize: 11, color: '#4A6080', marginTop: 4, fontFamily: 'monospace' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  summaryLabel: { fontSize: 14, color: '#C8D8F0' },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  rerunButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#141A26', borderRadius: 12, paddingVertical: 14,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  rerunText: { fontSize: 14, fontWeight: '600', color: '#C8D8F0' },
});
