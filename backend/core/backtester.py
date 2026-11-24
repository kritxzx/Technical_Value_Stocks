"""
Honest Walk-Forward Backtesting Engine (Zero Lookahead Bias).

Evaluates the Log-Linear Channel + Multi-Confluence Buy Zone + ATR Stop/Target
strategy bar-by-bar using only information available up to day t, executes on
day t+1 Open with realistic slippage, and reports standard quantitative metrics:
Win Rate, Profit Factor, Expectancy, Sharpe Ratio, Max Drawdown, and Trade Log.
"""
from __future__ import annotations

import logging
import math
from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np
import pandas as pd

from backend.core.config import (
    CHANNEL_STD_MULT,
    DEFAULT_FORECAST_HORIZON,
    DEFAULT_UNIVERSE,
    MIN_SIGNAL_SCORE,
    REGRESSION_WINDOW,
    SR_ORDER,
)
from backend.core.data_processing import get_cached_history
from backend.core.indicators import atr, compute_volume_profile, ema, macd, rsi

logger = logging.getLogger(__name__)


def _fast_log_ols(log_y: np.ndarray, x: np.ndarray, x_mean: float, sxx: float) -> tuple[float, float, float, float]:
    """Vectorized OLS on log prices; returns (slope, intercept, r2, std_log)."""
    n = len(log_y)
    y_mean = float(np.mean(log_y))
    dy = log_y - y_mean
    dx = x - x_mean
    sxy = float(np.dot(dx, dy))
    slope = sxy / sxx if sxx > 0 else 0.0
    intercept = y_mean - slope * x_mean
    fitted = slope * x + intercept
    resid = log_y - fitted
    ss_res = float(np.dot(resid, resid))
    ss_tot = float(np.dot(dy, dy))
    r2 = max(0.0, 1.0 - ss_res / ss_tot) if ss_tot > 1e-12 else 0.0
    std_log = math.sqrt(ss_res / max(n - 2, 1))
    return slope, intercept, r2, std_log


def _causal_swing_support(lows: np.ndarray, current_idx: int, current_price: float, order: int = SR_ORDER) -> float | None:
    """
    Find nearest confirmed swing low strictly below current_price.
    Only considers pivots at index k <= current_idx - order so there is ZERO lookahead.
    """
    start = max(order, current_idx - 252)
    end = current_idx - order
    if end <= start:
        return None

    best_s1: float | None = None
    for k in range(start, end + 1):
        val = lows[k]
        if val >= current_price:
            continue
        window_slice = lows[k - order : k + order + 1]
        if val <= np.min(window_slice):
            if best_s1 is None or val > best_s1:
                best_s1 = float(val)
    return best_s1


def _compute_sharpe(daily_returns: np.ndarray) -> float:
    if len(daily_returns) < 20:
        return 0.0
    std = float(np.std(daily_returns, ddof=1))
    if std < 1e-9:
        return 0.0
    return round(float(np.mean(daily_returns) / std * math.sqrt(252.0)), 2)


def _compute_max_drawdown(equity: np.ndarray) -> float:
    if len(equity) == 0:
        return 0.0
    peaks = np.maximum.accumulate(equity)
    dd = (equity - peaks) / np.maximum(peaks, 1e-9)
    return round(float(np.min(dd) * 100.0), 2)


