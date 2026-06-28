// services/dividendService.ts
//
// Raw dividend data service. Fetch, cache, resolve.
// Never calculates income — that lives in useDividendData.ts.
// Never writes to portfolio stores.
// Logging prefix: [DIVIDEND]

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getETFDividends, getNextDividendDates } from '../app/services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DividendFrequency =
  | 'Monthly'
  | 'Quarterly'
  | 'Semi-Annual'
  | 'Annual'
  | 'Irregular'
  | 'None';

export type DividendSource =
  | 'history-12m'       // summed from last 12 months of actual payments
  | 'history-annualized' // annualized from latest regular payment
  | 'yield-price'       // dividendYield × currentPrice fallback
  | 'none';             // no data available

export type DividendData = {
  ticker: string;
  annualDividendPerShare: number;
  dividendPerPayment: number;
  dividendFrequency: DividendFrequency;
  exDividendDate: string | null;   // ISO date string or null
  payDate: string | null;          // ISO date string or null
  source: DividendSource;
  lastUpdated: number;             // unix ms timestamp
};

// Cache shape: one object, keyed by ticker
type DividendCache = Record<string, { data: DividendData; updatedAt: number }>;

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_KEY = 'dividend_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_TICKERS = 50;

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(event: string, data?: unknown) {
  console.log(`[DIVIDEND] ${event}`, data ?? '');
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function readCache(): Promise<DividendCache> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as DividendCache;
  } catch {
    return {};
  }
}

async function writeCache(cache: DividendCache): Promise<void> {
  try {
    // Evict oldest entries if over limit
    const entries = Object.entries(cache);
    if (entries.length > MAX_CACHE_TICKERS) {
      entries.sort((a, b) => a[1].updatedAt - b[1].updatedAt);
      const trimmed = entries.slice(entries.length - MAX_CACHE_TICKERS);
      cache = Object.fromEntries(trimmed);
    }
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    log('Cache write failed', { err: String(err) });
  }
}

// ─── Frequency inference ──────────────────────────────────────────────────────

function inferFrequency(
  payments: { date: string; amount: number }[]
): DividendFrequency {
  if (payments.length === 0) return 'None';

  // Count payments in the last 12 months
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Normalize dates from dividend history (they come as "Jun 15, 2025" format)
  const recent = payments.filter(p => {
    try {
      const d = new Date(p.date);
      return d.toISOString().slice(0, 10) >= cutoffStr;
    } catch { return false; }
  });

  const count = recent.length;
  if (count >= 10) return 'Monthly';
  if (count >= 3 && count <= 5) return 'Quarterly';
  if (count === 2) return 'Semi-Annual';
  if (count === 1) return 'Annual';
  if (payments.length >= 2) return 'Irregular';
  return 'None';
}

// ─── Annual dividend resolution ───────────────────────────────────────────────
//
// Resolution order:
// 1. Sum the last 12 months of actual payments
// 2. Annualize the latest regular payment if < 12 months history
// 3. dividendYield × currentPrice as last resort
// 4. Return 0 if all fail

function resolveAnnualDividend(
  payments: { date: string; amount: number; timestamp?: number }[],
  frequency: DividendFrequency,
  dividendYield: number,
  currentPrice: number
): { annualDps: number; perPayment: number; source: DividendSource } {

  // Step 1: sum last 12 months
  if (payments.length > 0) {
    const now = Date.now();
    const twelveMonthsAgo = now - 365 * 24 * 60 * 60 * 1000;
    const last12m = payments.filter(p => {
      if (p.timestamp) return p.timestamp * 1000 >= twelveMonthsAgo;
      try { return new Date(p.date).getTime() >= twelveMonthsAgo; } catch { return false; }
    });

    if (last12m.length >= 2) {
      const annualDps = last12m.reduce((s, p) => s + p.amount, 0);
      const perPayment = last12m.length > 0 ? annualDps / last12m.length : 0;
      return { annualDps, perPayment, source: 'history-12m' };
    }

    // Step 2: annualize latest payment
    if (payments.length >= 1) {
      const latest = payments[0]; // sorted desc by timestamp
      const perPayment = latest.amount;
      const multiplier: Record<DividendFrequency, number> = {
        Monthly: 12, Quarterly: 4, 'Semi-Annual': 2, Annual: 1,
        Irregular: 2, None: 0,
      };
      const annualDps = perPayment * (multiplier[frequency] ?? 4);
      if (annualDps > 0) {
        return { annualDps, perPayment, source: 'history-annualized' };
      }
    }
  }

  // Step 3: yield × price fallback
  if (dividendYield > 0 && currentPrice > 0) {
    const annualDps = dividendYield * currentPrice;
    const freqMultiplier: Record<DividendFrequency, number> = {
      Monthly: 12, Quarterly: 4, 'Semi-Annual': 2, Annual: 1,
      Irregular: 2, None: 4,
    };
    const perPayment = annualDps / (freqMultiplier[frequency] ?? 4);
    return { annualDps, perPayment, source: 'yield-price' };
  }

  return { annualDps: 0, perPayment: 0, source: 'none' };
}

