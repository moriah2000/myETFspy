// app/hooks/useSnapshotEngine.ts
// Phase A — Pure Snapshot + TWR Engine
// No hooks, no AsyncStorage, no side effects. Pass data in, get DailySnapshot[] out.
//
// Source of truth: Transaction Engine + historical prices.
// This file NEVER stores anything — that's usePortfolioSnapshots' job.

import { Transaction } from './useTransactionEngine';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type DailySnapshot = {
  date: string;              // ISO 'YYYY-MM-DD'
  portfolioValue: number;    // market value at that day's close
  contributions: number;     // cumulative net cash invested (BUY cost - SELL proceeds returned to "cash", net)
  profit: number;            // portfolioValue - contributions + realizedGain + dividendIncome
  dailyReturn: number;       // TWR return for this single day (decimal, e.g. 0.012 = 1.2%)
  cumulativeReturn: number;  // compounded TWR from inception (decimal)
  dividendIncome: number;    // cumulative dividends received to date
  realizedGain: number;      // cumulative realized gains (FIFO) to date
};

// Historical close price for one ticker on one date
export type PriceHistoryPoint = {
  date: string;     // ISO 'YYYY-MM-DD'
  close: number;
};

// Map of ticker -> chronologically sorted price history
export type PriceHistoryMap = Record<string, PriceHistoryPoint[]>;

// ─────────────────────────────────────────────
// Utility — find the closest known price on or before a given date
// Historical APIs return trading days only; weekends/holidays need fallback to last known close.
// ─────────────────────────────────────────────

function priceOnOrBefore(history: PriceHistoryPoint[], date: string): number {
  if (history.length === 0) return 0;
  // history is assumed sorted ascending by date
  let result = history[0].close;
  for (const point of history) {
    if (point.date > date) break;
    result = point.close;
  }
  return result;
}

// ─────────────────────────────────────────────
// Utility — get all calendar dates from start to end (inclusive), as ISO strings
// ─────────────────────────────────────────────

function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cur = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ─────────────────────────────────────────────
// Calculate portfolio market value on a specific date,
// given transactions up to and including that date.
// ─────────────────────────────────────────────

function portfolioValueOnDate(
  transactions: Transaction[],
  priceHistoryMap: PriceHistoryMap,
  date: string
): number {
  // Shares held per ticker as of this date
  const sharesMap: Record<string, number> = {};
  for (const txn of transactions) {
    if (txn.date > date) continue; // only transactions up to this date
    if (!sharesMap[txn.ticker]) sharesMap[txn.ticker] = 0;
    if (txn.transactionType === 'BUY' || txn.transactionType === 'TRANSFER_IN') {
      sharesMap[txn.ticker] += txn.quantity;
    } else if (txn.transactionType === 'SELL' || txn.transactionType === 'TRANSFER_OUT') {
      sharesMap[txn.ticker] -= txn.quantity;
    }
  }

  let total = 0;
  for (const [ticker, shares] of Object.entries(sharesMap)) {
    if (shares <= 0) continue;
    const history = priceHistoryMap[ticker] ?? [];
    const price = priceOnOrBefore(history, date);
    total += shares * price;
  }
  return total;
}

// ─────────────────────────────────────────────
// Calculate net contributions as of a specific date.
// Contribution = cost of BUYs - proceeds of SELLs (net cash put into the market).
// This is NOT the same as cost basis — it tracks cash flow, not FIFO lots.
// ─────────────────────────────────────────────

function netContributionsOnDate(transactions: Transaction[], date: string): number {
  let net = 0;
  for (const txn of transactions) {
    if (txn.date > date) continue;
    if (txn.transactionType === 'BUY' || txn.transactionType === 'TRANSFER_IN') {
      net += txn.quantity * txn.pricePerShare + txn.fees;
    } else if (txn.transactionType === 'SELL' || txn.transactionType === 'TRANSFER_OUT') {
      net -= txn.quantity * txn.pricePerShare - txn.fees;
    }
  }
  return net;
}

// ─────────────────────────────────────────────
// Calculate cumulative realized gains as of a specific date (FIFO).
// ─────────────────────────────────────────────

function cumulativeRealizedGainOnDate(transactions: Transaction[], date: string): number {
  const relevant = transactions.filter(t => t.date <= date);
  const tickers = [...new Set(relevant.map(t => t.ticker))];

  let totalRealized = 0;
  for (const ticker of tickers) {
    const tickerTxns = relevant
      .filter(t => t.ticker === ticker)
      .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.createdAt - b.createdAt);

    const lots: { quantity: number; pricePerShare: number }[] = [];
    for (const txn of tickerTxns) {
      if (txn.transactionType === 'BUY' || txn.transactionType === 'TRANSFER_IN') {
        lots.push({ quantity: txn.quantity, pricePerShare: txn.pricePerShare });
      } else if (txn.transactionType === 'SELL' || txn.transactionType === 'TRANSFER_OUT') {
        let toSell = txn.quantity;
        while (toSell > 0 && lots.length > 0) {
          const lot = lots[0];
          if (lot.quantity <= toSell) {
            totalRealized += (txn.pricePerShare - lot.pricePerShare) * lot.quantity - txn.fees;
            toSell -= lot.quantity;
            lots.shift();
          } else {
            totalRealized += (txn.pricePerShare - lot.pricePerShare) * toSell - txn.fees;
            lot.quantity -= toSell;
            toSell = 0;
          }
        }
      }
    }
  }
  return totalRealized;
}

