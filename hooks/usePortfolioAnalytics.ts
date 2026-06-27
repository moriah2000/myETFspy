// hooks/usePortfolioAnalytics.ts
//
// Portfolio analytics calculations.
// Consumes usePortfolioData only. Never reads AsyncStorage directly.
// Never imports usePortfolioTransactions or calculateAllPositions.
// Logging prefix: [ANALYTICS]

import { useEffect, useState } from 'react';
import { usePortfolioData } from '../app/hooks/usePortfolioData';
import { resolveMetadataBatch } from '../services/metadataResolver';
import {
  CONCENTRATION_LIMITS,
  DIVERSIFICATION_THRESHOLDS,
  TOP_HOLDINGS_COUNT,
} from '../constants/portfolioAnalytics';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AllocationSlice = {
  label: string;
  value: number;        // dollar value
  weight: number;       // 0–100 percentage
};

export type TopHolding = {
  ticker: string;
  assetType: string;
  value: number;
  weight: number;       // 0–100 percentage
};

export type ConcentrationRisk = {
  status: 'Healthy' | 'Warning' | 'High Risk';
  message: string;
  largestHolding: string;
  largestHoldingWeight: number;
  top3Weight: number;
};

export type DiversificationScore = {
  grade: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'N/A';
  reasons: string[];
  holdingCount: number;
  sectorCount: number;
  assetClassCount: number;
  largestWeight: number;
};

export type PortfolioAnalytics = {
  assetAllocation: AllocationSlice[];
  sectorAllocation: AllocationSlice[];
  geographicAllocation: AllocationSlice[];
  topHoldings: TopHolding[];
  concentrationRisk: ConcentrationRisk;
  diversification: DiversificationScore;
  loading: boolean;
  error: string | null;
};

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(event: string, data?: unknown) {
  console.log(`[ANALYTICS] ${event}`, data ?? '');
}

// ─── Generic allocation engine ────────────────────────────────────────────────
// One implementation, three uses (asset, sector, geographic).

