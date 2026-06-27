// services/insightsEngine.ts
//
// Pure insights engine. No React hooks, no AsyncStorage, no network calls.
// Identical inputs always produce identical outputs.
// Logging prefix: [INSIGHTS] — called by useInsights, not directly by UI.

// ─── Types ────────────────────────────────────────────────────────────────────

export type InsightSeverity = 'info' | 'positive' | 'warning' | 'alert';

export type InsightType =
  | 'CONCENTRATION'
  | 'DIVERSIFICATION'
  | 'SECTOR'
  | 'INCOME'
  | 'YIELD'
  | 'INCOME_GROWTH'
  | 'TOP_EARNER'
  | 'FIRE_PROGRESS'
  | 'BEST_PERFORMER'
  | 'WORST_PERFORMER'
  | 'ASSET_MIX'
  | 'MILESTONE'
  | 'ACHIEVEMENT';

export type InsightCard = {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  body: string;
  recommendation: string;   // clear suggested action (empty string if no action needed)
  metric: string;           // key figure displayed prominently e.g. "28.4%" or "$1,240/yr"
  priority: number;         // lower = shown first. alerts=1x, warnings=2x, positive=3x, info=4x
};

export type InsightsInput = {
  // Portfolio
  totalValue: number;
  positions: {
    ticker: string;
    assetType: string;
    value: number;
    qty: number;
    price: number;
    pct: number;            // today's price change %
  }[];

  // Analytics
  concentrationRisk: {
    status: 'Healthy' | 'Warning' | 'High Risk';
    largestHolding: string;
    largestHoldingWeight: number;
    top3Weight: number;
  };
  diversification: {
    grade: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'N/A';
    reasons: string[];
    holdingCount: number;
    sectorCount: number;
    assetClassCount: number;
    largestWeight: number;
  };
  sectorAllocation: { label: string; weight: number; value: number }[];
  topHoldings: { ticker: string; value: number; weight: number }[];

  // Dividend
  annualIncome: number;
  monthlyIncome: number;
  next12MonthsIncome: number;
  portfolioYield: number;
  yieldOnCost: number;
  byTicker: {
    ticker: string;
    annualIncome: number;
    dividendFrequency: string;
    source: string;
  }[];

  // FIRE
  fireProgressPct: number;
  fireYearsUntilTarget: number | null;
  fireTargetReached: boolean;
  fireTargetIncome: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number): string { return `${v.toFixed(1)}%`; }
function currency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

const MILESTONE_VALUES = [
  1_000, 5_000, 10_000, 25_000, 50_000, 100_000,
  250_000, 500_000, 1_000_000,
];
const INCOME_MILESTONES = [100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000];

function nearestMilestone(value: number, milestones: number[]): number | null {
  // Returns the milestone just crossed (value >= milestone)
  const crossed = milestones.filter(m => value >= m);
  return crossed.length > 0 ? crossed[crossed.length - 1] : null;
}

let _idCounter = 0;
function makeId(type: string): string { return `${type}_${++_idCounter}`; }

// ─── Individual insight generators ───────────────────────────────────────────

function concentrationInsight(input: InsightsInput): InsightCard | null {
  const { status, largestHolding, largestHoldingWeight, top3Weight } = input.concentrationRisk;
  if (status === 'Healthy') return null;

  const isHighRisk = status === 'High Risk';
  return {
    id: makeId('CONCENTRATION'),
    type: 'CONCENTRATION',
    severity: isHighRisk ? 'alert' : 'warning',
    title: isHighRisk ? 'High Concentration Risk' : 'Concentration Warning',
    body: largestHoldingWeight >= 25
      ? `${largestHolding} represents ${pct(largestHoldingWeight)} of your portfolio.`
      : `Your top 3 holdings represent ${pct(top3Weight)} of your portfolio.`,
    recommendation: `Consider adding positions in other sectors or asset classes to reduce dependence on ${largestHolding}.`,
    metric: largestHoldingWeight >= 25 ? pct(largestHoldingWeight) : pct(top3Weight),
    priority: isHighRisk ? 10 : 20,
  };
}

