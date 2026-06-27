// hooks/useForecast.ts
//
// Manages user inputs, defaults, validation, and scenario selection.
// Consumes usePortfolioData and useDividendData only.
// Never reads transactions, never performs FIFO calculations.
// Logging prefix: [FORECAST]

import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_SCENARIO, FIRE_DEFAULTS, FIRE_METHODS,
  FORECAST_DEFAULTS, SCENARIOS, ScenarioKey, FireMethodKey,
} from '../constants/forecastScenarios';
import { useDividendData } from './useDividendData';
import { usePortfolioData } from '../app/hooks/usePortfolioData';
import {
  calcContributionForecast, calcDividendGrowthForecast, calcFireProjection,
  ContributionForecastResult, DividendGrowthResult, FireResult,
} from '../services/forecastEngine';

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(event: string, data?: unknown) {
  console.log(`[FORECAST] ${event}`, data ?? '');
}

// ─── Input state types ────────────────────────────────────────────────────────

export type ContributionInputs = {
  monthlyContribution: number;
  years: number;
  inflationEnabled: boolean;
};

export type DividendGrowthInputs = {
  dividendGrowthRate: number;   // decimal
  years: number;
  inflationEnabled: boolean;
};

export type FireInputs = {
  targetAnnualIncome: number;
  monthlyContribution: number;
  safeWithdrawalRate: number;   // decimal
  methodKey: FireMethodKey;
  inflationEnabled: boolean;
};

