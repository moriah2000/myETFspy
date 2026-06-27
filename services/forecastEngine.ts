// services/forecastEngine.ts
//
// Pure mathematical forecast engine.
// No React hooks. No AsyncStorage. No network requests. No hidden constants.
// Identical inputs always produce identical outputs.
// All assumptions are explicit inputs.
//
// Logging prefix: [FORECAST] — called by useForecast, not directly by UI.

import { PORTFOLIO_MILESTONES } from '../constants/forecastScenarios';

// ─── Input types ──────────────────────────────────────────────────────────────

export type ContributionForecastInput = {
  startingBalance: number;        // current portfolio value
  monthlyContribution: number;    // $ per month added
  annualReturn: number;           // decimal e.g. 0.08
  years: number;                  // projection horizon
  inflationRate: number;          // decimal e.g. 0.03 (used if inflationEnabled)
  inflationEnabled: boolean;
};

export type DividendGrowthInput = {
  currentAnnualIncome: number;    // $ current annual dividend income
  currentTotalCostBasis: number;  // $ FIFO cost basis (for YOC)
  dividendGrowthRate: number;     // decimal e.g. 0.06
  years: number;                  // max projection horizon
  inflationRate: number;
  inflationEnabled: boolean;
};

export type FireInput = {
  currentPortfolioValue: number;
  monthlyContribution: number;
  annualReturn: number;
  targetAnnualIncome: number;
  currentAnnualDividendIncome: number;
  currentPortfolioYield: number;  // decimal e.g. 0.035
  safeWithdrawalRate: number;     // decimal e.g. 0.04
  methodKey: 'dividend_yield' | 'swr';
  inflationRate: number;
  inflationEnabled: boolean;
};

// ─── Output types ─────────────────────────────────────────────────────────────

export type YearlyProjection = {
  year: number;
  portfolioValue: number;
  totalContributions: number;     // cumulative contributions added
  totalGrowth: number;            // portfolioValue - startingBalance - totalContributions
  monthlyIncome: number;          // portfolioValue × annualReturn / 12 (approximate passive income)
  // Inflation-adjusted equivalents (same as nominal when inflationEnabled=false)
  realPortfolioValue: number;
  realTotalContributions: number;
  realMonthlyIncome: number;
};

export type MilestoneResult = {
  milestone: number;
  projectedYear: number | null;   // null = not reached within horizon
};

export type ContributionForecastResult = {
  yearlyProjections: YearlyProjection[];   // every year from 1 to input.years
  displayYears: YearlyProjection[];        // years 1, 5, 10, 20 (or max available)
  milestones: MilestoneResult[];
  finalValue: number;
  totalContributed: number;
  totalGrowth: number;
  // Metadata for future extensions (taxes, DRIP, withdrawals, Monte Carlo)
  meta: {
    startingBalance: number;
    annualReturn: number;
    monthlyContribution: number;
    inflationRate: number;
    inflationEnabled: boolean;
    years: number;
  };
};

export type DividendGrowthYearResult = {
  year: number;
  annualIncome: number;
  monthlyIncome: number;
  yieldOnCost: number;            // annualIncome / currentTotalCostBasis
  realAnnualIncome: number;       // inflation-adjusted
  realMonthlyIncome: number;
};

export type DividendGrowthResult = {
  yearlyProjections: DividendGrowthYearResult[];
  displayYears: DividendGrowthYearResult[];  // 1, 5, 10, 20
  meta: {
    currentAnnualIncome: number;
    dividendGrowthRate: number;
    inflationRate: number;
    inflationEnabled: boolean;
  };
};

