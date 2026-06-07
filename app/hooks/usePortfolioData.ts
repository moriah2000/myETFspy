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

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

export function usePortfolioData() {
  const [positions, setPositions] = useState<ETFPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [etfsRaw, holdingsRaw] = await Promise.all([
        AsyncStorage.getItem('userETFs'),
        AsyncStorage.getItem('userHoldings'),
      ]);

      const tickers: string[] = etfsRaw
        ? JSON.parse(etfsRaw)
        : ['SCHD', 'VTI', 'QQQM', 'JEPI'];
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
          color: ETF_COLORS[ticker] || '#338DFF',
        };
      });

      setPositions(data);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Portfolio fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
  const totalChange = positions.reduce((sum, p) => sum + p.qty * p.change, 0);
  const totalChangePct = totalValue > 0
    ? ((totalChange / (totalValue - totalChange)) * 100)
    : 0;
  const hasValues = totalValue > 0;

  return {
    positions,
    loading,
    lastUpdated,
    totalValue,
    totalChange,
    totalChangePct,
    hasValues,
    refresh: fetchData,
  };
}