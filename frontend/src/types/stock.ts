export interface CandlePoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LinePoint {
  time: string;
  value: number;
}

export interface ForecastPoint {
  time: string;
  value: number;
  low: number;
  high: number;
}

export interface ScoreBreakdown {
  r2: number;
  channel: number;
  upside: number;
  momentum: number;
  trend: number;
}

export interface QuoteInfo {
  ticker: string;
  name: string;
  sector?: string | null;
  exchange: string;
  currency: string;
  last_price: number;
  previous_close?: number | null;
  change?: number | null;
  change_pct?: number | null;
  day_high?: number | null;
  day_low?: number | null;
  year_high?: number | null;
  year_low?: number | null;
  market_cap?: number | null;
  volume?: number | null;
  is_live: boolean;
}

export interface IndicatorsSnapshot {
  ema20?: number | null;
  ema50?: number | null;
  ema200?: number | null;
  rsi14?: number | null;
  macd?: number | null;
  macd_signal?: number | null;
  macd_hist?: number | null;
  macd_improving: boolean;
  atr14?: number | null;
  atr_pct?: number | null;
  volume_ratio?: number | null;
  annualized_vol_pct: number;
  trend_alignment: string;
  poc?: number | null;
}

export interface ForecastSummary {
  horizon_days: number;
  horizon_label: string;
  confidence: number;
  target_price: number;
  target_low: number;
  target_high: number;
  target_change_pct: number;
  points: ForecastPoint[];
}

export interface EntrySetup {
  entry_low?: number | null;
  entry_high?: number | null;
  stop_loss?: number | null;
  target: number;
  tp1?: number | null;
  tp2?: number | null;
  risk_reward?: number | null;
  risk_reward_tp2?: number | null;
  entry_status: string;
  entry_status_label: string;
  entry_status_color: string;
  zone_strength: string;
  confluence_count: number;
  confluence_factors: string[];
  candle_confirmed: boolean;
}

export interface ModelSummary {
  current_price: number;
  r_squared: number;
  slope: number;
  daily_drift_pct: number;
  annualized_drift_pct: number;
  ev_target: number;
  upper_band: number;
  lower_band: number;
  upside_pct: number;
  channel_position_pct: number;
  structure: string;
  structure_label: string;
  structure_color: string;
  score: number;
  score_breakdown: ScoreBreakdown;
  s1?: number | null;
  s2?: number | null;
  r1?: number | null;
  r2?: number | null;
  s1_touches: number;
  r1_touches: number;
  window: number;
  std_dev: number;
}

export interface ChartData {
  candles: CandlePoint[];
  ev_line: LinePoint[];
  upper_band: LinePoint[];
  lower_band: LinePoint[];
  ema20: LinePoint[];
  ema50: LinePoint[];
  ema200: LinePoint[];
  rsi14: LinePoint[];
}

export interface AnalyzeResponse {
  ticker: string;
  quote: QuoteInfo;
  model: ModelSummary;
  indicators: IndicatorsSnapshot;
  forecast: ForecastSummary;
  entry_setup: EntrySetup;
  chart: ChartData;
}

export interface ScreenerRow {
  ticker: string;
  price: number;
  r_squared: number;
  ev_target: number;
  upside_pct: number;
  structure: string;
  structure_label: string;
  structure_color: string;
  score: number;
  rsi14?: number | null;
  atr_pct?: number | null;
  trend_alignment?: string | null;
  s1?: number | null;
  r1?: number | null;
  forecast_days: number;
  forecast_target: number;
  forecast_low: number;
  forecast_high: number;
  entry_low?: number | null;
  entry_high?: number | null;
  stop_loss?: number | null;
  risk_reward?: number | null;
  entry_status: string;
  entry_status_label: string;
  entry_status_color: string;
  scanned_at?: string | null;
}

export interface ScreenerResponse {
  scanned_at?: string | null;
  total: number;
  actionable: number;
  in_zone: number;
  rows: ScreenerRow[];
}

export interface BacktestTrade {
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  stop_loss: number;
  target: number;
  return_pct: number;
  exit_reason: string;
  score: number;
  confluence_count: number;
  bars_held: number;
}

export interface EquityPoint {
  time: string;
  strategy: number;
  buy_hold: number;
}

export interface BacktestResponse {
  ticker: string;
  period_start: string;
  period_end: string;
  bars_tested: number;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate_pct: number;
  profit_factor: number;
  expectancy_pct: number;
  avg_win_pct: number;
  avg_loss_pct: number;
  realized_rr: number;
  total_return_pct: number;
  buy_hold_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  verdict: string;
  verdict_text: string;
  equity_curve: EquityPoint[];
  trades: BacktestTrade[];
}

export interface PortfolioTickerSummary {
  ticker: string;
  total_trades: number;
  win_rate_pct: number;
  profit_factor: number;
  expectancy_pct: number;
  total_return_pct: number;
  buy_hold_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  verdict: string;
}

export interface PortfolioBacktestResponse {
  period: string;
  tickers_tested: number;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate_pct: number;
  profit_factor: number;
  expectancy_pct: number;
  avg_win_pct: number;
  avg_loss_pct: number;
  realized_rr: number;
  verdict: string;
  verdict_text: string;
  tickers: PortfolioTickerSummary[];
}

export type ActiveTab = 'deep-dive' | 'screener' | 'backtest' | 'watchlist';
