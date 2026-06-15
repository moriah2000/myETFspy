import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getETFPrice } from '../services/api';

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

const REFRESH_INTERVAL = 10 * 1000;

export function usePortfolioData() {
  const [positions, setPositions] = useState<ETFPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [etfsRaw, holdingsRaw] = await Promise.all([
        AsyncStorage.getItem('userETFs'),
        AsyncStorage.getItem('userHoldings'),
      ]);
      const tickers: string[] = etfsRaw ? JSON.parse(etfsRaw) : [];
      if (tickers.length === 0) {
        setPositions([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const holdingsData = holdingsRaw ? JSON.parse(holdingsRaw) : {};

      // Also read transactions and calculate positions from them
      const txRaw = await AsyncStorage.getItem('portfolio_transactions');
      const transactions: any[] = txRaw ? JSON.parse(txRaw) : [];

      // Build a shares/cost map from transactions (simple weighted average)
      const txMap: Record<string, { qty: number; totalCost: number }> = {};
      for (const txn of transactions) {
        if (!txMap[txn.ticker]) txMap[txn.ticker] = { qty: 0, totalCost: 0 };
        if (txn.transactionType === 'BUY') {
          txMap[txn.ticker].qty += txn.quantity;
          txMap[txn.ticker].totalCost += txn.quantity * txn.pricePerShare;
        } else if (txn.transactionType === 'SELL') {
          txMap[txn.ticker].qty -= txn.quantity;
        }
      }

      // Merge: transactions take priority over legacy holdings
      const mergedHoldings: Record<string, { qty: number; avgCost: number }> = {};
      // First load legacy holdings
      for (const ticker of tickers) {
        const h = holdingsData[ticker];
        if (h) {
          mergedHoldings[ticker] = {
            qty: parseFloat(String(h.qty || '0')),
            avgCost: parseFloat(String(h.cost || '0')),
          };
        }
      }
      // Override/add with transaction-derived positions
      for (const [ticker, pos] of Object.entries(txMap)) {
        if (pos.qty > 0) {
          mergedHoldings[ticker] = {
            qty: pos.qty,
            avgCost: pos.qty > 0 ? pos.totalCost / pos.qty : 0,
          };
        }
      }

      // Add any transaction tickers not already in tickers list
      const txTickers = Object.keys(txMap).filter(t => !tickers.includes(t) && txMap[t].qty > 0);
      const allTickers = [...tickers, ...txTickers];

      const prices = await Promise.all(allTickers.map((t) => getETFPrice(t)));
      const data: ETFPosition[] = allTickers.map((ticker, i) => {
        const p = prices[i];
        const qty = mergedHoldings[ticker]?.qty ?? 0;
        const avgCost = mergedHoldings[ticker]?.avgCost ?? 0;
        return {
          ticker,
          price: p?.price ?? 0,
          change: p?.change ?? 0,
          pct: p?.changesPercentage ?? 0,
          qty,
          avgCost,
          value: qty > 0 ? qty * (p?.price ?? 0) : 0,
          color: ETF_COLORS[ticker] || ['#338DFF','#00C896','#FF9F43','#A78BFA','#FF5A5F','#66AFFF','#FFD93D','#E879F9','#4FC3F7'][i % 9],
        };
      });
      setPositions(data);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Portfolio fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