def _classify_verdict(
    total_trades: int,
    win_rate: float,
    profit_factor: float,
    expectancy: float,
) -> tuple[str, str]:
    if total_trades < 5:
        return (
            "INSUFFICIENT_DATA",
            f"เกิดสัญญาณเพียง {total_trades} ไม้ในช่วงทดสอบ ข้อมูลน้อยเกินกว่าจะสรุปทางสถิติได้",
        )
    if profit_factor >= 1.5 and expectancy > 0.5 and win_rate >= 48.0:
        return (
            "STRONG_EDGE",
            "กลยุทธ์มีสถิติได้เปรียบชัดเจน (Positive Expectancy & Profit Factor ≥ 1.5) เหมาะกับพฤติกรรมราคาหุ้นตัวนี้",
        )
    if profit_factor >= 1.15 and expectancy > 0.0:
        return (
            "MODERATE_EDGE",
            "กลยุทธ์ให้ผลตอบแทนเป็นบวกแต่ส่วนต่างยังไม่สูงมาก ควรคัดกรองด้วยปัจจัยพื้นฐานหรือรอจุดเข้าที่มี Confluence สูง",
        )
    return (
        "NO_EDGE",
        "กลยุทธ์นี้ไม่ค่อยเข้ากับพฤติกรรมราคาของหุ้นตัวนี้ในช่วงทดสอบ (Expectancy ≤ 0) ไม่ควรใช้สัญญาณอัตโนมัติกับหุ้นนี้โดยตรง",
    )


