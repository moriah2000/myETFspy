// services/metadataResolver.ts
//
// Resolves sector and geographic metadata for a ticker.
// Resolution order:
//   1. API metadata (Phase 3C — not yet implemented)
//   2. Cached metadata (Phase 3C — not yet implemented)
//   3. Static mapping (Phase 3B — implemented here)
//   4. "Other" fallback
//
// The analytics hook must NEVER know which source provided the data.
// Only this file needs to change when API-backed metadata is introduced.
//
// Logging prefix: [ANALYTICS]

// ─── Types ────────────────────────────────────────────────────────────────────

export type TickerMetadata = {
  sector: string;
  region: string;
  source: 'api' | 'cache' | 'static' | 'fallback';
};

// ─── Static mappings ──────────────────────────────────────────────────────────

const SECTOR_MAP: Record<string, string> = {
  // Broad market ETFs
  VOO: 'Broad Market', SPY: 'Broad Market', VTI: 'Broad Market',
  VXUS: 'Broad Market', IVV: 'Broad Market', ITOT: 'Broad Market',
  VT: 'Broad Market', SPTM: 'Broad Market', SCHB: 'Broad Market',

  // Dividend ETFs
  SCHD: 'Dividend', JEPI: 'Dividend', JEPQ: 'Dividend',
  VYM: 'Dividend', HDV: 'Dividend', DVY: 'Dividend',
  DGRO: 'Dividend', DIVO: 'Dividend', FDVV: 'Dividend',
  SPYD: 'Dividend', SDY: 'Dividend',

  // Technology ETFs & stocks
  QQQ: 'Technology', QQQM: 'Technology', XLK: 'Technology',
  VGT: 'Technology', FTEC: 'Technology', SOXX: 'Technology',
  SMH: 'Technology', ARKK: 'Technology',
  AAPL: 'Technology', MSFT: 'Technology', NVDA: 'Technology',
  GOOG: 'Technology', GOOGL: 'Technology', META: 'Technology',
  AMZN: 'Technology', TSLA: 'Technology', AMD: 'Technology',
  INTC: 'Technology', CRM: 'Technology', ORCL: 'Technology',
  AVGO: 'Technology', QCOM: 'Technology', TXN: 'Technology',
  ADBE: 'Technology', NOW: 'Technology', PLTR: 'Technology',

  // Healthcare
  XLV: 'Healthcare', VHT: 'Healthcare', IHI: 'Healthcare',
  JNJ: 'Healthcare', UNH: 'Healthcare', PFE: 'Healthcare',
  ABBV: 'Healthcare', MRK: 'Healthcare', LLY: 'Healthcare',
  ABT: 'Healthcare', TMO: 'Healthcare', DHR: 'Healthcare',

  // Financials
  XLF: 'Financials', VFH: 'Financials', KBE: 'Financials',
  JPM: 'Financials', BAC: 'Financials', WFC: 'Financials',
  GS: 'Financials', MS: 'Financials', BRK: 'Financials',
  V: 'Financials', MA: 'Financials', AXP: 'Financials',
  BLK: 'Financials', SCHW: 'Financials',

  // Industrials
  XLI: 'Industrials', VIS: 'Industrials',
  CAT: 'Industrials', DE: 'Industrials', HON: 'Industrials',
  BA: 'Industrials', RTX: 'Industrials', UPS: 'Industrials',
  GE: 'Industrials', MMM: 'Industrials',

  // Consumer
  XLY: 'Consumer', XLP: 'Consumer', VCR: 'Consumer', VDC: 'Consumer',
  COST: 'Consumer', WMT: 'Consumer', HD: 'Consumer', MCD: 'Consumer',
  NKE: 'Consumer', SBUX: 'Consumer', TGT: 'Consumer', LOW: 'Consumer',

  // Energy
  XLE: 'Energy', VDE: 'Energy', XOM: 'Energy', CVX: 'Energy',
  COP: 'Energy', SLB: 'Energy', EOG: 'Energy', MPC: 'Energy',

  // Utilities
  XLU: 'Utilities', VPU: 'Utilities', NEE: 'Utilities',
  DUK: 'Utilities', SO: 'Utilities', AEP: 'Utilities',

  // Real Estate
  XLRE: 'Real Estate', VNQ: 'Real Estate', IYR: 'Real Estate',
  O: 'Real Estate', AMT: 'Real Estate', PLD: 'Real Estate',
  SPG: 'Real Estate', VICI: 'Real Estate',

  // Communication
  XLC: 'Communication', VOX: 'Communication',
  NFLX: 'Communication', DIS: 'Communication', CMCSA: 'Communication',
  T: 'Communication', VZ: 'Communication', TMUS: 'Communication',

  // Crypto ETFs
  IBIT: 'Crypto', FBTC: 'Crypto', GBTC: 'Crypto',
  ETHA: 'Crypto', ARKB: 'Crypto',
};

