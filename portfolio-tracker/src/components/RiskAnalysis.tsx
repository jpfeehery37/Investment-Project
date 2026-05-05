import {
  buildRiskSnapshot,
  MAX_POSITION_WEIGHT_PCT,
  sectorGroupLabel,
} from "@/lib/risk";
import type { EnrichedPosition } from "@/lib/portfolio";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

type Props = {
  rows: EnrichedPosition[];
  totalValue: number | null;
};

export function RiskAnalysis({ rows, totalValue }: Props) {
  if (totalValue == null || totalValue <= 0) {
    return (
      <section className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-8 text-center text-sm text-zinc-500 shadow-xl shadow-black/40">
        <h2 className="text-sm font-medium tracking-wide text-zinc-400">
          Risk analysis
        </h2>
        <p className="mt-2">
          Risk metrics need a full set of live prices. Refresh once quotes
          load.
        </p>
      </section>
    );
  }

  const { positionRows, sectorRows, stats } = buildRiskSnapshot(
    rows,
    totalValue,
  );

  return (
    <section className="mb-10 space-y-6">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-zinc-500">
          Risk analysis
        </h2>
        <p className="mt-1 text-xs text-zinc-600">
          Based on current market values
        </p>
      </div>

      <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm leading-relaxed text-amber-100/90">
        <span className="font-semibold text-amber-200/95">Guideline: </span>
        Keep any single position under{" "}
        <span className="font-mono font-semibold text-amber-100">
          {MAX_POSITION_WEIGHT_PCT}%
        </span>{" "}
        of the portfolio to limit concentration risk. Positions above that
        threshold are highlighted.
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-lg shadow-black/30">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Position sizing
          </h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 pr-3">Ticker</th>
                  <th className="pb-2 pr-3">Sector</th>
                  <th className="pb-2 pr-3 text-right">Value</th>
                  <th className="pb-2 text-right">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {positionRows.map((p) => {
                  const over = p.weightPct > MAX_POSITION_WEIGHT_PCT;
                  return (
                    <tr
                      key={p.ticker}
                      className={`tabular-nums ${over ? "bg-rose-950/20" : ""}`}
                    >
                      <td className="py-2.5 pr-3 font-mono font-medium text-zinc-100">
                        {p.ticker}
                      </td>
                      <td className="py-2.5 pr-3 text-zinc-400">
                        {sectorGroupLabel(p.sector)}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-zinc-300">
                        {money.format(p.currentValue)}
                      </td>
                      <td
                        className={`py-2.5 text-right font-medium ${
                          over ? "text-rose-400" : "text-zinc-200"
                        }`}
                      >
                        {pctFmt.format(p.weightPct)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-lg shadow-black/30">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Sector exposure
          </h3>
          <ul className="mt-5 space-y-4">
            {sectorRows.map((s) => (
              <li key={s.groupLabel}>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="font-medium text-zinc-300">
                    {s.groupLabel}
                  </span>
                  <span className="tabular-nums text-zinc-500">
                    {pctFmt.format(s.pct)}% · {money.format(s.valueUsd)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-500"
                    style={{ width: `${Math.min(s.pct, 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900/90 to-zinc-950 p-5 shadow-lg shadow-black/30">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Portfolio stats
        </h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-zinc-500">Positions</dt>
            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-white">
              {stats.positionCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Largest position</dt>
            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-white">
              {stats.largestTicker}{" "}
              <span className="text-sm font-normal text-zinc-400">
                ({pctFmt.format(stats.largestPct)}%)
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Top sector</dt>
            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-white">
              {stats.topSectorLabel}{" "}
              <span className="text-sm font-normal text-zinc-400">
                ({pctFmt.format(stats.topSectorPct)}%)
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Avg position value</dt>
            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-white">
              {money.format(stats.avgPositionValueUsd)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
