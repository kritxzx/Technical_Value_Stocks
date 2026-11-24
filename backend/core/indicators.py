"""
Technical indicators module: EMA (20/50/200), RSI (14), MACD (12/26/9),
ATR (14), realized volatility, and Volume Ratio.
All calculations are pure pandas/numpy with safe NaN handling.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from backend.core.config import ATR_PERIOD, RSI_PERIOD, VOLUME_MA_PERIOD


def ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def rsi(close: pd.Series, period: int = RSI_PERIOD) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = (-delta).clip(lower=0.0)
    avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0.0, np.nan)
    rsi_vals = 100.0 - (100.0 / (1.0 + rs))
    # If avg_loss is 0 and avg_gain > 0 -> RSI is 100; if both 0 -> 50
    rsi_vals = rsi_vals.where(avg_loss != 0.0, np.where(avg_gain > 0.0, 100.0, 50.0))
    return rsi_vals


def macd(
    close: pd.Series,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    fast_ema = ema(close, fast)
    slow_ema = ema(close, slow)
    macd_line = fast_ema - slow_ema
    signal_line = ema(macd_line, signal)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def atr(df: pd.DataFrame, period: int = ATR_PERIOD) -> pd.Series:
    high = df["High"]
    low = df["Low"]
    prev_close = df["Close"].shift(1)
    tr = pd.concat(
        [
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return tr.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()


def _safe_float(val) -> float | None:
    if val is None or pd.isna(val) or not np.isfinite(val):
        return None
    return float(val)


def compute_volume_profile(
    df: pd.DataFrame,
    lookback: int = 120,
    bins: int = 24,
) -> dict:
    """
    Build a simple Volume-at-Price profile over the last `lookback` bars
    to identify the Point of Control (POC) and High-Volume Nodes (HVNs),
    which represent institutional accumulation / cost-basis zones.
    """
    sliced = df.iloc[-lookback:] if len(df) > lookback else df
    if len(sliced) < 15:
        return {"poc": None, "hvn_levels": []}

    typical = ((sliced["High"] + sliced["Low"] + sliced["Close"]) / 3.0).to_numpy(dtype=float)
    vols = sliced["Volume"].to_numpy(dtype=float)
    p_min, p_max = float(np.min(typical)), float(np.max(typical))
    if p_max <= p_min or np.sum(vols) <= 0:
        return {"poc": None, "hvn_levels": []}

    hist, edges = np.histogram(typical, bins=bins, range=(p_min, p_max), weights=vols)
    centers = 0.5 * (edges[:-1] + edges[1:])
    poc_idx = int(np.argmax(hist))
    poc_price = round(float(centers[poc_idx]), 2)

    # High-Volume Nodes: local peaks or bins with >= 65% of POC volume
    threshold = hist[poc_idx] * 0.65
    hvn_levels: list[float] = []
    for i, v in enumerate(hist):
        if v >= threshold:
            hvn_levels.append(round(float(centers[i]), 2))

    return {"poc": poc_price, "hvn_levels": hvn_levels}


def compute_indicators(df: pd.DataFrame) -> dict:
    """
    Compute full indicator series (for charting) and latest scalar snapshot
    (for scoring and UI summary cards).
    """
    close = df["Close"].astype(float)
    volume = df["Volume"].astype(float)

    ema20 = ema(close, 20)
    ema50 = ema(close, 50)
    ema200 = ema(close, 200) if len(close) >= 200 else pd.Series(np.nan, index=close.index)

    rsi14 = rsi(close, RSI_PERIOD)
    macd_line, macd_signal, macd_hist = macd(close)
    atr14 = atr(df, ATR_PERIOD)

    vol_ma = volume.rolling(VOLUME_MA_PERIOD, min_periods=1).mean()
    vol_ratio_series = volume / vol_ma.replace(0.0, np.nan)

    # Realized daily log-return volatility over recent 60 bars
    log_ret = np.log(close / close.shift(1)).dropna()
    vol_window = log_ret.iloc[-60:] if len(log_ret) >= 20 else log_ret
    daily_vol = float(vol_window.std(ddof=1)) if len(vol_window) > 2 else 0.02
    annualized_vol_pct = round(daily_vol * np.sqrt(252) * 100.0, 2)

    last_close = float(close.iloc[-1])
    last_ema20 = _safe_float(ema20.iloc[-1])
    last_ema50 = _safe_float(ema50.iloc[-1])
    last_ema200 = _safe_float(ema200.iloc[-1])
    last_rsi = _safe_float(rsi14.iloc[-1])
    last_macd = _safe_float(macd_line.iloc[-1])
    last_macd_sig = _safe_float(macd_signal.iloc[-1])
    last_macd_hist = _safe_float(macd_hist.iloc[-1])
    prev_macd_hist = _safe_float(macd_hist.iloc[-2]) if len(macd_hist) >= 2 else None
    last_atr = _safe_float(atr14.iloc[-1])
    last_vol_ratio = _safe_float(vol_ratio_series.iloc[-1])

    # Classify EMA trend alignment
    if last_ema20 and last_ema50 and last_ema200:
        if last_close > last_ema20 > last_ema50 > last_ema200:
            trend_alignment = "BULLISH_ALIGNED"
        elif last_ema50 > last_ema200 and last_close <= last_ema20 and last_close >= last_ema200:
            trend_alignment = "PULLBACK_IN_UPTREND"
        elif last_close > last_ema50 and last_close > last_ema200:
            trend_alignment = "UPTREND"
        elif last_close < last_ema50 and last_ema50 < last_ema200:
            trend_alignment = "BEARISH"
        else:
            trend_alignment = "MIXED"
    elif last_ema20 and last_ema50:
        if last_close > last_ema20 > last_ema50:
            trend_alignment = "UPTREND"
        elif last_close < last_ema20 < last_ema50:
            trend_alignment = "BEARISH"
        else:
            trend_alignment = "MIXED"
    else:
        trend_alignment = "MIXED"

    macd_improving = (
        last_macd_hist is not None
        and prev_macd_hist is not None
        and last_macd_hist > prev_macd_hist
    )

    atr_pct = round((last_atr / last_close) * 100.0, 2) if (last_atr and last_close > 0) else None
    vol_profile = compute_volume_profile(df)

    # Latest candle reversal / stabilization check (anti-falling-knife filter)
    last_open = float(df["Open"].iloc[-1])
    last_high = float(df["High"].iloc[-1])
    last_low = float(df["Low"].iloc[-1])
    bar_range = last_high - last_low
    lower_wick = min(last_open, last_close) - last_low
    bullish_candle = last_close >= last_open
    hammer_wick = bar_range > 0 and (lower_wick / bar_range) >= 0.40
    prev_low = float(df["Low"].iloc[-2]) if len(df) >= 2 else last_low
    holding_low = last_low >= prev_low * 0.995
    candle_confirmed = bool(bullish_candle or hammer_wick or (macd_improving and holding_low))

    return {
        "series": {
            "ema20": ema20,
            "ema50": ema50,
            "ema200": ema200,
            "rsi14": rsi14,
            "macd": macd_line,
            "macd_signal": macd_signal,
            "macd_hist": macd_hist,
            "atr14": atr14,
        },
        "latest": {
            "ema20": round(last_ema20, 2) if last_ema20 is not None else None,
            "ema50": round(last_ema50, 2) if last_ema50 is not None else None,
            "ema200": round(last_ema200, 2) if last_ema200 is not None else None,
            "rsi14": round(last_rsi, 2) if last_rsi is not None else None,
            "macd": round(last_macd, 4) if last_macd is not None else None,
            "macd_signal": round(last_macd_sig, 4) if last_macd_sig is not None else None,
            "macd_hist": round(last_macd_hist, 4) if last_macd_hist is not None else None,
            "macd_improving": macd_improving,
            "atr14": round(last_atr, 2) if last_atr is not None else None,
            "atr_pct": atr_pct,
            "volume_ratio": round(last_vol_ratio, 2) if last_vol_ratio is not None else None,
            "daily_volatility": daily_vol,
            "annualized_vol_pct": annualized_vol_pct,
            "trend_alignment": trend_alignment,
            "poc": vol_profile["poc"],
            "hvn_levels": vol_profile["hvn_levels"],
            "candle_confirmed": candle_confirmed,
        },
    }
