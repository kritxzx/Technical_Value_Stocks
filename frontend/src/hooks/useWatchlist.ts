import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'neon_quant_watchlist_v2';
const DEFAULT_WATCHLIST = ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'PLTR', 'LLY'];

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((t) => String(t).toUpperCase()).filter(Boolean);
        }
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_WATCHLIST;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
    } catch {
      // ignore storage errors
    }
  }, [watchlist]);

  const toggleTicker = useCallback((ticker: string) => {
    const sym = ticker.trim().toUpperCase();
    if (!sym) return;
    setWatchlist((prev) =>
      prev.includes(sym) ? prev.filter((t) => t !== sym) : [sym, ...prev]
    );
  }, []);

  const removeTicker = useCallback((ticker: string) => {
    const sym = ticker.trim().toUpperCase();
    setWatchlist((prev) => prev.filter((t) => t !== sym));
  }, []);

  const isWatched = useCallback(
    (ticker: string) => watchlist.includes(ticker.trim().toUpperCase()),
    [watchlist]
  );

  return { watchlist, toggleTicker, removeTicker, isWatched };
}
