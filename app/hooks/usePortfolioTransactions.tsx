// app/hooks/usePortfolioTransactions.tsx
//
// STABILIZATION MODE — single app-wide Transaction Store.
//
// Hardening pass (post code review):
//   1. Module-level write queue serializes all mutations — concurrent calls
//      can no longer read the same state and overwrite each other.
//   2. Intentional-clear flag prevents self-heal from resurrecting a
//      portfolio the user deliberately deleted.
//   3. Migration failure surfaces a real error state instead of silently
//      returning [] (which looked identical to legitimate empty data).
//   4. All mutations guard on ready === true before executing.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AssetType, Transaction, generateId,
  migrationTransactionFromHolding, todayISO,
} from './useTransactionEngine';

const KEYS = {
  TRANSACTIONS: 'portfolio_transactions',
  TRANSACTIONS_BACKUP: 'portfolio_transactions_backup',
  INTENTIONALLY_CLEARED: 'portfolio_intentionally_cleared',
  MIGRATION_DONE: 'v1_5_migration_complete',
  LEGACY_HOLDINGS: 'userHoldings',
  LEGACY_ETFS: 'userETFs',
} as const;

function log(event: string, data?: unknown) {
  console.log(`[STABILIZE][TransactionStore] ${event}`, data ?? '');
}

// ─────────────────────────────────────────────
// Fix 1: Module-level write queue
// All mutations funnel through enqueueWrite(), which chains them onto a
// single promise so they execute one at a time. This prevents two concurrent
// calls from both reading the same state and silently overwriting each other.
// ─────────────────────────────────────────────

let writeChain: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeChain.then(fn);
  // Swallow rejections on the chain itself so a failed write doesn't
  // permanently jam the queue — the caller still gets the rejection via
  // their own returned promise.
  writeChain = result.catch(() => {});
  return result;
}

// ─────────────────────────────────────────────
// Storage helpers
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

function parseTransactionsSafely(raw: string | null, sourceLabel: string): Transaction[] {
  if (!raw) return [];
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    log(`PARSE FAILURE reading ${sourceLabel} — not valid JSON`, { err: String(err) });
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

  // Fix 2: Self-heal only when the empty state is unintentional.
  // If the user explicitly called resetAll(), the INTENTIONALLY_CLEARED flag
  // is set and we respect their choice rather than restoring from backup.
  if (txns.length === 0) {
    const cleared = await AsyncStorage.getItem(KEYS.INTENTIONALLY_CLEARED);
    if (cleared === 'true') {
      log('SELF-HEAL skipped — user intentionally cleared the portfolio');
      return [];
    }
    const backupRaw = await AsyncStorage.getItem(KEYS.TRANSACTIONS_BACKUP);
    const backupTxns = parseTransactionsSafely(backupRaw, KEYS.TRANSACTIONS_BACKUP);
    if (backupTxns.length > 0) {
      log('SELF-HEAL: main log empty, restoring from backup', { recoveredCount: backupTxns.length });
      await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(backupTxns));
      return backupTxns;
    }
  }
  return txns;
}

