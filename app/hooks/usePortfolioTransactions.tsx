// app/hooks/usePortfolioTransactions.ts
//
// STABILIZATION MODE — rewritten as the single, app-wide Transaction Store.
//
// Rule 1: transactions are the ONLY source of truth. This file is the ONLY
//         place allowed to write the 'portfolio_transactions' key.
// Rule 2/3: exactly one writer, no duplicate instances. Enforced by wrapping
//         the whole app in <TransactionStoreProvider> (see app/_layout.tsx)
//         so every screen reads the SAME state instead of creating its own.
// Rule 6: every read/write/migration event is logged with a [STABILIZE] tag.
// Rule 7: self-healing — a one-step-behind backup copy is kept so a wiped or
//         corrupted transaction log can be recovered instead of lost.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AssetType, Transaction, generateId,
  migrationTransactionFromHolding, todayISO,
} from './useTransactionEngine';

const KEYS = {
  TRANSACTIONS: 'portfolio_transactions',
  TRANSACTIONS_BACKUP: 'portfolio_transactions_backup',
  MIGRATION_DONE: 'v1_5_migration_complete',
  LEGACY_HOLDINGS: 'userHoldings',
  LEGACY_ETFS: 'userETFs',
} as const;

function log(event: string, data?: unknown) {
  console.log(`[STABILIZE][TransactionStore] ${event}`, data ?? '');
}

// ─────────────────────────────────────────────
// Storage helpers (Rule 6 logging + Rule 7 self-healing)
// ─────────────────────────────────────────────

function isValidTransaction(t: any): t is Transaction {
  return (
    t && typeof t === 'object' &&
    typeof t.transactionId === 'string' &&
    typeof t.ticker === 'string' && t.ticker.length > 0 &&
    typeof t.quantity === 'number' && !isNaN(t.quantity) &&
    typeof t.pricePerShare === 'number' && !isNaN(t.pricePerShare) &&
    typeof t.transactionType === 'string'
  );
}

// Parses a raw transactions blob defensively. Drops only individual malformed
// entries instead of discarding the whole array, and reports how many were
// dropped so corruption is visible in logs rather than silent.
function parseTransactionsSafely(raw: string | null, sourceLabel: string): Transaction[] {
  if (!raw) return [];
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    log(`PARSE FAILURE reading ${sourceLabel} — raw value was not valid JSON`, { err: String(err) });
    return [];
  }
  if (!Array.isArray(parsed)) {
    log(`CORRUPTION: ${sourceLabel} was not an array`, { typeofValue: typeof parsed });
    return [];
  }
  const valid = parsed.filter(isValidTransaction);
  if (valid.length !== parsed.length) {
    log(`CORRUPTION: dropped ${parsed.length - valid.length} malformed transaction(s) from ${sourceLabel}`);
  }
  return valid;
}

async function readTransactionsFromStorage(): Promise<Transaction[]> {
  const raw = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
  log('STORAGE READ', { key: KEYS.TRANSACTIONS, present: !!raw });
  const txns = parseTransactionsSafely(raw, KEYS.TRANSACTIONS);

  // Rule 7 self-healing: if the main key is empty/corrupted but a backup
  // exists with real data, recover from it rather than accepting data loss.
  if (txns.length === 0) {
    const backupRaw = await AsyncStorage.getItem(KEYS.TRANSACTIONS_BACKUP);
    const backupTxns = parseTransactionsSafely(backupRaw, KEYS.TRANSACTIONS_BACKUP);
    if (backupTxns.length > 0) {
      log('SELF-HEAL: main transaction log was empty but backup had data — restoring from backup', {
        recoveredCount: backupTxns.length,
      });
      await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(backupTxns));
      return backupTxns;
    }
  }
  return txns;
}

async function persist(txns: Transaction[]): Promise<void> {
  // Snapshot the PREVIOUS state as backup before overwriting, so a bad write
  // (or a future regression) always leaves a one-step-behind recovery copy.
  try {
    const prevRaw = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
    if (prevRaw) {
      const prevTxns = parseTransactionsSafely(prevRaw, KEYS.TRANSACTIONS);
      if (prevTxns.length > 0) {
        await AsyncStorage.setItem(KEYS.TRANSACTIONS_BACKUP, JSON.stringify(prevTxns));
      }
    }
  } catch (err) {
    log('Backup snapshot step failed (non-fatal)', { err: String(err) });
  }
  await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txns));
  log('STORAGE WRITE', { key: KEYS.TRANSACTIONS, count: txns.length });
}

// ─────────────────────────────────────────────
// One-time migration — locked with a module-level singleton promise so it
// can only ever execute once per app session, no matter how many components
// mount/remount (including React Strict Mode's double-invoke in dev, which
// a per-component ref cannot protect against since the ref itself resets
// on remount; a module-level promise survives that).
// ─────────────────────────────────────────────

let migrationPromise: Promise<Transaction[]> | null = null;

