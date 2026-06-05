export async function getETFPrice(ticker: string) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
  );
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  return {
    price: meta?.regularMarketPrice,
    change: meta?.regularMarketPrice - meta?.chartPreviousClose,
    changesPercentage: ((meta?.regularMarketPrice - meta?.chartPreviousClose) / meta?.chartPreviousClose) * 100,
    yearHigh: meta?.fiftyTwoWeekHigh,
    yearLow: meta?.fiftyTwoWeekLow,
    avgVolume: meta?.regularMarketVolume,
    marketCap: null,
  };
}

export async function getETFHoldings(ticker: string) {
  return [
    { asset: 'AAPL', name: 'Apple Inc', weightPercentage: 5.8 },
    { asset: 'MSFT', name: 'Microsoft Corp', weightPercentage: 5.6 },
    { asset: 'NVDA', name: 'NVIDIA Corp', weightPercentage: 5.1 },
    { asset: 'AMZN', name: 'Amazon.com Inc', weightPercentage: 3.8 },
    { asset: 'GOOGL', name: 'Alphabet Inc', weightPercentage: 3.2 },
  ];
}

export async function getETFDividends(ticker: string) {
  return [];
}