import type { EnrichedPosition, PositionSector } from "@/lib/portfolio";

export const MAX_POSITION_WEIGHT_PCT = 25;

const SECTOR_GROUP_LABEL: Record<PositionSector, string> = {
  Technology: "Tech",
  Energy: "Energy",
  "ETF/Diversified": "ETF",
};

/** Short labels for sector exposure UI */
export function sectorGroupLabel(sector: PositionSector): string {
  return SECTOR_GROUP_LABEL[sector];
}

export type PositionSizingRow = {
  ticker: string;
  sector: PositionSector;
  currentValue: number;
  weightPct: number;
};

export type SectorExposureRow = {
  groupLabel: string;
  valueUsd: number;
  pct: number;
};

export type PortfolioRiskStats = {
  positionCount: number;
  largestTicker: string;
  largestPct: number;
  topSectorLabel: string;
  topSectorPct: number;
  avgPositionValueUsd: number;
};

export function buildRiskSnapshot(
  rows: EnrichedPosition[],
  totalValue: number,
): {
  positionRows: PositionSizingRow[];
  sectorRows: SectorExposureRow[];
  stats: PortfolioRiskStats;
} {
  const valued = rows.filter(
    (r): r is EnrichedPosition & { currentValue: number } =>
      r.currentValue != null && Number.isFinite(r.currentValue),
  );

  const positionRows: PositionSizingRow[] = valued.map((r) => ({
    ticker: r.ticker,
    sector: r.sector,
    currentValue: r.currentValue,
    weightPct: (r.currentValue / totalValue) * 100,
  }));

  positionRows.sort((a, b) => b.weightPct - a.weightPct);

  const sectorMap = new Map<string, { valueUsd: number; groupLabel: string }>();
  for (const r of valued) {
    const groupLabel = sectorGroupLabel(r.sector);
    const prev = sectorMap.get(groupLabel);
    const add = r.currentValue;
    if (prev) {
      prev.valueUsd += add;
    } else {
      sectorMap.set(groupLabel, { valueUsd: add, groupLabel });
    }
  }

  const sectorRows: SectorExposureRow[] = [...sectorMap.values()]
    .map(({ groupLabel, valueUsd }) => ({
      groupLabel,
      valueUsd,
      pct: (valueUsd / totalValue) * 100,
    }))
    .sort((a, b) => b.pct - a.pct);

  const largest =
    positionRows.length === 0
      ? null
      : positionRows.reduce((a, b) => (a.weightPct >= b.weightPct ? a : b));

  const topSector = sectorRows[0];
  const n = positionRows.length;
  const avgPositionValueUsd = n > 0 ? totalValue / n : 0;

  const stats: PortfolioRiskStats = {
    positionCount: n,
    largestTicker: largest?.ticker ?? "—",
    largestPct: largest?.weightPct ?? 0,
    topSectorLabel: topSector?.groupLabel ?? "—",
    topSectorPct: topSector?.pct ?? 0,
    avgPositionValueUsd,
  };

  return { positionRows, sectorRows, stats };
}
