// app/hooks/usePortfolioData.ts
//
// STABILIZATION MODE — rewritten as a shared Context so only ONE instance
// ever runs, regardless of how many screens call usePortfolioData().
//
// Previously this was a plain hook, so Home tab and Portfolio tab each
// created their own independent instance with their own price-fetch interval.
// Because they shared the same transaction store but ran separate intervals
// at slightly different times, they produced alternating txCount/share-count
// values — one instance seeing the just-updated transactions, the other
// still holding the previous render's closure. The result was a permanent
// flip-flop between two different position states.
//
// Now there is exactly one interval, one positions array, one totalValue.
// Both screens read from the same shared state — alternation is structurally
// impossible.

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getETFPrice } from '../services/api';
import { usePortfolioTransactions } from './usePortfolioTransactions';
import { calculateAllPositions } from './useTransactionEngine';

export type ETFPosition = {
  ticker: string;
  price: number;
  change: number;
  pct: number;
  value: number;
  qty: number;
  avgCost: number;
  color: string;
};

export const ETF_COLORS: Record<string, string> = {
  SCHD: '#338DFF', VTI: '#00C896', QQQM: '#FF9F43', JEPI: '#A78BFA',
  JEPQ: '#FF5A5F', SPY: '#66AFFF', VOO: '#4F8EF7', VXUS: '#FFD93D',
  QQQI: '#E879F9',
};

const FALLBACK_COLORS = ['#338DFF','#00C896','#FF9F43','#A78BFA','#FF5A5F','#66AFFF','#FFD93D','#E879F9','#4FC3F7'];
const REFRESH_INTERVAL = 10 * 1000;

function log(event: string, data?: unknown) {
  console.log(`[STABILIZE][usePortfolioData] ${event}`, data ?? '');
}

type PortfolioDataValue = {
  positions: ETFPosition[];
  loading: boolean;
  refreshing: boolean;
  lastUpdated: Date | null;
  totalValue: number;
  totalChange: number;
  totalChangePct: number;
  hasValues: boolean;
  refresh: () => void;
};

const PortfolioDataContext = createContext<PortfolioDataValue | null>(null);

// ─────────────────────────────────────────────
// Provider — mount once in app/_layout.tsx inside TransactionStoreProvider
// ─────────────────────────────────────────────
export function PortfolioDataProvider({ children }: { children: React.ReactNode }) {
  const { transactions, ready: transactionsReady } = usePortfolioTransactions();
  const [positions, setPositions] = useState<ETFPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Each fetchData call stamps itself with the current generation. If a newer
  // fetchData starts while a price fetch is in-flight, the old one checks this
  // ref after awaiting and bails out — preventing stale data from overwriting
  // a more recent (possibly empty) setPositions call.
  const fetchGenRef = useRef(0);

  const fetchData = useCallback(async (isManual = false) => {
    if (!transactionsReady) return;

    const myGen = ++fetchGenRef.current;

    if (isManual) setRefreshing(true);

    try {
      const allTickers = [...new Set(transactions.map(t => t.ticker))];

      if (allTickers.length === 0) {
        log('No tickers', { transactionCount: transactions.length });
        setPositions([]);
        setLoading(false);
        setRefreshing(false);
        setLastUpdated(new Date());
        return;
      }

      const prices = await Promise.all(allTickers.map(t => getETFPrice(t)));

      // A newer fetchData (triggered by a transactions change) ran while we
      // were awaiting prices. Discard this result — the newer call already
      // wrote the correct state (e.g. empty positions after resetAll).
      if (myGen !== fetchGenRef.current) {
        log('fetchData superseded — discarding stale result', { myGen, currentGen: fetchGenRef.current });
        return;
      }

      const priceMap: Record<string, number> = {};
      allTickers.forEach((ticker, i) => { priceMap[ticker] = prices[i]?.price ?? 0; });

      const fifoPositions = calculateAllPositions(transactions, priceMap);

      const data: ETFPosition[] = fifoPositions.map((pos, i) => {
        const p = prices[allTickers.indexOf(pos.ticker)];
        return {
          ticker: pos.ticker,
          price: p?.price ?? 0,
          change: p?.change ?? 0,
          pct: p?.changesPercentage ?? 0,
          qty: pos.totalShares,
          avgCost: pos.avgCost,
          value: pos.marketValue,
          color: ETF_COLORS[pos.ticker] || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
        };
      });

      log('Positions recomputed', {
        transactionCount: transactions.length,
        positionCount: data.length,
        totalShares: Object.fromEntries(data.map(d => [d.ticker, d.qty])),
        totalValue: data.reduce((s, d) => s + d.value, 0),
      });

      setPositions(data);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('[STABILIZE][usePortfolioData] fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [transactions, transactionsReady]);

  // Single interval, managed here — no screens should ever call startFetching.
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    fetchData();
    intervalRef.current = setInterval(() => fetchData(), REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
  const totalChange = positions.reduce((sum, p) => sum + p.qty * p.change, 0);
  const totalChangePct = totalValue > 0 ? (totalChange / (totalValue - totalChange)) * 100 : 0;

  const value: PortfolioDataValue = {
    positions,
    loading,
    refreshing,
    lastUpdated,
    totalValue,
    totalChange,
    totalChangePct,
    hasValues: totalValue > 0,
    refresh: () => fetchData(true),
  };

  return (
    <PortfolioDataContext.Provider value={value}>
      {children}
    </PortfolioDataContext.Provider>
  );
}

// ─────────────────────────────────────────────
// Hook — same name as before, zero changes needed at call sites
// ─────────────────────────────────────────────
export function usePortfolioData(): PortfolioDataValue {
  const ctx = useContext(PortfolioDataContext);
  if (!ctx) throw new Error(
    'usePortfolioData() must be used within a <PortfolioDataProvider>. ' +
    'Check that app/_layout.tsx wraps the app in the provider.'
  );
  return ctx;
}
