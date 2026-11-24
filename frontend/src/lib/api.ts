import type {
  AnalyzeResponse,
  BacktestResponse,
  PortfolioBacktestResponse,
  ScreenerResponse,
} from '../types/stock';

const API_BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) message = body.detail;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function fetchAnalysis(
  ticker: string,
  windowDays = 90,
  horizonDays = 20,
  refresh = false
): Promise<AnalyzeResponse> {
  const params = new URLSearchParams({
    window: String(windowDays),
    horizon: String(horizonDays),
    refresh: String(refresh),
  });
  const res = await fetch(`${API_BASE}/analyze/${encodeURIComponent(ticker)}?${params}`);
  return handleResponse<AnalyzeResponse>(res);
}

export async function fetchScreener(): Promise<ScreenerResponse> {
  const res = await fetch(`${API_BASE}/screener`);
  return handleResponse<ScreenerResponse>(res);
}

export async function runScreenerScan(): Promise<ScreenerResponse> {
  const res = await fetch(`${API_BASE}/screener/run`, { method: 'POST' });
  return handleResponse<ScreenerResponse>(res);
}

export async function fetchUniverse(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/universe`);
  const data = await handleResponse<{ tickers: string[] }>(res);
  return data.tickers;
}

export async function fetchTickerBacktest(
  ticker: string,
  opts: {
    period?: '2y' | '3y' | '5y';
    window?: number;
    horizon?: number;
    minScore?: number;
    requireConfirm?: boolean;
  } = {}
): Promise<BacktestResponse> {
  const params = new URLSearchParams({
    period: opts.period ?? '3y',
    window: String(opts.window ?? 90),
    horizon: String(opts.horizon ?? 20),
    min_score: String(opts.minScore ?? 55),
    require_confirm: String(opts.requireConfirm ?? true),
  });
  const res = await fetch(`${API_BASE}/backtest/${encodeURIComponent(ticker)}?${params}`);
  return handleResponse<BacktestResponse>(res);
}

export async function fetchPortfolioBacktest(opts: {
  period?: '2y' | '3y' | '5y';
  window?: number;
  horizon?: number;
  minScore?: number;
  requireConfirm?: boolean;
  maxTickers?: number;
} = {}): Promise<PortfolioBacktestResponse> {
  const params = new URLSearchParams({
    period: opts.period ?? '3y',
    window: String(opts.window ?? 90),
    horizon: String(opts.horizon ?? 20),
    min_score: String(opts.minScore ?? 55),
    require_confirm: String(opts.requireConfirm ?? true),
    max_tickers: String(opts.maxTickers ?? 25),
  });
  const res = await fetch(`${API_BASE}/backtest/portfolio?${params}`);
  return handleResponse<PortfolioBacktestResponse>(res);
}
