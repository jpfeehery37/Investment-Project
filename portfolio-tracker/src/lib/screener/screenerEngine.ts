export type ScreenerSignal =
  | "Cheap Valuation"
  | "Beaten Down"
  | "Near 52W Low"
  | "Positive Revenue Growth"
  | "Positive Operating Margin"
  | "Possible Turnaround";

export type ScreenerRow = {
  ticker: string;
  companyName: string;
  sector: string;
  price: number | null;
  marketCap: number | null;
  pe: number | null;
  evToEbitda: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  /** % above the 52-week low: (price - low) / low * 100 */
  distanceFrom52WeekLowPct: number | null;
  return6mPct: number | null;
  revenueGrowthPct: number | null;
  operatingMarginPct: number | null;
  signals: ScreenerSignal[];
};

export type ScreenerFilters = {
  sector: string;
  minMarketCap: number;
  maxPe: number | null;
  maxEvEbitda: number | null;
  /** Show stocks within this % above the 52-week low (e.g. 20 = near the low). */
  maxDistanceFrom52WeekLowPct: number;
  requireNegative6m: boolean;
  requirePositiveRevenueGrowth: boolean;
  requirePositiveOperatingMargin: boolean;
};

export type ScreenerSortKey =
  | "cheapestValuation"
  | "biggestSelloff"
  | "closestTo52WeekLow"
  | "mostSignals"
  | "largestMarketCap";

export const DEFAULT_SCREENER_FILTERS: ScreenerFilters = {
  sector: "all",
  minMarketCap: 300_000_000,
  maxPe: 35,
  maxEvEbitda: 22,
  maxDistanceFrom52WeekLowPct: 60,
  requireNegative6m: false,
  requirePositiveRevenueGrowth: false,
  requirePositiveOperatingMargin: false,
};

function numOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function normalizePctish(v: number | null): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  if (Math.abs(v) <= 1 && v !== 0) return v * 100;
  return v;
}

export function computeSignals(row: Omit<ScreenerRow, "signals">): ScreenerSignal[] {
  const signals: ScreenerSignal[] = [];
  const pe = row.pe;
  const { price, yearHigh, yearLow, return6mPct, revenueGrowthPct, operatingMarginPct } =
    row;
  const dist = row.distanceFrom52WeekLowPct;

  if (pe != null && pe > 0 && pe < 16) {
    signals.push("Cheap Valuation");
  }

  let beaten = false;
  if (return6mPct != null && return6mPct <= -10) {
    signals.push("Beaten Down");
    beaten = true;
  } else if (
    price != null &&
    yearHigh != null &&
    yearHigh > 0 &&
    (yearHigh - price) / yearHigh >= 0.28
  ) {
    signals.push("Beaten Down");
    beaten = true;
  }

  if (dist != null && dist <= 18) {
    signals.push("Near 52W Low");
  }

  if (revenueGrowthPct != null && revenueGrowthPct > 0) {
    signals.push("Positive Revenue Growth");
  }

  if (operatingMarginPct != null && operatingMarginPct > 0) {
    signals.push("Positive Operating Margin");
  }

  const improving =
    (revenueGrowthPct != null && revenueGrowthPct > 0) ||
    (operatingMarginPct != null && operatingMarginPct > 5);
  if ((beaten || (dist != null && dist <= 22)) && improving && pe != null && pe > 0 && pe < 30) {
    signals.push("Possible Turnaround");
  }

  return signals;
}

export function applyFilters(rows: ScreenerRow[], f: ScreenerFilters): ScreenerRow[] {
  return rows.filter((r) => {
    if (f.sector !== "all" && r.sector.toLowerCase() !== f.sector.toLowerCase()) {
      return false;
    }
    const mcap = r.marketCap;
    if (mcap == null || mcap < f.minMarketCap) return false;
    if (f.maxPe != null) {
      if (r.pe == null || r.pe <= 0 || r.pe > f.maxPe) return false;
    }
    if (
      f.maxEvEbitda != null &&
      r.evToEbitda != null &&
      r.evToEbitda > 0 &&
      r.evToEbitda > f.maxEvEbitda
    ) {
      return false;
    }
    if (r.distanceFrom52WeekLowPct == null) return false;
    if (r.distanceFrom52WeekLowPct > f.maxDistanceFrom52WeekLowPct) return false;
    if (f.requireNegative6m) {
      if (r.return6mPct == null || r.return6mPct >= 0) return false;
    }
    if (f.requirePositiveRevenueGrowth) {
      if (r.revenueGrowthPct == null || r.revenueGrowthPct <= 0) return false;
    }
    if (f.requirePositiveOperatingMargin) {
      if (r.operatingMarginPct == null || r.operatingMarginPct <= 0) return false;
    }
    return true;
  });
}

