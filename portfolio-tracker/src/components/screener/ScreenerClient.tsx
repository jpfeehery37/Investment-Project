"use client";

import { StockDetailDrawer } from "@/components/screener/StockDetailDrawer";
import {
  applyFilters,
  DEFAULT_SCREENER_FILTERS,
  sortRows,
  type ScreenerFilters,
  type ScreenerRow,
  type ScreenerSortKey,
} from "@/lib/screener/screenerEngine";
import { useCallback, useMemo, useState, useEffect } from "react";

type ApiResponse = {
  rows: ScreenerRow[];
  sectors: string[];
  fetchedAt: string;
};

type ApiErrorBody = {
  error: string;
  code?: string;
  status?: number;
};

function formatMcap(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "N/A";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

function formatPrice(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatPct(n: number | null, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "N/A";
  return `${n.toFixed(digits)}%`;
}

function TableSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-10 animate-pulse rounded-lg bg-zinc-800/60"
          style={{ opacity: 1 - i * 0.08 }}
        />
      ))}
    </div>
  );
}

const SORT_OPTIONS: { value: ScreenerSortKey; label: string }[] = [
  { value: "cheapestValuation", label: "Cheapest valuation (P/E)" },
  { value: "biggestSelloff", label: "Biggest selloff (6M)" },
  { value: "closestTo52WeekLow", label: "Closest to 52-week low" },
  { value: "mostSignals", label: "Most signals" },
  { value: "largestMarketCap", label: "Largest market cap" },
];