async function persist(txns: Transaction[]): Promise<void> {
  try {
    const prevRaw = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
    if (prevRaw) {
      const prevTxns = parseTransactionsSafely(prevRaw, KEYS.TRANSACTIONS);
      // Only promote to backup if the current log is non-empty.
      // If we're persisting after a resetAll(), the current log is already []
      // and backing it up would clobber the real portfolio sitting in backup.
      if (prevTxns.length > 0 && txns.length > 0) {
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
// Migration — module-level singleton, runs exactly once per app session.
// Fix 3: surfaces a real error state on failure instead of returning [],
// which was indistinguishable from legitimate empty data.
// ─────────────────────────────────────────────

type MigrationResult =
  | { ok: true; transactions: Transaction[] }
  | { ok: false; error: string };

let migrationPromise: Promise<MigrationResult> | null = null;

async function runMigrationUnlocked(): Promise<MigrationResult> {
  try {
    const done = await AsyncStorage.getItem(KEYS.MIGRATION_DONE);
    log('Migration flag check', { value: done });
    if (done === 'true') {
      return { ok: true, transactions: await readTransactionsFromStorage() };
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
    return { ok: true, transactions };
  } catch (err) {
    const error = String(err);
    log('Migration FAILED', { err: error });
    return { ok: false, error };
  }
}

function runMigrationOnce(): Promise<MigrationResult> {
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
  migrationError: string | null;
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
  importTransactions: (transactions: Transaction[]) => Promise<void>;
};

const TransactionStoreContext = createContext<TransactionStoreValue | null>(null);

export function TransactionStoreProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ready, setReady] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    runMigrationOnce().then(result => {
      if (result.ok) {
        log('Initial load complete', { transactionCount: result.transactions.length });
        setTransactions(result.transactions);
      } else {
        // Fix 3: surface migration failure as a real error state so the UI
        // can show a meaningful message instead of an apparently empty portfolio.
        log('Initial load failed — showing error state', { error: result.error });
        setMigrationError(result.error);
      }
      setReady(true);
    });
  }, []);

  // Fix 4: every mutation helper checks ready before executing, and all
  // use enqueueWrite() to serialize concurrent calls.

  const addTransaction = useCallback(async (input: AddTransactionInput): Promise<Transaction> => {
    if (!ready) throw new Error('TransactionStore not ready');
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
    return enqueueWrite(async () => {
      // Read first — readTransactionsFromStorage() still needs the
      // INTENTIONALLY_CLEARED flag intact so it skips self-heal and returns [].
      // Only after we have the (correctly empty) current list do we clear the
      // flag, re-enabling self-heal for all future sessions.
      const current = await readTransactionsFromStorage();
      await AsyncStorage.removeItem(KEYS.INTENTIONALLY_CLEARED);
      const updated = [...current, txn];
      await persist(updated);
      setTransactions(updated);
      log('addTransaction', { ticker: txn.ticker, type: txn.transactionType, newCount: updated.length });
      return txn;
    });
  }, [ready]);

  const deleteTransaction = useCallback(async (transactionId: string): Promise<void> => {
    if (!ready) throw new Error('TransactionStore not ready');
    return enqueueWrite(async () => {
      const current = await readTransactionsFromStorage();
      const updated = current.filter(t => t.transactionId !== transactionId);
      await persist(updated);
      setTransactions(updated);
      log('deleteTransaction', { transactionId, newCount: updated.length });
    });
  }, [ready]);

  const deleteAllForTicker = useCallback(async (ticker: string): Promise<void> => {
    if (!ready) throw new Error('TransactionStore not ready');
    return enqueueWrite(async () => {
      const upperTicker = ticker.toUpperCase();
      const current = await readTransactionsFromStorage();
      const updated = current.filter(t => t.ticker !== upperTicker);
      await persist(updated);
      setTransactions(updated);
      log('deleteAllForTicker', { ticker: upperTicker, removed: current.length - updated.length, newCount: updated.length });
    });
  }, [ready]);

  const editTransaction = useCallback(async (
    transactionId: string,
    changes: Partial<Pick<Transaction, 'quantity' | 'pricePerShare' | 'fees' | 'date' | 'notes'>>
  ): Promise<void> => {
    if (!ready) throw new Error('TransactionStore not ready');
    return enqueueWrite(async () => {
      const current = await readTransactionsFromStorage();
      const updated = current.map(t =>
        t.transactionId === transactionId
          ? { ...t, ...changes, updatedAt: Date.now() }
          : t
      );
      await persist(updated);
      setTransactions(updated);
      log('editTransaction', { transactionId, newCount: updated.length });
    });
  }, [ready]);

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
    if (!ready) throw new Error('TransactionStore not ready');
    return enqueueWrite(async () => {
      // Fix 2: set the intentional-clear flag BEFORE wiping, so that if the
      // app is killed mid-reset and relaunches with an empty main log,
      // self-heal knows not to restore from backup.
      await AsyncStorage.setItem(KEYS.INTENTIONALLY_CLEARED, 'true');
      await persist([]);
      setTransactions([]);
      log('resetAll — transaction log cleared, self-heal suppressed');
    });
  }, [ready]);

  // importTransactions — bulk restore from a validated backup.
  // Preserves all original transactionIds, dates, and timestamps exactly as exported.
  // Does NOT regenerate IDs or timestamps.
  const importTransactions = useCallback(async (incoming: Transaction[]): Promise<void> => {
    if (!ready) throw new Error('TransactionStore not ready');
    return enqueueWrite(async () => {
      await AsyncStorage.setItem(KEYS.INTENTIONALLY_CLEARED, 'true');
      await persist(incoming);
      await AsyncStorage.removeItem(KEYS.INTENTIONALLY_CLEARED);
      setTransactions(incoming);
      log('importTransactions', { restoredCount: incoming.length });
    });
  }, [ready]);

  const value: TransactionStoreValue = {
    transactions, ready, migrationError,
    addTransaction, deleteTransaction, deleteAllForTicker,
    editTransaction, getForTicker, reload, resetAll,
    importTransactions,
  };

  return (
    <TransactionStoreContext.Provider value={value}>
      {children}
    </TransactionStoreContext.Provider>
  );
}

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
