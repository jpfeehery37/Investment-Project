/**
 * Screener data: **Yahoo Finance v8 chart** (works where v7 `quote` returns 401)
 * + **SEC EDGAR** company facts (fundamentals, shares, EPS → market cap & P/E).
 *
 * Stooq is not used — their CSV endpoint now requires an API key / captcha flow.
 */

import { assembleRow, type ScreenerRow } from "@/lib/screener/screenerEngine";
import {
  SCREENER_UNIVERSE,
  UNIVERSE_SECTOR_BY_TICKER,
} from "@/lib/screener/universe";

const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const SEC_UA = process.env.SEC_CONTACT_EMAIL?.trim()
  ? `PortfolioScreener/1.0 (${process.env.SEC_CONTACT_EMAIL.trim()})`
  : "PortfolioScreener/1.0 (https://www.sec.gov/os/webmaster-faq#code-support)";

const CHART_CONCURRENCY = 5;
const CHART_BATCH_PAUSE_MS = 120;
const EDGAR_CONCURRENCY = 2;
const EDGAR_BATCH_PAUSE_MS = 280;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const yahooInit: RequestInit = {
  headers: {
    "User-Agent": YAHOO_UA,
    Accept: "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
  },
  next: { revalidate: 0 },
};

type ChartMeta = {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  longName?: string;
  shortName?: string;
};

type YahooChartBundle = {
  price: number;
  yearHigh: number;
  yearLow: number;
  companyName: string;
  return6mPct: number | null;
};

async function fetchYahooChart6mo(symbol: string): Promise<YahooChartBundle | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6mo&interval=1d`;
  const res = await fetch(url, yahooInit);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Yahoo chart HTTP ${res.status} for ${symbol}: ${text.slice(0, 100).replace(/\s+/g, " ")}`,
    );
  }
  let data: {
    chart?: {
      result?: Array<{
        meta?: ChartMeta;
        indicators?: {
          quote?: Array<{ close?: Array<number | null> }>;
          adjclose?: Array<{ adjclose?: Array<number | null> }>;
        };
      }>;
      error?: { description?: string };
    };
  };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    return null;
  }
  const err = data.chart?.error;
  if (err?.description) {
    throw new Error(`Yahoo chart: ${err.description}`);
  }
  const r0 = data.chart?.result?.[0];
  const meta = r0?.meta;
  if (!meta) return null;

  const price =
    typeof meta.regularMarketPrice === "number" && meta.regularMarketPrice > 0
      ? meta.regularMarketPrice
      : typeof meta.chartPreviousClose === "number" &&
          meta.chartPreviousClose > 0
        ? meta.chartPreviousClose
        : null;
  const yearHigh =
    typeof meta.fiftyTwoWeekHigh === "number" ? meta.fiftyTwoWeekHigh : null;
  const yearLow =
    typeof meta.fiftyTwoWeekLow === "number" ? meta.fiftyTwoWeekLow : null;
  if (price == null || yearHigh == null || yearLow == null) return null;

  const ind = r0.indicators;
  const adj =
    ind?.adjclose?.[0]?.adjclose?.filter(
      (c): c is number => typeof c === "number" && Number.isFinite(c) && c > 0,
    ) ?? [];
  const raw =
    ind?.quote?.[0]?.close?.filter(
      (c): c is number => typeof c === "number" && Number.isFinite(c) && c > 0,
    ) ?? [];
  const closes = adj.length >= 2 ? adj : raw;
  let return6mPct: number | null = null;
  if (closes.length >= 2) {
    const first = closes[0];
    const last = closes[closes.length - 1];
    if (first > 0) return6mPct = ((last - first) / first) * 100;
  }

  const companyName =
    (meta.longName || meta.shortName || symbol).trim() || symbol;

  return {
    price,
    yearHigh,
    yearLow,
    companyName,
    return6mPct,
  };
}

