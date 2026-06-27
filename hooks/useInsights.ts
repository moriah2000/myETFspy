// hooks/useInsights.ts
//
// Feeds existing hooks into insightsEngine and exposes InsightCard[].
// Consumes: usePortfolioData, useDividendData, usePortfolioAnalytics, useForecast.
// Never reads transactions, never performs FIFO, no AsyncStorage, no network.
// Logging prefix: [INSIGHTS]

import { useMemo } from 'react';
import { usePortfolioData } from '../app/hooks/usePortfolioData';
import { useDividendData } from './useDividendData';
import { usePortfolioAnalytics } from './usePortfolioAnalytics';
import { useForecast } from './useForecast';
import { generateInsights, InsightCard, InsightsInput } from '../services/insightsEngine';

function log(event: string, data?: unknown) {
  console.log(`[INSIGHTS] ${event}`, data ?? '');
}

export type InsightsState = {
  cards: InsightCard[];
  loading: boolean;
  alertCount: number;
  warningCount: number;
};

export function useInsights(): InsightsState {
  const { positions, totalValue, loading: portfolioLoading } = usePortfolioData();
  const {
    annualIncome, monthlyIncome, next12MonthsIncome,
    portfolioYield, yieldOnCost, byTicker,
    loading: dividendLoading,
  } = useDividendData();
  const {
    concentrationRisk, diversification, sectorAllocation, topHoldings,
    loading: analyticsLoading,
  } = usePortfolioAnalytics();
  const {
    fireResult, fireInputs,
  } = useForecast();

  const loading = portfolioLoading || dividendLoading || analyticsLoading;

  const cards = useMemo(() => {
    if (loading || positions.length === 0) return [];

    const input: InsightsInput = {
      totalValue,
      positions: positions.map(p => ({
        ticker: p.ticker,
        assetType: p.assetType,
        value: p.value,
        qty: p.qty,
        price: p.price,
        pct: p.pct,
      })),
      concentrationRisk,
      diversification,
      sectorAllocation,
      topHoldings,
      annualIncome,
      monthlyIncome,
      next12MonthsIncome,
      portfolioYield,
      yieldOnCost,
      byTicker: byTicker.map(t => ({
        ticker: t.ticker,
        annualIncome: t.annualIncome,
        dividendFrequency: t.dividendFrequency,
        source: t.source,
      })),
      fireProgressPct: fireResult.progressPct,
      fireYearsUntilTarget: fireResult.yearsUntilTarget,
      fireTargetReached: fireResult.targetReached,
      fireTargetIncome: fireInputs.targetAnnualIncome,
    };

    const result = generateInsights(input);

    log('Insights generated', {
      count: result.length,
      alerts: result.filter(c => c.severity === 'alert').length,
      warnings: result.filter(c => c.severity === 'warning').length,
    });

    return result;
  }, [
    loading, positions.length, totalValue,
    concentrationRisk.status, concentrationRisk.largestHoldingWeight,
    diversification.grade, diversification.holdingCount,
    sectorAllocation.length,
    annualIncome, portfolioYield, yieldOnCost, next12MonthsIncome,
    fireResult.progressPct, fireResult.targetReached,
  ]);

  return {
    cards,
    loading,
    alertCount: cards.filter(c => c.severity === 'alert').length,
    warningCount: cards.filter(c => c.severity === 'warning').length,
  };
}