export type FireResult = {
  requiredPortfolioValue: number;
  currentPortfolioValue: number;
  progressPct: number;            // 0–100, capped at 100
  targetReached: boolean;
  yearsUntilTarget: number | null; // null = not reachable within 50 years
  projectedReachYear: number | null;
  yearlyProjections: YearlyProjection[];
  method: 'dividend_yield' | 'swr';
  targetAnnualIncome: number;
  meta: {
    annualReturn: number;
    monthlyContribution: number;
    safeWithdrawalRate: number;
    currentPortfolioYield: number;
    inflationRate: number;
    inflationEnabled: boolean;
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(v: number, fallback = 0): number {
  return isFinite(v) && !isNaN(v) ? v : fallback;
}

function inflationDeflator(inflationRate: number, years: number): number {
  return Math.pow(1 + inflationRate, years);
}

function selectDisplayYears<T extends { year: number }>(
  projections: T[],
  targetYears: number[]
): T[] {
  return targetYears
    .map(y => projections.find(p => p.year === y) ?? projections[projections.length - 1])
    .filter((p, i, arr) => p && arr.findIndex(x => x?.year === p?.year) === i) as T[];
}

function detectMilestones(projections: YearlyProjection[]): MilestoneResult[] {
  return PORTFOLIO_MILESTONES.map(milestone => {
    const hit = projections.find(p => p.portfolioValue >= milestone);
    return { milestone, projectedYear: hit?.year ?? null };
  });
}

// ─── Contribution Forecast ────────────────────────────────────────────────────

export function calcContributionForecast(
  input: ContributionForecastInput
): ContributionForecastResult {
  const {
    startingBalance, monthlyContribution, annualReturn,
    years, inflationRate, inflationEnabled,
  } = input;

  const safeReturn = clamp(safeNumber(annualReturn), 0, 1);
  const safeMonthly = clamp(safeNumber(monthlyContribution), 0, Infinity);
  const safeYears = clamp(Math.round(safeNumber(years, 1)), 1, 50);
  const safeInflation = clamp(safeNumber(inflationRate), 0, 1);
  const monthlyReturn = safeReturn / 12;

  const yearlyProjections: YearlyProjection[] = [];
  let balance = safeNumber(startingBalance);

  for (let y = 1; y <= safeYears; y++) {
    // Compound month by month for accuracy
    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + monthlyReturn) + safeMonthly;
    }

    const totalContributions = safeMonthly * 12 * y;
    const totalGrowth = balance - safeNumber(startingBalance) - totalContributions;
    const deflator = inflationEnabled ? inflationDeflator(safeInflation, y) : 1;

    yearlyProjections.push({
      year: y,
      portfolioValue: safeNumber(balance),
      totalContributions: safeNumber(totalContributions),
      totalGrowth: safeNumber(totalGrowth),
      monthlyIncome: safeNumber(balance * safeReturn / 12),
      realPortfolioValue: safeNumber(balance / deflator),
      realTotalContributions: safeNumber(totalContributions / deflator),
      realMonthlyIncome: safeNumber((balance * safeReturn / 12) / deflator),
    });
  }

  const last = yearlyProjections[yearlyProjections.length - 1];
  const displayYears = selectDisplayYears(yearlyProjections, [1, 5, 10, 20]);
  const milestones = detectMilestones(yearlyProjections);

  return {
    yearlyProjections,
    displayYears,
    milestones,
    finalValue: safeNumber(last?.portfolioValue ?? 0),
    totalContributed: safeNumber(last?.totalContributions ?? 0),
    totalGrowth: safeNumber(last?.totalGrowth ?? 0),
    meta: {
      startingBalance, annualReturn, monthlyContribution,
      inflationRate, inflationEnabled, years: safeYears,
    },
  };
}

// ─── Dividend Growth Forecast ─────────────────────────────────────────────────

