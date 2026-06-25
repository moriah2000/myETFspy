const BASE_URL = 'https://query1.finance.yahoo.com';
const PROXY_URL = 'https://myetfspy-proxy.vercel.app';

// ── Known crypto tickers ──────────────────────────────────────
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
  return 'ETF';
}

// ── Hardcoded ETF stats (fallback when Yahoo quoteSummary fails) ──
const ETF_STATS: Record<string, { dividendYield: number; expenseRatio: number; aum: number; inceptionDate: string }> = {
  SCHD:  { dividendYield: 0.0365, expenseRatio: 0.0006, aum: 56_340_000_000, inceptionDate: '10/20/2011' },
  VTI:   { dividendYield: 0.0152, expenseRatio: 0.0003, aum: 430_000_000_000, inceptionDate: '05/24/2001' },
  QQQM:  { dividendYield: 0.0064, expenseRatio: 0.0015, aum: 36_000_000_000, inceptionDate: '10/13/2020' },
  JEPI:  { dividendYield: 0.0819, expenseRatio: 0.0035, aum: 37_000_000_000, inceptionDate: '05/20/2020' },
  JEPQ:  { dividendYield: 0.0980, expenseRatio: 0.0035, aum: 18_000_000_000, inceptionDate: '05/03/2022' },
  SPY:   { dividendYield: 0.0128, expenseRatio: 0.0009, aum: 530_000_000_000, inceptionDate: '01/22/1993' },
  VOO:   { dividendYield: 0.0128, expenseRatio: 0.0003, aum: 460_000_000_000, inceptionDate: '09/07/2010' },
  VXUS:  { dividendYield: 0.0280, expenseRatio: 0.0007, aum: 68_000_000_000, inceptionDate: '01/26/2011' },
  QQQI:  { dividendYield: 0.0120, expenseRatio: 0.0068, aum: 4_200_000_000,  inceptionDate: '12/19/2023' },
  QQQ:   { dividendYield: 0.0064, expenseRatio: 0.0020, aum: 290_000_000_000, inceptionDate: '03/10/1999' },
  IVV:   { dividendYield: 0.0128, expenseRatio: 0.0003, aum: 490_000_000_000, inceptionDate: '05/15/2000' },
  VUG:   { dividendYield: 0.0055, expenseRatio: 0.0004, aum: 130_000_000_000, inceptionDate: '01/26/2004' },
  VEA:   { dividendYield: 0.0310, expenseRatio: 0.0005, aum: 115_000_000_000, inceptionDate: '07/20/2007' },
  IEMG:  { dividendYield: 0.0230, expenseRatio: 0.0009, aum: 75_000_000_000,  inceptionDate: '10/18/2012' },
  EFA:   { dividendYield: 0.0290, expenseRatio: 0.0032, aum: 48_000_000_000,  inceptionDate: '08/14/2001' },
  IWM:   { dividendYield: 0.0135, expenseRatio: 0.0019, aum: 58_000_000_000,  inceptionDate: '05/22/2000' },
  VWO:   { dividendYield: 0.0260, expenseRatio: 0.0008, aum: 86_000_000_000,  inceptionDate: '03/04/2005' },
  DGRO:  { dividendYield: 0.0245, expenseRatio: 0.0008, aum: 28_000_000_000,  inceptionDate: '06/10/2014' },
  HDV:   { dividendYield: 0.0380, expenseRatio: 0.0008, aum: 10_000_000_000,  inceptionDate: '03/29/2011' },
  DVY:   { dividendYield: 0.0450, expenseRatio: 0.0038, aum: 14_000_000_000,  inceptionDate: '11/03/2003' },
  XLK:   { dividendYield: 0.0070, expenseRatio: 0.0010, aum: 68_000_000_000,  inceptionDate: '12/16/1998' },
  XLF:   { dividendYield: 0.0190, expenseRatio: 0.0010, aum: 42_000_000_000,  inceptionDate: '12/16/1998' },
  XLV:   { dividendYield: 0.0155, expenseRatio: 0.0010, aum: 38_000_000_000,  inceptionDate: '12/16/1998' },
  XLE:   { dividendYield: 0.0340, expenseRatio: 0.0010, aum: 30_000_000_000,  inceptionDate: '12/16/1998' },
  XLI:   { dividendYield: 0.0155, expenseRatio: 0.0010, aum: 22_000_000_000,  inceptionDate: '12/16/1998' },
  XLC:   { dividendYield: 0.0080, expenseRatio: 0.0010, aum: 18_000_000_000,  inceptionDate: '06/18/2018' },
  XLRE:  { dividendYield: 0.0310, expenseRatio: 0.0010, aum: 6_500_000_000,   inceptionDate: '10/07/2015' },
  XLU:   { dividendYield: 0.0310, expenseRatio: 0.0010, aum: 12_000_000_000,  inceptionDate: '12/16/1998' },
  XLB:   { dividendYield: 0.0190, expenseRatio: 0.0010, aum: 7_000_000_000,   inceptionDate: '12/16/1998' },
  XLP:   { dividendYield: 0.0270, expenseRatio: 0.0010, aum: 13_000_000_000,  inceptionDate: '12/16/1998' },
  AGG:   { dividendYield: 0.0320, expenseRatio: 0.0003, aum: 105_000_000_000, inceptionDate: '09/22/2003' },
  BND:   { dividendYield: 0.0320, expenseRatio: 0.0003, aum: 110_000_000_000, inceptionDate: '04/03/2007' },
  TLT:   { dividendYield: 0.0390, expenseRatio: 0.0015, aum: 45_000_000_000,  inceptionDate: '07/22/2002' },
  LQD:   { dividendYield: 0.0430, expenseRatio: 0.0014, aum: 30_000_000_000,  inceptionDate: '07/22/2002' },
  HYG:   { dividendYield: 0.0590, expenseRatio: 0.0048, aum: 14_000_000_000,  inceptionDate: '04/04/2007' },
  GLD:   { dividendYield: 0.0000, expenseRatio: 0.0040, aum: 65_000_000_000,  inceptionDate: '11/18/2004' },
  IAU:   { dividendYield: 0.0000, expenseRatio: 0.0025, aum: 32_000_000_000,  inceptionDate: '01/21/2005' },
  IBIT:  { dividendYield: 0.0000, expenseRatio: 0.0025, aum: 58_000_000_000,  inceptionDate: '01/05/2024' },
  ARKK:  { dividendYield: 0.0000, expenseRatio: 0.0075, aum: 6_000_000_000,   inceptionDate: '10/31/2014' },
  TQQQ:  { dividendYield: 0.0050, expenseRatio: 0.0088, aum: 22_000_000_000,  inceptionDate: '02/09/2010' },
  SQQQ:  { dividendYield: 0.0000, expenseRatio: 0.0095, aum: 4_000_000_000,   inceptionDate: '02/09/2010' },
  SPXL:  { dividendYield: 0.0040, expenseRatio: 0.0091, aum: 3_500_000_000,   inceptionDate: '11/05/2008' },
  SPHD:  { dividendYield: 0.0430, expenseRatio: 0.0030, aum: 3_200_000_000,   inceptionDate: '10/18/2012' },
  DGRW:  { dividendYield: 0.0190, expenseRatio: 0.0028, aum: 14_000_000_000,  inceptionDate: '05/22/2013' },
  ITOT:  { dividendYield: 0.0148, expenseRatio: 0.0003, aum: 58_000_000_000,  inceptionDate: '01/20/2004' },
};

