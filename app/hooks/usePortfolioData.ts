// app/hooks/usePortfolioData.ts
//
// STABILIZATION MODE — positions are now derived ONLY from the transaction
// store via calculatePositionFIFO/calculateAllPositions (useTransactionEngine.ts).
// The previous version blended legacy userHoldings/userETFs with its own
// non-FIFO recompute and short-circuited to an empty list whenever userETFs
// was empty, regardless of what was actually in the transaction log — that
// split was the direct cause of assets/quantities appearing to vanish on
// Home/Portfolio while the transaction log itself was fine.

import { useCallback, useEffect, useRef, useState } from 'react';
import { getETFPrice } from '../services/api';
import { calculateAllPositions } from './useTransactionEngine';
import { usePortfolioTransactions } from './usePortfolioTransactions';

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
  SCHD: '#338DFF',
  VTI: '#00C896',
  QQQM: '#FF9F43',
  JEPI: '#A78BFA',
  JEPQ: '#FF5A5F',
  SPY: '#66AFFF',
  VOO: '#4F8EF7',
  VXUS: '#FFD93D',
  QQQI: '#E879F9',
};

const FALLBACK_COLORS = ['#338DFF','#00C896','#FF9F43','#A78BFA','#FF5A5F','#66AFFF','#FFD93D','#E879F9','#4FC3F7'];
const REFRESH_INTERVAL = 10 * 1000;

function log(event: string, data?: unknown) {
  console.log(`[STABILIZE][usePortfolioData] ${event}`, data ?? '');
}

export function usePortfolioData() {
  const { transactions, ready: transactionsReady } = usePortfolioTransactions();
  const [positions, setPositions] = useState<ETFPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      if (!transactionsReady) {
        return;
      }

      // Every distinct ticker that has ever appeared in the transaction log.
      // calculateAllPositions itself filters out anything with zero net
      // shares, so it's safe to fetch a price for all of them up front.
      const allTickers = [...new Set(transactions.map(t => t.ticker))];

      if (allTickers.length === 0) {
        log('No tickers in transaction log', { transactionCount: transactions.length });
        setPositions([]);
        setLoading(false);
        setRefreshing(false);
        setLastUpdated(new Date());
        return;
      }

      const prices = await Promise.all(allTickers.map((t) => getETFPrice(t)));
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
      console.error('[STABILIZE][usePortfolioData] Portfolio fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [transactions, transactionsReady]);

  const reset = useCallback(() => {
    setPositions([]);
    setLoading(true);
    setLastUpdated(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const startFetching = useCallback(() => {
    fetchData();
    intervalRef.current = setInterval(() => fetchData(), REFRESH_INTERVAL);
  }, [fetchData]);

  useEffect(() => {
    startFetching();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startFetching]);

  const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
  const totalChange = positions.reduce((sum, p) => sum + p.qty * p.change, 0);
  const totalChangePct = totalValue > 0
    ? (totalChange / (totalValue - totalChange)) * 100
    : 0;
  const hasValues = totalValue > 0;

  return {
    positions,
    loading,
    refreshing,
    lastUpdated,
    totalValue,
    totalChange,
    totalChangePct,
    hasValues,
    refresh: () => fetchData(true),
    reset,
    startFetching,
  };
}
