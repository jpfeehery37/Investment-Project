/**
 * Aggregates FMP stable endpoints into screener rows. Server-only.
 */

import { fmpFetchJson } from "@/lib/fmp/client";
import type { FmpBatchQuote, FmpProfile } from "@/lib/fmp/types";
import {
  assembleRow,
  readEvToEbitda,
  readOperatingMarginTtm,
  readRevenueGrowth,
  readSixMonthReturn,
  type ScreenerRow,
} from "@/lib/screener/screenerEngine";
import { SCREENER_UNIVERSE } from "@/lib/screener/universe";

const QUOTE_CHUNK = 40;
/** Parallel symbols per wave — lower if you hit FMP rate limits on a free plan. */
const ENRICH_CONCURRENCY = 2;

async function fetchBatchQuotes(
  symbols: readonly string[],
): Promise<Map<string, FmpBatchQuote>> {
  const map = new Map<string, FmpBatchQuote>();
  for (let i = 0; i < symbols.length; i += QUOTE_CHUNK) {
    const part = symbols.slice(i, i + QUOTE_CHUNK).join(",");
    const data = await fmpFetchJson<unknown>("/batch-quote", { symbols: part });
    const arr = Array.isArray(data) ? data : [];
    for (const item of arr) {
      const q = item as FmpBatchQuote;
      const sym = q.symbol?.toUpperCase();
      if (sym) map.set(sym, q);
    }
  }
  return map;
}

async function enrichSymbol(
  ticker: string,
  quote: FmpBatchQuote,
): Promise<ScreenerRow> {
  const [profileData, metrics, ratios, priceChg, growth] = await Promise.all([
    fmpFetchJson<FmpProfile[] | FmpProfile | null>("/profile", {
      symbol: ticker,
    }),
    fmpFetchJson<unknown>("/key-metrics-ttm", { symbol: ticker }),
    fmpFetchJson<unknown>("/ratios-ttm", { symbol: ticker }),
    fmpFetchJson<unknown>("/stock-price-change", { symbol: ticker }),
    fmpFetchJson<unknown>("/financial-growth", {
      symbol: ticker,
      period: "annual",
      limit: "3",
    }),
  ]);

  const profileRow = Array.isArray(profileData)
    ? profileData[0]
    : profileData ?? undefined;
  const companyName =
    quote.name ??
    profileRow?.companyName ??
    profileRow?.symbol ??
    ticker;
  const sector = profileRow?.sector?.trim() || "Unknown";
  const price =
    typeof quote.price === "number"
      ? quote.price
      : typeof profileRow?.price === "number"
        ? profileRow.price
        : null;
  const marketCap =
    typeof quote.marketCap === "number"
      ? quote.marketCap
      : typeof profileRow?.mktCap === "number"
        ? profileRow.mktCap
        : null;
  const pe =
    typeof quote.pe === "number" && quote.pe > 0
      ? quote.pe
      : null;
  const yearHigh =
    typeof quote.yearHigh === "number" ? quote.yearHigh : null;
  const yearLow =
    typeof quote.yearLow === "number" ? quote.yearLow : null;

  const evToEbitda = readEvToEbitda(metrics);
  const operatingMarginPct = readOperatingMarginTtm(ratios);
  const revenueGrowthPct = readRevenueGrowth(growth);
  const return6mPct = readSixMonthReturn(priceChg);

  return assembleRow({
    ticker,
    companyName,
    sector,
    price,
    marketCap,
    pe,
    evToEbitda,
    yearHigh,
    yearLow,
    return6mPct,
    revenueGrowthPct,
    operatingMarginPct,
  });
}

function rowFromQuoteOnly(ticker: string, quote: FmpBatchQuote): ScreenerRow {
  return assembleRow({
    ticker,
    companyName: quote.name ?? ticker,
    sector: "Unknown",
    price: typeof quote.price === "number" ? quote.price : null,
    marketCap: typeof quote.marketCap === "number" ? quote.marketCap : null,
    pe: typeof quote.pe === "number" && quote.pe > 0 ? quote.pe : null,
    evToEbitda: null,
    yearHigh: typeof quote.yearHigh === "number" ? quote.yearHigh : null,
    yearLow: typeof quote.yearLow === "number" ? quote.yearLow : null,
    return6mPct: null,
    revenueGrowthPct: null,
    operatingMarginPct: null,
  });
}

export async function loadScreenerUniverse(): Promise<ScreenerRow[]> {
  const symbols = SCREENER_UNIVERSE as readonly string[];
  const quoteMap = await fetchBatchQuotes(symbols);
  const rows: ScreenerRow[] = [];

  for (let i = 0; i < symbols.length; i += ENRICH_CONCURRENCY) {
    const slice = symbols.slice(i, i + ENRICH_CONCURRENCY);
    const chunk = await Promise.all(
      slice.map(async (ticker) => {
        const q = quoteMap.get(ticker.toUpperCase());
        if (!q || typeof q.price !== "number" || !Number.isFinite(q.price)) {
          return null;
        }
        try {
          return await enrichSymbol(ticker, q);
        } catch {
          return rowFromQuoteOnly(ticker, q);
        }
      }),
    );
    for (const c of chunk) {
      if (c != null) rows.push(c);
    }
  }

  return rows;
}

export function uniqueSectors(rows: ScreenerRow[]): string[] {
  return [...new Set(rows.map((r) => r.sector))].sort((a, b) =>
    a.localeCompare(b),
  );
}
