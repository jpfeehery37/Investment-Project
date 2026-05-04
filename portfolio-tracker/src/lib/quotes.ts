/**
 * Live quotes via Yahoo Finance chart API (same underlying source as yfinance).
 * Fetched on the server for Vercel compatibility.
 */

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        symbol?: string;
      };
    }>;
    error?: { description?: string };
  };
};

async function fetchYahooPrice(symbol: string): Promise<number | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; PortfolioTracker/1.0; +https://vercel.com)",
      Accept: "application/json",
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as YahooChartResponse;
  if (data.chart?.error) return null;

  const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  return price;
}

export async function fetchYahooPrices(
  symbols: readonly string[],
): Promise<Record<string, number | null>> {
  const unique = [...new Set(symbols)];
  const entries = await Promise.all(
    unique.map(async (sym) => {
      const price = await fetchYahooPrice(sym);
      return [sym, price] as const;
    }),
  );
  return Object.fromEntries(entries);
}