export function calcDividendGrowthForecast(
  input: DividendGrowthInput
): DividendGrowthResult {
  const {
    currentAnnualIncome, currentTotalCostBasis, dividendGrowthRate,
    years, inflationRate, inflationEnabled,
  } = input;

  const safeGrowth = clamp(safeNumber(dividendGrowthRate), 0, 1);
  const safeYears = clamp(Math.round(safeNumber(years, 1)), 1, 50);
  const safeInflation = clamp(safeNumber(inflationRate), 0, 1);
  const safeCostBasis = safeNumber(currentTotalCostBasis);

  const yearlyProjections: DividendGrowthYearResult[] = [];

  for (let y = 1; y <= safeYears; y++) {
    const annualIncome = currentAnnualIncome * Math.pow(1 + safeGrowth, y);
    const deflator = inflationEnabled ? inflationDeflator(safeInflation, y) : 1;
    const yoc = safeCostBasis > 0 ? annualIncome / safeCostBasis : 0;

    yearlyProjections.push({
      year: y,
      annualIncome: safeNumber(annualIncome),
      monthlyIncome: safeNumber(annualIncome / 12),
      yieldOnCost: safeNumber(yoc),
      realAnnualIncome: safeNumber(annualIncome / deflator),
      realMonthlyIncome: safeNumber(annualIncome / 12 / deflator),
    });
  }

  return {
    yearlyProjections,
    displayYears: selectDisplayYears(yearlyProjections, [1, 5, 10, 20]),
    meta: {
      currentAnnualIncome,
      dividendGrowthRate,
      inflationRate,
      inflationEnabled,
    },
  };
}

// ─── FIRE Projection ──────────────────────────────────────────────────────────

export function calcFireProjection(input: FireInput): FireResult {
  const {
    currentPortfolioValue, monthlyContribution, annualReturn,
    targetAnnualIncome, currentPortfolioYield, safeWithdrawalRate,
    methodKey, inflationRate, inflationEnabled,
  } = input;

  const safeReturn = clamp(safeNumber(annualReturn), 0, 1);
  const safeMonthly = clamp(safeNumber(monthlyContribution), 0, Infinity);
  const safeInflation = clamp(safeNumber(inflationRate), 0, 1);
  const safeTarget = safeNumber(targetAnnualIncome);

  // Required portfolio value
  let requiredPortfolioValue: number;
  if (methodKey === 'dividend_yield') {
    const yield_ = clamp(safeNumber(currentPortfolioYield), 0.001, 1);
    requiredPortfolioValue = safeTarget / yield_;
  } else {
    const swr = clamp(safeNumber(safeWithdrawalRate), 0.001, 1);
    requiredPortfolioValue = safeTarget / swr;
  }

  const safeCurrent = safeNumber(currentPortfolioValue);
  const targetReached = safeCurrent >= requiredPortfolioValue;
  const progressPct = requiredPortfolioValue > 0
    ? clamp((safeCurrent / requiredPortfolioValue) * 100, 0, 100)
    : 0;

  // Project forward up to 50 years
  const MAX_YEARS = 50;
  const monthlyReturn = safeReturn / 12;
  const yearlyProjections: YearlyProjection[] = [];
  let balance = safeCurrent;
  let projectedReachYear: number | null = targetReached ? 0 : null;

  for (let y = 1; y <= MAX_YEARS; y++) {
    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + monthlyReturn) + safeMonthly;
    }
    const totalContributions = safeMonthly * 12 * y;
    const totalGrowth = balance - safeCurrent - totalContributions;
    const deflator = inflationEnabled ? inflationDeflator(safeInflation, y) : 1;

    yearlyProjections.push({
      year: y,
      portfolioValue: safeNumber(balance),
      totalContributions: safeNumber(totalContributions),
      totalGrowth: safeNumber(totalGrowth),
      monthlyIncome: safeNumber(balance * safeReturn / 12),
      realPortfolioValue: safeNumber(balance / deflator),
      realTotalContributions: safeNumber(totalContributions / deflator),
      realMonthlyIncome: safeNumber((balance * safeReturn / 12) / deflator),
    });

    if (projectedReachYear === null && balance >= requiredPortfolioValue) {
      projectedReachYear = y;
    }
  }

  return {
    requiredPortfolioValue: safeNumber(requiredPortfolioValue),
    currentPortfolioValue: safeCurrent,
    progressPct: safeNumber(progressPct),
    targetReached,
    yearsUntilTarget: targetReached ? 0 : projectedReachYear,
    projectedReachYear,
    yearlyProjections,
    method: methodKey,
    targetAnnualIncome: safeTarget,
    meta: {
      annualReturn, monthlyContribution, safeWithdrawalRate,
      currentPortfolioYield, inflationRate, inflationEnabled,
    },
  };
}