const GEO_MAP: Record<string, string> = {
  // US-focused ETFs
  VOO: 'United States', SPY: 'United States', VTI: 'United States',
  IVV: 'United States', ITOT: 'United States', SPTM: 'United States',
  SCHB: 'United States', QQQ: 'United States', QQQM: 'United States',
  XLK: 'United States', XLF: 'United States', XLV: 'United States',
  XLI: 'United States', XLE: 'United States', XLU: 'United States',
  XLY: 'United States', XLP: 'United States', XLRE: 'United States',
  XLC: 'United States', VGT: 'United States', VHT: 'United States',
  VFH: 'United States', VIS: 'United States', VDE: 'United States',
  VPU: 'United States', VCR: 'United States', VDC: 'United States',
  VNQ: 'United States', VOX: 'United States',
  SCHD: 'United States', JEPI: 'United States', JEPQ: 'United States',
  VYM: 'United States', HDV: 'United States', DVY: 'United States',
  DGRO: 'United States', DIVO: 'United States', SPYD: 'United States',
  SDY: 'United States', FDVV: 'United States',
  SOXX: 'United States', SMH: 'United States', ARKK: 'United States',
  KBE: 'United States', IHI: 'United States', IYR: 'United States',

  // International / Global
  VXUS: 'International', VT: 'International',

  // Crypto
  IBIT: 'Other', FBTC: 'Other', GBTC: 'Other',
  ETHA: 'Other', ARKB: 'Other',

  // US stocks (all mapped to United States)
  AAPL: 'United States', MSFT: 'United States', NVDA: 'United States',
  GOOG: 'United States', GOOGL: 'United States', META: 'United States',
  AMZN: 'United States', TSLA: 'United States', AMD: 'United States',
  INTC: 'United States', CRM: 'United States', ORCL: 'United States',
  AVGO: 'United States', QCOM: 'United States', TXN: 'United States',
  ADBE: 'United States', NOW: 'United States', PLTR: 'United States',
  JNJ: 'United States', UNH: 'United States', PFE: 'United States',
  ABBV: 'United States', MRK: 'United States', LLY: 'United States',
  ABT: 'United States', TMO: 'United States', DHR: 'United States',
  JPM: 'United States', BAC: 'United States', WFC: 'United States',
  GS: 'United States', MS: 'United States', BRK: 'United States',
  V: 'United States', MA: 'United States', AXP: 'United States',
  BLK: 'United States', SCHW: 'United States',
  CAT: 'United States', DE: 'United States', HON: 'United States',
  BA: 'United States', RTX: 'United States', UPS: 'United States',
  GE: 'United States', MMM: 'United States',
  COST: 'United States', WMT: 'United States', HD: 'United States',
  MCD: 'United States', NKE: 'United States', SBUX: 'United States',
  TGT: 'United States', LOW: 'United States',
  XOM: 'United States', CVX: 'United States', COP: 'United States',
  SLB: 'United States', EOG: 'United States', MPC: 'United States',
  NEE: 'United States', DUK: 'United States', SO: 'United States',
  AEP: 'United States', O: 'United States', AMT: 'United States',
  PLD: 'United States', SPG: 'United States', VICI: 'United States',
  NFLX: 'United States', DIS: 'United States', CMCSA: 'United States',
  T: 'United States', VZ: 'United States', TMUS: 'United States',
};

// ─── Placeholder for future API/cache resolution (Phase 3C) ──────────────────

async function resolveFromApi(_ticker: string): Promise<TickerMetadata | null> {
  // Phase 3C: fetch from market data API and return metadata
  // Return null to fall through to cache/static
  return null;
}

async function resolveFromCache(_ticker: string): Promise<TickerMetadata | null> {
  // Phase 3C: read from AsyncStorage metadata cache
  // Return null to fall through to static
  return null;
}

function resolveFromStatic(ticker: string): TickerMetadata | null {
  const upper = ticker.toUpperCase();
  const sector = SECTOR_MAP[upper];
  const region = GEO_MAP[upper];
  if (!sector && !region) return null;
  return {
    sector: sector ?? 'Other',
    region: region ?? 'Other',
    source: 'static',
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function resolveMetadata(ticker: string): Promise<TickerMetadata> {
  const upper = ticker.toUpperCase();

  const fromApi = await resolveFromApi(upper);
  if (fromApi) return fromApi;

  const fromCache = await resolveFromCache(upper);
  if (fromCache) return fromCache;

  const fromStatic = resolveFromStatic(upper);
  if (fromStatic) return fromStatic;

  return { sector: 'Other', region: 'Other', source: 'fallback' };
}

export async function resolveMetadataBatch(
  tickers: string[]
): Promise<Record<string, TickerMetadata>> {
  const results = await Promise.all(
    tickers.map(async t => ({ ticker: t, meta: await resolveMetadata(t) }))
  );
  return Object.fromEntries(results.map(r => [r.ticker, r.meta]));
}