function diversificationInsight(input: InsightsInput): InsightCard | null {
  const { grade, holdingCount, sectorCount } = input.diversification;
  if (grade === 'N/A') return null;

  if (grade === 'Excellent' || grade === 'Good') {
    return {
      id: makeId('DIVERSIFICATION'),
      type: 'DIVERSIFICATION',
      severity: 'positive',
      title: `${grade} Diversification`,
      body: `Your portfolio spans ${holdingCount} holdings across ${sectorCount} sector${sectorCount > 1 ? 's' : ''}.`,
      recommendation: '',
      metric: grade,
      priority: 30,
    };
  }

  const isFair = grade === 'Fair';
  return {
    id: makeId('DIVERSIFICATION'),
    type: 'DIVERSIFICATION',
    severity: isFair ? 'warning' : 'alert',
    title: `${grade} Diversification`,
    body: `Only ${holdingCount} holding${holdingCount > 1 ? 's' : ''} across ${sectorCount} sector${sectorCount > 1 ? 's' : ''}. Portfolio is concentrated.`,
    recommendation: isFair
      ? 'Add 2–3 positions in underrepresented sectors to improve your score.'
      : 'Significant diversification needed. Consider broad market ETFs like VTI or VOO.',
    metric: grade,
    priority: isFair ? 21 : 11,
  };
}

function sectorInsight(input: InsightsInput): InsightCard | null {
  if (input.sectorAllocation.length === 0) return null;
  const top = input.sectorAllocation[0];
  if (top.weight < 40) return null; // Only surface if dominant

  return {
    id: makeId('SECTOR'),
    type: 'SECTOR',
    severity: top.weight >= 60 ? 'warning' : 'info',
    title: `${top.label} Dominance`,
    body: `${top.label} represents ${pct(top.weight)} of your portfolio (${currency(top.value)}).`,
    recommendation: top.weight >= 60
      ? `Consider reducing ${top.label} exposure or adding positions in other sectors.`
      : `Monitor your ${top.label} exposure — it\'s your largest sector.`,
    metric: pct(top.weight),
    priority: top.weight >= 60 ? 22 : 41,
  };
}

function incomeInsight(input: InsightsInput): InsightCard | null {
  if (input.annualIncome <= 0) return null;

  return {
    id: makeId('INCOME'),
    type: 'INCOME',
    severity: 'positive',
    title: 'Dividend Income',
    body: `Your portfolio generates ${currency(input.annualIncome)} annually (${currency(input.monthlyIncome)}/month).`,
    recommendation: '',
    metric: `${currency(input.monthlyIncome)}/mo`,
    priority: 32,
  };
}

function yieldInsight(input: InsightsInput): InsightCard | null {
  const y = input.portfolioYield;
  if (y <= 0) return null;

  const isHigh = y >= 0.06;
  const isLow = y < 0.015 && input.annualIncome > 0;

  return {
    id: makeId('YIELD'),
    type: 'YIELD',
    severity: isHigh ? 'positive' : isLow ? 'info' : 'info',
    title: isHigh ? 'High Portfolio Yield' : 'Portfolio Yield',
    body: isHigh
      ? `Your portfolio yield of ${pct(y * 100)} is above average — strong income generation.`
      : `Your portfolio yield is ${pct(y * 100)}, typical for a growth-oriented portfolio.`,
    recommendation: isLow
      ? 'Consider adding dividend-focused ETFs like SCHD or JEPI to increase yield.'
      : '',
    metric: pct(y * 100),
    priority: isHigh ? 33 : 43,
  };
}

function incomeGrowthInsight(input: InsightsInput): InsightCard | null {
  const { annualIncome, next12MonthsIncome } = input;
  if (annualIncome <= 0 || next12MonthsIncome <= 0) return null;

  const growthPct = ((next12MonthsIncome - annualIncome) / annualIncome) * 100;
  if (Math.abs(growthPct) < 1) return null; // Not meaningful

  const isGrowth = growthPct > 0;
  return {
    id: makeId('INCOME_GROWTH'),
    type: 'INCOME_GROWTH',
    severity: isGrowth ? 'positive' : 'warning',
    title: isGrowth ? 'Income Growth Projected' : 'Income Decline Projected',
    body: isGrowth
      ? `Your next 12 months income (${currency(next12MonthsIncome)}) is ${pct(Math.abs(growthPct))} higher than current annual income.`
      : `Your next 12 months income (${currency(next12MonthsIncome)}) is ${pct(Math.abs(growthPct))} lower than current annual income.`,
    recommendation: isGrowth
      ? ''
      : 'Check if any holdings have reduced or cut their dividends recently.',
    metric: `${isGrowth ? '+' : '-'}${pct(Math.abs(growthPct))}`,
    priority: isGrowth ? 34 : 23,
  };
}