// ── Hardcoded stock stats fallback ────────────────────────────
const STOCK_STATS: Record<string, { marketCap: number; peRatio: number; eps: number; beta: number; dividendYield: number; sector: string; industry: string }> = {
  AAPL:  { marketCap: 3_100_000_000_000, peRatio: 32.1, eps: 6.42, beta: 1.24, dividendYield: 0.0050, sector: 'Technology', industry: 'Consumer Electronics' },
  MSFT:  { marketCap: 3_050_000_000_000, peRatio: 36.8, eps: 11.80, beta: 0.90, dividendYield: 0.0070, sector: 'Technology', industry: 'Software' },
  NVDA:  { marketCap: 3_200_000_000_000, peRatio: 55.2, eps: 1.30, beta: 1.68, dividendYield: 0.0003, sector: 'Technology', industry: 'Semiconductors' },
  AMZN:  { marketCap: 2_100_000_000_000, peRatio: 42.5, eps: 4.30, beta: 1.15, dividendYield: 0.0000, sector: 'Consumer Disc.', industry: 'Internet Retail' },
  META:  { marketCap: 1_450_000_000_000, peRatio: 28.4, eps: 23.20, beta: 1.32, dividendYield: 0.0040, sector: 'Technology', industry: 'Social Media' },
  GOOGL: { marketCap: 2_050_000_000_000, peRatio: 23.8, eps: 7.60, beta: 1.05, dividendYield: 0.0050, sector: 'Technology', industry: 'Internet Services' },
  TSLA:  { marketCap: 1_100_000_000_000, peRatio: 120.5, eps: 0.73, beta: 2.30, dividendYield: 0.0000, sector: 'Consumer Disc.', industry: 'Auto Manufacturers' },
  BRK_B: { marketCap: 1_000_000_000_000, peRatio: 11.2, eps: 16.40, beta: 0.88, dividendYield: 0.0000, sector: 'Financials', industry: 'Insurance' },
  JPM:   { marketCap: 680_000_000_000, peRatio: 13.5, eps: 18.20, beta: 1.12, dividendYield: 0.0210, sector: 'Financials', industry: 'Banking' },
  V:     { marketCap: 620_000_000_000, peRatio: 32.4, eps: 9.90, beta: 0.94, dividendYield: 0.0080, sector: 'Financials', industry: 'Credit Services' },
  JNJ:   { marketCap: 380_000_000_000, peRatio: 16.2, eps: 9.80, beta: 0.55, dividendYield: 0.0320, sector: 'Healthcare', industry: 'Pharmaceuticals' },
  WMT:   { marketCap: 760_000_000_000, peRatio: 40.1, eps: 2.38, beta: 0.52, dividendYield: 0.0110, sector: 'Consumer Staples', industry: 'Discount Stores' },
  AVGO:  { marketCap: 880_000_000_000, peRatio: 38.2, eps: 4.60, beta: 1.35, dividendYield: 0.0115, sector: 'Technology', industry: 'Semiconductors' },
  XOM:   { marketCap: 490_000_000_000, peRatio: 14.8, eps: 8.90, beta: 0.78, dividendYield: 0.0340, sector: 'Energy', industry: 'Oil & Gas' },
  LLY:   { marketCap: 750_000_000_000, peRatio: 65.4, eps: 12.10, beta: 0.42, dividendYield: 0.0070, sector: 'Healthcare', industry: 'Pharmaceuticals' },
};

