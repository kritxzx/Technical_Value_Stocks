"""
FastAPI backend for the US Quant Screener Web App.
No login required — open analytics terminal serving REST APIs and
(when built) the React SPA from frontend/dist.
"""
from __future__ import annotations

import logging
import math
import threading

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.core import config
from backend.core.backtester import run_portfolio_backtest, run_ticker_backtest
from backend.core.data_processing import (
    clear_ticker_cache,
    get_cached_history,
    get_cached_quote,
)
from backend.core.mathematical_models import (
    add_forecast,
    build_model,
    refresh_with_live_price,
)
from backend.schemas import (
    AnalyzeResponse,
    BacktestResponse,
    CandlePoint,
    ChartData,
    EntrySetup,
    ForecastPoint,
    ForecastSummary,
    IndicatorsSnapshot,
    LinePoint,
    ModelSummary,
    PortfolioBacktestResponse,
    QuoteInfo,
    ScoreBreakdown,
    ScreenerResponse,
    ScreenerRow,
)
from main import run_scan

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("backend")

app = FastAPI(
    title="US Quant Screener API",
    version="2.0.0",
    description="Log-Linear Quant Channel, Technical Confluence & Market Screener API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_scan_lock = threading.Lock()


def _series_to_line_points(series: pd.Series) -> list[LinePoint]:
    points: list[LinePoint] = []
    for dt, val in series.items():
        if pd.notna(val) and math.isfinite(float(val)):
            points.append(LinePoint(time=dt.strftime("%Y-%m-%d"), value=round(float(val), 2)))
    return points


def _clean_opt_float(val) -> float | None:
    if val is None or pd.isna(val):
        return None
    f = float(val)
    return f if math.isfinite(f) else None


def _clean_opt_str(val) -> str | None:
    if val is None or pd.isna(val):
        return None
    return str(val)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "version": "2.0.0",
        "horizons": config.FORECAST_HORIZONS,
        "default_horizon": config.DEFAULT_FORECAST_HORIZON,
        "allowed_windows": config.ALLOWED_WINDOWS,
        "default_window": config.REGRESSION_WINDOW,
        "default_watchlist": config.DEFAULT_WATCHLIST,
        "min_signal_score": config.MIN_SIGNAL_SCORE,
    }


@app.get("/api/universe")
def get_universe():
    return {"tickers": config.DEFAULT_UNIVERSE}


