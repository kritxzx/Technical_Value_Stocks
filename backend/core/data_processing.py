"""
Data access layer with timezone normalization, concurrent universe fetching,
rich ticker quote/metadata, and lightweight thread-safe TTL caching.
"""
from __future__ import annotations

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import pandas as pd
import yfinance as yf

from backend.core.config import (
    CHART_INTERVAL,
    CHART_PERIOD,
    HISTORY_CACHE_TTL,
    QUOTE_CACHE_TTL,
)

logger = logging.getLogger(__name__)


class _TTLCache:
    def __init__(self, ttl: int):
        self._ttl = ttl
        self._store: dict[str, tuple[float, object]] = {}
        self._lock = threading.Lock()

    def get(self, key: str):
        now = time.monotonic()
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            ts, val = entry
            if now - ts > self._ttl:
                self._store.pop(key, None)
                return None
            return val

    def set(self, key: str, value: object) -> None:
        with self._lock:
            self._store[key] = (time.monotonic(), value)

    def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


_history_cache = _TTLCache(HISTORY_CACHE_TTL)
_quote_cache = _TTLCache(QUOTE_CACHE_TTL)


def _normalize_ohlcv(df: pd.DataFrame) -> pd.DataFrame:
    """Standardize OHLCV columns and strip timezone so dates align cleanly."""
    df = df.copy()
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df.rename(columns=str.title)
    required = ["Open", "High", "Low", "Close", "Volume"]
    if not all(col in df.columns for col in required):
        return pd.DataFrame()
    df = df[required].dropna(subset=["Open", "High", "Low", "Close"])
    df["Volume"] = df["Volume"].fillna(0.0)
    idx = pd.to_datetime(df.index)
    if idx.tz is not None:
        idx = idx.tz_localize(None)
    df.index = idx.normalize()
    df.index.name = "Date"
    # Deduplicate dates if any, keeping last
    df = df[~df.index.duplicated(keep="last")].sort_index()
    # Filter out corrupted non-positive prices
    df = df[(df["Close"] > 0) & (df["High"] > 0) & (df["Low"] > 0)]
    return df


def get_price_history(
    ticker: str,
    period: str = CHART_PERIOD,
    interval: str = CHART_INTERVAL,
    retries: int = 2,
) -> pd.DataFrame | None:
    """
    Fetch OHLCV history for one ticker. Returns None (never raises) on failure.
    """
    ticker = ticker.strip().upper()
    if not ticker:
        return None
    last_err = None
    for attempt in range(retries + 1):
        try:
            df = yf.Ticker(ticker).history(
                period=period, interval=interval, auto_adjust=True
            )
            if df is None or df.empty:
                raise ValueError(f"no data returned for {ticker}")
            cleaned = _normalize_ohlcv(df)
            if cleaned.empty:
                raise ValueError(f"cleaned OHLCV is empty for {ticker}")
            return cleaned
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            if attempt < retries:
                time.sleep(1.2 * (attempt + 1))
    logger.warning("Failed to fetch %s: %s", ticker, last_err)
    return None


def get_cached_history(
    ticker: str,
    period: str = CHART_PERIOD,
    interval: str = CHART_INTERVAL,
    force_refresh: bool = False,
) -> pd.DataFrame | None:
    ticker = ticker.strip().upper()
    cache_key = f"{ticker}:{period}:{interval}"
    if not force_refresh:
        cached = _history_cache.get(cache_key)
        if cached is not None:
            return cached
    df = get_price_history(ticker, period=period, interval=interval)
    if df is not None:
        _history_cache.set(cache_key, df)
    return df


def get_universe_history(
    tickers: list[str],
    period: str = CHART_PERIOD,
    interval: str = CHART_INTERVAL,
    max_workers: int = 6,
) -> dict[str, pd.DataFrame]:
    """
    Concurrently fetch OHLCV history for a list of tickers using a bounded
    thread pool (much faster than sequential sleeps while staying polite to Yahoo).
    """
    unique_tickers = list(dict.fromkeys(t.strip().upper() for t in tickers if t.strip()))
    out: dict[str, pd.DataFrame] = {}

    def _fetch_one(tkr: str) -> tuple[str, pd.DataFrame | None]:
        return tkr, get_price_history(tkr, period=period, interval=interval)

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(_fetch_one, tkr) for tkr in unique_tickers]
        for fut in as_completed(futures):
            try:
                tkr, df = fut.result()
                if df is not None and len(df) >= 30:
                    out[tkr] = df
            except Exception as exc:  # noqa: BLE001
                logger.warning("Worker error fetching ticker: %s", exc)
    return out


def _safe_attr(obj, attr: str):
    try:
        val = getattr(obj, attr, None)
        return val
    except Exception:  # noqa: BLE001
        return None


def get_live_price(ticker: str) -> dict | None:
    """
    Fetch near-real-time quote + key metadata using yfinance fast_info
    with graceful fallback for optional fields.
    """
    ticker = ticker.strip().upper()
    if not ticker:
        return None
    try:
        tk = yf.Ticker(ticker)
        fi = tk.fast_info
        last = _safe_attr(fi, "last_price")
        prev_close = _safe_attr(fi, "previous_close")
        if last is None:
            return None

        last_f = float(last)
        prev_f = float(prev_close) if prev_close else None
        change = round(last_f - prev_f, 2) if prev_f else None
        change_pct = round((last_f - prev_f) / prev_f * 100.0, 2) if (prev_f and prev_f > 0) else None

        day_high = _safe_attr(fi, "day_high")
        day_low = _safe_attr(fi, "day_low")
        year_high = _safe_attr(fi, "year_high")
        year_low = _safe_attr(fi, "year_low")
        market_cap = _safe_attr(fi, "market_cap")
        last_volume = _safe_attr(fi, "last_volume")
        currency = _safe_attr(fi, "currency") or "USD"
        exchange = _safe_attr(fi, "exchange") or ""

        # Lightweight metadata fetch (shortName / sector) — best effort
        name = ticker
        sector = None
        try:
            info = tk.info or {}
            name = info.get("shortName") or info.get("longName") or ticker
            sector = info.get("sector")
        except Exception:  # noqa: BLE001
            pass

        return {
            "ticker": ticker,
            "name": name,
            "sector": sector,
            "exchange": exchange,
            "currency": currency,
            "last_price": last_f,
            "previous_close": prev_f,
            "change": change,
            "change_pct": change_pct,
            "day_high": float(day_high) if day_high else None,
            "day_low": float(day_low) if day_low else None,
            "year_high": float(year_high) if year_high else None,
            "year_low": float(year_low) if year_low else None,
            "market_cap": float(market_cap) if market_cap else None,
            "volume": int(last_volume) if last_volume else None,
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to fetch live price for %s: %s", ticker, exc)
        return None


def get_cached_quote(ticker: str, force_refresh: bool = False) -> dict | None:
    ticker = ticker.strip().upper()
    if not force_refresh:
        cached = _quote_cache.get(ticker)
        if cached is not None:
            return cached
    quote = get_live_price(ticker)
    if quote is not None:
        _quote_cache.set(ticker, quote)
    return quote


def clear_ticker_cache(ticker: str) -> None:
    ticker = ticker.strip().upper()
    _history_cache.delete(f"{ticker}:{CHART_PERIOD}:{CHART_INTERVAL}")
    _quote_cache.delete(ticker)


def validate_ticker(ticker: str) -> bool:
    """Cheap existence check before doing a full fetch."""
    return get_price_history(ticker, period="5d", retries=0) is not None