// ─────────────────────────────────────────────
// Calculate cumulative dividend income as of a specific date.
// (DIVIDEND transactions — future-compatible, returns 0 until DIVIDEND type is used)
// ─────────────────────────────────────────────

function cumulativeDividendIncomeOnDate(transactions: Transaction[], date: string): number {
  return transactions
    .filter(t => t.date <= date && t.transactionType === 'DIVIDEND')
    .reduce((sum, t) => sum + t.quantity * t.pricePerShare, 0);
}

// ─────────────────────────────────────────────
// Time-Weighted Return calculation.
//
// Sub-periods are bounded by each transaction date (cash flow event).
// For each sub-period: r = (endValue - cashFlow - startValue) / startValue
// Chain geometrically: TWR = (1+r1)(1+r2)...(1+rn) - 1
// ─────────────────────────────────────────────

export function calculateTWR(
  transactions: Transaction[],
  priceHistoryMap: PriceHistoryMap,
  fromDate: string,
  toDate: string
): number {
  if (fromDate > toDate) return 0;

  // Boundaries: fromDate, every transaction date in range, toDate
  const txnDatesInRange = [...new Set(
    transactions
      .filter(t => t.date >= fromDate && t.date <= toDate)
      .map(t => t.date)
  )].sort();

  const boundaries = [fromDate, ...txnDatesInRange, toDate]
    .filter((d, i, arr) => arr.indexOf(d) === i) // dedupe
    .sort();

  let compoundedReturn = 1;

  for (let i = 0; i < boundaries.length - 1; i++) {
    const periodStart = boundaries[i];
    const periodEnd = boundaries[i + 1];

    const startValue = portfolioValueOnDate(transactions, priceHistoryMap, periodStart);

    // Cash flow that occurred ON periodEnd (the transaction(s) that created this boundary)
    const cashFlowOnEnd = transactions
      .filter(t => t.date === periodEnd)
      .reduce((sum, t) => {
        if (t.transactionType === 'BUY' || t.transactionType === 'TRANSFER_IN') {
          return sum + t.quantity * t.pricePerShare + t.fees;
        } else if (t.transactionType === 'SELL' || t.transactionType === 'TRANSFER_OUT') {
          return sum - (t.quantity * t.pricePerShare - t.fees);
        }
        return sum;
      }, 0);

    const endValueBeforeFlow = portfolioValueOnDate(transactions, priceHistoryMap, periodEnd) - cashFlowOnEnd;

    if (startValue > 0) {
      const periodReturn = (endValueBeforeFlow - startValue) / startValue;
      compoundedReturn *= (1 + periodReturn);
    }
    // If startValue is 0 (e.g. very first period before any holdings), skip — no return to measure
  }

  return compoundedReturn - 1;
}

// ─────────────────────────────────────────────
// Build the full snapshot history from scratch.
// Expensive — only call when a full rebuild is required.
// ─────────────────────────────────────────────

export function buildSnapshotsFromScratch(
  transactions: Transaction[],
  priceHistoryMap: PriceHistoryMap
): DailySnapshot[] {
  if (transactions.length === 0) return [];

  const firstDate = transactions.reduce((min, t) => t.date < min ? t.date : min, transactions[0].date);
  const today = new Date().toISOString().split('T')[0];
  const allDates = dateRange(firstDate, today);

  const snapshots: DailySnapshot[] = [];
  let compoundedReturn = 1;
  let previousValue: number | null = null;

  for (const date of allDates) {
    const portfolioValue = portfolioValueOnDate(transactions, priceHistoryMap, date);
    const contributions = netContributionsOnDate(transactions, date);
    const realizedGain = cumulativeRealizedGainOnDate(transactions, date);
    const dividendIncome = cumulativeDividendIncomeOnDate(transactions, date);
    const profit = portfolioValue - contributions + realizedGain + dividendIncome;

    // Daily TWR return — compare to previous day, accounting for same-day cash flow
    let dailyReturn = 0;
    if (previousValue !== null && previousValue > 0) {
      const cashFlowToday = transactions
        .filter(t => t.date === date)
        .reduce((sum, t) => {
          if (t.transactionType === 'BUY' || t.transactionType === 'TRANSFER_IN') {
            return sum + t.quantity * t.pricePerShare + t.fees;
          } else if (t.transactionType === 'SELL' || t.transactionType === 'TRANSFER_OUT') {
            return sum - (t.quantity * t.pricePerShare - t.fees);
          }
          return sum;
        }, 0);
      const valueBeforeFlow = portfolioValue - cashFlowToday;
      dailyReturn = (valueBeforeFlow - previousValue) / previousValue;
      compoundedReturn *= (1 + dailyReturn);
    }

    snapshots.push({
      date,
      portfolioValue,
      contributions,
      profit,
      dailyReturn,
      cumulativeReturn: compoundedReturn - 1,
      dividendIncome,
      realizedGain,
    });

    previousValue = portfolioValue;
  }

  return snapshots;
}