async function secJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": SEC_UA,
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`SEC request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

type TickerMeta = { cik: string; title: string };

async function loadTickerMetaMap(): Promise<Map<string, TickerMeta>> {
  const raw = await secJson<unknown>(
    "https://www.sec.gov/files/company_tickers.json",
  );
  const map = new Map<string, TickerMeta>();
  const ingest = (ticker: string, cik: number | string, title: string) => {
    map.set(ticker.toUpperCase(), {
      cik: String(cik),
      title: title || ticker,
    });
  };
  if (Array.isArray(raw)) {
    for (const row of raw as Array<{
      ticker?: string;
      cik_str?: number;
      title?: string;
    }>) {
      if (row.ticker && row.cik_str != null) {
        ingest(row.ticker, row.cik_str, row.title ?? "");
      }
    }
    return map;
  }
  if (raw && typeof raw === "object") {
    for (const v of Object.values(raw as Record<string, unknown>)) {
      if (
        v &&
        typeof v === "object" &&
        "ticker" in v &&
        "cik_str" in (v as object)
      ) {
        const row = v as { ticker?: string; cik_str?: number; title?: string };
        if (row.ticker && row.cik_str != null) {
          ingest(row.ticker, row.cik_str, row.title ?? "");
        }
      }
    }
  }
  return map;
}

type FactPoint = { end?: string; val?: number; fy?: number; form?: string };

function pickUsdSeries(facts: Record<string, unknown> | undefined): FactPoint[] {
  if (!facts) return [];
  const units = (facts as { units?: Record<string, FactPoint[]> }).units;
  if (!units) return [];
  for (const k of ["USD", "usd"]) {
    const arr = units[k];
    if (Array.isArray(arr) && arr.length) return arr;
  }
  return [];
}

function pickSharesSeries(facts: Record<string, unknown> | undefined): FactPoint[] {
  if (!facts) return [];
  const units = (facts as { units?: Record<string, FactPoint[]> }).units;
  if (!units) return [];
  for (const k of ["shares", "Shares", "SHARES", "pure"]) {
    const arr = units[k];
    if (Array.isArray(arr) && arr.length) return arr;
  }
  return [];
}

function latestByFy10K(series: FactPoint[]): Map<number, FactPoint> {
  const m = new Map<number, FactPoint>();
  const k = series
    .filter((p) => p.form === "10-K" && p.fy != null && p.val != null)
    .sort((a, b) => (b.end ?? "").localeCompare(a.end ?? ""));
  for (const p of k) {
    const fy = p.fy!;
    if (!m.has(fy)) m.set(fy, p);
  }
  return m;
}

type EdgarParsed = {
  revenueGrowthPct: number | null;
  operatingMarginPct: number | null;
  sharesOutstanding: number | null;
  epsDiluted: number | null;
};

function parseEdgarFundamentals(factsJson: Record<string, unknown>): EdgarParsed {
  const empty: EdgarParsed = {
    revenueGrowthPct: null,
    operatingMarginPct: null,
    sharesOutstanding: null,
    epsDiluted: null,
  };
  const facts = factsJson.facts as
    | Record<string, Record<string, { units?: Record<string, FactPoint[]> }>>
    | undefined;
  if (!facts?.["us-gaap"]) return empty;
  const gaap = facts["us-gaap"];

  const revenueTags = [
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "SalesRevenueNet",
  ];
  let revSeries: FactPoint[] = [];
  for (const tag of revenueTags) {
    const s = pickUsdSeries(gaap[tag] as Record<string, unknown> | undefined);
    if (s.length) {
      revSeries = s;
      break;
    }
  }
  const opTags = ["OperatingIncomeLoss", "OperatingIncome"];
  let opSeries: FactPoint[] = [];
  for (const tag of opTags) {
    const s = pickUsdSeries(gaap[tag] as Record<string, unknown> | undefined);
    if (s.length) {
      opSeries = s;
      break;
    }
  }

  const revByFy = latestByFy10K(revSeries);
  const opByFy = latestByFy10K(opSeries);
  const fys = [...new Set([...revByFy.keys(), ...opByFy.keys()])].sort(
    (a, b) => b - a,
  );
  const latest = fys[0];
  const prev = fys[1];
  let revenueGrowthPct: number | null = null;
  let operatingMarginPct: number | null = null;
  if (latest != null && prev != null) {
    const r1 = revByFy.get(latest)?.val;
    const r0 = revByFy.get(prev)?.val;
    if (r1 != null && r0 != null && r0 !== 0) {
      revenueGrowthPct = ((r1 - r0) / Math.abs(r0)) * 100;
    }
  }
  if (latest != null) {
    const r = revByFy.get(latest)?.val;
    const o = opByFy.get(latest)?.val;
    if (r != null && r !== 0 && o != null) {
      operatingMarginPct = (o / r) * 100;
    }
  }

  let sharesOutstanding: number | null = null;
  for (const tag of [
    "CommonStockSharesOutstanding",
    "EntityCommonStockSharesOutstanding",
  ]) {
    const s = pickSharesSeries(gaap[tag] as Record<string, unknown> | undefined);
    const flat = s
      .filter((p) => p.val != null && p.val > 0)
      .sort((a, b) => (b.end ?? "").localeCompare(a.end ?? ""));
    if (flat[0]?.val != null) {
      sharesOutstanding = flat[0].val;
      break;
    }
  }

  let epsDiluted: number | null = null;
  const epsSeries = pickUsdSeries(
    gaap.EarningsPerShareDiluted as Record<string, unknown> | undefined,
  );
  const epsK = latestByFy10K(epsSeries);
  const epsPt = latest != null ? epsK.get(latest) : undefined;
  if (epsPt?.val != null && epsPt.val > 0) epsDiluted = epsPt.val;
  if (epsDiluted == null && epsSeries.length) {
    const flat = epsSeries
      .filter((p) => p.val != null && p.val > 0)
      .sort((a, b) => (b.end ?? "").localeCompare(a.end ?? ""))[0];
    if (flat?.val != null && flat.val > 0) epsDiluted = flat.val;
  }

  return {
    revenueGrowthPct,
    operatingMarginPct,
    sharesOutstanding,
    epsDiluted,
  };
}

async function fetchEdgarForTicker(
  ticker: string,
  metaMap: Map<string, TickerMeta>,
): Promise<EdgarParsed> {
  const meta = metaMap.get(ticker.toUpperCase());
  if (!meta) {
    return {
      revenueGrowthPct: null,
      operatingMarginPct: null,
      sharesOutstanding: null,
      epsDiluted: null,
    };
  }
  const padded = meta.cik.padStart(10, "0");
  try {
    const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`;
    const json = await secJson<Record<string, unknown>>(url);
    return parseEdgarFundamentals(json);
  } catch {
    return {
      revenueGrowthPct: null,
      operatingMarginPct: null,
      sharesOutstanding: null,
      epsDiluted: null,
    };
  }
}

