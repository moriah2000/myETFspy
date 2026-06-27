// constants/portfolioAnalytics.ts
//
// All thresholds and scoring parameters for Phase 3B analytics.
// Never hardcode these values in hooks or UI.

export const CONCENTRATION_LIMITS = {
  singleHoldingWarning: 25,   // % — single position triggers Warning
  singleHoldingHighRisk: 40,  // % — single position triggers High Risk
  top3Warning: 60,            // % — top 3 combined triggers Warning
  top3HighRisk: 80,           // % — top 3 combined triggers High Risk
} as const;

export const DIVERSIFICATION_THRESHOLDS = {
  // Holdings count
  holdingsExcellent: 15,
  holdingsGood: 8,
  holdingsFair: 4,

  // Largest position weight (%)
  largestExcellent: 20,
  largestGood: 30,
  largestFair: 45,

  // Sector count
  sectorsExcellent: 5,
  sectorsGood: 3,
  sectorsFair: 2,

  // Asset class count
  assetClassesGood: 2,
} as const;

export const TOP_HOLDINGS_COUNT = 10;
export const CALENDAR_MONTHS_FORWARD = 3;
