/**
 * useChartPoints.ts
 * Fetches price/portfolio history and normalizes it into ChartPoint[] for InteractiveChart.
 *
 * Two modes:
 *   Single-ticker  — for ETF/Stock/Crypto detail screens
 *   Multi-ticker   — for Portfolio (weighted sum of qty × price)
 *
 * For Portfolio "Today" period, also manages the rolling value snapshot
 * in AsyncStorage so the chart auto-updates as live prices change.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { ChartPoint } from '../../components/InteractiveChart';
import { getETFHistory } from '../services/api';

// ── Snapshot store (Portfolio Today) ─────────────────────────
const SNAPSHOT_KEY = 'portfolio_value_snapshots';
const MAX_SNAPSHOTS = 390; // ~1 trading day at 1-min intervals
const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface Snapshot {
  ts: number;   // Unix ms
  value: number;
}

async function loadSnapshots(): Promise<Snapshot[]> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return [];
    const snaps: Snapshot[] = JSON.parse(raw);
    const cutoff = Date.now() - SNAPSHOT_TTL_MS;
    return snaps.filter(s => s.ts > cutoff);
  } catch {
    return [];
  }
}

async function appendSnapshot(value: number): Promise<Snapshot[]> {
  const snaps = await loadSnapshots();
  snaps.push({ ts: Date.now(), value });
  // Keep only MAX_SNAPSHOTS most recent
  const trimmed = snaps.slice(-MAX_SNAPSHOTS);
  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(trimmed));
  return trimmed;
}

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

// ── Single-ticker hook (ETF / Stock / Crypto detail) ──────────
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

// ── Multi-ticker hook (Portfolio) ─────────────────────────────
interface PortfolioTickerPos {
  ticker: string;
  qty: number;
}

interface MultiOptions {
  positions: PortfolioTickerPos[];
  period: string;
  chartW: number;
  chartH: number;
  /** Pass totalValue here so "Today" snapshots stay current */
  liveTotal?: number;
}

export function usePortfolioChartPoints(
  { positions, period, chartW, chartH, liveTotal }: MultiOptions
): {
  points: ChartPoint[];
  loading: boolean;
  isPositive: boolean;
  pctChange: number | null;
  /** For "Today" period: latest live value to pass as liveValue prop */
  liveValue: number | undefined;
} {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [pctChange, setPctChange] = useState<number | null>(null);

  // "Today" snapshot management
  const lastSnapshotTotal = useRef<number | null>(null);

  // Append snapshot whenever liveTotal changes materially (> $0.01 change)
  useEffect(() => {
    if (period !== 'Today' || !liveTotal || liveTotal <= 0) return;
    if (
      lastSnapshotTotal.current === null ||
      Math.abs(liveTotal - lastSnapshotTotal.current) > 0.01
    ) {
      lastSnapshotTotal.current = liveTotal;
      appendSnapshot(liveTotal);
    }
  }, [liveTotal, period]);

  // Fetch / rebuild points when period or positions change
  useEffect(() => {
    if (positions.length === 0) return;
    let cancelled = false;
    setLoading(true);
    setPoints([]);
    setPctChange(null);

    async function load() {
      // "Today" — use AsyncStorage snapshots
      if (period === 'Today') {
        const snaps = await loadSnapshots();
        if (cancelled) return;
        if (snaps.length < 2) {
          // Not enough snapshots yet — show flat line at current value
          if (liveTotal && liveTotal > 0) {
            const now = Date.now();
            const flat: ChartPoint[] = [
              { x: 0, y: chartH / 2, value: liveTotal, label: formatLabel(now - 3600_000, 'Today') },
              { x: chartW, y: chartH / 2, value: liveTotal, label: formatLabel(now, 'Today') },
            ];
            if (!cancelled) { setPoints(flat); setPctChange(0); setLoading(false); }
          } else {
            if (!cancelled) setLoading(false);
          }
          return;
        }

        const vals = snaps.map(s => s.value);
        const minV = Math.min(...vals);
        const maxV = Math.max(...vals);
        const range = maxV - minV || 1;
        const PAD_TOP = 12, PAD_BOTTOM = 4;

        const pts: ChartPoint[] = snaps.map((s, i) => ({
          x: (i / (snaps.length - 1)) * chartW,
          y: PAD_TOP + (1 - (s.value - minV) / range) * (chartH - PAD_TOP - PAD_BOTTOM),
          value: s.value,
          label: formatLabel(s.ts, 'Today'),
        }));

        const pct = ((snaps[snaps.length - 1].value - snaps[0].value) / snaps[0].value) * 100;
        if (!cancelled) { setPoints(pts); setPctChange(pct); setLoading(false); }
        return;
      }

      // All other periods — fetch historical prices
      const source = positions.filter(p => p.qty > 0).length > 0
        ? positions.filter(p => p.qty > 0)
        : positions;

      const histories = await Promise.all(
        source.map(p => getETFHistory(p.ticker, period))
      );
      if (cancelled) return;

      const minLen = Math.min(...histories.map(h => h.length));
      if (minLen < 2) { setLoading(false); return; }

      // Build weighted portfolio value series
      const combined: { ts: number; val: number }[] = [];
      for (let i = 0; i < minLen; i++) {
        const val = source.reduce((sum, p, idx) => {
          return sum + (histories[idx][i]?.close ?? 0) * (p.qty > 0 ? p.qty : 1);
        }, 0);
        combined.push({ ts: histories[0][i].timestamp, val });
      }

      if (combined.length < 2) { if (!cancelled) setLoading(false); return; }

      const vals = combined.map(d => d.val);
      const minV = Math.min(...vals);
      const maxV = Math.max(...vals);
      const range = maxV - minV || 1;
      const PAD_TOP = 12, PAD_BOTTOM = 4;

      const pts: ChartPoint[] = combined.map((d, i) => ({
        x: (i / (combined.length - 1)) * chartW,
        y: PAD_TOP + (1 - (d.val - minV) / range) * (chartH - PAD_TOP - PAD_BOTTOM),
        value: d.val,
        label: formatLabel(d.ts * 1000, period),
      }));

      const pct = ((combined[combined.length - 1].val - combined[0].val) / combined[0].val) * 100;
      if (!cancelled) { setPoints(pts); setPctChange(pct); setLoading(false); }
    }

    load().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [
    period,
    positions.map(p => `${p.ticker}:${p.qty}`).join(','),
    chartW, chartH,
  ]);

  const isPositive = (pctChange ?? 0) >= 0;

  // For "Today" period, pass liveTotal as liveValue so the last point auto-updates
  const liveValue = (period === 'Today' && liveTotal && liveTotal > 0)
    ? liveTotal
    : undefined;

  return { points, loading, isPositive, pctChange, liveValue };
}
