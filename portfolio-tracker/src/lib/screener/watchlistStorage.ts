export type WatchlistEntry = {
  ticker: string;
  companyName: string;
  dateAdded: string;
  signals: string[];
  reason: string;
  notes: string;
};

const STORAGE_KEY = "portfolio-dashboard-screener-watchlist-v1";

function safeParse(raw: string | null): WatchlistEntry[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(
      (x): x is WatchlistEntry =>
        x != null &&
        typeof x === "object" &&
        typeof (x as WatchlistEntry).ticker === "string",
    );
  } catch {
    return [];
  }
}

export function loadWatchlist(): WatchlistEntry[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

export function saveWatchlist(entries: WatchlistEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function upsertWatchlistEntry(entry: WatchlistEntry): WatchlistEntry[] {
  const current = loadWatchlist();
  const idx = current.findIndex(
    (e) => e.ticker.toUpperCase() === entry.ticker.toUpperCase(),
  );
  if (idx >= 0) {
    const next = [...current];
    next[idx] = entry;
    saveWatchlist(next);
    return next;
  }
  const next = [...current, entry];
  saveWatchlist(next);
  return next;
}
