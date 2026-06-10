const BASE_URL = 'https://query1.finance.yahoo.com';
const PROXY_URL = 'https://myetfspy-proxy.vercel.app';

// ── Known crypto tickers (base symbol, no -USD suffix) ────────
export const CRYPTO_TICKERS = new Set([
  'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'ADA', 'DOGE', 'AVAX', 'LINK', 'DOT',
  'MATIC', 'LTC', 'UNI', 'ATOM', 'XLM', 'ALGO', 'VET', 'FIL', 'THETA', 'TRX',
  'ETC', 'XMR', 'AAVE', 'COMP', 'MKR', 'SNX', 'CRV', 'SUSHI', 'YFI', 'BAL',
  'NEAR', 'FTM', 'SAND', 'MANA', 'AXS', 'GALA', 'ENJ', 'CHZ', 'FLOW', 'HBAR',
  'ICP', 'SHIB', 'APE', 'OP', 'ARB', 'SUI', 'SEI', 'TIA', 'INJ', 'PYTH',
  'PEPE', 'WIF', 'BONK', 'JUP', 'HYPE', 'TON', 'NOT',
]);

export type AssetType = 'ETF' | 'STOCK' | 'CRYPTO';

export function detectAssetType(ticker: string): AssetType {
  const t = ticker.toUpperCase().replace('-USD', '');
  if (CRYPTO_TICKERS.has(t)) return 'CRYPTO';
  return 'ETF'; // default — will be refined by Yahoo quoteType
}

// ── Search (ETFs, stocks, crypto) ─────────────────────────────
export type AssetSearchResult = {
  ticker: string;
  name: string;
  type: AssetType;
  exchange?: string;
};

export async function searchAsset(query: string): Promise<AssetSearchResult[]> {
  try {
    // Check if query matches a known crypto ticker first
    const upperQuery = query.toUpperCase();
    if (CRYPTO_TICKERS.has(upperQuery)) {
      return [{
        ticker: upperQuery,
        name: getCryptoName(upperQuery),
        type: 'CRYPTO',
      }];
    }

    const url = `${BASE_URL}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0`;
    const response = await fetch(url);
    const data = await response.json();
    const quotes = data?.quotes ?? [];

    const results: AssetSearchResult[] = quotes
      .filter((q: any) => q.symbol && (q.quoteType === 'ETF' || q.quoteType === 'EQUITY' || q.quoteType === 'CRYPTOCURRENCY'))
      .slice(0, 10)
      .map((q: any) => {
        let type: AssetType = 'STOCK';
        if (q.quoteType === 'ETF') type = 'ETF';
        else if (q.quoteType === 'CRYPTOCURRENCY') type = 'CRYPTO';
        else if (CRYPTO_TICKERS.has(q.symbol.replace('-USD', '').toUpperCase())) type = 'CRYPTO';

        // Clean crypto ticker — strip -USD suffix for display
        const ticker = type === 'CRYPTO'
          ? q.symbol.replace('-USD', '').toUpperCase()
          : q.symbol.toUpperCase();

        return {
          ticker,
          name: q.longname ?? q.shortname ?? q.symbol,
          type,
          exchange: q.exchange,
        };
      });

    return results;
  } catch (e) {
    return [];
  }
}

function getCryptoName(ticker: string): string {
  const names: Record<string, string> = {
    BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', XRP: 'XRP',
    BNB: 'BNB', ADA: 'Cardano', DOGE: 'Dogecoin', AVAX: 'Avalanche',
    LINK: 'Chainlink', DOT: 'Polkadot', MATIC: 'Polygon', LTC: 'Litecoin',
    UNI: 'Uniswap', ATOM: 'Cosmos', XLM: 'Stellar', ALGO: 'Algorand',
    VET: 'VeChain', FIL: 'Filecoin', TRX: 'TRON', ETC: 'Ethereum Classic',
    XMR: 'Monero', AAVE: 'Aave', NEAR: 'NEAR Protocol', FTM: 'Fantom',
    SAND: 'The Sandbox', MANA: 'Decentraland', AXS: 'Axie Infinity',
    HBAR: 'Hedera', ICP: 'Internet Computer', SHIB: 'Shiba Inu',
    OP: 'Optimism', ARB: 'Arbitrum', SUI: 'Sui', TON: 'Toncoin',
    PEPE: 'Pepe', HYPE: 'Hyperliquid', INJ: 'Injective',
  };
  return names[ticker] || ticker;
}

