"""
Upgraded Quant Core:
  1. Log-Linear Regression Trend Channel (scale-invariant, strictly positive)
  2. High/Low Swing Support & Resistance with non-chaining clustering & touch strength
  3. Technical Indicator Confluence (EMA 20/50/200, RSI 14, MACD, ATR 14, Volume Ratio)
  4. Volatility-Scaled Log-Space Forecast Cone (realistic sqrt(t) uncertainty)
  5. ATR-Based Entry / Stop-Loss / Risk:Reward Setup
  6. Confluence Signal Score (0-100) with transparent breakdown & falling-knife penalty
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats
from scipy.signal import argrelextrema

from backend.core.config import (
    CHANNEL_STD_MULT,
    REGRESSION_WINDOW,
    SR_LOOKBACK_DAYS,
    SR_ORDER,
    SR_TOLERANCE_PCT,
)
from backend.core.indicators import compute_indicators


def linear_regression_channel(
    close: pd.Series,
    window: int = REGRESSION_WINDOW,
    std_mult: float = CHANNEL_STD_MULT,
) -> dict:
    """
    Fit an OLS trend line in log-price space over the most recent `window`
    closes and build a +-std_mult*sigma percentage channel around it.
    """
    window = min(window, len(close))
    y_raw = close.iloc[-window:].to_numpy(dtype=float)
    y_log = np.log(np.maximum(y_raw, 1e-8))
    x = np.arange(window, dtype=float)

    slope_log, intercept_log, r_value, _p_value, _std_err = stats.linregress(x, y_log)
    fitted_log = slope_log * x + intercept_log
    residuals_log = y_log - fitted_log
    std_log = float(residuals_log.std(ddof=1)) if window > 2 else 0.0

    fitted_price = np.exp(fitted_log)
    upper_price = np.exp(fitted_log + std_mult * std_log)
    lower_price = np.exp(fitted_log - std_mult * std_log)

    # Approximate dollar std dev at current price for reference
    std_dev_price = float(fitted_price[-1] * std_log)
    daily_drift_pct = float((np.exp(slope_log) - 1.0) * 100.0)
    annualized_drift_pct = float((np.exp(slope_log * 252.0) - 1.0) * 100.0)

    line_series = pd.Series(np.nan, index=close.index)
    upper_series = pd.Series(np.nan, index=close.index)
    lower_series = pd.Series(np.nan, index=close.index)
    line_series.iloc[-window:] = fitted_price
    upper_series.iloc[-window:] = upper_price
    lower_series.iloc[-window:] = lower_price

    # Position inside channel (0 = lower band, 50 = EV line, 100 = upper band)
    log_band_span = 2.0 * std_mult * std_log
    if log_band_span > 1e-9:
        channel_pos_pct = float(
            (y_log[-1] - (fitted_log[-1] - std_mult * std_log)) / log_band_span * 100.0
        )
    else:
        channel_pos_pct = 50.0

    return {
        "line": line_series,
        "upper": upper_series,
        "lower": lower_series,
        "r_squared": float(r_value ** 2),
        "slope": float(slope_log),
        "intercept": float(intercept_log),
        "std_log": std_log,
        "std_dev": round(std_dev_price, 4),
        "daily_drift_pct": round(daily_drift_pct, 3),
        "annualized_drift_pct": round(annualized_drift_pct, 2),
        "ev_target": float(fitted_price[-1]),
        "upper_band": float(upper_price[-1]),
        "lower_band": float(lower_price[-1]),
        "current_price": float(y_raw[-1]),
        "channel_position_pct": round(channel_pos_pct, 1),
        "window": window,
    }


def _cluster_levels(raw_levels: list[float], tolerance_pct: float) -> list[dict]:
    """
    Cluster nearby price levels without chaining drift: each new level is
    compared against the cluster's running mean rather than the last item.
    """
    if not raw_levels:
        return []
    sorted_levels = sorted(lv for lv in raw_levels if lv > 0)
    if not sorted_levels:
        return []

    clusters: list[dict] = []
    bucket = [sorted_levels[0]]
    bucket_mean = sorted_levels[0]

    for lv in sorted_levels[1:]:
        if bucket_mean > 0 and abs(lv - bucket_mean) / bucket_mean <= tolerance_pct:
            bucket.append(lv)
            bucket_mean = sum(bucket) / len(bucket)
        else:
            clusters.append({"price": round(bucket_mean, 2), "touches": len(bucket)})
            bucket = [lv]
            bucket_mean = lv

    clusters.append({"price": round(bucket_mean, 2), "touches": len(bucket)})
    return clusters


def find_support_resistance(
    df: pd.DataFrame,
    order: int = SR_ORDER,
    tolerance_pct: float = SR_TOLERANCE_PCT,
    lookback: int = SR_LOOKBACK_DAYS,
) -> list[dict]:
    """
    Detect macro swing highs (from High) and swing lows (from Low) over
    the last `lookback` bars and cluster them with touch counts.
    """
    sliced = df.iloc[-lookback:] if len(df) > lookback else df
    highs = sliced["High"].to_numpy(dtype=float)
    lows = sliced["Low"].to_numpy(dtype=float)

    if len(highs) < order * 2 + 1:
        return []

    hi_idx = argrelextrema(highs, np.greater_equal, order=order)[0]
    lo_idx = argrelextrema(lows, np.less_equal, order=order)[0]

    raw_levels = highs[hi_idx].tolist() + lows[lo_idx].tolist()
    return _cluster_levels(raw_levels, tolerance_pct)


def nearest_support_resistance(
    current_price: float, levels: list[dict]
) -> dict:
    """
    Find nearest 2 supports (S1, S2) below current price and
    nearest 2 resistances (R1, R2) above current price.
    """
    below = sorted([lv for lv in levels if lv["price"] < current_price], key=lambda x: x["price"], reverse=True)
    above = sorted([lv for lv in levels if lv["price"] > current_price], key=lambda x: x["price"])

    s1 = below[0]["price"] if len(below) >= 1 else None
    s2 = below[1]["price"] if len(below) >= 2 else None
    r1 = above[0]["price"] if len(above) >= 1 else None
    r2 = above[1]["price"] if len(above) >= 2 else None

    return {
        "s1": s1,
        "s2": s2,
        "r1": r1,
        "r2": r2,
        "s1_touches": below[0]["touches"] if len(below) >= 1 else 0,
        "r1_touches": above[0]["touches"] if len(above) >= 1 else 0,
    }


def classify_structure(
    current_price: float,
    prev_close: float | None,
    upper_band: float,
    lower_band: float,
    s1: float | None,
    r1: float | None,
    proximity_pct: float = 0.02,
) -> str:
    """
    Classify current price structure relative to the log-regression channel
    and macro support/resistance levels.
    """
    if current_price > upper_band:
        return "ABOVE_CHANNEL_EXTENDED"
    if current_price < lower_band:
        return "BELOW_CHANNEL_EXTENDED"
    # Breakdown if live price dropped below S1, OR if close broke below R1 (former support) just today
    if s1 is not None and current_price < s1:
        return "BELOW_S1_BREAKDOWN"
    if (
        r1 is not None
        and prev_close is not None
        and prev_close >= r1
        and current_price < r1
    ):
        return "BELOW_S1_BREAKDOWN"
    if r1 is not None and r1 > 0 and abs(current_price - r1) / r1 <= proximity_pct:
        return "AT_R1_RESISTANCE"
    if s1 is not None and s1 > 0 and (current_price - s1) / s1 <= 0.04:
        return "ABOVE_S1_HOLDING"
    return "NEUTRAL"


def calculate_signal_score(model: dict, indicators_latest: dict) -> tuple[float, dict]:
    """
    Confluence 0-100 screener score with transparent 5-factor breakdown:
      - r2 (0-30): trend cleanliness, penalized when R² < 0.45
      - channel (0-25): pullback sweet spot (10%-45% of channel), penalized on breakdown
      - upside (0-15): upside to EV target
      - momentum (0-15): healthy pullback RSI (35-58) + MACD turning up
      - trend (0-15): EMA 20/50/200 institutional uptrend alignment
    Downtrends (slope <= 0) score 0.
    """
    zero_breakdown = {"r2": 0.0, "channel": 0.0, "upside": 0.0, "momentum": 0.0, "trend": 0.0}
    if model["slope"] <= 0 or model["current_price"] <= 0:
        return 0.0, zero_breakdown

    # 1. Trend cleanliness (R²) — max 30 pts
    r2 = model["r_squared"]
    if r2 < 0.35:
        r2_pts = r2 * 30.0 * 0.45  # heavy penalty for noisy/non-trending charts
    elif r2 < 0.50:
        r2_pts = r2 * 30.0 * 0.75
    else:
        r2_pts = r2 * 30.0

    # 2. Channel pullback position — max 25 pts
    # Sweet spot: 10%..45% of channel (pullback near lower band / support, NOT crashing below -2σ)
    pos = model["channel_position_pct"]
    if pos < -15.0:
        # Falling knife below -2σ channel -> strong penalty
        channel_pts = 4.0
    elif pos < 0.0:
        # Just below lower band -> cautious partial credit
        channel_pts = 11.0
    elif pos <= 45.0:
        # Ideal pullback zone inside uptrend channel
        channel_pts = 25.0 - abs(pos - 22.0) * 0.25
    elif pos <= 100.0:
        # Upper half of channel: less attractive risk/reward
        channel_pts = max(2.0, 20.0 * (1.0 - (pos - 45.0) / 55.0))
    else:
        # Extended above +2σ
        channel_pts = 0.0

    # 3. Upside to EV target — max 15 pts
    upside_pct = (model["ev_target"] - model["current_price"]) / model["current_price"] * 100.0
    if upside_pct <= 0:
        upside_pts = 0.0
    else:
        upside_pts = float(np.clip(upside_pct * 1.5, 0.0, 15.0))

    # 4. Momentum & RSI Confluence — max 15 pts
    rsi_val = indicators_latest.get("rsi14")
    macd_hist = indicators_latest.get("macd_hist")
    macd_improving = indicators_latest.get("macd_improving", False)

    momentum_pts = 7.5
    if rsi_val is not None:
        if 35.0 <= rsi_val <= 58.0:
            momentum_pts = 11.0  # healthy pullback / reset zone
        elif 58.0 < rsi_val <= 68.0:
            momentum_pts = 8.0
        elif 28.0 <= rsi_val < 35.0:
            momentum_pts = 7.0   # deeply oversold, watch for turn
        elif rsi_val > 72.0:
            momentum_pts = 2.0   # overbought
        else:
            momentum_pts = 3.0   # extreme freefall (<28)

    if macd_hist is not None:
        if macd_improving:
            momentum_pts = min(15.0, momentum_pts + 4.0)
        elif macd_hist > 0:
            momentum_pts = min(15.0, momentum_pts + 2.0)
        else:
            momentum_pts = max(0.0, momentum_pts - 2.0)

    # 5. EMA Trend Alignment — max 15 pts
    alignment = indicators_latest.get("trend_alignment", "MIXED")
    alignment_map = {
        "PULLBACK_IN_UPTREND": 15.0,
        "BULLISH_ALIGNED": 13.5,
        "UPTREND": 11.0,
        "MIXED": 6.0,
        "BEARISH": 1.0,
    }
    trend_pts = alignment_map.get(alignment, 6.0)

    breakdown = {
        "r2": round(r2_pts, 1),
        "channel": round(channel_pts, 1),
        "upside": round(upside_pts, 1),
        "momentum": round(momentum_pts, 1),
        "trend": round(trend_pts, 1),
    }
    total = round(float(np.clip(sum(breakdown.values()), 0.0, 100.0)), 1)
    return total, breakdown


def forecast_price_path(
    model: dict,
    horizon_days: int = 20,
    confidence: float = 0.90,
    daily_volatility: float | None = None,
) -> dict:
    """
    Volatility-scaled log-space projection:
    Combines log-linear trend drift with sqrt(t) realized return volatility +
    regression estimation error, ensuring strictly positive & realistic bands.
    """
    n = model["window"]
    slope_log = model["slope"]
    intercept_log = model["intercept"]
    std_log = model["std_log"]

    x = np.arange(n, dtype=float)
    x_mean = x.mean()
    sxx = float(np.sum((x - x_mean) ** 2)) if n > 1 else 1.0

    steps = np.arange(1, horizon_days + 1, dtype=float)
    future_x = (n - 1) + steps
    log_point = slope_log * future_x + intercept_log

    # Realized daily volatility blended safely with residual dispersion
    sigma_ret = daily_volatility if (daily_volatility and daily_volatility > 0) else max(std_log * 0.25, 0.015)

    dof = max(n - 2, 1)
    t_mult = float(stats.t.ppf(0.5 + confidence / 2.0, dof))

    # Estimation variance of trend line + sqrt(t) diffusive variance
    est_var = (std_log ** 2) * (1.0 / n + ((future_x - x_mean) ** 2) / sxx) if sxx > 0 else (std_log ** 2)
    diff_var = (sigma_ret ** 2) * steps
    se_log = np.sqrt(est_var + diff_var)
    margin_log = t_mult * se_log

    point = np.exp(log_point)
    path_low = np.maximum(0.01, np.exp(log_point - margin_log))
    path_high = np.exp(log_point + margin_log)

    return {
        "horizon_days": horizon_days,
        "confidence": confidence,
        "target_price": round(float(point[-1]), 2),
        "target_low": round(float(path_low[-1]), 2),
        "target_high": round(float(path_high[-1]), 2),
        "path": point,
        "path_low": path_low,
        "path_high": path_high,
    }


def suggest_entry_setup(model: dict, forecast: dict, atr14: float | None = None) -> dict:
    """
    Build a Multi-Confluence Demand Zone (combining Macro S1, EMA 20/50/200,
    Volume Profile HVN/POC, and Log-Channel bands), ATR-calibrated Stop-Loss,
    two-tier Take Profit (TP1 conservative / TP2 trend), and candle confirmation.
    """
    current = model["current_price"]
    ev_target = model["ev_target"]
    lower_band = model["lower_band"]
    s1 = model["s1"]
    r1 = model["r1"]
    s1_touches = model.get("s1_touches", 0)
    ind = model.get("indicators", {}).get("latest", {})
    atr_val = atr14 if (atr14 is not None and atr14 > 0) else max(model["std_dev"] * 0.5, current * 0.015)

    if model["slope"] <= 0:
        return {
            "entry_low": None,
            "entry_high": None,
            "stop_loss": None,
            "target": round(float(forecast["target_price"]), 2),
            "tp1": None,
            "tp2": round(float(forecast["target_price"]), 2),
            "risk_reward": None,
            "risk_reward_tp2": None,
            "entry_status": "DOWNTREND_NO_SETUP",
            "zone_strength": "NONE",
            "confluence_count": 0,
            "confluence_factors": [],
            "candle_confirmed": False,
        }

    # Gather realistic support candidates below (or right at) current price
    min_anchor = lower_band * 0.85
    max_anchor = current * 1.015
    candidates: list[tuple[float, float, str]] = []  # (price, weight, label)

    def _add_candidate(price: float | None, weight: float, label: str):
        if price is not None and min_anchor <= price <= max_anchor:
            candidates.append((float(price), weight, label))

    if s1 is not None:
        _add_candidate(s1, 1.4 if s1_touches >= 2 else 1.1, f"Macro S1 ({s1_touches}x)")

    _add_candidate(ind.get("ema20"), 1.0, "EMA 20 Support")
    _add_candidate(ind.get("ema50"), 1.3, "EMA 50 Institutional")
    _add_candidate(ind.get("ema200"), 1.4, "EMA 200 Major")

    # Nearest High-Volume Node (Volume Profile) at or below current price
    hvn_levels = ind.get("hvn_levels") or []
    hvn_below = [lv for lv in hvn_levels if min_anchor <= lv <= max_anchor]
    if hvn_below:
        nearest_hvn = max(hvn_below)
        poc = ind.get("poc")
        is_poc = poc is not None and abs(nearest_hvn - poc) / max(poc, 1e-6) < 0.01
        _add_candidate(nearest_hvn, 1.35 if is_poc else 1.2, "Volume POC" if is_poc else "Volume HVN")

    # Log-Channel -1σ and -2σ
    mid_lower = float(np.sqrt(max(ev_target * lower_band, 1e-8)))  # geometric midpoint (-1σ)
    _add_candidate(mid_lower, 0.9, "Channel -1σ Pullback")
    _add_candidate(lower_band, 1.0, "Channel -2σ Band")

    # Find highest-confluence cluster within +-max(1.2*ATR, 2.5% of price)
    cluster_radius = max(atr_val * 1.2, current * 0.025)
    best_cluster: list[tuple[float, float, str]] = []
    best_score = -1.0

    for anchor_price, _, _ in candidates:
        members = [c for c in candidates if abs(c[0] - anchor_price) <= cluster_radius]
        weight_sum = sum(m[1] for m in members)
        # Slight preference for reachable zones closer to current price
        dist_pct = abs(current - anchor_price) / max(current, 1e-6)
        cluster_score = weight_sum - dist_pct * 2.0
        if cluster_score > best_score:
            best_score = cluster_score
            best_cluster = members

    if best_cluster:
        total_w = sum(m[1] for m in best_cluster)
        entry_ref = sum(m[0] * m[1] for m in best_cluster) / total_w
        factors = list(dict.fromkeys(m[2] for m in best_cluster))
        confluence_count = len(factors)
    else:
        entry_ref = lower_band
        factors = ["Channel -2σ Band"]
        confluence_count = 1

    buffer = atr_val * 0.40
    entry_low = max(0.01, entry_ref - buffer)
    entry_high = entry_ref + buffer
    stop_loss = max(0.01, entry_low - atr_val * 1.5)

    tp2 = round(float(forecast["target_price"]), 2)
    # Conservative TP1: nearest realistic resistance (R1) or EV Target above entry_high
    tp1_candidates = [
        p for p in [r1, ev_target, tp2]
        if p is not None and p > entry_high * 1.015
    ]
    tp1 = round(float(min(tp1_candidates)), 2) if tp1_candidates else tp2

    risk = entry_high - stop_loss
    rr_tp1 = round((tp1 - entry_high) / risk, 2) if (risk > 0 and tp1 > entry_high) else 0.0
    rr_tp2 = round((tp2 - entry_high) / risk, 2) if (risk > 0 and tp2 > entry_high) else 0.0

    zone_strength = "HIGH" if confluence_count >= 3 else ("MEDIUM" if confluence_count == 2 else "LOW")
    candle_confirmed = bool(ind.get("candle_confirmed", False))

    if current < stop_loss:
        entry_status = "BELOW_ZONE_RISK"
    elif current <= entry_high:
        entry_status = "CONFIRMED_ENTRY" if candle_confirmed else "IN_ZONE_WAIT_CONFIRM"
    else:
        entry_status = "WAIT_FOR_PULLBACK"

    return {
        "entry_low": round(float(entry_low), 2),
        "entry_high": round(float(entry_high), 2),
        "stop_loss": round(float(stop_loss), 2),
        "target": tp2,
        "tp1": tp1,
        "tp2": tp2,
        "risk_reward": rr_tp1,
        "risk_reward_tp2": rr_tp2,
        "entry_status": entry_status,
        "zone_strength": zone_strength,
        "confluence_count": confluence_count,
        "confluence_factors": factors,
        "candle_confirmed": candle_confirmed,
    }


def refresh_with_live_price(model: dict, live_price: float) -> dict:
    """
    Overlay a live quote onto an already-built model without refitting OLS.
    Recomputes upside, channel position, structure, and signal score.
    """
    if live_price is None or live_price <= 0:
        return model

    updated = dict(model)
    prev_close = model["current_price"]
    updated["current_price"] = float(live_price)
    updated["upside_pct"] = round((model["ev_target"] - live_price) / live_price * 100.0, 2)

    # Recompute channel position in log space
    log_upper = np.log(max(model["upper_band"], 1e-8))
    log_lower = np.log(max(model["lower_band"], 1e-8))
    span = log_upper - log_lower
    if span > 1e-9:
        updated["channel_position_pct"] = round(
            float((np.log(live_price) - log_lower) / span * 100.0), 1
        )

    updated["structure"] = classify_structure(
        live_price,
        prev_close,
        model["upper_band"],
        model["lower_band"],
        model["s1"],
        model["r1"],
    )
    score, breakdown = calculate_signal_score(updated, model["indicators"]["latest"])
    updated["score"] = score
    updated["score_breakdown"] = breakdown
    return updated


def add_forecast(model: dict, horizon_days: int = 20, confidence: float = 0.90) -> dict:
    """Attach volatility-scaled forecast and ATR entry/stop/target setup."""
    latest_ind = model["indicators"]["latest"]
    forecast = forecast_price_path(
        model,
        horizon_days=horizon_days,
        confidence=confidence,
        daily_volatility=latest_ind.get("daily_volatility"),
    )
    entry_setup = suggest_entry_setup(model, forecast, atr14=latest_ind.get("atr14"))
    return {**model, "forecast": forecast, "entry_setup": entry_setup}


def build_model(df: pd.DataFrame, window: int = REGRESSION_WINDOW) -> dict:
    """
    One-stop quant model builder used by both the FastAPI backend and CLI scanner.
    Accepts full OHLCV DataFrame.
    """
    close = df["Close"].astype(float)
    channel = linear_regression_channel(close, window=window)
    indicators = compute_indicators(df)
    levels = find_support_resistance(df)
    sr = nearest_support_resistance(channel["current_price"], levels)

    prev_close = float(close.iloc[-2]) if len(close) >= 2 else None
    structure = classify_structure(
        channel["current_price"],
        prev_close,
        channel["upper_band"],
        channel["lower_band"],
        sr["s1"],
        sr["r1"],
    )

    upside_pct = (
        round((channel["ev_target"] - channel["current_price"]) / channel["current_price"] * 100.0, 2)
        if channel["current_price"] > 0
        else 0.0
    )

    partial = {
        **channel,
        **sr,
        "levels": levels,
        "structure": structure,
        "upside_pct": upside_pct,
        "indicators": indicators,
    }
    score, breakdown = calculate_signal_score(partial, indicators["latest"])
    partial["score"] = score
    partial["score_breakdown"] = breakdown
    return partial
