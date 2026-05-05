"use client";

import type { ScreenerFilters, ScreenerRow } from "@/lib/screener/screenerEngine";
import {
  buildBearCase,
  buildBullCase,
  buildReasonLines,
  buildResearchQuestions,
} from "@/lib/screener/screenerEngine";
import { upsertWatchlistEntry } from "@/lib/screener/watchlistStorage";
import { useState } from "react";

type Props = {
  row: ScreenerRow | null;
  filters: ScreenerFilters;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

function fmtMoney(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "N/A";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number | null, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "N/A";
  return `${n.toFixed(digits)}%`;
}

export function StockDetailDrawer({
  row,
  filters,
  open,
  onClose,
  onSaved,
}: Props) {
  const [notes, setNotes] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  if (!open || !row) return null;

  const reasons = buildReasonLines(row, filters);
  const reasonSummary = reasons
    .filter((r) => r.kind !== "other")
    .slice(0, 5)
    .map((r) => r.text)
    .join(" ");
  const bull = buildBullCase(row);
  const bear = buildBearCase(row);
  const questions = buildResearchQuestions(row);

  const handleSave = () => {
    upsertWatchlistEntry({
      ticker: row.ticker,
      companyName: row.companyName,
      dateAdded: new Date().toISOString(),
      signals: row.signals,
      reason: reasonSummary || reasons.map((r) => r.text).join(" "),
      notes: notes.trim(),
    });
    setSavedFlash(true);
    onSaved();
    setTimeout(() => setSavedFlash(false), 2000);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close drawer"
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <p className="font-mono text-lg font-semibold text-white">
              {row.ticker}
            </p>
            <p className="text-sm text-zinc-400">{row.companyName}</p>
            <p className="mt-1 text-xs text-zinc-500">{row.sector}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Why this appeared
            </h3>
            <ul className="mt-2 space-y-2 text-sm text-zinc-300">
              {reasons.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Filters &amp; signals matched
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {row.signals.map((s) => (
                <span
                  key={s}
                  className="rounded-md border border-emerald-900/50 bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-200/90"
                >
                  {s}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Interpretation is rule-based from Yahoo chart + SEC data, not investment
              advice.
            </p>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Key metrics
            </h3>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
                <dt className="text-xs text-zinc-500">Price</dt>
                <dd className="font-mono text-zinc-100">{fmtMoney(row.price)}</dd>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
                <dt className="text-xs text-zinc-500">Market cap</dt>
                <dd className="font-mono text-zinc-100">
                  {fmtMoney(row.marketCap)}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
                <dt className="text-xs text-zinc-500">P/E</dt>
                <dd className="font-mono text-zinc-100">
                  {row.pe != null && row.pe > 0 ? row.pe.toFixed(2) : "N/A"}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
                <dt className="text-xs text-zinc-500">EV/EBITDA</dt>
                <dd className="font-mono text-zinc-100">
                  {row.evToEbitda != null && row.evToEbitda > 0
                    ? row.evToEbitda.toFixed(2)
                    : "N/A"}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
                <dt className="text-xs text-zinc-500">52W range</dt>
                <dd className="font-mono text-xs text-zinc-100">
                  {fmtMoney(row.yearLow)} – {fmtMoney(row.yearHigh)}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
                <dt className="text-xs text-zinc-500">Above 52W low</dt>
                <dd className="font-mono text-zinc-100">
                  {fmtPct(row.distanceFrom52WeekLowPct)}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
                <dt className="text-xs text-zinc-500">6M return</dt>
                <dd className="font-mono text-zinc-100">
                  {fmtPct(row.return6mPct)}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
                <dt className="text-xs text-zinc-500">Rev. growth</dt>
                <dd className="font-mono text-zinc-100">
                  {fmtPct(row.revenueGrowthPct)}
                </dd>
              </div>
              <div className="col-span-2 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
                <dt className="text-xs text-zinc-500">Operating margin</dt>
                <dd className="font-mono text-zinc-100">
                  {fmtPct(row.operatingMarginPct)}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-600/90">
              Bull case starter
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-zinc-300">
              {bull.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-500/90">
              Bear case starter
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-zinc-300">
              {bear.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Questions to research next
            </h3>
            <ul className="mt-2 list-decimal space-y-1 pl-4 text-sm text-zinc-300">
              {questions.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </section>

          <section>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Thesis, catalysts, risks…"
              className="mt-2 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-700 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </section>
        </div>

        <div className="border-t border-zinc-800 p-4">
          <button
            type="button"
            onClick={handleSave}
            className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-500"
          >
            {savedFlash ? "Saved to watchlist" : "Save to Watchlist"}
          </button>
        </div>
      </aside>
    </>
  );
}