@app.get("/api/analyze/{ticker}", response_model=AnalyzeResponse)
def analyze_ticker(
    ticker: str,
    window: int = Query(default=config.REGRESSION_WINDOW, ge=30, le=252),
    horizon: int = Query(default=config.DEFAULT_FORECAST_HORIZON, ge=5, le=120),
    refresh: bool = Query(default=False),
):
    sym = ticker.strip().upper()
    if not sym or len(sym) > 12:
        raise HTTPException(status_code=400, detail="ชื่อย่อหุ้นไม่ถูกต้อง")

    if refresh:
        clear_ticker_cache(sym)

    df = get_cached_history(sym, force_refresh=refresh)
    if df is None or df.empty or len(df) < 30:
        raise HTTPException(
            status_code=404,
            detail=f"ไม่พบข้อมูลราคาของ '{sym}' — กรุณาตรวจสอบชื่อย่อหุ้นอีกครั้ง",
        )

    model = build_model(df, window=window)
    live = get_cached_quote(sym, force_refresh=refresh)

    if live and live.get("last_price"):
        model = refresh_with_live_price(model, live["last_price"])
        quote = QuoteInfo(**live, is_live=True)
    else:
        last_close = float(df["Close"].iloc[-1])
        prev_close = float(df["Close"].iloc[-2]) if len(df) >= 2 else None
        change = round(last_close - prev_close, 2) if prev_close else None
        change_pct = round((last_close - prev_close) / prev_close * 100.0, 2) if (prev_close and prev_close > 0) else None
        quote = QuoteInfo(
            ticker=sym,
            name=sym,
            last_price=last_close,
            previous_close=prev_close,
            change=change,
            change_pct=change_pct,
            day_high=float(df["High"].iloc[-1]),
            day_low=float(df["Low"].iloc[-1]),
            year_high=float(df["High"].iloc[-252:].max()),
            year_low=float(df["Low"].iloc[-252:].min()),
            volume=int(df["Volume"].iloc[-1]),
            is_live=False,
        )

    model = add_forecast(model, horizon_days=horizon, confidence=config.FORECAST_CONFIDENCE)
    fc = model["forecast"]
    setup = model["entry_setup"]
    ind_series = model["indicators"]["series"]
    ind_latest = model["indicators"]["latest"]

    s_label, s_color = config.STRUCTURE_LABELS.get(model["structure"], ("ปกติ", "#94a3b8"))
    e_label, e_color = config.ENTRY_STATUS_LABELS.get(setup["entry_status"], ("ไม่ทราบสถานะ", "#94a3b8"))

    # Build timezone-naive business dates for forecast cone
    last_date = df.index[-1]
    future_dates = pd.bdate_range(start=last_date, periods=fc["horizon_days"] + 1)[1:]
    forecast_points = [
        ForecastPoint(
            time=dt.strftime("%Y-%m-%d"),
            value=round(float(val), 2),
            low=round(float(lo), 2),
            high=round(float(hi), 2),
        )
        for dt, val, lo, hi in zip(future_dates, fc["path"], fc["path_low"], fc["path_high"])
    ]

    target_change_pct = (
        round((fc["target_price"] - model["current_price"]) / model["current_price"] * 100.0, 2)
        if model["current_price"] > 0
        else 0.0
    )

    candles = [
        CandlePoint(
            time=dt.strftime("%Y-%m-%d"),
            open=round(float(row["Open"]), 2),
            high=round(float(row["High"]), 2),
            low=round(float(row["Low"]), 2),
            close=round(float(row["Close"]), 2),
            volume=float(row["Volume"]),
        )
        for dt, row in df.iterrows()
    ]

    return AnalyzeResponse(
        ticker=sym,
        quote=quote,
        model=ModelSummary(
            current_price=round(model["current_price"], 2),
            r_squared=round(model["r_squared"] * 100.0, 1),
            slope=round(model["slope"], 6),
            daily_drift_pct=model["daily_drift_pct"],
            annualized_drift_pct=model["annualized_drift_pct"],
            ev_target=round(model["ev_target"], 2),
            upper_band=round(model["upper_band"], 2),
            lower_band=round(model["lower_band"], 2),
            upside_pct=model["upside_pct"],
            channel_position_pct=model["channel_position_pct"],
            structure=model["structure"],
            structure_label=s_label,
            structure_color=s_color,
            score=model["score"],
            score_breakdown=ScoreBreakdown(**model["score_breakdown"]),
            s1=model["s1"],
            s2=model["s2"],
            r1=model["r1"],
            r2=model["r2"],
            s1_touches=model["s1_touches"],
            r1_touches=model["r1_touches"],
            window=model["window"],
            std_dev=round(model["std_dev"], 2),
        ),
        indicators=IndicatorsSnapshot(
            ema20=ind_latest["ema20"],
            ema50=ind_latest["ema50"],
            ema200=ind_latest["ema200"],
            rsi14=ind_latest["rsi14"],
            macd=ind_latest["macd"],
            macd_signal=ind_latest["macd_signal"],
            macd_hist=ind_latest["macd_hist"],
            macd_improving=ind_latest["macd_improving"],
            atr14=ind_latest["atr14"],
            atr_pct=ind_latest["atr_pct"],
            volume_ratio=ind_latest["volume_ratio"],
            annualized_vol_pct=ind_latest["annualized_vol_pct"],
            trend_alignment=ind_latest["trend_alignment"],
            poc=ind_latest.get("poc"),
        ),
        forecast=ForecastSummary(
            horizon_days=fc["horizon_days"],
            horizon_label=config.FORECAST_HORIZONS.get(fc["horizon_days"], f"{fc['horizon_days']} วัน"),
            confidence=fc["confidence"],
            target_price=fc["target_price"],
            target_low=fc["target_low"],
            target_high=fc["target_high"],
            target_change_pct=target_change_pct,
            points=forecast_points,
        ),
        entry_setup=EntrySetup(
            entry_low=setup["entry_low"],
            entry_high=setup["entry_high"],
            stop_loss=setup["stop_loss"],
            target=setup["target"],
            tp1=setup.get("tp1"),
            tp2=setup.get("tp2"),
            risk_reward=setup["risk_reward"],
            risk_reward_tp2=setup.get("risk_reward_tp2"),
            entry_status=setup["entry_status"],
            entry_status_label=e_label,
            entry_status_color=e_color,
            zone_strength=setup.get("zone_strength", "LOW"),
            confluence_count=setup.get("confluence_count", 0),
            confluence_factors=setup.get("confluence_factors", []),
            candle_confirmed=setup.get("candle_confirmed", False),
        ),
        chart=ChartData(
            candles=candles,
            ev_line=_series_to_line_points(model["line"]),
            upper_band=_series_to_line_points(model["upper"]),
            lower_band=_series_to_line_points(model["lower"]),
            ema20=_series_to_line_points(ind_series["ema20"]),
            ema50=_series_to_line_points(ind_series["ema50"]),
            ema200=_series_to_line_points(ind_series["ema200"]),
            rsi14=_series_to_line_points(ind_series["rsi14"]),
        ),
    )