function peSortKey(pe: number | null): number {
  if (pe == null || pe <= 0) return Number.POSITIVE_INFINITY;
  return pe;
}

export function sortRows(rows: ScreenerRow[], key: ScreenerSortKey): ScreenerRow[] {
  const copy = [...rows];
  switch (key) {
    case "cheapestValuation":
      copy.sort((a, b) => peSortKey(a.pe) - peSortKey(b.pe));
      break;
    case "biggestSelloff":
      copy.sort((a, b) => {
        const av = a.return6mPct ?? 0;
        const bv = b.return6mPct ?? 0;
        return av - bv;
      });
      break;
    case "closestTo52WeekLow":
      copy.sort((a, b) => {
        const av = a.distanceFrom52WeekLowPct ?? Number.POSITIVE_INFINITY;
        const bv = b.distanceFrom52WeekLowPct ?? Number.POSITIVE_INFINITY;
        return av - bv;
      });
      break;
    case "mostSignals":
      copy.sort((a, b) => b.signals.length - a.signals.length);
      break;
    case "largestMarketCap":
      copy.sort((a, b) => {
        const av = a.marketCap ?? -1;
        const bv = b.marketCap ?? -1;
        return bv - av;
      });
      break;
    default:
      break;
  }
  return copy;
}

export type ReasonLine = { text: string; kind: "valuation" | "technical" | "fundamental" | "other" };

export function buildReasonLines(row: ScreenerRow, filters: ScreenerFilters): ReasonLine[] {
  const lines: ReasonLine[] = [];
  const d = row.distanceFrom52WeekLowPct;
  if (d != null) {
    lines.push({
      text: `Trading ${d.toFixed(1)}% above its 52-week low (within your ${filters.maxDistanceFrom52WeekLowPct}% ceiling).`,
      kind: "technical",
    });
  }
  if (filters.maxPe != null && row.pe != null && row.pe > 0 && row.pe <= filters.maxPe) {
    lines.push({
      text: `P/E of ${row.pe.toFixed(1)} is at or below your maximum P/E filter (${filters.maxPe}).`,
      kind: "valuation",
    });
  }
  if (
    filters.maxEvEbitda != null &&
    row.evToEbitda != null &&
    row.evToEbitda > 0 &&
    row.evToEbitda <= filters.maxEvEbitda
  ) {
    lines.push({
      text: `EV/EBITDA of ${row.evToEbitda.toFixed(1)} is within your EV/EBITDA cap (${filters.maxEvEbitda}).`,
      kind: "valuation",
    });
  }
  if (filters.requireNegative6m && row.return6mPct != null && row.return6mPct < 0) {
    lines.push({
      text: `6-month return is negative (${row.return6mPct.toFixed(1)}%), matching your “negative 6M” filter.`,
      kind: "technical",
    });
  } else if (row.return6mPct != null && row.return6mPct < 0) {
    lines.push({
      text: `6-month return is negative (${row.return6mPct.toFixed(1)}%).`,
      kind: "technical",
    });
  }
  if (row.revenueGrowthPct != null && row.revenueGrowthPct > 0) {
    lines.push({
      text: `Revenue growth is positive (${row.revenueGrowthPct.toFixed(1)}% YoY style metric).`,
      kind: "fundamental",
    });
  }
  if (row.operatingMarginPct != null && row.operatingMarginPct > 0) {
    lines.push({
      text: `Operating margin is positive (${row.operatingMarginPct.toFixed(1)}%).`,
      kind: "fundamental",
    });
  }
  return lines;
}

