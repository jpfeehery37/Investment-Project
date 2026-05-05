export type PositionSector = "Technology" | "Energy" | "ETF/Diversified";

export type PositionInput = {
  ticker: string;
  name: string;
  shares: number;
  /** Average cost per share (USD) */
  costBasisPerShare: number;
  sector: PositionSector;
};

export const POSITIONS: readonly PositionInput[] = [
  {
    ticker: "RIG",
    name: "Transocean",
    shares: 80,
    costBasisPerShare: 3.32,
    sector: "Energy",
  },
  {
    ticker: "NVDA",
    name: "NVIDIA",
    shares: 1.728,
    costBasisPerShare: 180.89,
    sector: "Technology",
  },
  {
    ticker: "INTC",
    name: "Intel",
    shares: 8.5,
    costBasisPerShare: 32.52,
    sector: "Technology",
  },
  {
    ticker: "SPY",
    name: "SPDR S&P 500 ETF",
    shares: 1.06,
    costBasisPerShare: 648.4,
    sector: "ETF/Diversified",
  },
  {
    ticker: "AMZN",
    name: "Amazon",
    shares: 1.5,
    costBasisPerShare: 231.43,
    sector: "Technology",
  },
  {
    ticker: "ABAT",
    name: "American Battery",
    shares: 75,
    costBasisPerShare: 2.98,
    sector: "Technology",
  },
] as const;

export type EnrichedPosition = PositionInput & {
  costTotal: number;
  currentPrice: number | null;
  currentValue: number | null;
  plDollars: number | null;
  plPercent: number | null;
};

export function enrichPosition(
  p: PositionInput,
  currentPrice: number | null,
): EnrichedPosition {
  const costTotal = p.shares * p.costBasisPerShare;
  if (currentPrice == null || !Number.isFinite(currentPrice)) {
    return {
      ...p,
      costTotal,
      currentPrice: null,
      currentValue: null,
      plDollars: null,
      plPercent: null,
    };
  }
  const currentValue = p.shares * currentPrice;
  const plDollars = currentValue - costTotal;
  const plPercent = costTotal !== 0 ? (plDollars / costTotal) * 100 : null;
  return {
    ...p,
    costTotal,
    currentPrice,
    currentValue,
    plDollars,
    plPercent,
  };
}