// ─── Fetch next ex-date and pay date ─────────────────────────────────────────
// Routes through proxy — no direct Yahoo calls from mobile app.

async function fetchNextDates(ticker: string): Promise<{ exDividendDate: string | null; payDate: string | null }> {
  try {
    return await getNextDividendDates(ticker);
  } catch {
    return { exDividendDate: null, payDate: null };
  }
}

// ─── Main fetch function ──────────────────────────────────────────────────────

async function fetchDividendData(
  ticker: string,
  dividendYield: number,
  currentPrice: number
): Promise<DividendData> {
  log('Fetching', { ticker });

  // Skip non-dividend assets immediately
  const upperTicker = ticker.toUpperCase();
  const noDividendTickers = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'ADA', 'DOGE',
    'AVAX', 'LINK', 'DOT', 'MATIC', 'LTC', 'SHIB', 'PEPE', 'GLD', 'IAU', 'IBIT',
    'ARKK', 'SQQQ', 'TQQQ',
  ]);

  if (noDividendTickers.has(upperTicker)) {
    return {
      ticker, annualDividendPerShare: 0, dividendPerPayment: 0,
      dividendFrequency: 'None', exDividendDate: null, payDate: null,
      source: 'none', lastUpdated: Date.now(),
    };
  }

  try {
    // Fetch history and next dates in parallel
    const [payments, dates] = await Promise.all([
      getETFDividends(ticker),
      fetchNextDates(ticker),
    ]);

    const frequency = inferFrequency(payments);
    const { annualDps, perPayment, source } = resolveAnnualDividend(
      payments, frequency, dividendYield, currentPrice
    );

    log('Resolved', { ticker, annualDps, frequency, source });

    return {
      ticker,
      annualDividendPerShare: annualDps,
      dividendPerPayment: perPayment,
      dividendFrequency: frequency,
      exDividendDate: dates.exDividendDate,
      payDate: dates.payDate,
      source,
      lastUpdated: Date.now(),
    };
  } catch (err) {
    log('Fetch failed', { ticker, err: String(err) });
    // Yield-price fallback on total failure
    const annualDps = dividendYield * currentPrice;
    return {
      ticker,
      annualDividendPerShare: annualDps,
      dividendPerPayment: annualDps / 4,
      dividendFrequency: 'Quarterly',
      exDividendDate: null,
      payDate: null,
      source: annualDps > 0 ? 'yield-price' : 'none',
      lastUpdated: Date.now(),
    };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Get dividend data for a single ticker.
// Resolution: user override (Phase 3B) → cache → fresh fetch → fallback
export async function getDividendData(
  ticker: string,
  dividendYield: number,
  currentPrice: number,
  forceRefresh = false
): Promise<DividendData> {
  const cache = await readCache();
  const cached = cache[ticker];
  const now = Date.now();

  // Return cached data if fresh
  if (!forceRefresh && cached && (now - cached.updatedAt) < CACHE_TTL_MS) {
    log('Cache hit', { ticker, ageMs: now - cached.updatedAt });
    return cached.data;
  }

  // Fetch fresh data
  const data = await fetchDividendData(ticker, dividendYield, currentPrice);

  // Update cache
  cache[ticker] = { data, updatedAt: now };
  await writeCache(cache);

  return data;
}

// Get dividend data for multiple tickers in parallel, respecting cache.
export async function getDividendDataBatch(
  tickers: { ticker: string; dividendYield: number; currentPrice: number }[],
  forceRefresh = false
): Promise<Record<string, DividendData>> {
  log('Batch fetch', { count: tickers.length });

  const results = await Promise.allSettled(
    tickers.map(t => getDividendData(t.ticker, t.dividendYield, t.currentPrice, forceRefresh))
  );

  const out: Record<string, DividendData> = {};
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      out[tickers[i].ticker] = r.value;
    } else {
      log('Batch item failed', { ticker: tickers[i].ticker, err: r.reason });
    }
  });

  return out;
}

// Clear the entire dividend cache (useful after import/reset)
export async function clearDividendCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
    log('Cache cleared');
  } catch { /* non-critical */ }
}