export type ForecastState = {
  // Scenario
  scenario: ScenarioKey;
  scenarioParams: typeof SCENARIOS[ScenarioKey];
  setScenario: (key: ScenarioKey) => void;

  // Contribution forecast
  contributionInputs: ContributionInputs;
  setContributionInputs: (inputs: Partial<ContributionInputs>) => void;
  contributionResult: ContributionForecastResult;

  // Dividend growth forecast
  dividendInputs: DividendGrowthInputs;
  setDividendInputs: (inputs: Partial<DividendGrowthInputs>) => void;
  dividendResult: DividendGrowthResult;

  // FIRE projection
  fireInputs: FireInputs;
  setFireInputs: (inputs: Partial<FireInputs>) => void;
  fireResult: FireResult;
  fireMethods: typeof FIRE_METHODS;

  // Portfolio context (read-only, for display)
  currentPortfolioValue: number;
  currentAnnualDividendIncome: number;
  currentMonthlyDividendIncome: number;
  currentPortfolioYield: number;
  currentTotalCostBasis: number;
  portfolioLoading: boolean;
  dividendLoading: boolean;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useForecast(): ForecastState {
  const { totalValue, totalCostBasis, loading: portfolioLoading } = usePortfolioData();
  const {
    annualIncome, monthlyIncome, portfolioYield,
    loading: dividendLoading,
  } = useDividendData();

  // ── Scenario ────────────────────────────────────────────────────────────────
  const [scenario, setScenarioKey] = useState<ScenarioKey>(DEFAULT_SCENARIO);

  const setScenario = useCallback((key: ScenarioKey) => {
    log('Scenario selected', { key });
    setScenarioKey(key);
  }, []);

  const scenarioParams = SCENARIOS[scenario];

  // ── Contribution inputs ──────────────────────────────────────────────────────
  const [contributionInputs, setContributionInputsRaw] = useState<ContributionInputs>({
    monthlyContribution: FORECAST_DEFAULTS.monthlyContribution,
    years: FORECAST_DEFAULTS.years,
    inflationEnabled: FORECAST_DEFAULTS.inflationEnabled,
  });

  const setContributionInputs = useCallback((patch: Partial<ContributionInputs>) => {
    setContributionInputsRaw(prev => ({ ...prev, ...patch }));
  }, []);

  // ── Dividend growth inputs ───────────────────────────────────────────────────
  const [dividendInputs, setDividendInputsRaw] = useState<DividendGrowthInputs>({
    dividendGrowthRate: SCENARIOS[DEFAULT_SCENARIO].dividendGrowthRate,
    years: 20,
    inflationEnabled: FORECAST_DEFAULTS.inflationEnabled,
  });

  const setDividendInputs = useCallback((patch: Partial<DividendGrowthInputs>) => {
    setDividendInputsRaw(prev => ({ ...prev, ...patch }));
  }, []);

  // ── FIRE inputs ──────────────────────────────────────────────────────────────
  const [fireInputs, setFireInputsRaw] = useState<FireInputs>({
    targetAnnualIncome: FIRE_DEFAULTS.targetAnnualIncome,
    monthlyContribution: FIRE_DEFAULTS.monthlyContribution,
    safeWithdrawalRate: FIRE_DEFAULTS.safeWithdrawalRate,
    methodKey: FIRE_DEFAULTS.methodKey,
    inflationEnabled: FORECAST_DEFAULTS.inflationEnabled,
  });

  const setFireInputs = useCallback((patch: Partial<FireInputs>) => {
    setFireInputsRaw(prev => ({ ...prev, ...patch }));
  }, []);

  // ── Calculations (memoised — recompute only when inputs or portfolio change) ─

  const contributionResult = useMemo(() => {
    const result = calcContributionForecast({
      startingBalance: totalValue,
      monthlyContribution: contributionInputs.monthlyContribution,
      annualReturn: scenarioParams.annualReturn,
      years: contributionInputs.years,
      inflationRate: scenarioParams.inflationRate,
      inflationEnabled: contributionInputs.inflationEnabled,
    });
    log('Contribution forecast generated', {
      scenario, finalValue: result.finalValue,
      years: contributionInputs.years,
    });
    return result;
  }, [totalValue, contributionInputs, scenarioParams, scenario]);

  const dividendResult = useMemo(() => {
    // Sync growth rate to scenario when scenario changes
    const growthRate = dividendInputs.dividendGrowthRate;
    const result = calcDividendGrowthForecast({
      currentAnnualIncome: annualIncome,
      currentTotalCostBasis: totalCostBasis,
      dividendGrowthRate: growthRate,
      years: dividendInputs.years,
      inflationRate: scenarioParams.inflationRate,
      inflationEnabled: dividendInputs.inflationEnabled,
    });
    log('Dividend growth forecast generated', {
      scenario, year20Income: result.displayYears.find(y => y.year === 20)?.annualIncome,
    });
    return result;
  }, [annualIncome, totalCostBasis, dividendInputs, scenarioParams, scenario]);

  const fireResult = useMemo(() => {
    const result = calcFireProjection({
      currentPortfolioValue: totalValue,
      monthlyContribution: fireInputs.monthlyContribution,
      annualReturn: scenarioParams.annualReturn,
      targetAnnualIncome: fireInputs.targetAnnualIncome,
      currentAnnualDividendIncome: annualIncome,
      currentPortfolioYield: portfolioYield,
      safeWithdrawalRate: fireInputs.safeWithdrawalRate,
      methodKey: fireInputs.methodKey,
      inflationRate: scenarioParams.inflationRate,
      inflationEnabled: fireInputs.inflationEnabled,
    });
    log('FIRE projection generated', {
      method: fireInputs.methodKey,
      requiredValue: result.requiredPortfolioValue,
      progressPct: result.progressPct,
      yearsUntilTarget: result.yearsUntilTarget,
    });
    return result;
  }, [totalValue, annualIncome, portfolioYield, fireInputs, scenarioParams, scenario]);

  return {
    scenario,
    scenarioParams,
    setScenario,
    contributionInputs,
    setContributionInputs,
    contributionResult,
    dividendInputs,
    setDividendInputs,
    dividendResult,
    fireInputs,
    setFireInputs,
    fireResult,
    fireMethods: FIRE_METHODS,
    currentPortfolioValue: totalValue,
    currentAnnualDividendIncome: annualIncome,
    currentMonthlyDividendIncome: monthlyIncome,
    currentPortfolioYield: portfolioYield,
    currentTotalCostBasis: totalCostBasis,
    portfolioLoading,
    dividendLoading,
  };
}
