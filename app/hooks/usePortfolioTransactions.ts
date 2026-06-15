// app/hooks/usePortfolioTransactions.ts
// Standalone hook — NO imports from usePortfolioData, no circular deps.
// Screens use this directly. usePortfolioData is NOT touched.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AssetType, Transaction, generateId,
  migrationTransactionFromHolding, todayISO,
} from './useTransactionEngine';

const KEYS = {
  TRANSACTIONS: 'portfolio_transactions',
  MIGRATION_DONE: 'v1_5_migration_complete',
  LEGACY_HOLDINGS: 'userHoldings',
  LEGACY_ETFS: 'userETFs',
} as const;

// ─────────────────────────────────────────────
// One-time silent migration
// ─────────────────────────────────────────────

async function runMigration(): Promise<Transaction[]> {
  try {
    const done = await AsyncStorage.getItem(KEYS.MIGRATION_DONE);
    if (done === 'true') {
      const raw = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
      return raw ? JSON.parse(raw) : [];
    }

    const [holdingsRaw, etfsRaw] = await Promise.all([
      AsyncStorage.getItem(KEYS.LEGACY_HOLDINGS),
      AsyncStorage.getItem(KEYS.LEGACY_ETFS),
    ]);

    const holdings = holdingsRaw ? JSON.parse(holdingsRaw) : {};
    const etfs: string[] = etfsRaw ? JSON.parse(etfsRaw) : [];
    const allTickers = [...new Set([...etfs, ...Object.keys(holdings)])];

    const transactions: Transaction[] = [];
    for (const ticker of allTickers) {
      const h = holdings[ticker];
      if (!h) continue;
      // Detect assetType from watchlist storage if available
      const assetType: AssetType = h.assetType
        ? (h.assetType.toUpperCase() as AssetType)
        : 'ETF';
      const txn = migrationTransactionFromHolding(
        ticker, h.qty ?? h.shares ?? 0, h.cost ?? h.avgCost ?? 0, assetType
      );
      if (txn) transactions.push(txn);
    }

    await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactions));
    await AsyncStorage.setItem(KEYS.MIGRATION_DONE, 'true');
    console.log(`[V1.5 Migration] ${transactions.length} holding(s) migrated`);
    return transactions;
  } catch (err) {
    console.error('[V1.5 Migration] failed, will retry:', err);
    return [];
  }
}

async function persist(txns: Transaction[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txns));
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export type AddTransactionInput = {
  ticker: string;
  assetType: AssetType;
  transactionType: Transaction['transactionType'];
  quantity: number;
  pricePerShare: number;
  fees?: number;
  date?: string;
  notes?: string;
};

export function usePortfolioTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ready, setReady] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    runMigration().then(txns => {
      setTransactions(txns);
      setReady(true);
    });
  }, []);

  const addTransaction = useCallback(async (input: AddTransactionInput): Promise<Transaction> => {
    const now = Date.now();
    const txn: Transaction = {
      transactionId: generateId(),
      portfolioId: 'default',
      ticker: input.ticker.toUpperCase().trim(),
      assetType: input.assetType,
      transactionType: input.transactionType,
      quantity: input.quantity,
      pricePerShare: input.pricePerShare,
      fees: input.fees ?? 0,
      date: input.date ?? todayISO(),
      notes: input.notes ?? '',
      createdAt: now,
      updatedAt: now,
    };
    // Read fresh from storage to avoid stale closure issues
    const raw = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
    const current: Transaction[] = raw ? JSON.parse(raw) : [];
    const updated = [...current, txn];
    await persist(updated);
    setTransactions(updated);
    return txn;
  }, []);

  const deleteTransaction = useCallback(async (transactionId: string): Promise<void> => {
    const raw = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
    const current: Transaction[] = raw ? JSON.parse(raw) : [];
    const updated = current.filter(t => t.transactionId !== transactionId);
    await persist(updated);
    setTransactions(updated);
  }, []);

  const editTransaction = useCallback(async (
    transactionId: string,
    changes: Partial<Pick<Transaction, 'quantity' | 'pricePerShare' | 'fees' | 'date' | 'notes'>>
  ): Promise<void> => {
    const raw = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
    const current: Transaction[] = raw ? JSON.parse(raw) : [];
    const updated = current.map(t =>
      t.transactionId === transactionId
        ? { ...t, ...changes, updatedAt: Date.now() }
        : t
    );
    await persist(updated);
    setTransactions(updated);
  }, []);

  const getForTicker = useCallback((ticker: string): Transaction[] => {
    return transactions
      .filter(t => t.ticker === ticker.toUpperCase())
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [transactions]);

  const reload = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
    setTransactions(raw ? JSON.parse(raw) : []);
  }, []);

  return {
    transactions,
    ready,
    addTransaction,
    deleteTransaction,
    editTransaction,
    getForTicker,
    reload,
  };
}