export function buildBullCase(row: ScreenerRow): string[] {
  const parts: string[] = [];
  if (row.signals.includes("Cheap Valuation")) {
    parts.push("Valuation multiples screen inexpensive relative to earnings power.");
  }
  if (row.signals.includes("Near 52W Low") || row.signals.includes("Beaten Down")) {
    parts.push("Sentiment and price may already reflect a large portion of bad news.");
  }
  if (row.signals.includes("Positive Revenue Growth")) {
    parts.push("Top-line growth suggests demand is not collapsing.");
  }
  if (row.signals.includes("Positive Operating Margin")) {
    parts.push("Core operations are still profitable at the latest reported TTM snapshot.");
  }
  if (row.signals.includes("Possible Turnaround")) {
    parts.push("Improving fundamentals plus a weak tape can precede mean reversion if execution holds.");
  }
  if (parts.length === 0) {
    parts.push("Passes your current quantitative filters — drill into catalysts and balance sheet next.");
  }
  return parts;
}

export function buildBearCase(row: ScreenerRow): string[] {
  const parts: string[] = [];
  if (row.return6mPct != null && row.return6mPct < -15) {
    parts.push("Severe recent drawdowns often coincide with deteriorating fundamentals or sector headwinds.");
  }
  if (row.pe != null && row.pe > 0 && row.pe < 8) {
    parts.push("Very low P/E can signal distress, cyclical trough risk, or accounting noise — not only “cheap.”");
  }
  parts.push("Screeners ignore balance sheet leverage, liquidity, and off-balance-sheet risks.");
  parts.push("One quarter of margin recovery does not prove a durable turnaround.");
  return parts;
}

export function buildResearchQuestions(row: ScreenerRow): string[] {
  return [
    `What is driving ${row.ticker}'s margin and revenue trajectory versus peers in ${row.sector}?`,
    "Are cash flows sufficient to cover debt maturities and capex over the next 24 months?",
    "What specific catalyst (product cycle, cost program, commodity price) would re-rate the stock?",
    "What would need to go wrong for the bull case to break?",
  ];
}

/** Merge raw FMP fragments into a row + signals (pure, testable). */
export function assembleRow(input: {
  ticker: string;
  companyName: string;
  sector: string;
  price: number | null;
  marketCap: number | null;
  pe: number | null;
  evToEbitda: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  return6mPct: number | null;
  revenueGrowthPct: number | null;
  operatingMarginPct: number | null;
}): ScreenerRow {
  let distanceFrom52WeekLowPct: number | null = null;
  const { price, yearLow } = input;
  if (price != null && yearLow != null && yearLow > 0) {
    distanceFrom52WeekLowPct = ((price - yearLow) / yearLow) * 100;
  }

  const base: Omit<ScreenerRow, "signals"> = {
    ...input,
    distanceFrom52WeekLowPct,
  };
  const signals = computeSignals(base);
  return { ...base, signals };
}

export function readSixMonthReturn(change: unknown): number | null {
  const row = Array.isArray(change) ? change[0] : change;
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const raw =
    o["6M"] ??
    o["6m"] ??
    o["6MChange"] ??
    o["6Month"] ??
    o["6months"] ??
    o["6Months"];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = parseFloat(raw.replace("%", "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function readEvToEbitda(metrics: unknown): number | null {
  const row = Array.isArray(metrics) ? metrics[0] : metrics;
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const v =
    o.enterpriseValueOverEBITDATTM ??
    o.enterpriseValueOverEBITDATtm ??
    o.evToEBITDATTM ??
    o.evToEbitdaTTM;
  return numOrNull(v);
}

export function readOperatingMarginTtm(ratios: unknown): number | null {
  const row = Array.isArray(ratios) ? ratios[0] : ratios;
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  return normalizePctish(numOrNull(o.operatingProfitMarginTTM));
}

export function readRevenueGrowth(growth: unknown): number | null {
  const row = Array.isArray(growth) ? growth[0] : growth;
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const raw =
    numOrNull(o.revenueGrowth) ??
    numOrNull(o.growthRevenue) ??
    numOrNull(o.revenueGrowthYoy);
  return normalizePctish(raw);
}
