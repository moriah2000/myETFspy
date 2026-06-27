// hooks/useDividendData.ts
//
// Portfolio-level dividend income calculations.
// Consumes usePortfolioData (positions, totalValue, totalCostBasis).
// Consumes dividendService (raw DividendData per ticker).
// Never reimplements FIFO. Never writes to portfolio stores.
// Logging prefix: [DIVIDEND]

import { useEffect, useRef, useState } from 'react';
import { usePortfolioData } from '../app/hooks/usePortfolioData';
import { DividendData, getDividendDataBatch } from '../services/dividendService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TickerDividendSummary = {
  ticker: string;
  shares: number;
  annualIncome: number;           // shares × annualDividendPerShare
  monthlyIncome: number;          // annualIncome / 12
  incomePerPayment: number;       // shares × dividendPerPayment
  dividendFrequency: string;
  exDividendDate: string | null;
  payDate: string | null;
  source: string;
  currentValue: number;
};

export type CalendarEntry = {
  ticker: string;
  payDate: string;                // ISO date string
  exDividendDate: string | null;
  expectedIncome: number;
  month: string;                  // e.g. "July 2026"
};

export type DividendSummary = {
  annualIncome: number;
  monthlyIncome: number;
  next12MonthsIncome: number;     // rolling forward projection based on latest schedules
  portfolioYield: number;         // annualIncome / totalValue
  yieldOnCost: number;            // annualIncome / totalCostBasis
  byTicker: TickerDividendSummary[];
  calendar: CalendarEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(event: string, data?: unknown) {
  console.log(`[DIVIDEND] ${event}`, data ?? '');
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function formatMonth(isoDate: string): string {
  try {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch { return isoDate.slice(0, 7); }
}

function formatPayDate(isoDate: string): string {
  try {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return isoDate; }
}

// Build calendar entries for tickers that have a known pay date in the future
function buildCalendar(summaries: TickerDividendSummary[]): CalendarEntry[] {
  const today = new Date().toISOString().slice(0, 10);
  const threeMonthsOut = new Date();
  threeMonthsOut.setMonth(threeMonthsOut.getMonth() + 3);
  const cutoff = threeMonthsOut.toISOString().slice(0, 10);

  const entries: CalendarEntry[] = [];

  for (const s of summaries) {
    if (!s.payDate) continue;
    if (s.payDate < today || s.payDate > cutoff) continue;
    if (s.incomePerPayment <= 0) continue;

    entries.push({
      ticker: s.ticker,
      payDate: s.payDate,
      exDividendDate: s.exDividendDate,
      expectedIncome: s.incomePerPayment,
      month: formatMonth(s.payDate),
    });
  }

  // Sort by pay date ascending
  entries.sort((a, b) => a.payDate.localeCompare(b.payDate));
  return entries;
}

// Next 12 months income: project payments forward based on frequency
function calcNext12MonthsIncome(summaries: TickerDividendSummary[]): number {
  const freqPayments: Record<string, number> = {
    Monthly: 12, Quarterly: 4, 'Semi-Annual': 2, Annual: 1, Irregular: 2, None: 0,
  };
  return summaries.reduce((sum, s) => {
    const payments = freqPayments[s.dividendFrequency] ?? 4;
    return sum + s.incomePerPayment * payments;
  }, 0);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDividendData(): DividendSummary {
  const { positions, totalValue, totalCostBasis, loading: portfolioLoading } = usePortfolioData();
  const [dividendMap, setDividendMap] = useState<Record<string, DividendData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshCountRef = useRef(0);

  async function fetchAll(forceRefresh = false) {
    if (portfolioLoading || positions.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const myRefresh = ++refreshCountRef.current;

    log('Fetching dividend data', { positionCount: positions.length });

    try {
      const batch = positions
        .filter(p => p.qty > 0)
        .map(p => ({
          ticker: p.ticker,
          // dividendYield not on ETFPosition — pass 0, service will use history
          dividendYield: 0,
          currentPrice: p.price,
        }));

      const result = await getDividendDataBatch(batch, forceRefresh);

      if (myRefresh !== refreshCountRef.current) return; // superseded

      setDividendMap(result);
      log('Dividend data loaded', { tickerCount: Object.keys(result).length });
    } catch (err) {
      if (myRefresh !== refreshCountRef.current) return;
      const msg = String(err);
      setError(msg);
      log('Fetch failed', { err: msg });
    } finally {
      if (myRefresh === refreshCountRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (!portfolioLoading) {
      fetchAll();
    }
  }, [portfolioLoading, positions.length]);

  // ── Calculations ────────────────────────────────────────────────────────────

  const byTicker: TickerDividendSummary[] = positions
    .filter(p => p.qty > 0)
    .map(p => {
      const d = dividendMap[p.ticker];
      if (!d) {
        return {
          ticker: p.ticker, shares: p.qty,
          annualIncome: 0, monthlyIncome: 0, incomePerPayment: 0,
          dividendFrequency: 'Unknown', exDividendDate: null, payDate: null,
          source: 'pending', currentValue: p.value,
        };
      }
      const annualIncome = p.qty * d.annualDividendPerShare;
      const incomePerPayment = p.qty * d.dividendPerPayment;
      return {
        ticker: p.ticker,
        shares: p.qty,
        annualIncome,
        monthlyIncome: annualIncome / 12,
        incomePerPayment,
        dividendFrequency: d.dividendFrequency,
        exDividendDate: d.exDividendDate,
        payDate: d.payDate,
        source: d.source,
        currentValue: p.value,
      };
    });

  const annualIncome = byTicker.reduce((s, t) => s + t.annualIncome, 0);
  const monthlyIncome = annualIncome / 12;
  const next12MonthsIncome = calcNext12MonthsIncome(byTicker);
  const portfolioYield = totalValue > 0 ? annualIncome / totalValue : 0;
  const yieldOnCost = totalCostBasis > 0 ? annualIncome / totalCostBasis : 0;
  const calendar = buildCalendar(byTicker);

  return {
    annualIncome,
    monthlyIncome,
    next12MonthsIncome,
    portfolioYield,
    yieldOnCost,
    byTicker,
    calendar,
    loading: loading || portfolioLoading,
    error,
    refresh: () => fetchAll(true),
  };
}