async function runMigrationUnlocked(): Promise<Transaction[]> {
  try {
    const done = await AsyncStorage.getItem(KEYS.MIGRATION_DONE);
    log('Migration flag check', { value: done });
    if (done === 'true') {
      return readTransactionsFromStorage();
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
      const assetType: AssetType = h.assetType
        ? (h.assetType.toUpperCase() as AssetType)
        : 'ETF';
      const txn = migrationTransactionFromHolding(
        ticker, h.qty ?? h.shares ?? 0, h.cost ?? h.avgCost ?? 0, assetType
      );
      if (txn) transactions.push(txn);
    }

    await persist(transactions);
    await AsyncStorage.setItem(KEYS.MIGRATION_DONE, 'true');
    log('Migration complete', { migratedCount: transactions.length });
    return transactions;
  } catch (err) {
    log('Migration FAILED — will retry next launch', { err: String(err) });
    return [];
  }
}

function runMigrationOnce(): Promise<Transaction[]> {
  if (!migrationPromise) {
    migrationPromise = runMigrationUnlocked();
  }
  return migrationPromise;
}

// ─────────────────────────────────────────────
// Context
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

type TransactionStoreValue = {
  transactions: Transaction[];
  ready: boolean;
  addTransaction: (input: AddTransactionInput) => Promise<Transaction>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  deleteAllForTicker: (ticker: string) => Promise<void>;
  editTransaction: (
    transactionId: string,
    changes: Partial<Pick<Transaction, 'quantity' | 'pricePerShare' | 'fees' | 'date' | 'notes'>>
  ) => Promise<void>;
  getForTicker: (ticker: string) => Transaction[];
  reload: () => Promise<void>;
  resetAll: () => Promise<void>;
};

const TransactionStoreContext = createContext<TransactionStoreValue | null>(null);

export function TransactionStoreProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ready, setReady] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    runMigrationOnce().then(txns => {
      log('Initial load complete', { transactionCount: txns.length });
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
    const current = await readTransactionsFromStorage();
    const updated = [...current, txn];
    await persist(updated);
    setTransactions(updated);
    log('addTransaction', { ticker: txn.ticker, type: txn.transactionType, newCount: updated.length });
    return txn;
  }, []);

  const deleteTransaction = useCallback(async (transactionId: string): Promise<void> => {
    const current = await readTransactionsFromStorage();
    const updated = current.filter(t => t.transactionId !== transactionId);
    await persist(updated);
    setTransactions(updated);
    log('deleteTransaction', { transactionId, newCount: updated.length });
  }, []);

  const deleteAllForTicker = useCallback(async (ticker: string): Promise<void> => {
    const current = await readTransactionsFromStorage();
    const upperTicker = ticker.toUpperCase();
    const updated = current.filter(t => t.ticker !== upperTicker);
    await persist(updated);
    setTransactions(updated);
    log('deleteAllForTicker', { ticker: upperTicker, removed: current.length - updated.length, newCount: updated.length });
  }, []);

  const editTransaction = useCallback(async (
    transactionId: string,
    changes: Partial<Pick<Transaction, 'quantity' | 'pricePerShare' | 'fees' | 'date' | 'notes'>>
  ): Promise<void> => {
    const current = await readTransactionsFromStorage();
    const updated = current.map(t =>
      t.transactionId === transactionId
        ? { ...t, ...changes, updatedAt: Date.now() }
        : t
    );
    await persist(updated);
    setTransactions(updated);
    log('editTransaction', { transactionId, newCount: updated.length });
  }, []);

  const getForTicker = useCallback((ticker: string): Transaction[] => {
    return transactions
      .filter(t => t.ticker === ticker.toUpperCase())
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [transactions]);

  const reload = useCallback(async () => {
    const txns = await readTransactionsFromStorage();
    setTransactions(txns);
    log('reload', { count: txns.length });
  }, []);

  const resetAll = useCallback(async (): Promise<void> => {
    await persist([]);
    setTransactions([]);
    log('resetAll — transaction log cleared');
  }, []);

  const value: TransactionStoreValue = {
    transactions, ready, addTransaction, deleteTransaction, deleteAllForTicker,
    editTransaction, getForTicker, reload, resetAll,
  };

  return (
    <TransactionStoreContext.Provider value={value}>
      {children}
    </TransactionStoreContext.Provider>
  );
}

// Same name and shape as before, so every existing screen that imports
// `usePortfolioTransactions` from this file keeps working with zero changes
// at the call site — it now just reads shared state instead of creating its
// own, which is what actually closes the race condition.
export function usePortfolioTransactions(): TransactionStoreValue {
  const ctx = useContext(TransactionStoreContext);
  if (!ctx) {
    throw new Error(
      'usePortfolioTransactions() must be used within a <TransactionStoreProvider>. ' +
      'Check that app/_layout.tsx wraps the app in the provider.'
    );
  }
  return ctx;
}
