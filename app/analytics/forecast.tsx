// app/analytics/forecast.tsx
//
// Contribution Forecast + Dividend Growth screens combined.
// All calculations via useForecast → forecastEngine (pure math).

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View, Switch, ActivityIndicator,
} from 'react-native';
import { SCENARIOS, ScenarioKey } from '../../constants/forecastScenarios';
import { useForecast } from '../../hooks/useForecast';

type Tab = 'contribution' | 'dividend';

function formatCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}
function formatPct(v: number): string { return `${(v * 100).toFixed(1)}%`; }

function ScenarioPicker({
  selected, onSelect,
}: { selected: ScenarioKey; onSelect: (k: ScenarioKey) => void }) {
  return (
    <View style={styles.scenarioRow}>
      {(Object.keys(SCENARIOS) as ScenarioKey[]).map(key => {
        const s = SCENARIOS[key];
        const active = selected === key;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.scenarioBtn, active && { borderColor: s.color, backgroundColor: `${s.color}18` }]}
            onPress={() => onSelect(key)}
            activeOpacity={0.7}>
            <Text style={[styles.scenarioBtnText, active && { color: s.color }]}>{s.label}</Text>
            <Text style={[styles.scenarioBtnSub, active && { color: s.color }]}>
              {(s.annualReturn * 100).toFixed(0)}% return
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function NumberInput({
  label, value, onChangeText, prefix = '', suffix = '',
}: { label: string; value: string; onChangeText: (v: string) => void; prefix?: string; suffix?: string }) {
  return (
    <View style={styles.inputRow}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputBox}>
        {prefix ? <Text style={styles.inputAffix}>{prefix}</Text> : null}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="numeric"
          placeholderTextColor="#4A6080"
        />
        {suffix ? <Text style={styles.inputAffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export default function ForecastScreen() {
  const router = useRouter();
  const forecast = useForecast();
  const [tab, setTab] = useState<Tab>('contribution');

  // Local string state for inputs (converted to numbers on change)
  const [monthlyStr, setMonthlyStr] = useState(String(forecast.contributionInputs.monthlyContribution));
  const [yearsStr, setYearsStr] = useState(String(forecast.contributionInputs.years));
  const [divGrowthStr, setDivGrowthStr] = useState(
    String((forecast.dividendInputs.dividendGrowthRate * 100).toFixed(1))
  );

  const loading = forecast.portfolioLoading || forecast.dividendLoading;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#C8D8F0" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Forecast</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#338DFF" />
          <Text style={styles.loadingText}>Loading portfolio data…</Text>
        </View>
      </View>
    );
  }

  const { contributionResult, dividendResult, scenario, scenarioParams } = forecast;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#C8D8F0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Forecast</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab toggle */}
      <View style={styles.tabRow}>
        {(['contribution', 'dividend'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}>
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t === 'contribution' ? 'Growth' : 'Dividends'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Scenario picker */}
        <Text style={styles.sectionLabel}>SCENARIO</Text>
        <ScenarioPicker selected={scenario} onSelect={forecast.setScenario} />

        {tab === 'contribution' && (
          <>
            {/* Inputs */}
            <Text style={styles.sectionLabel}>INPUTS</Text>
            <View style={styles.card}>
              <NumberInput
                label="Starting Balance"
                value={formatCurrency(forecast.currentPortfolioValue)}
                onChangeText={() => {}}
                prefix="$"
              />
              <NumberInput
                label="Monthly Contribution"
                value={monthlyStr}
                onChangeText={v => {
                  setMonthlyStr(v);
                  const n = parseFloat(v);
                  if (isFinite(n) && n >= 0) forecast.setContributionInputs({ monthlyContribution: n });
                }}
                prefix="$"
              />
              <NumberInput
                label="Years"
                value={yearsStr}
                onChangeText={v => {
                  setYearsStr(v);
                  const n = parseInt(v, 10);
                  if (isFinite(n) && n >= 1 && n <= 50) forecast.setContributionInputs({ years: n });
                }}
              />
              <View style={styles.switchRow}>
                <Text style={styles.inputLabel}>Inflation Adjusted</Text>
                <Switch
                  value={forecast.contributionInputs.inflationEnabled}
                  onValueChange={v => forecast.setContributionInputs({ inflationEnabled: v })}
                  trackColor={{ false: '#1E2A3A', true: '#338DFF' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Projections */}
            <Text style={styles.sectionLabel}>PROJECTED GROWTH</Text>
            <View style={styles.card}>
              {contributionResult.displayYears.map((row: any, i: number, arr: any[]) => (
                <View key={row.year} style={[styles.projRow, i < arr.length - 1 && styles.rowBorder]}>
                  <Text style={styles.projYear}>Year {row.year}</Text>
                  <View style={styles.projValues}>
                    <Text style={[styles.projMain, { color: scenarioParams.color }]}>
                      {formatCurrency(forecast.contributionInputs.inflationEnabled
                        ? row.realPortfolioValue : row.portfolioValue)}
                    </Text>
                    <Text style={styles.projSub}>
                      {formatCurrency(row.totalContributions)} contributed ·{' '}
                      {formatCurrency(row.totalGrowth)} growth
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Milestones */}
            {contributionResult.milestones.filter((m: any) => m.projectedYear !== null).length > 0 && (
              <>
                <Text style={styles.sectionLabel}>MILESTONES</Text>
                <View style={styles.card}>
                  {contributionResult.milestones
                    .filter((m: any) => m.projectedYear !== null)
                    .map((m: any, i: number, arr: any[]) => (
                      <View key={m.milestone} style={[styles.milestoneRow, i < arr.length - 1 && styles.rowBorder]}>
                        <Text style={styles.milestoneAmount}>{formatCurrency(m.milestone)}</Text>
                        <Text style={styles.milestoneYear}>Year {m.projectedYear}</Text>
                      </View>
                    ))}
                </View>
              </>
            )}

            {/* Assumptions */}
            <View style={styles.assumptionsCard}>
              <Text style={styles.assumptionsTitle}>Assumptions</Text>
              <Text style={styles.assumptionsText}>
                Annual return: {formatPct(scenarioParams.annualReturn)} ·
                Inflation: {formatPct(scenarioParams.inflationRate)} ·
                Compounded monthly · Starting balance: {formatCurrency(forecast.currentPortfolioValue)}
              </Text>
            </View>
          </>
        )}

        {tab === 'dividend' && (
          <>
            {/* Inputs */}
            <Text style={styles.sectionLabel}>INPUTS</Text>
            <View style={styles.card}>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Current Annual Income</Text>
                <Text style={styles.inputReadOnly}>{formatCurrency(forecast.currentAnnualDividendIncome)}</Text>
              </View>
              <NumberInput
                label="Dividend Growth Rate"
                value={divGrowthStr}
                onChangeText={v => {
                  setDivGrowthStr(v);
                  const n = parseFloat(v);
                  if (isFinite(n) && n >= 0 && n <= 50) {
                    forecast.setDividendInputs({ dividendGrowthRate: n / 100 });
                  }
                }}
                suffix="%"
              />
              <View style={styles.switchRow}>
                <Text style={styles.inputLabel}>Inflation Adjusted</Text>
                <Switch
                  value={forecast.dividendInputs.inflationEnabled}
                  onValueChange={v => forecast.setDividendInputs({ inflationEnabled: v })}
                  trackColor={{ false: '#1E2A3A', true: '#338DFF' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Projections */}
            <Text style={styles.sectionLabel}>PROJECTED INCOME</Text>
            <View style={styles.card}>
              {dividendResult.displayYears.map((row: any, i: number, arr: any[]) => {
                const annualVal = forecast.dividendInputs.inflationEnabled
                  ? row.realAnnualIncome : row.annualIncome;
                const monthlyVal = forecast.dividendInputs.inflationEnabled
                  ? row.realMonthlyIncome : row.monthlyIncome;
                return (
                  <View key={row.year} style={[styles.projRow, i < arr.length - 1 && styles.rowBorder]}>
                    <Text style={styles.projYear}>Year {row.year}</Text>
                    <View style={styles.projValues}>
                      <Text style={[styles.projMain, { color: scenarioParams.color }]}>
                        {formatCurrency(annualVal)}/yr
                      </Text>
                      <Text style={styles.projSub}>
                        {formatCurrency(monthlyVal)}/mo · YOC: {formatPct(row.yieldOnCost)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Assumptions */}
            <View style={styles.assumptionsCard}>
              <Text style={styles.assumptionsTitle}>Assumptions</Text>
              <Text style={styles.assumptionsText}>
                Dividend growth: {divGrowthStr}% annually ·
                Inflation: {formatPct(scenarioParams.inflationRate)} ·
                No reinvestment modelled · Based on current share count
              </Text>
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
    paddingTop: 60, paddingHorizontal: 16, paddingBottom: 12,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#E8EEF8' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 14, color: '#4A6A9A' },
  tabRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#141A26', borderRadius: 10, padding: 3,
  },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#1E2A3A' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#4A6A9A' },
  tabBtnTextActive: { color: '#E8EEF8' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 8 },
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
  projRow: { paddingHorizontal: 14, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' },
  projYear: { fontSize: 12, color: '#4A6A9A', marginBottom: 4 },
  projValues: {},
  projMain: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  projSub: { fontSize: 12, color: '#4A6080' },
  milestoneRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  milestoneAmount: { fontSize: 14, fontWeight: '600', color: '#E8EEF8' },
  milestoneYear: { fontSize: 14, color: '#338DFF', fontWeight: '600' },
  assumptionsCard: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 20,
  },
  assumptionsTitle: { fontSize: 11, color: '#4A6080', fontWeight: '600', marginBottom: 4 },
  assumptionsText: { fontSize: 12, color: '#4A6080', lineHeight: 18 },
});
