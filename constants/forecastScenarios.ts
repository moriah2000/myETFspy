// constants/forecastScenarios.ts
//
// All scenario parameters and milestone thresholds for Phase 3C forecasting.
// Never hardcode these values in hooks or UI.

export type ScenarioKey = 'conservative' | 'expected' | 'optimistic';

export type ScenarioParams = {
  label: string;
  annualReturn: number;        // decimal e.g. 0.07
  dividendGrowthRate: number;  // decimal e.g. 0.04
  inflationRate: number;       // decimal e.g. 0.03
  color: string;               // UI color
};

export const SCENARIOS: Record<ScenarioKey, ScenarioParams> = {
  conservative: {
    label: 'Conservative',
    annualReturn: 0.05,
    dividendGrowthRate: 0.03,
    inflationRate: 0.035,
    color: '#FF9F43',
  },
  expected: {
    label: 'Expected',
    annualReturn: 0.08,
    dividendGrowthRate: 0.06,
    inflationRate: 0.03,
    color: '#338DFF',
  },
  optimistic: {
    label: 'Optimistic',
    annualReturn: 0.12,
    dividendGrowthRate: 0.09,
    inflationRate: 0.025,
    color: '#00C896',
  },
};

export const DEFAULT_SCENARIO: ScenarioKey = 'expected';

// Contribution forecast
export const FORECAST_DEFAULTS = {
  monthlyContribution: 500,
  years: 20,
  inflationEnabled: false,
} as const;

// FIRE
export const FIRE_DEFAULTS = {
  targetAnnualIncome: 50000,
  safeWithdrawalRate: 0.04,   // 4% rule
  monthlyContribution: 500,
  methodKey: 'swr' as FireMethodKey,
} as const;

// Milestones (dollar values)
export const PORTFOLIO_MILESTONES = [
  25_000, 50_000, 100_000, 250_000, 500_000,
  1_000_000, 2_000_000, 5_000_000,
] as const;

export type FireMethodKey = 'dividend_yield' | 'swr';

export const FIRE_METHODS: Record<FireMethodKey, { label: string; description: string }> = {
  dividend_yield: {
    label: 'Dividend Yield',
    description: 'Target income ÷ portfolio yield. Relies on dividend income.',
  },
  swr: {
    label: '4% Rule (SWR)',
    description: 'Target income ÷ 4%. Based on Safe Withdrawal Rate research.',
  },
};