// ─────────────────────────────────────────────
// Append today's snapshot to an existing log (cheap path).
// Assumes previousSnapshots is already valid and up-to-date through yesterday.
// ─────────────────────────────────────────────

export function appendTodaySnapshot(
  transactions: Transaction[],
  priceHistoryMap: PriceHistoryMap,
  previousSnapshots: DailySnapshot[]
): DailySnapshot[] {
  const today = new Date().toISOString().split('T')[0];

  if (previousSnapshots.length === 0) {
    return buildSnapshotsFromScratch(transactions, priceHistoryMap);
  }

  const lastSnapshot = previousSnapshots[previousSnapshots.length - 1];
  if (lastSnapshot.date === today) {
    // Already have today — replace it (today's value can change intraday)
    return [...previousSnapshots.slice(0, -1), ...computeSingleDay(transactions, priceHistoryMap, today, previousSnapshots.slice(0, -1))];
  }

  // Append any missing days between lastSnapshot.date and today
  const missingDates = dateRange(lastSnapshot.date, today).slice(1); // exclude lastSnapshot.date itself
  let running = [...previousSnapshots];
  for (const date of missingDates) {
    running = [...running, ...computeSingleDay(transactions, priceHistoryMap, date, running)];
  }
  return running;
}

// Helper — compute one day's snapshot given prior snapshots for cumulative return chaining
function computeSingleDay(
  transactions: Transaction[],
  priceHistoryMap: PriceHistoryMap,
  date: string,
  priorSnapshots: DailySnapshot[]
): DailySnapshot[] {
  const portfolioValue = portfolioValueOnDate(transactions, priceHistoryMap, date);
  const contributions = netContributionsOnDate(transactions, date);
  const realizedGain = cumulativeRealizedGainOnDate(transactions, date);
  const dividendIncome = cumulativeDividendIncomeOnDate(transactions, date);
  const profit = portfolioValue - contributions + realizedGain + dividendIncome;

  const previous = priorSnapshots[priorSnapshots.length - 1];
  let dailyReturn = 0;
  let cumulativeReturn = previous ? previous.cumulativeReturn : 0;

  if (previous && previous.portfolioValue > 0) {
    const cashFlowToday = transactions
      .filter(t => t.date === date)
      .reduce((sum, t) => {
        if (t.transactionType === 'BUY' || t.transactionType === 'TRANSFER_IN') {
          return sum + t.quantity * t.pricePerShare + t.fees;
        } else if (t.transactionType === 'SELL' || t.transactionType === 'TRANSFER_OUT') {
          return sum - (t.quantity * t.pricePerShare - t.fees);
        }
        return sum;
      }, 0);
    const valueBeforeFlow = portfolioValue - cashFlowToday;
    dailyReturn = (valueBeforeFlow - previous.portfolioValue) / previous.portfolioValue;
    cumulativeReturn = (1 + cumulativeReturn) * (1 + dailyReturn) - 1;
  }

  return [{
    date,
    portfolioValue,
    contributions,
    profit,
    dailyReturn,
    cumulativeReturn,
    dividendIncome,
    realizedGain,
  }];
}

// ─────────────────────────────────────────────
// Detect whether a full rebuild is required.
// Returns true if any transaction is dated on or before the last snapshot date
// AND the transaction set has changed since the snapshots were built.
// ─────────────────────────────────────────────

export function needsFullRebuild(
  transactions: Transaction[],
  lastSnapshotDate: string | null,
  lastKnownTransactionFingerprint: string | null
): boolean {
  if (!lastSnapshotDate) return transactions.length > 0; // no snapshots yet, build if there's data
  const currentFingerprint = transactionFingerprint(transactions);
  if (currentFingerprint !== lastKnownTransactionFingerprint) {
    // Something changed — check if any transaction predates or equals last snapshot
    const hasBackdated = transactions.some(t => t.date <= lastSnapshotDate);
    return hasBackdated;
  }
  return false;
}

// Simple fingerprint: count + sum of quantities + latest updatedAt
// Cheap way to detect "did anything change" without deep comparison
export function transactionFingerprint(transactions: Transaction[]): string {
  const count = transactions.length;
  const latestUpdate = transactions.reduce((max, t) => Math.max(max, t.updatedAt), 0);
  const qtySum = transactions.reduce((sum, t) => sum + t.quantity, 0);
  return `${count}:${latestUpdate}:${qtySum.toFixed(4)}`;
}