function topEarnerInsight(input: InsightsInput): InsightCard | null {
  if (input.byTicker.length === 0 || input.annualIncome <= 0) return null;

  const sorted = [...input.byTicker]
    .filter(t => t.annualIncome > 0)
    .sort((a, b) => b.annualIncome - a.annualIncome);

  if (sorted.length === 0) return null;
  const top = sorted[0];
  const sharePct = (top.annualIncome / input.annualIncome) * 100;

  return {
    id: makeId('TOP_EARNER'),
    type: 'TOP_EARNER',
    severity: sharePct >= 60 ? 'warning' : 'info',
    title: 'Top Dividend Earner',
    body: `${top.ticker} generates ${currency(top.annualIncome)}/yr — ${pct(sharePct)} of your total dividend income.`,
    recommendation: sharePct >= 60
      ? `${top.ticker} generates most of your income. Add other dividend payers to reduce income concentration.`
      : '',
    metric: currency(top.annualIncome),
    priority: sharePct >= 60 ? 24 : 44,
  };
}

function fireProgressInsight(input: InsightsInput): InsightCard | null {
  const { fireProgressPct, fireYearsUntilTarget, fireTargetReached, fireTargetIncome } = input;
  if (fireProgressPct <= 0 && !fireTargetReached) return null;

  if (fireTargetReached) {
    return {
      id: makeId('FIRE_PROGRESS'),
      type: 'FIRE_PROGRESS',
      severity: 'positive',
      title: 'FIRE Target Reached! 🎉',
      body: `Your portfolio can sustain ${currency(fireTargetIncome)}/yr in retirement income.`,
      recommendation: '',
      metric: '100%',
      priority: 31,
    };
  }

  const isClose = fireProgressPct >= 75;
  const isEarly = fireProgressPct < 25;

  return {
    id: makeId('FIRE_PROGRESS'),
    type: 'FIRE_PROGRESS',
    severity: isClose ? 'positive' : 'info',
    title: isClose ? 'FIRE Goal Within Reach' : 'FIRE Progress',
    body: fireYearsUntilTarget !== null
      ? `You're ${pct(fireProgressPct)} of the way to financial independence. Projected in ${fireYearsUntilTarget} year${fireYearsUntilTarget !== 1 ? 's' : ''}.`
      : `You're ${pct(fireProgressPct)} of the way to your ${currency(fireTargetIncome)}/yr target.`,
    recommendation: isEarly
      ? 'Increase monthly contributions to accelerate your FIRE timeline.'
      : isClose
      ? 'You\'re close — maintain contributions and review your target income assumptions.'
      : '',
    metric: pct(fireProgressPct),
    priority: isClose ? 35 : 45,
  };
}

function bestPerformerInsight(input: InsightsInput): InsightCard | null {
  if (input.positions.length === 0) return null;
  const sorted = [...input.positions].filter(p => p.pct > 0).sort((a, b) => b.pct - a.pct);
  if (sorted.length === 0) return null;
  const best = sorted[0];

  return {
    id: makeId('BEST_PERFORMER'),
    type: 'BEST_PERFORMER',
    severity: 'positive',
    title: 'Best Performer Today',
    body: `${best.ticker} is up ${pct(best.pct)} today (${currency(best.value)} position).`,
    recommendation: '',
    metric: `+${pct(best.pct)}`,
    priority: 50,
  };
}

function worstPerformerInsight(input: InsightsInput): InsightCard | null {
  if (input.positions.length === 0) return null;
  const sorted = [...input.positions].filter(p => p.pct < -1).sort((a, b) => a.pct - b.pct);
  if (sorted.length === 0) return null;
  const worst = sorted[0];

  return {
    id: makeId('WORST_PERFORMER'),
    type: 'WORST_PERFORMER',
    severity: Math.abs(worst.pct) >= 5 ? 'warning' : 'info',
    title: 'Largest Decline Today',
    body: `${worst.ticker} is down ${pct(Math.abs(worst.pct))} today (${currency(worst.value)} position).`,
    recommendation: Math.abs(worst.pct) >= 5
      ? 'A significant single-day move. Check for news or earnings before reacting.'
      : '',
    metric: `-${pct(Math.abs(worst.pct))}`,
    priority: Math.abs(worst.pct) >= 5 ? 25 : 51,
  };
}

