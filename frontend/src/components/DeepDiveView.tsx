import { AlertCircle, ArrowDownRight, ArrowUpRight, Radio } from 'lucide-react';
import { fmtCompact, fmtPct, fmtPrice, fmtVolume } from '../lib/format';
import type { AnalyzeResponse } from '../types/stock';
import { BacktestPanel } from './BacktestPanel';
import { IndicatorsPanel } from './IndicatorsPanel';
import { StockChart } from './StockChart';
import { TradeSetupPanel } from './TradeSetupPanel';

interface DeepDiveViewProps {
  data: AnalyzeResponse | null;
  loading: boolean;
  error: string | null;
  windowDays: number;
  horizonDays: number;
  onChangeWindow: (w: number) => void;
  onChangeHorizon: (h: number) => void;
}

export function DeepDiveView({
  data,
  loading,
  error,
  windowDays,
  horizonDays,
  onChangeWindow,
  onChangeHorizon,
}: DeepDiveViewProps) {
  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="neon-card h-28 animate-pulse rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="neon-card h-24 animate-pulse rounded-2xl" />
          ))}
        </div>
        <div className="neon-card h-[420px] animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="neon-card-pink flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center">
        <AlertCircle className="h-10 w-10 text-[#ff2e97]" />
        <h3 className="mt-3 text-base font-semibold text-white">ไม่สามารถโหลดข้อมูลหุ้นได้</h3>
        <p className="mt-1 max-w-md text-sm text-slate-400">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { quote, model } = data;
  const isUp = (quote.change_pct ?? 0) >= 0;

  return (
    <div className={`space-y-4 transition-opacity ${loading ? 'opacity-70' : 'opacity-100'}`}>
      {/* Hero Ticker Header */}
      <div className="neon-card rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono-num text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {data.ticker}
              </h1>
              {quote.sector && (
                <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-slate-300">
                  {quote.sector}
                </span>
              )}
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: quote.is_live ? 'rgba(0,245,212,0.12)' : 'rgba(148,163,184,0.12)',
                  color: quote.is_live ? '#00f5d4' : '#94a3b8',
                }}
              >
                <Radio className="h-3 w-3" />
                {quote.is_live ? 'Live Quote' : 'Daily Close'}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-400">{quote.name}</p>
          </div>

          <div className="flex items-baseline gap-3 sm:flex-col sm:items-end sm:gap-1">
            <div className="font-mono-num text-3xl font-bold text-white sm:text-4xl">
              {fmtPrice(model.current_price)}
            </div>
            {quote.change_pct !== null && quote.change_pct !== undefined && (
              <div
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-mono-num text-xs font-semibold ${
                  isUp
                    ? 'bg-[#00f5d4]/15 text-[#00f5d4]'
                    : 'bg-[#ff2e97]/15 text-[#ff2e97]'
                }`}
              >
                {isUp ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {quote.change !== null && quote.change !== undefined
                  ? `${quote.change >= 0 ? '+' : ''}${quote.change.toFixed(2)} `
                  : ''}
                ({fmtPct(quote.change_pct)})
              </div>
            )}
          </div>
        </div>

        {/* Metadata strip */}
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-xs sm:grid-cols-4">
          <div>
            <span className="text-slate-500">Market Cap: </span>
            <span className="font-mono-num font-medium text-slate-200">
              {fmtCompact(quote.market_cap)}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Volume: </span>
            <span className="font-mono-num font-medium text-slate-200">
              {fmtVolume(quote.volume)}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Day Range: </span>
            <span className="font-mono-num font-medium text-slate-200">
              {fmtPrice(quote.day_low)} – {fmtPrice(quote.day_high)}
            </span>
          </div>
          <div>
            <span className="text-slate-500">52W Range: </span>
            <span className="font-mono-num font-medium text-slate-200">
              {fmtPrice(quote.year_low)} – {fmtPrice(quote.year_high)}
            </span>
          </div>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="neon-card rounded-2xl p-3.5 sm:p-4">
          <div className="text-xs text-slate-400">ราคาเหมาะสม (EV Target)</div>
          <div className="mt-1 font-mono-num text-xl font-bold text-[#22d3ee] sm:text-2xl">
            {fmtPrice(model.ev_target)}
          </div>
          <div
            className={`mt-1 font-mono-num text-xs font-semibold ${
              model.upside_pct >= 0 ? 'text-[#00f5d4]' : 'text-[#ff2e97]'
            }`}
          >
            Upside {fmtPct(model.upside_pct)}
          </div>
        </div>

        <div className="neon-card rounded-2xl p-3.5 sm:p-4">
          <div className="text-xs text-slate-400">ความชัดเจนเทรนด์ (R²)</div>
          <div className="mt-1 font-mono-num text-xl font-bold text-white sm:text-2xl">
            {model.r_squared.toFixed(1)}%
          </div>
          <div className="mt-1 font-mono-num text-xs text-slate-400">
            Drift {fmtPct(model.daily_drift_pct)}/วัน ({model.window}D)
          </div>
        </div>

        <div className="neon-card rounded-2xl p-3.5 sm:p-4">
          <div className="text-xs text-slate-400">ตำแหน่งในกรอบ Channel</div>
          <div className="mt-1 font-mono-num text-xl font-bold text-white sm:text-2xl">
            {model.channel_position_pct.toFixed(0)}%
          </div>
          <div className="mt-1 font-mono-num text-[11px] text-slate-400">
            {fmtPrice(model.lower_band)} – {fmtPrice(model.upper_band)}
          </div>
        </div>

        <div className="neon-card rounded-2xl p-3.5 sm:p-4">
          <div className="text-xs text-slate-400">สถานะโครงสร้างราคา</div>
          <div className="mt-2">
            <span
              className="inline-block rounded-lg px-2.5 py-1 text-xs font-semibold leading-snug"
              style={{
                backgroundColor: `${model.structure_color}22`,
                color: model.structure_color,
                border: `1px solid ${model.structure_color}44`,
              }}
            >
              {model.structure_label}
            </span>
          </div>
          <div className="mt-1.5 font-mono-num text-[11px] text-slate-400">
            Score: <strong className="text-[#ff2e97]">{model.score.toFixed(1)}</strong>/100
          </div>
        </div>
      </div>

      {/* TradingView Interactive Chart */}
      <StockChart data={data} />

      {/* Forecast & ATR Trade Setup */}
      <TradeSetupPanel
        data={data}
        windowDays={windowDays}
        horizonDays={horizonDays}
        onChangeWindow={onChangeWindow}
        onChangeHorizon={onChangeHorizon}
      />

      {/* Indicators & Score Breakdown */}
      <IndicatorsPanel data={data} />

      {/* Walk-Forward Backtest for this ticker */}
      <BacktestPanel
        ticker={data.ticker}
        windowDays={windowDays}
        horizonDays={horizonDays}
      />
    </div>
  );
}