// ── Price (ETF + Stock, same endpoint) ────────────────────────
export async function getETFPrice(ticker: string) {
  try {
    const url = `${BASE_URL}/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    const response = await fetch(url);
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta) return null;
    const prevClose = meta.previousClose || meta.chartPreviousClose || 0;
    const price = meta.regularMarketPrice || 0;
    const change = price - prevClose;
    const changesPercentage = prevClose > 0 ? (change / prevClose) * 100 : 0;
    return {
      price,
      change,
      changesPercentage,
      yearHigh: meta.fiftyTwoWeekHigh || 0,
      yearLow: meta.fiftyTwoWeekLow || 0,
      avgVolume: meta.averageDailyVolume10Day || 0,
    };
  } catch (e) {
    return null;
  }
}

// ── Crypto price (appends -USD) ───────────────────────────────
export async function getCryptoPrice(ticker: string) {
  const symbol = ticker.toUpperCase().includes('-USD')
    ? ticker.toUpperCase()
    : `${ticker.toUpperCase()}-USD`;
  return getETFPrice(symbol);
}

// ── History (ETF + Stock) ─────────────────────────────────────
export async function getETFHistory(ticker: string, range: string): Promise<{ timestamp: number; close: number }[]> {
  const intervalMap: Record<string, string> = {
    'Today': '5m', '1W': '1d', '1M': '1d',
    '3M': '1wk', '6M': '1wk', '1Y': '1mo', '5Y': '3mo',
    '1D': '5m', '3Y': '1mo',
  };
  const rangeMap: Record<string, string> = {
    'Today': '1d', '1W': '5d', '1M': '1mo',
    '3M': '3mo', '6M': '6mo', '1Y': '1y', '5Y': '5y',
    '1D': '1d', '3Y': '3y',
  };
  const interval = intervalMap[range] || '1d';
  const r = rangeMap[range] || '1y';
  try {
    const url = `${BASE_URL}/v8/finance/chart/${ticker}?interval=${interval}&range=${r}`;
    const response = await fetch(url);
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const timestamps: number[] = result?.timestamp || [];
    const closes: number[] = result?.indicators?.quote?.[0]?.close || [];
    return timestamps
      .map((t, i) => ({ timestamp: t, close: closes[i] }))
      .filter(p => p.close != null && !isNaN(p.close));
  } catch (e) {
    return [];
  }
}

// ── Crypto history (appends -USD) ────────────────────────────
export async function getCryptoHistory(ticker: string, range: string) {
  const symbol = ticker.toUpperCase().includes('-USD')
    ? ticker.toUpperCase()
    : `${ticker.toUpperCase()}-USD`;
  return getETFHistory(symbol, range);
}

// ── Search ETF (legacy, kept for compatibility) ───────────────
export async function searchETF(query: string) {
  try {
    const url = `${BASE_URL}/v1/finance/search?q=${query}&quotesCount=10&newsCount=0`;
    const response = await fetch(url);
    const data = await response.json();
    const quotes = data?.quotes ?? [];
    return quotes
      .filter((q: any) => q.quoteType === 'ETF')
      .map((q: any) => ({
        ticker: q.symbol,
        name: q.longname ?? q.shortname ?? q.symbol,
      }));
  } catch (e) {
    return [];
  }
}

// ── ETF Holdings ──────────────────────────────────────────────
export async function getETFHoldings(ticker: string) {
  try {
    const url = `${BASE_URL}/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    const response = await fetch(url);
    const data = await response.json();
    return data?.chart?.result?.[0] || null;
  } catch (e) {
    return null;
  }
}

