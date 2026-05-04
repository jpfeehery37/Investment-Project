import type { EnrichedPosition } from "@/lib/portfolio";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const moneyFlexible = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const pct = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const sharesFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

function plClass(value: number | null): string {
  if (value == null) return "text-zinc-500";
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-rose-400";
  return "text-zinc-300";
}

function formatPct(ratio: number | null): string {
  if (ratio == null) return "—";
  return pct.format(ratio / 100);
}

type Props = {
  rows: EnrichedPosition[];
  asOf: string;
};

export function PortfolioTable({ rows, asOf }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 shadow-xl shadow-black/40 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <h2 className="text-sm font-medium tracking-wide text-zinc-400">
          Positions
        </h2>
        <span className="text-xs text-zinc-500">As of {asOf}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="px-5 py-3">Ticker</th>
              <th className="px-5 py-3 text-right">Shares</th>
              <th className="px-5 py-3 text-right">Cost basis</th>
              <th className="px-5 py-3 text-right">Price</th>
              <th className="px-5 py-3 text-right">Value</th>
              <th className="px-5 py-3 text-right">P&amp;L $</th>
              <th className="px-5 py-3 text-right">P&amp;L %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {rows.map((r) => (
              <tr
                key={r.ticker}
                className="transition-colors hover:bg-zinc-800/30"
              >
                <td className="px-5 py-3.5 font-mono font-semibold text-zinc-100">
                  {r.ticker}
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-zinc-300">
                  {sharesFmt.format(r.shares)}
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-zinc-300">
                  {money.format(r.costBasisPerShare)}
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-zinc-200">
                  {r.currentPrice != null
                    ? moneyFlexible.format(r.currentPrice)
                    : "—"}
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums font-medium text-zinc-100">
                  {r.currentValue != null ? money.format(r.currentValue) : "—"}
                </td>
                <td
                  className={`px-5 py-3.5 text-right tabular-nums font-medium ${plClass(r.plDollars)}`}
                >
                  {r.plDollars != null ? money.format(r.plDollars) : "—"}
                </td>
                <td
                  className={`px-5 py-3.5 text-right tabular-nums font-medium ${plClass(r.plDollars)}`}
                >
                  {formatPct(r.plPercent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
