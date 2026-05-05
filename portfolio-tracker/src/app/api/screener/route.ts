import { FmpApiError, FmpConfigurationError } from "@/lib/fmp/client";
import { loadScreenerUniverse, uniqueSectors } from "@/lib/screener/fmpScreenerData";

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
    if (err instanceof FmpConfigurationError) {
      return Response.json(
        { error: err.message, code: "FMP_CONFIG" },
        { status: 500 },
      );
    }
    if (err instanceof FmpApiError) {
      const limit = err.status === 402 || err.status === 429;
      return Response.json(
        {
          error: err.message,
          code: limit ? "FMP_LIMIT" : "FMP_ERROR",
          status: err.status,
        },
        { status: limit ? 429 : 502 },
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: `Screener failed: ${message}`, code: "UNKNOWN" },
      { status: 500 },
    );
  }
}
