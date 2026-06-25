// services/healthService.ts
//
// READ-ONLY portfolio diagnostics. No mutations.
// Logging prefix: [HEALTH]

import { Transaction } from '../app/hooks/useTransactionEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CheckStatus = 'healthy' | 'warning' | 'error';

export type HealthCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  message: string;
  affectedIds?: string[];
};

export type HealthReport = {
  overallStatus: CheckStatus;
  checks: HealthCheck[];
  transactionCount: number;
  runAt: string;
};

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(event: string, data?: unknown) {
  console.log(`[HEALTH] ${event}`, data ?? '');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(d: unknown): boolean {
  if (typeof d !== 'string') return false;
  if (!DATE_RE.test(d)) return false;
  return !isNaN(Date.parse(d));
}

function worstStatus(a: CheckStatus, b: CheckStatus): CheckStatus {
  if (a === 'error' || b === 'error') return 'error';
  if (a === 'warning' || b === 'warning') return 'warning';
  return 'healthy';
}

// ─── Individual checks ────────────────────────────────────────────────────────

function checkInvalidPrices(txns: Transaction[]): HealthCheck {
  const bad = txns.filter(t => typeof t.pricePerShare !== 'number' || !isFinite(t.pricePerShare) || t.pricePerShare <= 0);
  if (bad.length === 0) {
    return { id: 'prices', label: 'Transaction Prices', status: 'healthy', message: 'All prices are valid.' };
  }
  return {
    id: 'prices', label: 'Transaction Prices', status: 'error',
    message: `${bad.length} transaction(s) have invalid or zero prices.`,
    affectedIds: bad.map(t => t.transactionId),
  };
}

function checkInvalidQuantities(txns: Transaction[]): HealthCheck {
  const bad = txns.filter(t => typeof t.quantity !== 'number' || !isFinite(t.quantity) || t.quantity <= 0);
  if (bad.length === 0) {
    return { id: 'quantities', label: 'Transaction Quantities', status: 'healthy', message: 'All quantities are valid.' };
  }
  return {
    id: 'quantities', label: 'Transaction Quantities', status: 'error',
    message: `${bad.length} transaction(s) have invalid or zero quantities.`,
    affectedIds: bad.map(t => t.transactionId),
  };
}

function checkDuplicateIds(txns: Transaction[]): HealthCheck {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const t of txns) {
    if (seen.has(t.transactionId)) dupes.push(t.transactionId);
    else seen.add(t.transactionId);
  }
  if (dupes.length === 0) {
    return { id: 'duplicate_ids', label: 'Transaction IDs', status: 'healthy', message: 'No duplicate IDs found.' };
  }
  return {
    id: 'duplicate_ids', label: 'Transaction IDs', status: 'error',
    message: `${dupes.length} duplicate transaction ID(s) detected.`,
    affectedIds: dupes,
  };
}

function checkMalformedDates(txns: Transaction[]): HealthCheck {
  const bad = txns.filter(t => !isValidDate(t.date));
  if (bad.length === 0) {
    return { id: 'dates', label: 'Transaction Dates', status: 'healthy', message: 'All dates are valid.' };
  }
  return {
    id: 'dates', label: 'Transaction Dates', status: 'error',
    message: `${bad.length} transaction(s) have malformed dates.`,
    affectedIds: bad.map(t => t.transactionId),
  };
}

function checkMissingTickers(txns: Transaction[]): HealthCheck {
  const bad = txns.filter(t => !t.ticker || typeof t.ticker !== 'string' || t.ticker.trim() === '');
  if (bad.length === 0) {
    return { id: 'tickers', label: 'Ticker Symbols', status: 'healthy', message: 'All transactions have ticker symbols.' };
  }
  return {
    id: 'tickers', label: 'Ticker Symbols', status: 'error',
    message: `${bad.length} transaction(s) are missing ticker symbols.`,
    affectedIds: bad.map(t => t.transactionId),
  };
}

function checkOversells(txns: Transaction[]): HealthCheck {
  // Group by ticker, run simple running balance to detect oversells
  const tickers = [...new Set(txns.map(t => t.ticker))];
  const oversellTxnIds: string[] = [];

  for (const ticker of tickers) {
    const tickerTxns = txns
      .filter(t => t.ticker === ticker)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

    let balance = 0;
    for (const t of tickerTxns) {
      if (['BUY', 'TRANSFER_IN', 'DRIP'].includes(t.transactionType)) {
        balance += t.quantity;
      } else if (['SELL', 'TRANSFER_OUT'].includes(t.transactionType)) {
        if (t.quantity > balance + 0.0001) {
          oversellTxnIds.push(t.transactionId);
        }
        balance -= t.quantity;
      }
    }
  }

  if (oversellTxnIds.length === 0) {
    return { id: 'oversells', label: 'Oversell Transactions', status: 'healthy', message: 'No oversell transactions detected.' };
  }
  return {
    id: 'oversells', label: 'Oversell Transactions', status: 'error',
    message: `${oversellTxnIds.length} historical oversell(s) detected — invalid accounting activity.`,
    affectedIds: oversellTxnIds,
  };
}

function checkEmptyPortfolio(txns: Transaction[]): HealthCheck {
  if (txns.length === 0) {
    return { id: 'empty', label: 'Portfolio Data', status: 'warning', message: 'No transactions found in portfolio.' };
  }
  return { id: 'empty', label: 'Portfolio Data', status: 'healthy', message: `${txns.length} transaction(s) found.` };
}

function checkFutureDates(txns: Transaction[]): HealthCheck {
  const today = new Date().toISOString().slice(0, 10);
  const bad = txns.filter(t => typeof t.date === 'string' && t.date > today);
  if (bad.length === 0) {
    return { id: 'future_dates', label: 'Future-Dated Transactions', status: 'healthy', message: 'No future-dated transactions found.' };
  }
  return {
    id: 'future_dates', label: 'Future-Dated Transactions', status: 'warning',
    message: `${bad.length} transaction(s) have dates in the future — may distort performance calculations.`,
    affectedIds: bad.map(t => t.transactionId),
  };
}

// ─── Main function ────────────────────────────────────────────────────────────

export function runHealthChecks(transactions: Transaction[]): HealthReport {
  log('Health check started', { transactionCount: transactions.length });

  const checks: HealthCheck[] = [
    checkEmptyPortfolio(transactions),
    checkInvalidPrices(transactions),
    checkInvalidQuantities(transactions),
    checkDuplicateIds(transactions),
    checkMalformedDates(transactions),
    checkFutureDates(transactions),
    checkMissingTickers(transactions),
    checkOversells(transactions),
  ];

  const overallStatus = checks.reduce<CheckStatus>(
    (worst, check) => worstStatus(worst, check.status),
    'healthy'
  );

  const report: HealthReport = {
    overallStatus,
    checks,
    transactionCount: transactions.length,
    runAt: new Date().toISOString(),
  };

  log('Health check complete', {
    overallStatus,
    errorCount: checks.filter(c => c.status === 'error').length,
    warningCount: checks.filter(c => c.status === 'warning').length,
  });

  return report;
}