def _df_to_screener_response(df: pd.DataFrame | None) -> ScreenerResponse:
    if df is None or df.empty:
        return ScreenerResponse(scanned_at=None, total=0, actionable=0, in_zone=0, rows=[])

    rows: list[ScreenerRow] = []
    for _, row in df.iterrows():
        struct = str(row.get("structure", "NEUTRAL"))
        s_label, s_color = config.STRUCTURE_LABELS.get(struct, ("ปกติ", "#94a3b8"))
        e_status = str(row.get("entry_status", "DOWNTREND_NO_SETUP"))
        e_label, e_color = config.ENTRY_STATUS_LABELS.get(e_status, ("ไม่ทราบสถานะ", "#94a3b8"))

        rows.append(
            ScreenerRow(
                ticker=str(row["ticker"]),
                price=float(row["price"]),
                r_squared=float(row["r_squared"]),
                ev_target=float(row["ev_target"]),
                upside_pct=float(row["upside_pct"]),
                structure=struct,
                structure_label=s_label,
                structure_color=s_color,
                score=float(row["score"]),
                rsi14=_clean_opt_float(row.get("rsi14")),
                atr_pct=_clean_opt_float(row.get("atr_pct")),
                trend_alignment=_clean_opt_str(row.get("trend_alignment")),
                s1=_clean_opt_float(row.get("s1")),
                r1=_clean_opt_float(row.get("r1")),
                forecast_days=int(row.get("forecast_days", config.DEFAULT_FORECAST_HORIZON)),
                forecast_target=float(row["forecast_target"]),
                forecast_low=float(row["forecast_low"]),
                forecast_high=float(row["forecast_high"]),
                entry_low=_clean_opt_float(row.get("entry_low")),
                entry_high=_clean_opt_float(row.get("entry_high")),
                stop_loss=_clean_opt_float(row.get("stop_loss")),
                risk_reward=_clean_opt_float(row.get("risk_reward")),
                entry_status=e_status,
                entry_status_label=e_label,
                entry_status_color=e_color,
                scanned_at=_clean_opt_str(row.get("scanned_at")),
            )
        )

    rows.sort(key=lambda r: r.score, reverse=True)
    scanned_at = max((r.scanned_at for r in rows if r.scanned_at), default=None)
    actionable = sum(1 for r in rows if r.score >= config.MIN_SIGNAL_SCORE)
    in_zone = sum(
        1 for r in rows if r.entry_status in ("IN_ZONE", "CONFIRMED_ENTRY", "IN_ZONE_WAIT_CONFIRM")
    )
    return ScreenerResponse(
        scanned_at=scanned_at,
        total=len(rows),
        actionable=actionable,
        in_zone=in_zone,
        rows=rows,
    )


