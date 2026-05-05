import { PortfolioTable } from "@/components/PortfolioTable";
import {
  POSITIONS,
  enrichPosition,
} from "@/lib/portfolio";
import { fetchYahooPrices } from "@/lib/quotes";

export const revalidate = 60;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pct = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function plBlockClass(value: number): string {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-rose-400";
  return "text-zinc-300";
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return "—";
  return money.format(value);
}

function formatPercentRatio(value: number | null | undefined): string {
  if (value == null) return "—";
  return pct.format(value / 100);
}

export default async function Home() {
  const tickers = POSITIONS.map((p) => p.ticker);
  const prices = await fetchYahooPrices(tickers);
  const rows = POSITIONS.map((p) =>
    enrichPosition(p, prices[p.ticker] ?? null),
  );

  const totalCost = rows.reduce((s, r) => s + r.costTotal, 0);
  const hasAllPrices = rows.every((r) => r.currentValue != null);
  const totalValue = hasAllPrices
    ? rows.reduce((s, r) => s + (r.currentValue as number), 0)
    : null;
  const totalPl =
    totalValue != null ? totalValue - totalCost : null;
  const totalPlPct =
    totalPl != null && totalCost !== 0 ? (totalPl / totalCost) * 100 : null;

  const asOf = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Portfolio
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Holdings overview
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Live prices from Yahoo Finance (same data source as yfinance), cached
          for one minute.
        </p>
      </header>

      <section className="mb-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900/90 to-zinc-950 p-5 shadow-lg shadow-black/30">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Total value
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-white">
            {formatMoney(totalValue)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900/90 to-zinc-950 p-5 shadow-lg shadow-black/30">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Total P&amp;L
          </p>
          <p
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight ${totalPl != null ? plBlockClass(totalPl) : "text-zinc-500"}`}
          >
            {formatMoney(totalPl)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900/90 to-zinc-950 p-5 shadow-lg shadow-black/30">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Total return
          </p>
          <p
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight ${totalPlPct != null ? plBlockClass(totalPlPct) : "text-zinc-500"}`}
          >
            {formatPercentRatio(totalPlPct)}
          </p>
        </div>
      </section>

      <PortfolioTable rows={rows} asOf={asOf} />
    </main>
  );
}
