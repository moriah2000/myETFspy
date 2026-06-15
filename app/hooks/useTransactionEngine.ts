// app/hooks/useTransactionEngine.ts
// Pure FIFO functions — no hooks, no AsyncStorage, no imports from your app.
// Pass data in, get results out. Nothing else.

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type AssetType = 'ETF' | 'STOCK' | 'CRYPTO';

export type TransactionType = 'BUY' | 'SELL' | 'DIVIDEND' | 'DRIP' | 'TRANSFER_IN' | 'TRANSFER_OUT';

export type Transaction = {
  transactionId: string;
  portfolioId: string;
  ticker: string;
  assetType: AssetType;
  transactionType: TransactionType;
  quantity: number;
  pricePerShare: number;
  fees: number;
  date: string;        // ISO e.g. '2024-01-15'
  notes: string;
  createdAt: number;   // Unix ms
  updatedAt: number;   // Unix ms
};

export type PositionSummary = {
  ticker: string;
  assetType: AssetType;
  totalShares: number;
  avgCost: number;
  totalCostBasis: number;
  realizedGain: number;
  unrealizedGain: number;
  unrealizedGainPct: number;
  marketValue: number;
  lastTransactionDate: string;
  transactionCount: number;
};

type CostLot = {
  quantity: number;
  pricePerShare: number;
  date: string;
};

// ─────────────────────────────────────────────
// FIFO calculator for one ticker
// ─────────────────────────────────────────────

export function calculatePositionFIFO(
  ticker: string,
  transactions: Transaction[],
  currentPrice: number = 0
): PositionSummary {
  const txns = transactions
    .filter(t => t.ticker === ticker)
    .sort((a, b) => a.date !== b.date
      ? a.date.localeCompare(b.date)
      : a.createdAt - b.createdAt
    );

  if (txns.length === 0) return emptyPosition(ticker, 'ETF');

  const assetType = txns[txns.length - 1].assetType;
  const lots: CostLot[] = [];
  let realizedGain = 0;
  let lastTransactionDate = '';

  for (const txn of txns) {
    if (txn.date > lastTransactionDate) lastTransactionDate = txn.date;

    if (txn.transactionType === 'BUY' || txn.transactionType === 'TRANSFER_IN') {
      lots.push({ quantity: txn.quantity, pricePerShare: txn.pricePerShare, date: txn.date });
    } else if (txn.transactionType === 'SELL' || txn.transactionType === 'TRANSFER_OUT') {
      let toSell = txn.quantity;
      while (toSell > 0 && lots.length > 0) {
        const lot = lots[0];
        if (lot.quantity <= toSell) {
          realizedGain += (txn.pricePerShare - lot.pricePerShare) * lot.quantity - txn.fees;
          toSell -= lot.quantity;
          lots.shift();
        } else {
          realizedGain += (txn.pricePerShare - lot.pricePerShare) * toSell - txn.fees;
          lot.quantity -= toSell;
          toSell = 0;
        }
      }
    }
  }

  const totalShares = lots.reduce((s, l) => s + l.quantity, 0);
  const totalCostBasis = lots.reduce((s, l) => s + l.quantity * l.pricePerShare, 0);
  const avgCost = totalShares > 0 ? totalCostBasis / totalShares : 0;
  const marketValue = totalShares * currentPrice;
  const unrealizedGain = marketValue - totalCostBasis;
  const unrealizedGainPct = totalCostBasis > 0 ? (unrealizedGain / totalCostBasis) * 100 : 0;

  return {
    ticker, assetType, totalShares, avgCost, totalCostBasis,
    realizedGain, unrealizedGain, unrealizedGainPct, marketValue,
    lastTransactionDate, transactionCount: txns.length,
  };
}

// ─────────────────────────────────────────────
// Calculate positions for all tickers at once
// ─────────────────────────────────────────────

export function calculateAllPositions(
  transactions: Transaction[],
  priceMap: Record<string, number>
): PositionSummary[] {
  const tickers = [...new Set(transactions.map(t => t.ticker))];
  return tickers
    .map(ticker => calculatePositionFIFO(ticker, transactions, priceMap[ticker] ?? 0))
    .filter(p => p.totalShares > 0);
}

// ─────────────────────────────────────────────
// Migration helper — converts a legacy holding to a BUY transaction
// Handles both string and number qty/cost from your mixed storage
// ─────────────────────────────────────────────

export function migrationTransactionFromHolding(
  ticker: string,
  rawQty: string | number,
  rawCost: string | number,
  assetType: AssetType = 'ETF'
): Transaction | null {
  const qty = typeof rawQty === 'string' ? parseFloat(rawQty) : rawQty;
  const cost = typeof rawCost === 'string' ? parseFloat(rawCost) : rawCost;
  if (!qty || qty <= 0 || isNaN(qty)) return null;

  const now = Date.now();
  return {
    transactionId: generateId(),
    portfolioId: 'default',
    ticker,
    assetType,
    transactionType: 'BUY',
    quantity: qty,
    pricePerShare: (!cost || isNaN(cost)) ? 0 : cost,
    fees: 0,
    date: todayISO(),
    notes: 'Migrated from v1.0 holdings',
    createdAt: now,
    updatedAt: now,
  };
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function emptyPosition(ticker: string, assetType: AssetType): PositionSummary {
  return {
    ticker, assetType, totalShares: 0, avgCost: 0, totalCostBasis: 0,
    realizedGain: 0, unrealizedGain: 0, unrealizedGainPct: 0,
    marketValue: 0, lastTransactionDate: '', transactionCount: 0,
  };
}
