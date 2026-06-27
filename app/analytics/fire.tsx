// app/analytics/fire.tsx
//
// FIRE Projection — Financial Independence calculator.
// Supports Dividend Yield and Safe Withdrawal Rate (4% Rule) methodologies.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import {
  FIRE_METHODS, SCENARIOS, ScenarioKey, FireMethodKey,
} from '../../constants/forecastScenarios';
import { useForecast } from '../../hooks/useForecast';

function formatCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}
function formatPct(v: number): string { return `${(v * 100).toFixed(1)}%`; }

export default function FireScreen() {
  const router = useRouter();
  const forecast = useForecast();
  const {
    fireInputs, setFireInputs, fireResult,
    scenario, setScenario, scenarioParams,
    currentPortfolioValue, currentPortfolioYield,
    portfolioLoading, dividendLoading,
  } = forecast;

  const [targetStr, setTargetStr] = useState(String(fireInputs.targetAnnualIncome));
  const [monthlyStr, setMonthlyStr] = useState(String(fireInputs.monthlyContribution));
  const [swrStr, setSwrStr] = useState(String((fireInputs.safeWithdrawalRate * 100).toFixed(1)));

  const loading = portfolioLoading || dividendLoading;

  const {
    requiredPortfolioValue, progressPct, targetReached,
    yearsUntilTarget, projectedReachYear,
  } = fireResult;

  const progressColor = progressPct >= 100 ? '#00C896' : progressPct >= 50 ? '#338DFF' : '#FF9F43';

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#C8D8F0" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>FIRE Projection</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#338DFF" />
          <Text style={styles.loadingText}>Loading portfolio data…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#C8D8F0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FIRE Projection</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Progress card */}
        <View style={[styles.progressCard, { borderColor: `${progressColor}44` }]}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Financial Independence</Text>
            {targetReached && (
              <View style={styles.targetReachedBadge}>
                <Text style={styles.targetReachedText}>Target Reached! 🎉</Text>
              </View>
            )}
          </View>

          {/* Progress bar */}
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, {
              width: `${Math.min(progressPct, 100)}%`,
              backgroundColor: progressColor,
            }]} />
          </View>
          <Text style={[styles.progressPct, { color: progressColor }]}>
            {progressPct.toFixed(1)}%
          </Text>

          <View style={styles.progressStats}>
            <View style={styles.progressStat}>
              <Text style={styles.progressStatLabel}>Current</Text>
              <Text style={styles.progressStatValue}>{formatCurrency(currentPortfolioValue)}</Text>
            </View>
            <View style={styles.progressStat}>
              <Text style={styles.progressStatLabel}>Target</Text>
              <Text style={styles.progressStatValue}>{formatCurrency(requiredPortfolioValue)}</Text>
            </View>
            <View style={styles.progressStat}>
              <Text style={styles.progressStatLabel}>Years Away</Text>
              <Text style={[styles.progressStatValue, { color: progressColor }]}>
                {targetReached ? '0' : yearsUntilTarget !== null ? String(yearsUntilTarget) : '50+'}
              </Text>
            </View>
          </View>
        </View>

        {/* Method toggle */}
        <Text style={styles.sectionLabel}>METHODOLOGY</Text>
        <View style={styles.methodRow}>
          {(Object.keys(FIRE_METHODS) as FireMethodKey[]).map(key => {
            const m = FIRE_METHODS[key];
            const active = fireInputs.methodKey === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.methodBtn, active && styles.methodBtnActive]}
                onPress={() => setFireInputs({ methodKey: key })}
                activeOpacity={0.7}>
                <Text style={[styles.methodBtnTitle, active && styles.methodBtnTitleActive]}>
                  {m.label}
                </Text>
                <Text style={styles.methodBtnDesc}>{m.description}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Scenario */}
        <Text style={styles.sectionLabel}>SCENARIO</Text>
        <View style={styles.scenarioRow}>
          {(Object.keys(SCENARIOS) as ScenarioKey[]).map(key => {
            const s = SCENARIOS[key];
            const active = scenario === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.scenarioBtn, active && { borderColor: s.color, backgroundColor: `${s.color}18` }]}
                onPress={() => setScenario(key)}
                activeOpacity={0.7}>
                <Text style={[styles.scenarioBtnText, active && { color: s.color }]}>{s.label}</Text>
                <Text style={[styles.scenarioBtnSub, active && { color: s.color }]}>
                  {(s.annualReturn * 100).toFixed(0)}%
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Inputs */}
        <Text style={styles.sectionLabel}>INPUTS</Text>
        <View style={styles.card}>
          {/* Target income */}
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Target Annual Income</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputAffix}>$</Text>
              <TextInput
                style={styles.input}
                value={targetStr}
                onChangeText={v => {
                  setTargetStr(v);
                  const n = parseFloat(v);
                  if (isFinite(n) && n > 0) setFireInputs({ targetAnnualIncome: n });
                }}
                keyboardType="numeric"
                placeholderTextColor="#4A6080"
              />
            </View>
          </View>

          {/* Monthly contribution */}
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Monthly Contribution</Text>
            <View style={styles.inputBox}>
              <Text style={styles.inputAffix}>$</Text>
              <TextInput
                style={styles.input}
                value={monthlyStr}
                onChangeText={v => {
                  setMonthlyStr(v);
                  const n = parseFloat(v);
                  if (isFinite(n) && n >= 0) setFireInputs({ monthlyContribution: n });
                }}
                keyboardType="numeric"
                placeholderTextColor="#4A6080"
              />
            </View>
          </View>

          {/* SWR (only shown for SWR method) */}
          {fireInputs.methodKey === 'swr' && (
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Safe Withdrawal Rate</Text>
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.input}
                  value={swrStr}
                  onChangeText={v => {
                    setSwrStr(v);
                    const n = parseFloat(v);
                    if (isFinite(n) && n > 0 && n <= 20) {
                      setFireInputs({ safeWithdrawalRate: n / 100 });
                    }
                  }}
                  keyboardType="numeric"
                  placeholderTextColor="#4A6080"
                />
                <Text style={styles.inputAffix}>%</Text>
              </View>
            </View>
          )}

          {/* Dividend yield (shown for dividend method, read-only) */}
          {fireInputs.methodKey === 'dividend_yield' && (
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Current Portfolio Yield</Text>
              <Text style={styles.inputReadOnly}>{formatPct(currentPortfolioYield)}</Text>
            </View>
          )}

          {/* Inflation toggle */}
          <View style={styles.switchRow}>
            <Text style={styles.inputLabel}>Inflation Adjusted</Text>
            <Switch
              value={fireInputs.inflationEnabled}
              onValueChange={v => setFireInputs({ inflationEnabled: v })}
              trackColor={{ false: '#1E2A3A', true: '#338DFF' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Projection table (5-year intervals) */}
        <Text style={styles.sectionLabel}>PROJECTED PATH</Text>
        <View style={styles.card}>
          {fireResult.yearlyProjections
            .filter((r: any) => r.year % 5 === 0 || r.year === 1)
            .slice(0, 8)
            .map((row: any, i: number, arr: any[]) => {
              const val = fireInputs.inflationEnabled ? row.realPortfolioValue : row.portfolioValue;
              const reached = val >= requiredPortfolioValue;
              return (
                <View key={row.year} style={[styles.projRow, i < arr.length - 1 && styles.rowBorder]}>
                  <Text style={styles.projYear}>Year {row.year}</Text>
                  <Text style={[styles.projValue, reached && { color: '#00C896' }]}>
                    {formatCurrency(val)}
                    {reached ? ' ✓' : ''}
                  </Text>
                </View>
              );
            })}
        </View>

        {/* Assumptions */}
        <View style={styles.assumptionsCard}>
          <Text style={styles.assumptionsTitle}>Assumptions</Text>
          <Text style={styles.assumptionsText}>
            Method: {FIRE_METHODS[fireInputs.methodKey].label} ·
            Return: {formatPct(scenarioParams.annualReturn)} ·
            Inflation: {formatPct(scenarioParams.inflationRate)} ·
            Compounded monthly
          </Text>
        </View>

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
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 14, color: '#4A6A9A' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 8 },
  progressCard: {
    backgroundColor: '#141A26', borderRadius: 14, padding: 16, marginBottom: 20,
    borderWidth: 0.5,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  progressLabel: { fontSize: 14, fontWeight: '700', color: '#E8EEF8' },
  targetReachedBadge: { backgroundColor: 'rgba(0,200,150,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  targetReachedText: { fontSize: 11, fontWeight: '700', color: '#00C896' },
  progressBarBg: { height: 8, backgroundColor: '#1E2A3A', borderRadius: 4, marginBottom: 6, overflow: 'hidden' },
  progressBarFill: { height: 8, borderRadius: 4 },
  progressPct: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginVertical: 8 },
  progressStats: { flexDirection: 'row', justifyContent: 'space-between' },
  progressStat: { alignItems: 'center', flex: 1 },
  progressStatLabel: { fontSize: 11, color: '#4A6080', marginBottom: 4 },
  progressStatValue: { fontSize: 13, fontWeight: '600', color: '#E8EEF8' },
  methodRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  methodBtn: {
    flex: 1, padding: 10, borderRadius: 10,
    backgroundColor: '#141A26', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  methodBtnActive: { borderColor: '#338DFF', backgroundColor: 'rgba(51,141,255,0.1)' },
  methodBtnTitle: { fontSize: 12, fontWeight: '700', color: '#4A6A9A', marginBottom: 4 },
  methodBtnTitleActive: { color: '#338DFF' },
  methodBtnDesc: { fontSize: 10, color: '#4A6080', lineHeight: 14 },
  scenarioRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  scenarioBtn: {
    flex: 1, padding: 10, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#141A26',
  },
  scenarioBtnText: { fontSize: 12, fontWeight: '700', color: '#4A6A9A', marginBottom: 2 },
  scenarioBtnSub: { fontSize: 10, color: '#4A6080' },
  card: {
    backgroundColor: '#141A26', borderRadius: 14, marginBottom: 20,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  inputLabel: { fontSize: 14, color: '#C8D8F0' },
  inputReadOnly: { fontSize: 14, fontWeight: '600', color: '#E8EEF8' },
  inputBox: { flexDirection: 'row', alignItems: 'center' },
  inputAffix: { fontSize: 14, color: '#4A6A9A', marginHorizontal: 4 },
  input: { fontSize: 14, color: '#E8EEF8', textAlign: 'right', minWidth: 80 },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  projRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' },
  projYear: { fontSize: 14, color: '#4A6A9A' },
  projValue: { fontSize: 14, fontWeight: '600', color: '#E8EEF8' },
  assumptionsCard: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 20,
  },
  assumptionsTitle: { fontSize: 11, color: '#4A6080', fontWeight: '600', marginBottom: 4 },
  assumptionsText: { fontSize: 12, color: '#4A6080', lineHeight: 18 },
});