export function ScreenerClient() {
  const [rawRows, setRawRows] = useState<ScreenerRow[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limitCode, setLimitCode] = useState(false);

  const [filters, setFilters] = useState<ScreenerFilters>(DEFAULT_SCREENER_FILTERS);
  const [sortKey, setSortKey] = useState<ScreenerSortKey>("mostSignals");
  const [drawerRow, setDrawerRow] = useState<ScreenerRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLimitCode(false);
    try {
      const res = await fetch("/api/screener", { cache: "no-store" });
      const body = (await res.json()) as ApiResponse & ApiErrorBody;
      if (!res.ok) {
        setRawRows([]);
        setSectors([]);
        setFetchedAt(null);
        setError(body.error || "Request failed");
        setLimitCode(body.code === "RATE_LIMIT" || res.status === 429);
        return;
      }
      setRawRows(body.rows ?? []);
      setSectors(body.sectors ?? []);
      setFetchedAt(body.fetchedAt ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setRawRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredSorted = useMemo(() => {
    const f = applyFilters(rawRows, filters);
    return sortRows(f, sortKey);
  }, [rawRows, filters, sortKey]);

  const maxPeInput =
    filters.maxPe == null ? "" : String(filters.maxPe);
  const maxEvInput =
    filters.maxEvEbitda == null ? "" : String(filters.maxEvEbitda);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-zinc-800/80 pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500/90">
          Research terminal
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Stock Screener
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Find mispriced companies with improving fundamentals.           Live data from Yahoo Finance v8 chart (prices / 52w / 6M) and SEC EDGAR
          (fundamentals, shares, EPS). No paid API keys — avoids v7 quote, which
          often returns 401 from cloud servers.
        </p>
        {fetchedAt && !loading && (
          <p className="mt-3 text-xs text-zinc-600">
            Universe refreshed {new Date(fetchedAt).toLocaleString()}
          </p>
        )}
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
        >
          Refresh data
        </button>
      </div>

      {loading && (
        <div className="space-y-6">
          <div className="h-32 animate-pulse rounded-xl bg-zinc-900/50" />
          <TableSkeleton />
        </div>
      )}

      {!loading && error && (
        <div
          className={`rounded-xl border px-5 py-6 ${
            limitCode
              ? "border-amber-800/60 bg-amber-950/25 text-amber-100/90"
              : "border-rose-900/50 bg-rose-950/20 text-rose-100/90"
          }`}
        >
          <p className="text-sm font-semibold">
            {limitCode ? "API limit" : "Could not load screener"}
          </p>
          <p className="mt-2 text-sm opacity-90">{error}</p>
          {!limitCode && (
            <p className="mt-3 text-xs text-zinc-500">
              If this persists, wait and retry — Yahoo or SEC may be blocking or
              timing out. Optional: set{" "}
              <code className="rounded bg-zinc-900 px-1 py-0.5 text-zinc-300">
                SEC_CONTACT_EMAIL
              </code>{" "}
              in{" "}
              <code className="rounded bg-zinc-900 px-1 py-0.5 text-zinc-300">
                .env.local
              </code>{" "}
              for friendlier SEC access.
            </p>
          )}
        </div>
      )}

      {!loading && !error && (
        <>
          <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/35 p-5 shadow-xl shadow-black/30">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Filters
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-sm">
                <span className="text-zinc-400">Sector</span>
                <select
                  value={filters.sector}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, sector: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-sky-700 focus:outline-none focus:ring-1 focus:ring-sky-600"
                >
                  <option value="all">All sectors</option>
                  {sectors.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-400">Min market cap (USD)</span>
                <input
                  type="number"
                  value={filters.minMarketCap}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      minMarketCap: Number(e.target.value) || 0,
                    }))
                  }
                  className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-sky-700 focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-400">Max P/E (empty = no max)</span>
                <input
                  type="number"
                  value={maxPeInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFilters((f) => ({
                      ...f,
                      maxPe: v === "" ? null : Number(v),
                    }));
                  }}
                  placeholder="e.g. 25"
                  className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-sky-700 focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-400">
                  Max EV/EBITDA (empty = no max)
                </span>
                <input
                  type="number"
                  value={maxEvInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFilters((f) => ({
                      ...f,
                      maxEvEbitda: v === "" ? null : Number(v),
                    }));
                  }}
                  placeholder="e.g. 15"
                  className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-sky-700 focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-400">
                  Max % above 52-week low
                </span>
                <input
                  type="number"
                  value={filters.maxDistanceFrom52WeekLowPct}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      maxDistanceFrom52WeekLowPct:
                        Number(e.target.value) || 0,
                    }))
                  }
                  className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-sky-700 focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </label>
              <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={filters.requireNegative6m}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        requireNegative6m: e.target.checked,
                      }))
                    }
                    className="rounded border-zinc-600 bg-zinc-900 text-sky-600 focus:ring-sky-600"
                  />
                  Negative 6-month return only
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={filters.requirePositiveRevenueGrowth}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        requirePositiveRevenueGrowth: e.target.checked,
                      }))
                    }
                    className="rounded border-zinc-600 bg-zinc-900 text-sky-600 focus:ring-sky-600"
                  />
                  Positive revenue growth only
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={filters.requirePositiveOperatingMargin}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        requirePositiveOperatingMargin: e.target.checked,
                      }))
                    }
                    className="rounded border-zinc-600 bg-zinc-900 text-sky-600 focus:ring-sky-600"
                  />
                  Positive operating margin only
                </label>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="text-sm text-zinc-400">
                Sort by{" "}
                <select
                  value={sortKey}
                  onChange={(e) =>
                    setSortKey(e.target.value as ScreenerSortKey)
                  }
                  className="ml-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 focus:border-sky-700 focus:outline-none focus:ring-1 focus:ring-sky-600"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_SCREENER_FILTERS)}
                className="text-xs font-medium text-sky-400/90 hover:text-sky-300"
              >
                Reset filters
              </button>
            </div>
          </section>

          {filteredSorted.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/25 px-6 py-16 text-center">
              <p className="text-sm font-medium text-zinc-300">
                No matches found. Try loosening your filters.
              </p>
              <p className="mt-2 text-xs text-zinc-600">
                {rawRows.length} loaded from Yahoo chart + SEC before filters.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30 shadow-xl shadow-black/40">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 sm:px-5">
                <h2 className="text-sm font-medium text-zinc-400">
                  Results{" "}
                  <span className="font-mono text-zinc-200">
                    ({filteredSorted.length})
                  </span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/90 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      <th className="px-4 py-3">Ticker</th>
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Sector</th>
                      <th className="px-4 py-3 text-right">Price</th>
                      <th className="px-4 py-3 text-right">Mkt cap</th>
                      <th className="px-4 py-3 text-right">P/E</th>
                      <th className="px-4 py-3 text-right">EV/EBITDA</th>
                      <th className="px-4 py-3 text-right">52w low +</th>
                      <th className="px-4 py-3 text-right">6M</th>
                      <th className="px-4 py-3 text-right">Rev gr.</th>
                      <th className="px-4 py-3 text-right">Op. mgn</th>
                      <th className="px-4 py-3">Signals</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {filteredSorted.map((r) => (
                      <tr
                        key={r.ticker}
                        role="button"
                        tabIndex={0}
                        onClick={() => setDrawerRow(r)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDrawerRow(r);
                          }
                        }}
                        className="cursor-pointer transition-colors hover:bg-sky-950/20"
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-white">
                          {r.ticker}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-zinc-300">
                          {r.companyName}
                        </td>
                        <td className="px-4 py-3 text-zinc-400">{r.sector}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                          {formatPrice(r.price)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                          {formatMcap(r.marketCap)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                          {r.pe != null && r.pe > 0
                            ? r.pe.toFixed(2)
                            : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                          {r.evToEbitda != null && r.evToEbitda > 0
                            ? r.evToEbitda.toFixed(2)
                            : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                          {formatPct(r.distanceFrom52WeekLowPct)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                          {formatPct(r.return6mPct)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                          {formatPct(r.revenueGrowthPct)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                          {formatPct(r.operatingMarginPct)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex max-w-[220px] flex-wrap gap-1">
                            {r.signals.map((s) => (
                              <span
                                key={s}
                                className="rounded border border-zinc-700/80 bg-zinc-800/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-300"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <StockDetailDrawer
        row={drawerRow}
        filters={filters}
        open={drawerRow != null}
        onClose={() => setDrawerRow(null)}
        onSaved={() => {}}
      />
    </main>
  );
}