def run_ticker_backtest(
    df: pd.DataFrame,
    ticker: str,
    window: int = REGRESSION_WINDOW,
    horizon_days: int = DEFAULT_FORECAST_HORIZON,
    min_score: float = MIN_SIGNAL_SCORE,
    require_confirm: bool = True,
    slippage_bps: float = 10.0,
) -> dict:
    """
    Walk-forward simulation on OHLCV DataFrame `df` (ideally 3y-5y).
    """
    n = len(df)
    start_idx = max(window, 200)
    if n < start_idx + 30:
        return {
            "ticker": ticker,
            "period_start": df.index[0].strftime("%Y-%m-%d") if n > 0 else "",
            "period_end": df.index[-1].strftime("%Y-%m-%d") if n > 0 else "",
            "bars_tested": 0,
            "total_trades": 0,
            "wins": 0,
            "losses": 0,
            "win_rate_pct": 0.0,
            "profit_factor": 0.0,
            "expectancy_pct": 0.0,
            "avg_win_pct": 0.0,
            "avg_loss_pct": 0.0,
            "realized_rr": 0.0,
            "total_return_pct": 0.0,
            "buy_hold_return_pct": 0.0,
            "max_drawdown_pct": 0.0,
            "sharpe_ratio": 0.0,
            "verdict": "INSUFFICIENT_DATA",
            "verdict_text": "ข้อมูลราคาย้อนหลังไม่เพียงพอสำหรับ Walk-Forward Backtest (ต้องมีอย่างน้อย ~1 ปี)",
            "equity_curve": [],
            "trades": [],
        }

    opens = df["Open"].to_numpy(dtype=float)
    highs = df["High"].to_numpy(dtype=float)
    lows = df["Low"].to_numpy(dtype=float)
    closes = df["Close"].to_numpy(dtype=float)
    log_closes = np.log(np.maximum(closes, 1e-8))
    dates = [dt.strftime("%Y-%m-%d") for dt in df.index]

    # Strictly causal indicator series
    close_s = df["Close"].astype(float)
    ema20_arr = ema(close_s, 20).to_numpy(dtype=float)
    ema50_arr = ema(close_s, 50).to_numpy(dtype=float)
    ema200_arr = ema(close_s, 200).to_numpy(dtype=float)
    rsi_arr = rsi(close_s, 14).to_numpy(dtype=float)
    _, _, macd_hist_s = macd(close_s)
    macd_hist_arr = macd_hist_s.to_numpy(dtype=float)
    atr_arr = atr(df, 14).to_numpy(dtype=float)

    # Precomputed OLS x constants
    x = np.arange(window, dtype=float)
    x_mean = float(np.mean(x))
    sxx = float(np.sum((x - x_mean) ** 2))
    slip = slippage_bps / 10000.0

    trades: list[dict] = []
    equity_values = np.ones(n - start_idx, dtype=float) * 100.0
    bh_start_price = closes[start_idx]
    bh_values = (closes[start_idx:] / bh_start_price) * 100.0

    current_equity = 100.0
    in_pos = False
    pos_entry_idx = -1
    pos_entry_price = 0.0
    pos_stop = 0.0
    pos_target = 0.0
    pos_score = 0.0
    pos_confluence = 0

    for i in range(start_idx, n):
        eq_idx = i - start_idx

        # 1. Manage open position on bar i
        if in_pos:
            exited = False
            exit_price = closes[i]
            exit_reason = "TIME_EXIT"

            # Conservative intraday check: stop-loss checked BEFORE take-profit
            if lows[i] <= pos_stop:
                exit_price = min(opens[i], pos_stop) * (1.0 - slip)
                exit_reason = "STOP_LOSS"
                exited = True
            elif highs[i] >= pos_target:
                exit_price = max(opens[i], pos_target) * (1.0 - slip)
                exit_reason = "TAKE_PROFIT"
                exited = True
            elif (i - pos_entry_idx) >= horizon_days or i == n - 1:
                exit_price = closes[i] * (1.0 - slip)
                exit_reason = "TIME_EXIT"
                exited = True

            if exited:
                ret_pct = (exit_price - pos_entry_price) / pos_entry_price * 100.0
                current_equity *= 1.0 + ret_pct / 100.0
                equity_values[eq_idx] = current_equity
                trades.append(
                    {
                        "entry_date": dates[pos_entry_idx],
                        "exit_date": dates[i],
                        "entry_price": round(pos_entry_price, 2),
                        "exit_price": round(exit_price, 2),
                        "stop_loss": round(pos_stop, 2),
                        "target": round(pos_target, 2),
                        "return_pct": round(ret_pct, 2),
                        "exit_reason": exit_reason,
                        "score": round(pos_score, 1),
                        "confluence_count": pos_confluence,
                        "bars_held": i - pos_entry_idx,
                    }
                )
                in_pos = False
                continue
            else:
                # Mark-to-market unrealized equity
                unrealized = (closes[i] - pos_entry_price) / pos_entry_price
                equity_values[eq_idx] = current_equity * (1.0 + unrealized)
                continue
        else:
            equity_values[eq_idx] = current_equity

        # Cannot open a new trade on the very last bar (need i+1 Open)
        if i >= n - 2:
            continue

        # 2. Evaluate causal signal at bar i close
        slope_log, intercept_log, r2, std_log = _fast_log_ols(
            log_closes[i - window + 1 : i + 1], x, x_mean, sxx
        )
        if slope_log <= 0 or r2 < 0.30:
            continue

        fitted_last = slope_log * (window - 1) + intercept_log
        ev_target = math.exp(fitted_last)
        upper_band = math.exp(fitted_last + CHANNEL_STD_MULT * std_log)
        lower_band = math.exp(fitted_last - CHANNEL_STD_MULT * std_log)
        price = closes[i]

        log_span = 2.0 * CHANNEL_STD_MULT * std_log
        pos_pct = (
            (log_closes[i] - (fitted_last - CHANNEL_STD_MULT * std_log)) / log_span * 100.0
            if log_span > 1e-9
            else 50.0
        )

        # Quick confluence score (mirrors mathematical_models.calculate_signal_score)
        r2_pts = r2 * 30.0 * (0.45 if r2 < 0.35 else (0.75 if r2 < 0.50 else 1.0))
        if pos_pct < -15.0:
            ch_pts = 4.0
        elif pos_pct < 0.0:
            ch_pts = 11.0
        elif pos_pct <= 45.0:
            ch_pts = 25.0 - abs(pos_pct - 22.0) * 0.25
        elif pos_pct <= 100.0:
            ch_pts = max(2.0, 20.0 * (1.0 - (pos_pct - 45.0) / 55.0))
        else:
            ch_pts = 0.0

        upside_pct = (ev_target - price) / price * 100.0
        up_pts = float(np.clip(upside_pct * 1.5, 0.0, 15.0)) if upside_pct > 0 else 0.0

        rsi_val = rsi_arr[i]
        mh = macd_hist_arr[i]
        mh_prev = macd_hist_arr[i - 1]
        mh_imp = (not math.isnan(mh)) and (not math.isnan(mh_prev)) and (mh > mh_prev)

        mom_pts = 7.5
        if not math.isnan(rsi_val):
            if 35.0 <= rsi_val <= 58.0:
                mom_pts = 11.0
            elif 58.0 < rsi_val <= 68.0:
                mom_pts = 8.0
            elif 28.0 <= rsi_val < 35.0:
                mom_pts = 7.0
            elif rsi_val > 72.0:
                mom_pts = 2.0
            else:
                mom_pts = 3.0
        if not math.isnan(mh):
            if mh_imp:
                mom_pts = min(15.0, mom_pts + 4.0)
            elif mh > 0:
                mom_pts = min(15.0, mom_pts + 2.0)
            else:
                mom_pts = max(0.0, mom_pts - 2.0)

        e20, e50, e200 = ema20_arr[i], ema50_arr[i], ema200_arr[i]
        if price > e20 > e50 > e200:
            tr_pts = 13.5
        elif e50 > e200 and price <= e20 and price >= e200:
            tr_pts = 15.0
        elif price > e50 and price > e200:
            tr_pts = 11.0
        elif price < e50 and e50 < e200:
            tr_pts = 1.0
        else:
            tr_pts = 6.0

        score = r2_pts + ch_pts + up_pts + mom_pts + tr_pts
        if score < min_score:
            continue

        # Multi-confluence support zone (strictly causal)
        atr_val = atr_arr[i] if (not math.isnan(atr_arr[i]) and atr_arr[i] > 0) else price * 0.015
        min_a = lower_band * 0.85
        max_a = price * 1.015
        cands: list[tuple[float, float]] = []

        s1 = _causal_swing_support(lows, i, price)
        if s1 is not None and min_a <= s1 <= max_a:
            cands.append((s1, 1.3))
        for ema_lv, w in ((e20, 1.0), (e50, 1.3), (e200, 1.4)):
            if not math.isnan(ema_lv) and min_a <= ema_lv <= max_a:
                cands.append((ema_lv, w))

        # Causal Volume Profile HVN over trailing 120 bars
        vp = compute_volume_profile(df.iloc[max(0, i - 119) : i + 1], lookback=120, bins=20)
        hvn_below = [lv for lv in vp["hvn_levels"] if min_a <= lv <= max_a]
        if hvn_below:
            cands.append((max(hvn_below), 1.25))

        mid_lower = math.sqrt(max(ev_target * lower_band, 1e-8))
        if min_a <= mid_lower <= max_a:
            cands.append((mid_lower, 0.9))
        if min_a <= lower_band <= max_a:
            cands.append((lower_band, 1.0))

        cluster_r = max(atr_val * 1.2, price * 0.025)
        best_members: list[tuple[float, float]] = []
        best_cscore = -1.0
        for ap, _ in cands:
            mems = [c for c in cands if abs(c[0] - ap) <= cluster_r]
            cs = sum(m[1] for m in mems) - abs(price - ap) / price * 2.0
            if cs > best_cscore:
                best_cscore = cs
                best_members = mems

        if best_members:
            tw = sum(m[1] for m in best_members)
            entry_ref = sum(m[0] * m[1] for m in best_members) / tw
            conf_cnt = len(best_members)
        else:
            entry_ref = lower_band
            conf_cnt = 1

        buf = atr_val * 0.40
        entry_low = max(0.01, entry_ref - buf)
        entry_high = entry_ref + buf
        stop_loss = max(0.01, entry_low - atr_val * 1.5)

        # Must be inside buy zone (not above, not broken below stop)
        if not (stop_loss < price <= entry_high):
            continue

        # Anti-falling-knife confirmation filter
        if require_confirm:
            bar_rng = highs[i] - lows[i]
            lower_wk = min(opens[i], price) - lows[i]
            bullish_bar = price >= opens[i]
            hammer = bar_rng > 0 and (lower_wk / bar_rng) >= 0.40
            holding_lo = lows[i] >= lows[i - 1] * 0.995
            if not (bullish_bar or hammer or (mh_imp and holding_lo)):
                continue

        # Realistic forecast target at horizon_days
        target = math.exp(slope_log * (window - 1 + horizon_days) + intercept_log)
        next_open = opens[i + 1] * (1.0 + slip)

        # Skip if next day gaps below stop or already above target
        if next_open <= stop_loss or next_open >= target * 0.99:
            continue

        risk = next_open - stop_loss
        reward = target - next_open
        if risk <= 0 or (reward / risk) < 1.0:
            continue

        # Enter trade on bar i+1 Open!
        in_pos = True
        pos_entry_idx = i + 1
        pos_entry_price = next_open
        pos_stop = stop_loss
        pos_target = target
        pos_score = score
        pos_confluence = conf_cnt

    # Aggregate statistics
    total_trades = len(trades)
    wins_list = [t["return_pct"] for t in trades if t["return_pct"] > 0]
    losses_list = [t["return_pct"] for t in trades if t["return_pct"] <= 0]
    wins = len(wins_list)
    losses = len(losses_list)

    win_rate = round((wins / total_trades) * 100.0, 1) if total_trades > 0 else 0.0
    gross_profit = sum(wins_list)
    gross_loss = abs(sum(losses_list))
    if gross_loss > 0:
        profit_factor = round(gross_profit / gross_loss, 2)
    elif gross_profit > 0:
        profit_factor = 9.99
    else:
        profit_factor = 0.0

    expectancy = round(sum(t["return_pct"] for t in trades) / total_trades, 2) if total_trades > 0 else 0.0
    avg_win = round(sum(wins_list) / wins, 2) if wins > 0 else 0.0
    avg_loss = round(sum(losses_list) / losses, 2) if losses > 0 else 0.0
    realized_rr = round(abs(avg_win / avg_loss), 2) if avg_loss < 0 else (round(avg_win, 2) if avg_win > 0 else 0.0)

    total_ret = round(float(equity_values[-1] - 100.0), 2)
    bh_ret = round(float(bh_values[-1] - 100.0), 2)
    max_dd = _compute_max_drawdown(equity_values)
    daily_rets = np.diff(equity_values) / np.maximum(equity_values[:-1], 1e-9)
    sharpe = _compute_sharpe(daily_rets)

    verdict, verdict_text = _classify_verdict(total_trades, win_rate, profit_factor, expectancy)

    # Downsample equity curve slightly if > 400 pts for lighter payload
    curve_dates = dates[start_idx:]
    step = max(1, len(curve_dates) // 300)
    equity_curve = [
        {
            "time": curve_dates[idx],
            "strategy": round(float(equity_values[idx]), 2),
            "buy_hold": round(float(bh_values[idx]), 2),
        }
        for idx in range(0, len(curve_dates), step)
    ]
    if equity_curve and equity_curve[-1]["time"] != curve_dates[-1]:
        equity_curve.append(
            {
                "time": curve_dates[-1],
                "strategy": round(float(equity_values[-1]), 2),
                "buy_hold": round(float(bh_values[-1]), 2),
            }
        )

    return {
        "ticker": ticker,
        "period_start": curve_dates[0],
        "period_end": curve_dates[-1],
        "bars_tested": len(curve_dates),
        "total_trades": total_trades,
        "wins": wins,
        "losses": losses,
        "win_rate_pct": win_rate,
        "profit_factor": profit_factor,
        "expectancy_pct": expectancy,
        "avg_win_pct": avg_win,
        "avg_loss_pct": avg_loss,
        "realized_rr": realized_rr,
        "total_return_pct": total_ret,
        "buy_hold_return_pct": bh_ret,
        "max_drawdown_pct": max_dd,
        "sharpe_ratio": sharpe,
        "verdict": verdict,
        "verdict_text": verdict_text,
        "equity_curve": equity_curve,
        "trades": list(reversed(trades)),  # newest first
    }


def run_portfolio_backtest(
    tickers: list[str] | None = None,
    period: str = "3y",
    window: int = REGRESSION_WINDOW,
    horizon_days: int = DEFAULT_FORECAST_HORIZON,
    min_score: float = MIN_SIGNAL_SCORE,
    require_confirm: bool = True,
    max_tickers: int = 20,
) -> dict:
    """
    Run walk-forward backtest across multiple tickers concurrently and
    aggregate into a statistically meaningful portfolio report.
    """
    target_tickers = (tickers or DEFAULT_UNIVERSE)[:max_tickers]
    per_ticker: list[dict] = []
    all_trades: list[dict] = []

    def _run_one(sym: str) -> dict | None:
        df = get_cached_history(sym, period=period)
        if df is None or len(df) < max(window, 200) + 30:
            return None
        return run_ticker_backtest(
            df,
            ticker=sym,
            window=window,
            horizon_days=horizon_days,
            min_score=min_score,
            require_confirm=require_confirm,
        )

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(_run_one, sym) for sym in target_tickers]
        for fut in as_completed(futures):
            try:
                res = fut.result()
                if res is not None:
                    per_ticker.append(res)
                    for t in res["trades"]:
                        all_trades.append({**t, "ticker": res["ticker"]})
            except Exception as exc:  # noqa: BLE001
                logger.warning("Portfolio backtest error: %s", exc)

    total_trades = len(all_trades)
    wins_list = [t["return_pct"] for t in all_trades if t["return_pct"] > 0]
    losses_list = [t["return_pct"] for t in all_trades if t["return_pct"] <= 0]
    wins = len(wins_list)
    losses = len(losses_list)

    win_rate = round((wins / total_trades) * 100.0, 1) if total_trades > 0 else 0.0
    gross_profit = sum(wins_list)
    gross_loss = abs(sum(losses_list))
    profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (9.99 if gross_profit > 0 else 0.0)
    expectancy = round(sum(t["return_pct"] for t in all_trades) / total_trades, 2) if total_trades > 0 else 0.0
    avg_win = round(sum(wins_list) / wins, 2) if wins > 0 else 0.0
    avg_loss = round(sum(losses_list) / losses, 2) if losses > 0 else 0.0
    realized_rr = round(abs(avg_win / avg_loss), 2) if avg_loss < 0 else 0.0

    verdict, verdict_text = _classify_verdict(total_trades, win_rate, profit_factor, expectancy)

    # Sort ticker summaries by profit_factor / expectancy
    ticker_summaries = [
        {
            "ticker": r["ticker"],
            "total_trades": r["total_trades"],
            "win_rate_pct": r["win_rate_pct"],
            "profit_factor": r["profit_factor"],
            "expectancy_pct": r["expectancy_pct"],
            "total_return_pct": r["total_return_pct"],
            "buy_hold_return_pct": r["buy_hold_return_pct"],
            "max_drawdown_pct": r["max_drawdown_pct"],
            "sharpe_ratio": r["sharpe_ratio"],
            "verdict": r["verdict"],
        }
        for r in per_ticker
    ]
    ticker_summaries.sort(key=lambda x: (x["expectancy_pct"], x["profit_factor"]), reverse=True)

    return {
        "period": period,
        "tickers_tested": len(per_ticker),
        "total_trades": total_trades,
        "wins": wins,
        "losses": losses,
        "win_rate_pct": win_rate,
        "profit_factor": profit_factor,
        "expectancy_pct": expectancy,
        "avg_win_pct": avg_win,
        "avg_loss_pct": avg_loss,
        "realized_rr": realized_rr,
        "verdict": verdict,
        "verdict_text": verdict_text,
        "tickers": ticker_summaries,
    }
