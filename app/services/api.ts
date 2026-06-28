// app/services/api.ts
//
// Central backend client for myETFspy.
// The mobile app only knows the proxy base URL.
// No third-party URLs. No API keys. No secrets.
// All requests go through myetfspy-proxy.vercel.app.

const PROXY = 'https://myetfspy-proxy.vercel.app';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssetType = 'ETF' | 'STOCK' | 'CRYPTO';

export type SearchResult = {
  ticker: string;
  name: string;
  type: AssetType;
  exchange: string;
};

export type PriceData = {
  price: number;
  change: number;
  changesPercentage: number;
  previousClose: number;
};

export type HistoryPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type DividendEvent = {
  date: string;
  amount: number;
  timestamp: number;
};

export type ETFSummaryData = {
  dividendYield: number;
  nav: number;
  expenseRatio: number;
  totalAssets: number;
  beta: number;
  ytdReturn: number;
  category: string;
};

export type StockSummaryData = {
  dividendYield: number;
  trailingPE: number;
  forwardPE: number;
  eps: number;
  marketCap: number;
  beta: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  targetMeanPrice: number;
  recommendationKey: string;
};

export type HoldingItem = {
  symbol: string;
  name: string;
  weight: number;
};

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function proxyFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${PROXY}${path}`);
    if (res.status === 429) {
      console.warn('[API] Rate limited:', path);
      return null;
    }
    if (!res.ok) return null;
    return await res.json() as T;
  } catch (err) {
    console.error('[API] Fetch error:', path, err);
    return null;
  }
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchAsset(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const data = await proxyFetch<any>(`/api/search?q=${encodeURIComponent(query)}`);
  if (!data?.quotes) return [];

  return data.quotes
    .filter((q: any) => q.symbol && ['EQUITY', 'ETF', 'MUTUALFUND', 'CRYPTOCURRENCY'].includes(q.quoteType))
    .slice(0, 15)
    .map((q: any) => {
      let type: AssetType = 'STOCK';
      if (q.quoteType === 'ETF' || q.quoteType === 'MUTUALFUND') type = 'ETF';
      else if (q.quoteType === 'CRYPTOCURRENCY') type = 'CRYPTO';
      return {
        ticker: q.symbol,
        name: q.longname || q.shortname || q.symbol,
        type,
        exchange: q.exchange || '',
      };
    });
}

// ─── Price (live quote) ───────────────────────────────────────────────────────

export async function getETFPrice(ticker: string): Promise<PriceData | null> {
  const data = await proxyFetch<any>(
    `/api/chart?ticker=${encodeURIComponent(ticker)}&interval=1m&range=1d`
  );
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) return null;
  const price = meta.regularMarketPrice ?? 0;
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
  const change = price - prev;
  return {
    price,
    change,
    changesPercentage: prev > 0 ? (change / prev) * 100 : 0,
    previousClose: prev,
  };
}

export async function getCryptoPrice(ticker: string): Promise<PriceData | null> {
  return getETFPrice(`${ticker}-USD`);
}

// ─── Price history ────────────────────────────────────────────────────────────

const RANGE_INTERVAL: Record<string, { interval: string; range: string }> = {
  '1D': { interval: '5m',  range: '1d' },
  '1W': { interval: '30m', range: '5d' },
  '1M': { interval: '1d',  range: '1mo' },
  '3M': { interval: '1d',  range: '3mo' },
  '6M': { interval: '1d',  range: '6mo' },
  '1Y': { interval: '1wk', range: '1y' },
  '5Y': { interval: '1mo', range: '5y' },
};

export async function getETFHistory(ticker: string, period: string): Promise<HistoryPoint[]> {
  const { interval, range } = RANGE_INTERVAL[period] ?? { interval: '1d', range: '1y' };
  const data = await proxyFetch<any>(
    `/api/chart?ticker=${encodeURIComponent(ticker)}&interval=${interval}&range=${range}`
  );
  const result = data?.chart?.result?.[0];
  if (!result) return [];

  const timestamps: number[] = result.timestamp ?? [];
  const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];
  const opens: number[] = result.indicators?.quote?.[0]?.open ?? [];
  const highs: number[] = result.indicators?.quote?.[0]?.high ?? [];
  const lows: number[] = result.indicators?.quote?.[0]?.low ?? [];
  const volumes: number[] = result.indicators?.quote?.[0]?.volume ?? [];

  return timestamps
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open: opens[i] ?? 0,
      high: highs[i] ?? 0,
      low: lows[i] ?? 0,
      close: closes[i] ?? 0,
      volume: volumes[i] ?? 0,
    }))
    .filter(p => p.close > 0);
}

export async function getCryptoHistory(ticker: string, period: string): Promise<HistoryPoint[]> {
  return getETFHistory(`${ticker}-USD`, period);
}

// ─── Dividends ────────────────────────────────────────────────────────────────

export async function getETFDividends(ticker: string): Promise<DividendEvent[]> {
  const data = await proxyFetch<any>(
    `/api/chart?ticker=${encodeURIComponent(ticker)}&interval=1d&range=2y&events=dividends`
  );
  const events = data?.chart?.result?.[0]?.events?.dividends;
  if (!events) return [];

  return Object.values(events)
    .map((d: any) => ({
      date: new Date(d.date * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      amount: d.amount ?? 0,
      timestamp: d.date,
    }))
    .filter(d => d.amount > 0)
    .sort((a, b) => b.timestamp - a.timestamp);
}

// ─── ETF Summary ──────────────────────────────────────────────────────────────

export async function getETFSummary(ticker: string): Promise<ETFSummaryData | null> {
  const data = await proxyFetch<any>(
    `/api/quote-summary?ticker=${encodeURIComponent(ticker)}&modules=summaryDetail,defaultKeyStatistics,fundProfile`
  );
  const result = data?.quoteSummary?.result?.[0];
  if (!result) return null;

  const sd = result.summaryDetail ?? {};
  const ks = result.defaultKeyStatistics ?? {};
  const fp = result.fundProfile ?? {};

  return {
    dividendYield: sd.dividendYield?.raw ?? sd.trailingAnnualDividendYield?.raw ?? 0,
    nav: ks.navPrice?.raw ?? 0,
    expenseRatio: ks.annualReportExpenseRatio?.raw ?? fp.annualReportExpenseRatio?.raw ?? 0,
    totalAssets: ks.totalAssets?.raw ?? 0,
    beta: ks.beta3Year?.raw ?? sd.beta?.raw ?? 0,
    ytdReturn: ks.ytdReturn?.raw ?? 0,
    category: fp.categoryName ?? '',
  };
}

// ─── Stock Summary ────────────────────────────────────────────────────────────

export async function getStockSummary(ticker: string): Promise<StockSummaryData | null> {
  const data = await proxyFetch<any>(
    `/api/quote-summary?ticker=${encodeURIComponent(ticker)}&modules=summaryDetail,defaultKeyStatistics,financialData,recommendationTrend`
  );
  const result = data?.quoteSummary?.result?.[0];
  if (!result) return null;

  const sd = result.summaryDetail ?? {};
  const ks = result.defaultKeyStatistics ?? {};
  const fd = result.financialData ?? {};

  return {
    dividendYield: sd.dividendYield?.raw ?? sd.trailingAnnualDividendYield?.raw ?? 0,
    trailingPE: sd.trailingPE?.raw ?? 0,
    forwardPE: sd.forwardPE?.raw ?? 0,
    eps: ks.trailingEps?.raw ?? 0,
    marketCap: sd.marketCap?.raw ?? 0,
    beta: sd.beta?.raw ?? 0,
    fiftyTwoWeekHigh: sd.fiftyTwoWeekHigh?.raw ?? 0,
    fiftyTwoWeekLow: sd.fiftyTwoWeekLow?.raw ?? 0,
    targetMeanPrice: fd.targetMeanPrice?.raw ?? 0,
    recommendationKey: fd.recommendationKey ?? '',
  };
}

// ─── Crypto Summary ───────────────────────────────────────────────────────────

export async function getCryptoSummary(ticker: string): Promise<StockSummaryData | null> {
  return getStockSummary(`${ticker}-USD`);
}

// ─── ETF Top Holdings ─────────────────────────────────────────────────────────

export async function getETFTopHoldings(ticker: string): Promise<HoldingItem[]> {
  const data = await proxyFetch<any>(`/api/holdings?ticker=${encodeURIComponent(ticker)}`);
  if (!data?.holdings) return [];
  return data.holdings;
}

// ─── Next dividend dates (ex-date, pay date) ──────────────────────────────────
// Used by dividendService.ts — replaces the direct Yahoo call in fetchNextDates()

export async function getNextDividendDates(ticker: string): Promise<{
  exDividendDate: string | null;
  payDate: string | null;
}> {
  const data = await proxyFetch<any>(
    `/api/quote-summary?ticker=${encodeURIComponent(ticker)}&modules=summaryDetail%2CcalendarEvents`
  );
  const result = data?.quoteSummary?.result?.[0];
  if (!result) return { exDividendDate: null, payDate: null };

  const sd = result.summaryDetail;
  const ce = result.calendarEvents;

  let exDate: string | null = null;
  let payDate: string | null = null;

  const exRaw = sd?.exDividendDate?.raw ?? ce?.exDividendDate?.raw;
  if (exRaw) {
    const d = new Date(exRaw * 1000);
    if (!isNaN(d.getTime())) exDate = d.toISOString().slice(0, 10);
  }

  const payRaw = ce?.dividendDate?.raw;
  if (payRaw) {
    const d = new Date(payRaw * 1000);
    if (!isNaN(d.getTime())) payDate = d.toISOString().slice(0, 10);
  }

  return { exDividendDate: exDate, payDate };
}

// ─── Hardcoded price fallbacks (offline / API unavailable) ───────────────────
// Preserved from original api.ts for resilience

export const HARDCODED_PRICES: Record<string, PriceData> = {
  SCHD:  { price: 28.50,    change: 0.12,  changesPercentage: 0.42,  previousClose: 28.38 },
  VOO:   { price: 520.00,   change: 1.20,  changesPercentage: 0.23,  previousClose: 518.80 },
  VTI:   { price: 278.00,   change: 0.85,  changesPercentage: 0.31,  previousClose: 277.15 },
  QQQM:  { price: 210.00,   change: 1.50,  changesPercentage: 0.72,  previousClose: 208.50 },
  SPY:   { price: 580.00,   change: 1.30,  changesPercentage: 0.22,  previousClose: 578.70 },
  QQQ:   { price: 480.00,   change: 2.10,  changesPercentage: 0.44,  previousClose: 477.90 },
  JEPI:  { price: 59.50,    change: 0.08,  changesPercentage: 0.13,  previousClose: 59.42 },
  JEPQ:  { price: 56.00,    change: 0.15,  changesPercentage: 0.27,  previousClose: 55.85 },
  VXUS:  { price: 68.00,    change: 0.20,  changesPercentage: 0.29,  previousClose: 67.80 },
  AAPL:  { price: 227.00,   change: 0.75,  changesPercentage: 0.33,  previousClose: 226.25 },
  MSFT:  { price: 420.00,   change: 1.80,  changesPercentage: 0.43,  previousClose: 418.20 },
  NVDA:  { price: 950.00,   change: 12.00, changesPercentage: 1.28,  previousClose: 938.00 },
  TSLA:  { price: 175.00,   change: -2.50, changesPercentage: -1.41, previousClose: 177.50 },
  BTC:   { price: 68000.00, change: 800.0, changesPercentage: 1.19,  previousClose: 67200.00 },
  ETH:   { price: 3800.00,  change: 45.00, changesPercentage: 1.20,  previousClose: 3755.00 },
};
