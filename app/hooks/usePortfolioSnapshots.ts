// app/hooks/usePortfolioSnapshots.ts
// Phase B — Snapshot Storage Hook
//
// Wraps useSnapshotEngine.ts with AsyncStorage persistence.
// Implements cache-invalidation: full rebuild on backdated transaction changes,
// cheap append on simple day-rollover.
//
// Snapshots are a DERIVED CACHE. Transactions + price history remain authoritative.
// This hook never mutates transactions — read-only consumer of usePortfolioTransactions.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getETFHistory } from '../services/api';
import {
  DailySnapshot,
  PriceHistoryMap,
  appendTodaySnapshot,
  buildSnapshotsFromScratch,
  needsFullRebuild,
  transactionFingerprint,
} from './useSnapshotEngine';
import { Transaction } from './useTransactionEngine';

const KEYS = {
  SNAPSHOTS: 'portfolio_daily_snapshots',
  META: 'portfolio_daily_snapshots_meta',
} as const;

type SnapshotMeta = {
  lastSnapshotDate: string | null;
  fingerprint: string | null;
};

async function loadSnapshotsFromStorage(): Promise<DailySnapshot[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SNAPSHOTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function loadMeta(): Promise<SnapshotMeta> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.META);
    return raw ? JSON.parse(raw) : { lastSnapshotDate: null, fingerprint: null };
  } catch {
    return { lastSnapshotDate: null, fingerprint: null };
  }
}

async function persistSnapshots(snapshots: DailySnapshot[], fingerprint: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.SNAPSHOTS, JSON.stringify(snapshots));
  const lastSnapshotDate = snapshots.length > 0 ? snapshots[snapshots.length - 1].date : null;
  await AsyncStorage.setItem(KEYS.META, JSON.stringify({ lastSnapshotDate, fingerprint }));
}

async function fetchPriceHistoryMap(transactions: Transaction[]): Promise<PriceHistoryMap> {
  const tickers = [...new Set(transactions.map(t => t.ticker))];
  if (tickers.length === 0) return {};

  const histories = await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const hist = await getETFHistory(ticker, '5Y');
        return { ticker, hist };
      } catch {
        return { ticker, hist: [] };
      }
    })
  );

  const map: PriceHistoryMap = {};
  for (const { ticker, hist } of histories) {
    map[ticker] = hist
      .map(h => ({
        date: new Date(h.timestamp * 1000).toISOString().split('T')[0],
        close: h.close,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  return map;
}

export function usePortfolioSnapshots(transactions: Transaction[], transactionsReady: boolean, enabled: boolean = true) {
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [rebuilding, setRebuilding] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  const currentFingerprint = useMemo(
    () => transactionFingerprint(transactions),
    [transactions]
  );

  const runSync = useCallback(async (txns: Transaction[]) => {
    if (txns.length === 0) {
      setSnapshots([]);
      setRebuilding(false);
      return;
    }

    setRebuilding(true);
    try {
      const meta = await loadMeta();
      const fingerprintNow = transactionFingerprint(txns);
      const requiresFullRebuild = needsFullRebuild(txns, meta.lastSnapshotDate, meta.fingerprint);

      console.log('[SNAPSHOT SYNC] runSync called. requiresFullRebuild:', requiresFullRebuild, 'meta:', meta);

      if (requiresFullRebuild) {
        const priceHistoryMap = await fetchPriceHistoryMap(txns);
        const rebuilt = buildSnapshotsFromScratch(txns, priceHistoryMap);
        console.log('[SNAPSHOT SYNC] FULL REBUILD, latest entry:', rebuilt[rebuilt.length - 1]);
        await persistSnapshots(rebuilt, fingerprintNow);
        setSnapshots(rebuilt);
      } else {
        const existing = await loadSnapshotsFromStorage();
        const today = new Date().toISOString().split('T')[0];
        const lastDate = existing.length > 0 ? existing[existing.length - 1].date : null;

        if (lastDate === today && existing.length > 0) {
          const priceHistoryMap = await fetchPriceHistoryMap(txns);
          const updated = appendTodaySnapshot(txns, priceHistoryMap, existing.slice(0, -1));
          console.log('[SNAPSHOT SYNC] APPEND-TODAY path, latest entry:', updated[updated.length - 1]);
          await persistSnapshots(updated, fingerprintNow);
          setSnapshots(updated);
        } else if (existing.length === 0) {
          const priceHistoryMap = await fetchPriceHistoryMap(txns);
          const rebuilt = buildSnapshotsFromScratch(txns, priceHistoryMap);
          console.log('[SNAPSHOT SYNC] NO-CACHE FULL BUILD, latest entry:', rebuilt[rebuilt.length - 1]);
          await persistSnapshots(rebuilt, fingerprintNow);
          setSnapshots(rebuilt);
        } else {
          const priceHistoryMap = await fetchPriceHistoryMap(txns);
          const updated = appendTodaySnapshot(txns, priceHistoryMap, existing);
          console.log('[SNAPSHOT SYNC] APPEND-MISSING-DAYS path, latest entry:', updated[updated.length - 1]);
          await persistSnapshots(updated, fingerprintNow);
          setSnapshots(updated);
        }
      }
      setError(null);
    } catch (err) {
      console.error('[usePortfolioSnapshots] sync failed:', err);
      setError('Failed to calculate performance history');
      const fallback = await loadSnapshotsFromStorage();
      setSnapshots(fallback);
    } finally {
      setRebuilding(false);
    }
  }, []);

  useEffect(() => {
    console.log('[SNAPSHOT SYNC] fingerprint changed:', currentFingerprint, 'txnCount:', transactions.length, 'enabled:', enabled);
    if (!enabled) {
      // STABILIZATION MODE: Rule 5 — do no work at all while disabled. Leave
      // whatever was already cached on disk untouched so re-enabling later
      // doesn't require a fresh full rebuild.
      setRebuilding(false);
      return;
    }
    if (!transactionsReady) return;
    if (initialized.current && transactions.length === 0) {
      AsyncStorage.multiRemove([KEYS.SNAPSHOTS, KEYS.META]);
      setSnapshots([]);
      setRebuilding(false);
      return;
    }
    initialized.current = true;
    runSync(transactions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionsReady, currentFingerprint, enabled]);

  const forceRebuild = useCallback(async () => {
    await AsyncStorage.multiRemove([KEYS.SNAPSHOTS, KEYS.META]);
    await runSync(transactions);
  }, [transactions, runSync]);

  return {
    snapshots,
    rebuilding,
    error,
    refresh: () => runSync(transactions),
    forceRebuild,
  };
}