// ── Dividends ─────────────────────────────────────────────────
export async function getETFDividends(ticker: string): Promise<{ date: string; amount: number; timestamp?: number }[]> {
  try {
    const url = `${BASE_URL}/v8/finance/chart/${ticker}?interval=1mo&range=2y&events=dividends`;
    const response = await fetch(url);
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const dividendEvents = result?.events?.dividends;
    if (!dividendEvents) return [];
    return Object.values(dividendEvents)
      .map((d: any) => ({
        date: new Date(d.date * 1000).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        }),
        amount: d.amount,
        timestamp: d.date,
      }))
      .sort((a: any, b: any) => b.timestamp - a.timestamp);
  } catch (e) {
    return [];
  }
}

// ── Top Holdings (via proxy) ──────────────────────────────────
export async function getETFTopHoldings(ticker: string): Promise<{ symbol: string; name: string; weight: number }[]> {
  try {
    const response = await fetch(`${PROXY_URL}/api/holdings?ticker=${ticker}`);
    const data = await response.json();
    if (data.holdings && data.holdings.length > 0) return data.holdings;
    return [];
  } catch (e) {
    return [];
  }
}

// ── ETF Summary ───────────────────────────────────────────────
export type ETFSummary = {
  name: string;
  price: number;
  change: number;
  changePct: number;
  dividendYield: number;
  expenseRatio: number;
  aum: number;
  inceptionDate: string;
  yearHigh: number;
  yearLow: number;
};

export async function getETFSummary(ticker: string): Promise<ETFSummary | null> {
  try {
    const chartUrl = `${BASE_URL}/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    const chartRes = await fetch(chartUrl);
    const chartData = await chartRes.json();
    const meta = chartData?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const prevClose = meta.previousClose || meta.chartPreviousClose || 0;
    const price = meta.regularMarketPrice || 0;
    const change = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

    let dividendYield = 0, expenseRatio = 0, aum = 0, inceptionDate = '';
    try {
      const summaryUrl = `${BASE_URL}/v10/finance/quoteSummary/${ticker}?modules=summaryDetail%2CfundProfile%2CdefaultKeyStatistics`;
      const summaryRes = await fetch(summaryUrl);
      const summaryData = await summaryRes.json();
      const result = summaryData?.quoteSummary?.result?.[0];
      const summaryDetail = result?.summaryDetail;
      const fundProfile = result?.fundProfile;
      const keyStats = result?.defaultKeyStatistics;
      dividendYield = summaryDetail?.yield?.raw || summaryDetail?.dividendYield?.raw || 0;
      expenseRatio = fundProfile?.feesExpensesInvestment?.annualReportExpenseRatio?.raw
        || fundProfile?.annualReportExpenseRatio?.raw || 0;
      aum = keyStats?.totalAssets?.raw || summaryDetail?.totalAssets?.raw || 0;
      const inceptionRaw = fundProfile?.fundInceptionDate?.raw;
      if (inceptionRaw) {
        inceptionDate = new Date(inceptionRaw * 1000).toLocaleDateString('en-US', {
          month: '2-digit', day: '2-digit', year: 'numeric',
        });
      }
    } catch { }

    return {
      name: meta.longName || meta.shortName || ticker,
      price, change, changePct, dividendYield, expenseRatio, aum, inceptionDate,
      yearHigh: meta.fiftyTwoWeekHigh || 0,
      yearLow: meta.fiftyTwoWeekLow || 0,
    };
  } catch (e) {
    return null;
  }
}

// ── Stock Summary ─────────────────────────────────────────────
export type StockSummary = {
  name: string;
  price: number;
  change: number;
  changePct: number;
  marketCap: number;
  peRatio: number;
  eps: number;
  dividendYield: number;
  beta: number;
  yearHigh: number;
  yearLow: number;
  avgVolume: number;
  sector: string;
  industry: string;
};

export async function getStockSummary(ticker: string): Promise<StockSummary | null> {
  try {
    const chartUrl = `${BASE_URL}/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    const chartRes = await fetch(chartUrl);
    const chartData = await chartRes.json();
    const meta = chartData?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const prevClose = meta.previousClose || meta.chartPreviousClose || 0;
    const price = meta.regularMarketPrice || 0;
    const change = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

    let marketCap = 0, peRatio = 0, eps = 0, dividendYield = 0;
    let beta = 0, sector = '', industry = '';

    try {
      const summaryUrl = `${BASE_URL}/v10/finance/quoteSummary/${ticker}?modules=summaryDetail%2CdefaultKeyStatistics%2CassetProfile%2CfinancialData`;
      const summaryRes = await fetch(summaryUrl);
      const summaryData = await summaryRes.json();
      const result = summaryData?.quoteSummary?.result?.[0];
      const summaryDetail = result?.summaryDetail;
      const keyStats = result?.defaultKeyStatistics;
      const assetProfile = result?.assetProfile;
      const financialData = result?.financialData;

      marketCap = summaryDetail?.marketCap?.raw || 0;
      peRatio = summaryDetail?.trailingPE?.raw || keyStats?.forwardPE?.raw || 0;
      eps = keyStats?.trailingEps?.raw || 0;
      dividendYield = summaryDetail?.dividendYield?.raw || 0;
      beta = summaryDetail?.beta?.raw || 0;
      sector = assetProfile?.sector || '';
      industry = assetProfile?.industry || '';
    } catch { }

    return {
      name: meta.longName || meta.shortName || ticker,
      price, change, changePct, marketCap, peRatio, eps,
      dividendYield, beta, sector, industry,
      yearHigh: meta.fiftyTwoWeekHigh || 0,
      yearLow: meta.fiftyTwoWeekLow || 0,
      avgVolume: meta.averageDailyVolume10Day || 0,
    };
  } catch (e) {
    return null;
  }
}

