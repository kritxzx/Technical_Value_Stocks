"""Pydantic response schemas for the US Quant Screener FastAPI backend."""
from __future__ import annotations

from pydantic import BaseModel


class CandlePoint(BaseModel):
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: float


class LinePoint(BaseModel):
    time: str
    value: float


class ForecastPoint(BaseModel):
    time: str
    value: float
    low: float
    high: float


class ScoreBreakdown(BaseModel):
    r2: float
    channel: float
    upside: float
    momentum: float
    trend: float


class QuoteInfo(BaseModel):
    ticker: str
    name: str
    sector: str | None = None
    exchange: str = ""
    currency: str = "USD"
    last_price: float
    previous_close: float | None = None
    change: float | None = None
    change_pct: float | None = None
    day_high: float | None = None
    day_low: float | None = None
    year_high: float | None = None
    year_low: float | None = None
    market_cap: float | None = None
    volume: int | None = None
    is_live: bool = False


class IndicatorsSnapshot(BaseModel):
    ema20: float | None = None
    ema50: float | None = None
    ema200: float | None = None
    rsi14: float | None = None
    macd: float | None = None
    macd_signal: float | None = None
    macd_hist: float | None = None
    macd_improving: bool = False
    atr14: float | None = None
    atr_pct: float | None = None
    volume_ratio: float | None = None
    annualized_vol_pct: float
    trend_alignment: str
    poc: float | None = None


class ForecastSummary(BaseModel):
    horizon_days: int
    horizon_label: str
    confidence: float
    target_price: float
    target_low: float
    target_high: float
    target_change_pct: float
    points: list[ForecastPoint]


class EntrySetup(BaseModel):
    entry_low: float | None = None
    entry_high: float | None = None
    stop_loss: float | None = None
    target: float
    tp1: float | None = None
    tp2: float | None = None
    risk_reward: float | None = None
    risk_reward_tp2: float | None = None
    entry_status: str
    entry_status_label: str
    entry_status_color: str
    zone_strength: str = "LOW"
    confluence_count: int = 0
    confluence_factors: list[str] = []
    candle_confirmed: bool = False


class ModelSummary(BaseModel):
    current_price: float
    r_squared: float
    slope: float
    daily_drift_pct: float
    annualized_drift_pct: float
    ev_target: float
    upper_band: float
    lower_band: float
    upside_pct: float
    channel_position_pct: float
    structure: str
    structure_label: str
    structure_color: str
    score: float
    score_breakdown: ScoreBreakdown
    s1: float | None = None
    s2: float | None = None
    r1: float | None = None
    r2: float | None = None
    s1_touches: int = 0
    r1_touches: int = 0
    window: int
    std_dev: float


class ChartData(BaseModel):
    candles: list[CandlePoint]
    ev_line: list[LinePoint]
    upper_band: list[LinePoint]
    lower_band: list[LinePoint]
    ema20: list[LinePoint]
    ema50: list[LinePoint]
    ema200: list[LinePoint]
    rsi14: list[LinePoint]


class AnalyzeResponse(BaseModel):
    ticker: str
    quote: QuoteInfo
    model: ModelSummary
    indicators: IndicatorsSnapshot
    forecast: ForecastSummary
    entry_setup: EntrySetup
    chart: ChartData


class ScreenerRow(BaseModel):
    ticker: str
    price: float
    r_squared: float
    ev_target: float
    upside_pct: float
    structure: str
    structure_label: str
    structure_color: str
    score: float
    rsi14: float | None = None
    atr_pct: float | None = None
    trend_alignment: str | None = None
    s1: float | None = None
    r1: float | None = None
    forecast_days: int
    forecast_target: float
    forecast_low: float
    forecast_high: float
    entry_low: float | None = None
    entry_high: float | None = None
    stop_loss: float | None = None
    risk_reward: float | None = None
    entry_status: str
    entry_status_label: str
    entry_status_color: str
    scanned_at: str | None = None


class ScreenerResponse(BaseModel):
    scanned_at: str | None = None
    total: int
    actionable: int
    in_zone: int
    rows: list[ScreenerRow]


class BacktestTrade(BaseModel):
    entry_date: str
    exit_date: str
    entry_price: float
    exit_price: float
    stop_loss: float
    target: float
    return_pct: float
    exit_reason: str
    score: float
    confluence_count: int
    bars_held: int


class EquityPoint(BaseModel):
    time: str
    strategy: float
    buy_hold: float


class BacktestResponse(BaseModel):
    ticker: str
    period_start: str
    period_end: str
    bars_tested: int
    total_trades: int
    wins: int
    losses: int
    win_rate_pct: float
    profit_factor: float
    expectancy_pct: float
    avg_win_pct: float
    avg_loss_pct: float
    realized_rr: float
    total_return_pct: float
    buy_hold_return_pct: float
    max_drawdown_pct: float
    sharpe_ratio: float
    verdict: str
    verdict_text: str
    equity_curve: list[EquityPoint]
    trades: list[BacktestTrade]


class PortfolioTickerSummary(BaseModel):
    ticker: str
    total_trades: int
    win_rate_pct: float
    profit_factor: float
    expectancy_pct: float
    total_return_pct: float
    buy_hold_return_pct: float
    max_drawdown_pct: float
    sharpe_ratio: float
    verdict: str


class PortfolioBacktestResponse(BaseModel):
    period: str
    tickers_tested: int
    total_trades: int
    wins: int
    losses: int
    win_rate_pct: float
    profit_factor: float
    expectancy_pct: float
    avg_win_pct: float
    avg_loss_pct: float
    realized_rr: float
    verdict: str
    verdict_text: str
    tickers: list[PortfolioTickerSummary]