function groupAllocation(
  positions: { value: number }[],
  selector: (pos: any) => string,
  totalValue: number
): AllocationSlice[] {
  const groups: Record<string, number> = {};

  for (const pos of positions) {
    const label = selector(pos);
    groups[label] = (groups[label] ?? 0) + pos.value;
  }

  return Object.entries(groups)
    .map(([label, value]) => ({
      label,
      value,
      weight: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

// ─── Concentration risk ───────────────────────────────────────────────────────

function calcConcentrationRisk(
  positions: { ticker: string; value: number }[],
  totalValue: number
): ConcentrationRisk {
  if (positions.length === 0 || totalValue === 0) {
    return {
      status: 'Healthy', message: 'No positions to evaluate.',
      largestHolding: '—', largestHoldingWeight: 0, top3Weight: 0,
    };
  }

  const sorted = [...positions].sort((a, b) => b.value - a.value);
  const largestWeight = (sorted[0].value / totalValue) * 100;
  const top3Weight = sorted.slice(0, 3).reduce((s, p) => s + p.value, 0) / totalValue * 100;

  let status: ConcentrationRisk['status'] = 'Healthy';
  let message = 'Portfolio is well diversified.';

  if (
    largestWeight >= CONCENTRATION_LIMITS.singleHoldingHighRisk ||
    top3Weight >= CONCENTRATION_LIMITS.top3HighRisk
  ) {
    status = 'High Risk';
    message = largestWeight >= CONCENTRATION_LIMITS.singleHoldingHighRisk
      ? `${sorted[0].ticker} represents ${largestWeight.toFixed(1)}% of the portfolio.`
      : `Top 3 holdings represent ${top3Weight.toFixed(1)}% of the portfolio.`;
  } else if (
    largestWeight >= CONCENTRATION_LIMITS.singleHoldingWarning ||
    top3Weight >= CONCENTRATION_LIMITS.top3Warning
  ) {
    status = 'Warning';
    message = largestWeight >= CONCENTRATION_LIMITS.singleHoldingWarning
      ? `${sorted[0].ticker} represents ${largestWeight.toFixed(1)}% of the portfolio.`
      : `Top 3 holdings represent ${top3Weight.toFixed(1)}% of the portfolio.`;
  }

  return {
    status, message,
    largestHolding: sorted[0].ticker,
    largestHoldingWeight: largestWeight,
    top3Weight,
  };
}

// ─── Diversification score ────────────────────────────────────────────────────

function calcDiversification(
  holdingCount: number,
  largestWeight: number,
  sectorCount: number,
  assetClassCount: number
): DiversificationScore {
  if (holdingCount === 0) {
    return {
      grade: 'N/A', reasons: ['No positions in portfolio.'],
      holdingCount: 0, sectorCount: 0, assetClassCount: 0, largestWeight: 0,
    };
  }

  const T = DIVERSIFICATION_THRESHOLDS;
  const reasons: string[] = [];
  let score = 0; // 0–8 points

  // Holdings count (0–2 pts)
  if (holdingCount >= T.holdingsExcellent) { score += 2; reasons.push(`${holdingCount} holdings`); }
  else if (holdingCount >= T.holdingsGood) { score += 1; reasons.push(`${holdingCount} holdings`); }
  else { reasons.push(`Only ${holdingCount} holding${holdingCount > 1 ? 's' : ''}`); }

  // Largest position weight (0–2 pts)
  if (largestWeight <= T.largestExcellent) { score += 2; reasons.push(`Largest position ${largestWeight.toFixed(1)}%`); }
  else if (largestWeight <= T.largestGood) { score += 1; reasons.push(`Largest position ${largestWeight.toFixed(1)}%`); }
  else { reasons.push(`Largest position ${largestWeight.toFixed(1)}% — concentrated`); }

  // Sector count (0–2 pts)
  if (sectorCount >= T.sectorsExcellent) { score += 2; reasons.push(`${sectorCount} sectors`); }
  else if (sectorCount >= T.sectorsGood) { score += 1; reasons.push(`${sectorCount} sectors`); }
  else { reasons.push(`${sectorCount} sector${sectorCount > 1 ? 's' : ''}`); }

  // Asset class count (0–2 pts)
  if (assetClassCount >= T.assetClassesGood) { score += 2; reasons.push(`${assetClassCount} asset classes`); }
  else { score += 1; reasons.push(`${assetClassCount} asset class`); }

  let grade: DiversificationScore['grade'];
  if (score >= 7) grade = 'Excellent';
  else if (score >= 5) grade = 'Good';
  else if (score >= 3) grade = 'Fair';
  else grade = 'Poor';

  return { grade, reasons, holdingCount, sectorCount, assetClassCount, largestWeight };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePortfolioAnalytics(): PortfolioAnalytics {
  const { positions, totalValue, loading: portfolioLoading } = usePortfolioData();
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (portfolioLoading) return;

    async function compute() {
      setLoading(true);
      setError(null);

      try {
        if (positions.length === 0) {
          log('Empty portfolio');
          setAnalytics(emptyAnalytics());
          setLoading(false);
          return;
        }

        // Resolve metadata for all tickers in one batch
        const tickers = positions.map(p => p.ticker);
        const metaMap = await resolveMetadataBatch(tickers);

        // Enrich positions with metadata
        const enriched = positions.map(p => ({
          ...p,
          sector: metaMap[p.ticker]?.sector ?? 'Other',
          region: metaMap[p.ticker]?.region ?? 'Other',
        }));

        // Asset allocation
        const assetAllocation = groupAllocation(enriched, p => p.assetType, totalValue);

        // Sector allocation
        const sectorAllocation = groupAllocation(enriched, p => p.sector, totalValue);

        // Geographic allocation
        const geographicAllocation = groupAllocation(enriched, p => p.region, totalValue);

        // Top holdings
        const topHoldings: TopHolding[] = [...enriched]
          .sort((a, b) => b.value - a.value)
          .slice(0, TOP_HOLDINGS_COUNT)
          .map(p => ({
            ticker: p.ticker,
            assetType: p.assetType,
            value: p.value,
            weight: totalValue > 0 ? (p.value / totalValue) * 100 : 0,
          }));

        // Concentration risk
        const concentrationRisk = calcConcentrationRisk(enriched, totalValue);

        // Diversification score
        const sectorCount = new Set(enriched.map(p => p.sector)).size;
        const assetClassCount = new Set(enriched.map(p => p.assetType)).size;
        const largestWeight = topHoldings[0]?.weight ?? 0;
        const diversification = calcDiversification(
          positions.length, largestWeight, sectorCount, assetClassCount
        );

        log('Portfolio analysed', {
          positions: positions.length,
          sectors: sectorCount,
          diversificationGrade: diversification.grade,
        });

        setAnalytics({
          assetAllocation, sectorAllocation, geographicAllocation,
          topHoldings, concentrationRisk, diversification,
          loading: false, error: null,
        });

      } catch (err) {
        const msg = String(err);
        setError(msg);
        log('Analysis failed', { err: msg });
      } finally {
        setLoading(false);
      }
    }

    compute();
  }, [portfolioLoading, positions.length, totalValue]);

  if (!analytics) {
    return { ...emptyAnalytics(), loading: loading || portfolioLoading, error };
  }

  return { ...analytics, loading: loading || portfolioLoading, error };
}

function emptyAnalytics(): PortfolioAnalytics {
  return {
    assetAllocation: [],
    sectorAllocation: [],
    geographicAllocation: [],
    topHoldings: [],
    concentrationRisk: {
      status: 'Healthy',
      message: 'No positions to evaluate.',
      largestHolding: '—',
      largestHoldingWeight: 0,
      top3Weight: 0,
    },
    diversification: {
      grade: 'N/A',
      reasons: ['No positions in portfolio.'],
      holdingCount: 0,
      sectorCount: 0,
      assetClassCount: 0,
      largestWeight: 0,
    },
    loading: false,
    error: null,
  };
}