function assetMixInsight(input: InsightsInput): InsightCard | null {
  const { assetClassCount, holdingCount } = input.diversification;
  if (assetClassCount <= 0 || holdingCount === 0) return null;
  if (assetClassCount >= 2) return null; // Already diversified across classes — not notable

  return {
    id: makeId('ASSET_MIX'),
    type: 'ASSET_MIX',
    severity: 'info',
    title: 'Single Asset Class',
    body: `All ${holdingCount} position${holdingCount > 1 ? 's' : ''} are in the same asset class.`,
    recommendation: 'Consider adding exposure to other asset classes such as bonds, REITs, or international equities.',
    metric: `${assetClassCount} class`,
    priority: 46,
  };
}

function milestoneInsights(input: InsightsInput): InsightCard[] {
  const cards: InsightCard[] = [];

  // Portfolio value milestone
  const valueMilestone = nearestMilestone(input.totalValue, MILESTONE_VALUES);
  if (valueMilestone !== null) {
    // Only surface if within 5% above the milestone (recently crossed)
    if (input.totalValue <= valueMilestone * 1.05) {
      cards.push({
        id: makeId('MILESTONE'),
        type: 'MILESTONE',
        severity: 'positive',
        title: `${currency(valueMilestone)} Milestone Reached 🎯`,
        body: `Your portfolio has crossed the ${currency(valueMilestone)} mark.`,
        recommendation: '',
        metric: currency(valueMilestone),
        priority: 36,
      });
    }
  }

  // Annual income milestone
  const incomeMilestone = nearestMilestone(input.annualIncome, INCOME_MILESTONES);
  if (incomeMilestone !== null && input.annualIncome <= incomeMilestone * 1.05) {
    cards.push({
      id: makeId('MILESTONE'),
      type: 'MILESTONE',
      severity: 'positive',
      title: `${currency(incomeMilestone)}/yr Income Milestone 💰`,
      body: `Your dividend income has crossed ${currency(incomeMilestone)} per year.`,
      recommendation: '',
      metric: `${currency(incomeMilestone)}/yr`,
      priority: 37,
    });
  }

  return cards;
}

function achievementInsights(input: InsightsInput): InsightCard[] {
  const cards: InsightCard[] = [];

  // 10+ holdings achievement
  if (input.diversification.holdingCount >= 10) {
    cards.push({
      id: makeId('ACHIEVEMENT'),
      type: 'ACHIEVEMENT',
      severity: 'positive',
      title: 'Diversified Investor',
      body: `You hold ${input.diversification.holdingCount} positions — a well-spread portfolio.`,
      recommendation: '',
      metric: `${input.diversification.holdingCount} positions`,
      priority: 52,
    });
  }

  // YOC > 8% achievement
  if (input.yieldOnCost >= 0.08) {
    cards.push({
      id: makeId('ACHIEVEMENT'),
      type: 'ACHIEVEMENT',
      severity: 'positive',
      title: 'Strong Yield on Cost',
      body: `Your yield on cost is ${pct(input.yieldOnCost * 100)} — your income relative to what you paid is excellent.`,
      recommendation: '',
      metric: pct(input.yieldOnCost * 100),
      priority: 53,
    });
  }

  return cards;
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export function generateInsights(input: InsightsInput): InsightCard[] {
  _idCounter = 0; // Reset for deterministic IDs

  const cards: InsightCard[] = [];

  const push = (card: InsightCard | null) => { if (card) cards.push(card); };

  push(concentrationInsight(input));
  push(diversificationInsight(input));
  push(sectorInsight(input));
  push(incomeInsight(input));
  push(yieldInsight(input));
  push(incomeGrowthInsight(input));
  push(topEarnerInsight(input));
  push(fireProgressInsight(input));
  push(bestPerformerInsight(input));
  push(worstPerformerInsight(input));
  push(assetMixInsight(input));

  for (const card of milestoneInsights(input)) cards.push(card);
  for (const card of achievementInsights(input)) cards.push(card);

  // Sort by priority ascending (lower = shown first)
  cards.sort((a, b) => a.priority - b.priority);

  return cards;
}
