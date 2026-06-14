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

const REFRESH_INTERVAL = 10 * 1000; // 1 minute

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
      const prices = await Promise.all(tickers.map((t) => getETFPrice(t)));
      const data: ETFPosition[] = tickers.map((ticker, i) => {
        const p = prices[i];
        const qty = parseFloat(holdingsData[ticker]?.qty || '0');
        const avgCost = parseFloat(holdingsData[ticker]?.cost || '0');
        const price = p?.price ?? 0;
        return {
          ticker,
          price,
          change: p?.change ?? 0,
          pct: p?.changesPercentage ?? 0,
          qty,
          avgCost,
          value: qty > 0 ? qty * price : 0,
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