async function mapInBatches<T, R>(
  items: readonly T[],
  concurrency: number,
  pauseMs: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const slice = items.slice(i, i + concurrency);
    const chunk = await Promise.all(slice.map(fn));
    out.push(...chunk);
    if (i + concurrency < items.length && pauseMs > 0) {
      await sleep(pauseMs);
    }
  }
  return out;
}

export async function loadScreenerUniverse(): Promise<ScreenerRow[]> {
  const symbols = SCREENER_UNIVERSE as readonly string[];

  let metaMap = new Map<string, TickerMeta>();
  try {
    metaMap = await loadTickerMetaMap();
  } catch {
    metaMap = new Map();
  }

  const chartRows = await mapInBatches(
    symbols,
    CHART_CONCURRENCY,
    CHART_BATCH_PAUSE_MS,
    async (sym) => {
      try {
        return await fetchYahooChart6mo(sym);
      } catch {
        return null;
      }
    },
  );
  const chartByTicker = new Map<string, YahooChartBundle | null>();
  symbols.forEach((s, i) => chartByTicker.set(s.toUpperCase(), chartRows[i]));

  const edgarRows = await mapInBatches(
    symbols,
    EDGAR_CONCURRENCY,
    EDGAR_BATCH_PAUSE_MS,
    async (sym) => fetchEdgarForTicker(sym, metaMap),
  );
  const edgarByTicker = new Map<string, EdgarParsed>();
  symbols.forEach((s, i) => edgarByTicker.set(s.toUpperCase(), edgarRows[i]));

  const rows: ScreenerRow[] = [];

  for (const ticker of symbols) {
    const ch = chartByTicker.get(ticker.toUpperCase());
    if (!ch) continue;

    const ed = edgarByTicker.get(ticker.toUpperCase()) ?? {
      revenueGrowthPct: null,
      operatingMarginPct: null,
      sharesOutstanding: null,
      epsDiluted: null,
    };

    const meta = metaMap.get(ticker.toUpperCase());
    const companyName =
      meta?.title && meta.title.length > 2 ? meta.title : ch.companyName;
    const sector =
      UNIVERSE_SECTOR_BY_TICKER[ticker.toUpperCase()] ?? "Unknown";

    let marketCap: number | null = null;
    if (
      ed.sharesOutstanding != null &&
      ed.sharesOutstanding > 0 &&
      ch.price > 0
    ) {
      marketCap = ch.price * ed.sharesOutstanding;
    }

    let pe: number | null = null;
    if (ed.epsDiluted != null && ed.epsDiluted > 0 && ch.price > 0) {
      pe = ch.price / ed.epsDiluted;
    }

    rows.push(
      assembleRow({
        ticker,
        companyName,
        sector,
        price: ch.price,
        marketCap,
        pe,
        evToEbitda: null,
        yearHigh: ch.yearHigh,
        yearLow: ch.yearLow,
        return6mPct: ch.return6mPct,
        revenueGrowthPct: ed.revenueGrowthPct,
        operatingMarginPct: ed.operatingMarginPct,
      }),
    );
  }

  if (rows.length === 0) {
    throw new Error(
      "No Yahoo chart data returned (empty or blocked for every symbol). v7 quote often 401 on servers, but if v8 chart also fails from your host, use a paid data API or run locally.",
    );
  }

  return rows;
}

export function uniqueSectors(rows: ScreenerRow[]): string[] {
  return [...new Set(rows.map((r) => r.sector))].sort((a, b) =>
    a.localeCompare(b),
  );
}