// ── Search ────────────────────────────────────────────────────
export type AssetSearchResult = {
  ticker: string;
  name: string;
  type: AssetType;
  exchange?: string;
};

export async function searchAsset(query: string): Promise<AssetSearchResult[]> {
  try {
    const upperQuery = query.toUpperCase();
    if (CRYPTO_TICKERS.has(upperQuery)) {
      return [{ ticker: upperQuery, name: getCryptoName(upperQuery), type: 'CRYPTO' }];
    }
    const url = `${PROXY_URL}/api/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    const data = await response.json();
    const quotes = data?.quotes ?? [];
    return quotes
      .filter((q: any) => q.symbol && ['ETF', 'EQUITY', 'CRYPTOCURRENCY'].includes(q.quoteType))
      .slice(0, 10)
      .map((q: any) => {
        let type: AssetType = 'STOCK';
        if (q.quoteType === 'ETF') type = 'ETF';
        else if (q.quoteType === 'CRYPTOCURRENCY') type = 'CRYPTO';
        else if (CRYPTO_TICKERS.has(q.symbol.replace('-USD', '').toUpperCase())) type = 'CRYPTO';
        const ticker = type === 'CRYPTO'
          ? q.symbol.replace('-USD', '').toUpperCase()
          : q.symbol.toUpperCase();
        return { ticker, name: q.longname ?? q.shortname ?? q.symbol, type, exchange: q.exchange };
      });
  } catch (e) {
    return [];
  }
}

export function getCryptoName(ticker: string): string {
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
    WIF: 'dogwifhat', BONK: 'Bonk', JUP: 'Jupiter',
  };
  return names[ticker] || ticker;
}

// ── Price ─────────────────────────────────────────────────────
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
      price, change, changesPercentage,
      yearHigh: meta.fiftyTwoWeekHigh || 0,
      yearLow: meta.fiftyTwoWeekLow || 0,
      avgVolume: meta.averageDailyVolume10Day || 0,
    };
  } catch (e) { return null; }
}

export async function getCryptoPrice(ticker: string) {
  const symbol = ticker.toUpperCase().includes('-USD')
    ? ticker.toUpperCase() : `${ticker.toUpperCase()}-USD`;
  return getETFPrice(symbol);
}

// ── History ───────────────────────────────────────────────────
export async function getETFHistory(ticker: string, range: string): Promise<{ timestamp: number; close: number }[]> {
  const intervalMap: Record<string, string> = {
    'Today': '5m', '1W': '1d', '1M': '1d', '3M': '1wk',
    '6M': '1wk', '1Y': '1mo', '5Y': '3mo', '1D': '5m', '3Y': '1mo',
  };
  const rangeMap: Record<string, string> = {
    'Today': '1d', '1W': '5d', '1M': '1mo', '3M': '3mo',
    '6M': '6mo', '1Y': '1y', '5Y': '5y', '1D': '1d', '3Y': '3y',
  };
  try {
    const url = `${BASE_URL}/v8/finance/chart/${ticker}?interval=${intervalMap[range] || '1d'}&range=${rangeMap[range] || '1y'}`;
    const response = await fetch(url);
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const timestamps: number[] = result?.timestamp || [];
    const closes: number[] = result?.indicators?.quote?.[0]?.close || [];
    return timestamps
      .map((t, i) => ({ timestamp: t, close: closes[i] }))
      .filter(p => p.close != null && !isNaN(p.close));
  } catch (e) { return []; }
}

export async function getCryptoHistory(ticker: string, range: string) {
  const symbol = ticker.toUpperCase().includes('-USD')
    ? ticker.toUpperCase() : `${ticker.toUpperCase()}-USD`;
  return getETFHistory(symbol, range);
}

// ── Legacy ────────────────────────────────────────────────────
export async function searchETF(query: string) {
  try {
    const url = `${BASE_URL}/v1/finance/search?q=${query}&quotesCount=10&newsCount=0`;
    const response = await fetch(url);
    const data = await response.json();
    return (data?.quotes ?? [])
      .filter((q: any) => q.quoteType === 'ETF')
      .map((q: any) => ({ ticker: q.symbol, name: q.longname ?? q.shortname ?? q.symbol }));
  } catch (e) { return []; }
}

export async function getETFHoldings(ticker: string) {
  try {
    const url = `${BASE_URL}/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    const response = await fetch(url);
    const data = await response.json();
    return data?.chart?.result?.[0] || null;
  } catch (e) { return null; }
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
        date: new Date(d.date * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        amount: d.amount,
        timestamp: d.date,
      }))
      .sort((a: any, b: any) => b.timestamp - a.timestamp);
  } catch (e) { return []; }
}

