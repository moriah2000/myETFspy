const BASE_URL = 'https://query1.finance.yahoo.com';
const PROXY_URL = 'https://myetfspy-proxy.vercel.app';

export async function getETFPrice(ticker: string) {
  try {
    const url = BASE_URL + '/v8/finance/chart/' + ticker + '?interval=1d&range=1d';
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

export async function searchETF(query: string) {
  try {
    const url = BASE_URL + '/v1/finance/search?q=' + query + '&quotesCount=10&newsCount=0';
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

export async function getETFHoldings(ticker: string) {
  try {
    const url = BASE_URL + '/v8/finance/chart/' + ticker + '?interval=1d&range=1d';
    const response = await fetch(url);
    const data = await response.json();
    return data?.chart?.result?.[0] || null;
  } catch (e) {
    return null;
  }
}

export async function getETFDividends(ticker: string) {
  try {
    const url = BASE_URL + '/v8/finance/chart/' + ticker + '?interval=1mo&range=1y&events=dividends';
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
      }))
      .reverse();
  } catch (e) {
    return [];
  }
}

export async function getETFTopHoldings(ticker: string): Promise<{ symbol: string; name: string; weight: number }[]> {
  try {
    const response = await fetch(`${PROXY_URL}/api/holdings?ticker=${ticker}`);
    const data = await response.json();
    if (data.holdings && data.holdings.length > 0) {
      return data.holdings;
    }
    return [];
  } catch (e) {
    return [];
  }
}