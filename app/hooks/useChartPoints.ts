/**
 * useChartPoints.ts
 * Fetches price/portfolio history and normalizes it into ChartPoint[] for InteractiveChart.
 *
 * Two modes:
 *   Single-ticker  — for ETF/Stock/Crypto detail screens (UNCHANGED from V1.5)
 *   Multi-ticker   — for Portfolio (now snapshot-driven, TWR-based — V1.6)
 *
 * V1.6 CHANGE: usePortfolioChartPoints no longer live-weights historical prices
 * by current quantity (which incorrectly back-projected today's share count
 * across periods before the shares were even purchased). It now reads from
 * usePortfolioSnapshots, which derives daily values from actual transaction
 * history + historical prices, with proper TWR for the Performance % mode.
 */

import { useEffect, useMemo, useState } from 'react';
import { ChartPoint } from '../../components/InteractiveChart';
import { getETFHistory } from '../services/api';
import { DailySnapshot, hasHistoricalPrices, calculateSimpleReturn } from './useSnapshotEngine';
import { PriceHistoryMap } from './useSnapshotEngine';

// ── Date label helpers ────────────────────────────────────────
function formatLabel(ts: number, period: string): string {
  const d = new Date(ts);
  if (period === 'Today' || period === '1D') {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  if (period === '1W' || period === '1M') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function formatLabelFromISODate(isoDate: string, period: string): string {
  const ts = new Date(isoDate + 'T00:00:00').getTime();
  return formatLabel(ts, period);
}

// ── Single-ticker hook (ETF / Stock / Crypto detail) — UNCHANGED ──
interface SingleOptions {
  ticker: string;
  period: string;
  chartW: number;
  chartH: number;
}

export function useSingleChartPoints(
  { ticker, period, chartW, chartH }: SingleOptions
): { points: ChartPoint[]; loading: boolean; isPositive: boolean } {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;
    setLoading(true);
    setPoints([]);

    getETFHistory(ticker, period === 'Today' ? '1D' : period).then((hist) => {
      if (cancelled || hist.length < 2) { setLoading(false); return; }
      const vals = hist.map(h => h.close);
      const minV = Math.min(...vals);
      const maxV = Math.max(...vals);
      const range = maxV - minV || 1;
      const PAD_TOP = 12, PAD_BOTTOM = 4;

      const pts: ChartPoint[] = hist.map((h, i) => ({
        x: (i / (hist.length - 1)) * chartW,
        y: PAD_TOP + (1 - (h.close - minV) / range) * (chartH - PAD_TOP - PAD_BOTTOM),
        value: h.close,
        label: formatLabel(h.timestamp * 1000, period),
      }));

      if (!cancelled) { setPoints(pts); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [ticker, period, chartW, chartH]);

  const isPositive = points.length > 1
    ? points[points.length - 1].value >= points[0].value
    : true;

  return { points, loading, isPositive };
}

// ── Chart mode type ────────────────────────────────────────────
export type ChartMode = 'performance' | 'value' | 'profit' | 'contributions' | 'dividends';

// ── Period -> number of calendar days to slice from snapshots ──
const PERIOD_DAYS: Record<string, number | null> = {
  'Today': 1,
  '1D': 1,
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '6M': 180,
  'YTD': null, // special-cased below
  '1Y': 365,
  '5Y': 1825,
  'ALL': null, // entire history
};

function sliceSnapshotsForPeriod(snapshots: DailySnapshot[], period: string): DailySnapshot[] {
  if (snapshots.length === 0) return [];

  if (period === 'YTD') {
    const yearStart = `${new Date().getFullYear()}-01-01`;
    return snapshots.filter(s => s.date >= yearStart);
  }
  if (period === 'ALL') return snapshots;

  const days = PERIOD_DAYS[period] ?? 365;
  if (days === 1) {
    // "Today"/"1D" — just the most recent snapshot (single point, will show as flat line)
    return snapshots.slice(-1);
  }
  return snapshots.slice(-days);
}

// ── Extract the relevant value for a given chart mode from a snapshot ──
function valueForMode(snapshot: DailySnapshot, mode: ChartMode): number {
  switch (mode) {
    case 'performance': return snapshot.cumulativeReturn * 100; // as percentage
    case 'value': return snapshot.portfolioValue;
    case 'profit': return snapshot.profit;
    case 'contributions': return snapshot.contributions;
    case 'dividends': return snapshot.dividendIncome;
    default: return snapshot.portfolioValue;
  }
}

// ── Multi-ticker hook (Portfolio) — V1.6 snapshot-driven ──────
interface MultiOptions {
  snapshots: DailySnapshot[];
  rebuilding: boolean;
  period: string;
  mode: ChartMode;
  chartW: number;
  chartH: number;
  /** Pass current live total here so "Today" mode reflects intraday price moves */
  liveTotal?: number;
  /** Pass current contributions so simple return can be computed when historical prices unavailable */
  liveContributions?: number;
  /** Whether historical prices are available — determines TWR vs simple return */
  priceHistoryAvailable?: boolean;
}

export function usePortfolioChartPoints(
  { snapshots, rebuilding, period, mode, chartW, chartH, liveTotal, liveContributions, priceHistoryAvailable }: MultiOptions
): {
  points: ChartPoint[];
  loading: boolean;
  isPositive: boolean;
  pctChange: number | null;
  liveValue: number | undefined;
} {
  const result = useMemo(() => {
    if (rebuilding || snapshots.length === 0) {
      return { points: [] as ChartPoint[], pctChange: null as number | null };
    }

    const sliced = sliceSnapshotsForPeriod(snapshots, period);
    if (sliced.length === 0) {
      return { points: [] as ChartPoint[], pctChange: null as number | null };
    }

    // For "Today"/"1D" with only one snapshot point, synthesize a flat line
    // using liveTotal so the chart isn't a single dot.
    if (sliced.length === 1 && liveTotal && mode === 'value') {
      const baseValue = sliced[0].portfolioValue;
      const pts: ChartPoint[] = [
        { x: 0, y: chartH / 2, value: baseValue, label: formatLabelFromISODate(sliced[0].date, period) },
        { x: chartW, y: chartH / 2, value: liveTotal, label: 'Now' },
      ];
      const pct = baseValue > 0 ? ((liveTotal - baseValue) / baseValue) * 100 : 0;
      return { points: pts, pctChange: pct };
    }

    if (sliced.length < 2) {
      return { points: [] as ChartPoint[], pctChange: null as number | null };
    }

    const vals = sliced.map(s => valueForMode(s, mode));
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const range = maxV - minV || 1;
    const PAD_TOP = 12, PAD_BOTTOM = 4;

    const pts: ChartPoint[] = sliced.map((s, i) => {
      const v = valueForMode(s, mode);
      return {
        x: (i / (sliced.length - 1)) * chartW,
        y: PAD_TOP + (1 - (v - minV) / range) * (chartH - PAD_TOP - PAD_BOTTOM),
        value: v,
        label: formatLabelFromISODate(s.date, period),
      };
    });

    // pctChange — always use simple return as the headline number.
    // For all modes: (currentValue - contributions) / contributions.
    // This is always accurate from the transaction ledger alone and never
    // produces absurd values from near-zero early snapshot portfolioValues.
    const latestValue = liveTotal ?? sliced[sliced.length - 1].portfolioValue;
    const contributions = liveContributions ?? sliced[sliced.length - 1].contributions;
    const pct = calculateSimpleReturn(latestValue, contributions) * 100;

    return { points: pts, pctChange: pct };
  }, [snapshots, rebuilding, period, mode, chartW, chartH, liveTotal, liveContributions, priceHistoryAvailable]);

  const isPositive = (result.pctChange ?? 0) >= 0;

  const liveValue = (mode === 'value' && (period === 'Today' || period === '1D') && liveTotal && liveTotal > 0)
    ? liveTotal
    : undefined;

  return {
    points: result.points,
    loading: rebuilding,
    isPositive,
    pctChange: result.pctChange,
    liveValue,
  };
}