// ── Crypto Summary ────────────────────────────────────────────
export type CryptoSummary = {
  name: string;
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  marketCap: number;
  volume24h: number;
  circulatingSupply: number;
  yearHigh: number;
  yearLow: number;
};

export async function getCryptoSummary(ticker: string): Promise<CryptoSummary | null> {
  try {
    const symbol = ticker.toUpperCase().includes('-USD')
      ? ticker.toUpperCase()
      : `${ticker.toUpperCase()}-USD`;

    const chartUrl = `${BASE_URL}/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const chartRes = await fetch(chartUrl);
    const chartData = await chartRes.json();
    const meta = chartData?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const prevClose = meta.previousClose || meta.chartPreviousClose || 0;
    const price = meta.regularMarketPrice || 0;
    const change = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

    let marketCap = 0, volume24h = 0, circulatingSupply = 0;
    try {
      const summaryUrl = `${BASE_URL}/v10/finance/quoteSummary/${symbol}?modules=summaryDetail%2CdefaultKeyStatistics`;
      const summaryRes = await fetch(summaryUrl);
      const summaryData = await summaryRes.json();
      const result = summaryData?.quoteSummary?.result?.[0];
      const summaryDetail = result?.summaryDetail;
      const keyStats = result?.defaultKeyStatistics;
      marketCap = summaryDetail?.marketCap?.raw || 0;
      volume24h = summaryDetail?.volume24Hr?.raw || summaryDetail?.regularMarketVolume?.raw || 0;
      circulatingSupply = summaryDetail?.circulatingSupply?.raw || keyStats?.circulatingSupply?.raw || 0;
    } catch { }

    const cleanTicker = ticker.toUpperCase().replace('-USD', '');
    return {
      name: getCryptoName(cleanTicker),
      ticker: cleanTicker,
      price, change, changePct, marketCap, volume24h, circulatingSupply,
      yearHigh: meta.fiftyTwoWeekHigh || 0,
      yearLow: meta.fiftyTwoWeekLow || 0,
    };
  } catch (e) {
    return null;
  }
}

// ── Formatters (shared utilities) ────────────────────────────
export function formatMarketCap(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return v > 0 ? `$${v.toLocaleString()}` : '—';
}

export function formatVolume(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return v > 0 ? `$${v.toLocaleString()}` : '—';
}

export function formatSupply(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v > 0 ? v.toLocaleString() : '—';
}