@app.get("/api/backtest/portfolio", response_model=PortfolioBacktestResponse)
def backtest_portfolio(
    period: str = Query(default="3y", pattern="^(2y|3y|5y)$"),
    window: int = Query(default=config.REGRESSION_WINDOW, ge=40, le=200),
    horizon: int = Query(default=config.DEFAULT_FORECAST_HORIZON, ge=5, le=60),
    min_score: float = Query(default=config.MIN_SIGNAL_SCORE, ge=30, le=85),
    require_confirm: bool = Query(default=True),
    max_tickers: int = Query(default=20, ge=5, le=58),
):
    return run_portfolio_backtest(
        period=period,
        window=window,
        horizon_days=horizon,
        min_score=min_score,
        require_confirm=require_confirm,
        max_tickers=max_tickers,
    )


@app.get("/api/backtest/{ticker}", response_model=BacktestResponse)
def backtest_ticker(
    ticker: str,
    period: str = Query(default="3y", pattern="^(2y|3y|5y)$"),
    window: int = Query(default=config.REGRESSION_WINDOW, ge=40, le=200),
    horizon: int = Query(default=config.DEFAULT_FORECAST_HORIZON, ge=5, le=60),
    min_score: float = Query(default=config.MIN_SIGNAL_SCORE, ge=30, le=85),
    require_confirm: bool = Query(default=True),
):
    sym = ticker.strip().upper()
    if not sym or len(sym) > 12:
        raise HTTPException(status_code=400, detail="ชื่อย่อหุ้นไม่ถูกต้อง")
    df = get_cached_history(sym, period=period)
    if df is None or df.empty or len(df) < 120:
        raise HTTPException(status_code=404, detail=f"ไม่พบข้อมูลย้อนหลังเพียงพอสำหรับ '{sym}'")
    return run_ticker_backtest(
        df,
        ticker=sym,
        window=window,
        horizon_days=horizon,
        min_score=min_score,
        require_confirm=require_confirm,
    )


@app.get("/api/screener", response_model=ScreenerResponse)
def get_screener():
    if not config.SIGNALS_PATH.exists():
        return ScreenerResponse(scanned_at=None, total=0, actionable=0, in_zone=0, rows=[])
    try:
        df = pd.read_csv(config.SIGNALS_PATH)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to read signals.csv: %s", exc)
        return ScreenerResponse(scanned_at=None, total=0, actionable=0, in_zone=0, rows=[])
    return _df_to_screener_response(df)


@app.post("/api/screener/run", response_model=ScreenerResponse)
def trigger_screener_scan():
    if not _scan_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="กำลังสแกนตลาดอยู่ กรุณารอสักครู่")
    try:
        df = run_scan(config.DEFAULT_UNIVERSE, config.MIN_SIGNAL_SCORE)
        config.SIGNALS_PATH.parent.mkdir(exist_ok=True)
        df.to_csv(config.SIGNALS_PATH, index=False)
        return _df_to_screener_response(df)
    finally:
        _scan_lock.release()


# ----------------------------------------------------------------------
# Serve built React SPA if frontend/dist exists
# ----------------------------------------------------------------------
if config.FRONTEND_DIST_DIR.exists():
    assets_dir = config.FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        target = config.FRONTEND_DIST_DIR / full_path
        if full_path and target.is_file():
            return FileResponse(target)
        return FileResponse(config.FRONTEND_DIST_DIR / "index.html")
