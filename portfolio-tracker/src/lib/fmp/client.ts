/**
 * Server-only Financial Modeling Prep client.
 * Never import this module from client components.
 */

export class FmpConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FmpConfigurationError";
  }
}

export class FmpApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly bodySnippet?: string,
  ) {
    super(message);
    this.name = "FmpApiError";
  }
}

const FMP_STABLE_BASE = "https://financialmodelingprep.com/stable";

function buildUrl(path: string, query: Record<string, string> = {}): string {
  const key = process.env.FMP_API_KEY?.trim();
  if (!key) {
    throw new FmpConfigurationError(
      "FMP_API_KEY is not set. Add it to .env.local for local dev and to Vercel project settings for production.",
    );
  }
  const url = new URL(`${FMP_STABLE_BASE}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v !== "") url.searchParams.set(k, v);
  }
  url.searchParams.set("apikey", key);
  return url.toString();
}

export async function fmpFetchJson<T>(
  path: string,
  query: Record<string, string> = {},
): Promise<T> {
  const url = buildUrl(path, query);
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  const text = await res.text();
  const snippet = text.slice(0, 280);

  if (res.status === 401 || res.status === 403) {
    throw new FmpApiError("FMP API rejected the request (check API key).", res.status, snippet);
  }
  if (res.status === 402) {
    throw new FmpApiError(
      "FMP API plan limit exceeded or payment required for this endpoint.",
      res.status,
      snippet,
    );
  }
  if (res.status === 429) {
    throw new FmpApiError("FMP API rate limit exceeded. Try again shortly.", res.status, snippet);
  }
  if (!res.ok) {
    throw new FmpApiError(`FMP API error (${res.status}).`, res.status, snippet);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new FmpApiError("FMP API returned invalid JSON.", res.status, snippet);
  }
}
