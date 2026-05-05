import { loadScreenerUniverse, uniqueSectors } from "@/lib/screener/freeScreenerData";

export const maxDuration = 60;

export async function GET() {
  try {
    const rows = await loadScreenerUniverse();
    const sectors = uniqueSectors(rows);
    return Response.json(
      {
        rows,
        sectors,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const rateLimited =
      /429|rate limit|too many requests/i.test(message) ||
      (err instanceof Error && err.name === "AbortError");
    return Response.json(
      {
        error: rateLimited
          ? "Upstream data source rate-limited the request. Wait a minute and try again."
          : `Screener failed: ${message}`,
        code: rateLimited ? "RATE_LIMIT" : "UNKNOWN",
      },
      { status: rateLimited ? 429 : 500 },
    );
  }
}