// ── Top Holdings ──────────────────────────────────────────────
export async function getETFTopHoldings(ticker: string): Promise<{ symbol: string; name: string; weight: number }[]> {
  try {
    const response = await fetch(`${PROXY_URL}/api/holdings?ticker=${ticker}`);
    const data = await response.json();
    if (data.holdings?.length > 0) return data.holdings;
    return [];
  } catch (e) { return []; }
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
  const t = ticker.toUpperCase();
  const hardcoded = ETF_STATS[t];

  try {
    const chartUrl = `${BASE_URL}/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    const chartRes = await fetch(chartUrl);
    const chartData = await chartRes.json();
    const meta = chartData?.chart?.result?.[0]?.meta;

    // If chart fetch fails, return hardcoded data with zero price
    if (!meta) {
      if (hardcoded) {
        return {
          name: ticker,
          price: 0, change: 0, changePct: 0,
          dividendYield: hardcoded.dividendYield,
          expenseRatio: hardcoded.expenseRatio,
          aum: hardcoded.aum,
          inceptionDate: hardcoded.inceptionDate,
          yearHigh: 0, yearLow: 0,
        };
      }
      return null;
    }

    const prevClose = meta.previousClose || meta.chartPreviousClose || 0;
    const price = meta.regularMarketPrice || 0;
    const change = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

    // Start with hardcoded, try to override with live Yahoo data
    let dividendYield = hardcoded?.dividendYield ?? 0;
    let expenseRatio = hardcoded?.expenseRatio ?? 0;
    let aum = hardcoded?.aum ?? 0;
    let inceptionDate = hardcoded?.inceptionDate ?? '';

    try {
      const summaryUrl = `${BASE_URL}/v10/finance/quoteSummary/${ticker}?modules=summaryDetail%2CfundProfile%2CdefaultKeyStatistics`;
      const summaryRes = await fetch(summaryUrl);
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        const result = summaryData?.quoteSummary?.result?.[0];
        if (result) {
          const sd = result.summaryDetail;
          const fp = result.fundProfile;
          const ks = result.defaultKeyStatistics;
          if (sd?.yield?.raw) dividendYield = sd.yield.raw;
          else if (sd?.dividendYield?.raw) dividendYield = sd.dividendYield.raw;
          if (fp?.feesExpensesInvestment?.annualReportExpenseRatio?.raw)
            expenseRatio = fp.feesExpensesInvestment.annualReportExpenseRatio.raw;
          else if (fp?.annualReportExpenseRatio?.raw)
            expenseRatio = fp.annualReportExpenseRatio.raw;
          if (ks?.totalAssets?.raw) aum = ks.totalAssets.raw;
          else if (sd?.totalAssets?.raw) aum = sd.totalAssets.raw;
          const inceptionRaw = fp?.fundInceptionDate?.raw;
          if (inceptionRaw) {
            inceptionDate = new Date(inceptionRaw * 1000).toLocaleDateString('en-US', {
              month: '2-digit', day: '2-digit', year: 'numeric',
            });
          }
        }
      }
    } catch { /* keep hardcoded values */ }

    return {
      name: meta.longName || meta.shortName || ticker,
      price, change, changePct,
      dividendYield, expenseRatio, aum, inceptionDate,
      yearHigh: meta.fiftyTwoWeekHigh || 0,
      yearLow: meta.fiftyTwoWeekLow || 0,
    };
  } catch (e) {
    // Total failure — return hardcoded with zero price if available
    if (hardcoded) {
      return {
        name: ticker,
        price: 0, change: 0, changePct: 0,
        dividendYield: hardcoded.dividendYield,
        expenseRatio: hardcoded.expenseRatio,
        aum: hardcoded.aum,
        inceptionDate: hardcoded.inceptionDate,
        yearHigh: 0, yearLow: 0,
      };
    }
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

    // Use hardcoded fallback first
    const hardcoded = STOCK_STATS[ticker.toUpperCase()];
    let marketCap = hardcoded?.marketCap ?? 0;
    let peRatio = hardcoded?.peRatio ?? 0;
    let eps = hardcoded?.eps ?? 0;
    let dividendYield = hardcoded?.dividendYield ?? 0;
    let beta = hardcoded?.beta ?? 0;
    let sector = hardcoded?.sector ?? '';
    let industry = hardcoded?.industry ?? '';

    // Try Yahoo quoteSummary to override with live data
    try {
      const summaryUrl = `${BASE_URL}/v10/finance/quoteSummary/${ticker}?modules=summaryDetail%2CdefaultKeyStatistics%2CassetProfile%2CfinancialData`;
      const summaryRes = await fetch(summaryUrl);
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        const result = summaryData?.quoteSummary?.result?.[0];
        if (result) {
          const sd = result.summaryDetail;
          const ks = result.defaultKeyStatistics;
          const ap = result.assetProfile;
          if (sd?.marketCap?.raw) marketCap = sd.marketCap.raw;
          if (sd?.trailingPE?.raw) peRatio = sd.trailingPE.raw;
          else if (ks?.forwardPE?.raw) peRatio = ks.forwardPE.raw;
          if (ks?.trailingEps?.raw) eps = ks.trailingEps.raw;
          if (sd?.dividendYield?.raw) dividendYield = sd.dividendYield.raw;
          if (sd?.beta?.raw) beta = sd.beta.raw;
          if (ap?.sector) sector = ap.sector;
          if (ap?.industry) industry = ap.industry;
        }
      }
    } catch { /* use hardcoded */ }

    return {
      name: meta.longName || meta.shortName || ticker,
      price, change, changePct, marketCap, peRatio, eps,
      dividendYield, beta, sector, industry,
      yearHigh: meta.fiftyTwoWeekHigh || 0,
      yearLow: meta.fiftyTwoWeekLow || 0,
      avgVolume: meta.averageDailyVolume10Day || 0,
    };
  } catch (e) { return null; }
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

// Hardcoded crypto market caps + supply as fallback
const CRYPTO_STATS: Record<string, { marketCap: number; circulatingSupply: number }> = {
  BTC:  { marketCap: 1_900_000_000_000, circulatingSupply: 19_700_000 },
  ETH:  { marketCap: 320_000_000_000,   circulatingSupply: 120_000_000 },
  SOL:  { marketCap: 90_000_000_000,    circulatingSupply: 460_000_000 },
  XRP:  { marketCap: 130_000_000_000,   circulatingSupply: 57_000_000_000 },
  BNB:  { marketCap: 88_000_000_000,    circulatingSupply: 145_000_000 },
  ADA:  { marketCap: 25_000_000_000,    circulatingSupply: 35_000_000_000 },
  DOGE: { marketCap: 28_000_000_000,    circulatingSupply: 145_000_000_000 },
  AVAX: { marketCap: 16_000_000_000,    circulatingSupply: 410_000_000 },
  LINK: { marketCap: 10_000_000_000,    circulatingSupply: 600_000_000 },
  SHIB: { marketCap: 4_000_000_000,     circulatingSupply: 589_000_000_000_000 },
  PEPE: { marketCap: 5_000_000_000,     circulatingSupply: 420_000_000_000_000 },
  TON:  { marketCap: 18_000_000_000,    circulatingSupply: 2_500_000_000 },
  HYPE: { marketCap: 8_000_000_000,     circulatingSupply: 333_000_000 },
};

export async function getCryptoSummary(ticker: string): Promise<CryptoSummary | null> {
  try {
    const symbol = ticker.toUpperCase().includes('-USD')
      ? ticker.toUpperCase() : `${ticker.toUpperCase()}-USD`;
    const cleanTicker = ticker.toUpperCase().replace('-USD', '');

    const chartUrl = `${BASE_URL}/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const chartRes = await fetch(chartUrl);
    const chartData = await chartRes.json();
    const meta = chartData?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const prevClose = meta.previousClose || meta.chartPreviousClose || 0;
    const price = meta.regularMarketPrice || 0;
    const change = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

    // Use hardcoded fallback
    const hardcoded = CRYPTO_STATS[cleanTicker];
    let marketCap = hardcoded?.marketCap ?? 0;
    let circulatingSupply = hardcoded?.circulatingSupply ?? 0;
    let volume24h = 0;

    // Try Yahoo quoteSummary
    try {
      const summaryUrl = `${BASE_URL}/v10/finance/quoteSummary/${symbol}?modules=summaryDetail%2CdefaultKeyStatistics`;
      const summaryRes = await fetch(summaryUrl);
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        const result = summaryData?.quoteSummary?.result?.[0];
        if (result) {
          const sd = result.summaryDetail;
          const ks = result.defaultKeyStatistics;
          if (sd?.marketCap?.raw) marketCap = sd.marketCap.raw;
          if (sd?.volume24Hr?.raw) volume24h = sd.volume24Hr.raw;
          else if (sd?.regularMarketVolume?.raw) volume24h = sd.regularMarketVolume.raw;
          if (sd?.circulatingSupply?.raw) circulatingSupply = sd.circulatingSupply.raw;
          else if (ks?.circulatingSupply?.raw) circulatingSupply = ks.circulatingSupply.raw;
        }
      }
    } catch { /* use hardcoded */ }

    return {
      name: getCryptoName(cleanTicker),
      ticker: cleanTicker,
      price, change, changePct, marketCap, volume24h, circulatingSupply,
      yearHigh: meta.fiftyTwoWeekHigh || 0,
      yearLow: meta.fiftyTwoWeekLow || 0,
    };
  } catch (e) { return null; }
}

// ── Formatters ────────────────────────────────────────────────
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
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v > 0 ? v.toLocaleString() : '—';
}

// ── Crypto price formatter (no scientific notation) ───────────
export function formatCryptoPrice(price: number): string {
  if (price === 0) return '—';
  if (price >= 1000) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(4)}`;
  if (price >= 0.01) return `$${price.toFixed(6)}`;
  if (price >= 0.0001) return `$${price.toFixed(8)}`;
  // For very small prices like SHIB/PEPE — use fixed with enough decimals
  const str = price.toFixed(12).replace(/\.?0+$/, '');
  return `$${str}`;
}