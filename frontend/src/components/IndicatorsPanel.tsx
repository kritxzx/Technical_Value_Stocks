import { Activity, Gauge, Layers, TrendingUp } from 'lucide-react';
import { TREND_ALIGNMENT_LABELS, fmtPrice } from '../lib/format';
import type { AnalyzeResponse } from '../types/stock';

interface IndicatorsPanelProps {
  data: AnalyzeResponse;
}

export function IndicatorsPanel({ data }: IndicatorsPanelProps) {
  const { model, indicators } = data;
  const rsi = indicators.rsi14 ?? 50;
  const trendMeta = TREND_ALIGNMENT_LABELS[indicators.trend_alignment] ?? {
    label: indicators.trend_alignment,
    color: '#94a3b8',
  };

  const scoreItems = [
    { label: 'Trend Fit (R²)', value: model.score_breakdown.r2, max: 30, color: '#22d3ee' },
    { label: 'Channel Pullback', value: model.score_breakdown.channel, max: 25, color: '#ff2e97' },
    { label: 'EV Upside', value: model.score_breakdown.upside, max: 15, color: '#00f5d4' },
    { label: 'RSI & MACD', value: model.score_breakdown.momentum, max: 15, color: '#a855f7' },
    { label: 'EMA Alignment', value: model.score_breakdown.trend, max: 15, color: '#facc15' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      {/* Signal Score Breakdown */}
      <div className="neon-card rounded-2xl p-4 sm:p-5 xl:col-span-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-[#ff2e97]" />
            <h3 className="text-sm font-semibold text-white">Confluence Signal Score</h3>
          </div>
          <div className="flex items-baseline gap-1 font-mono-num">
            <span className="text-2xl font-bold neon-text-pink">{model.score.toFixed(1)}</span>
            <span className="text-xs text-slate-500">/ 100</span>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {scoreItems.map((item) => {
            const pct = Math.min(100, Math.max(0, (item.value / item.max) * 100));
            return (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-300">{item.label}</span>
                  <span className="font-mono-num text-slate-400">
                    <strong className="text-white">{item.value.toFixed(1)}</strong> / {item.max}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: item.color,
                      boxShadow: `0 0 10px ${item.color}66`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Technical Confluence & S/R Levels */}
      <div className="neon-card rounded-2xl p-4 sm:p-5 xl:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#00f5d4]" />
            <h3 className="text-sm font-semibold text-white">อินดิเคเตอร์ยืนยัน & แนวรับ-แนวต้าน</h3>
          </div>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{
              backgroundColor: `${trendMeta.color}1a`,
              color: trendMeta.color,
              border: `1px solid ${trendMeta.color}44`,
            }}
          >
            {trendMeta.label}
          </span>
        </div>

        {/* RSI Bar */}
        <div className="mt-4 rounded-xl border border-white/5 bg-black/30 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">RSI (14) — โมเมนตัมระยะสั้น</span>
            <span className="font-mono-num font-bold text-white">
              {indicators.rsi14 !== null && indicators.rsi14 !== undefined
                ? indicators.rsi14.toFixed(1)
                : '—'}
              <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                {rsi >= 70 ? '(Overbought)' : rsi <= 30 ? '(Oversold)' : '(Healthy Zone)'}
              </span>
            </span>
          </div>
          <div className="relative mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-[#00f5d4]/40 via-slate-700/60 to-[#ff2e97]/50">
            <div
              className="absolute top-0 h-full w-2 -translate-x-1/2 rounded-full bg-white shadow-[0_0_10px_#fff]"
              style={{ left: `${Math.min(100, Math.max(0, rsi))}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between font-mono-num text-[10px] text-slate-500">
            <span>0</span>
            <span>30 (Oversold)</span>
            <span>50</span>
            <span>70 (Overbought)</span>
            <span>100</span>
          </div>
        </div>

        {/* Grid of Indicators */}
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <div className="rounded-xl border border-white/5 bg-black/30 p-2.5">
            <div className="text-[11px] text-slate-400">EMA 20 / 50 / 200</div>
            <div className="mt-1 space-y-0.5 font-mono-num text-xs">
              <div className="flex justify-between">
                <span className="text-amber-300">EMA20</span>
                <span className="text-white">{fmtPrice(indicators.ema20)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-400">EMA50</span>
                <span className="text-white">{fmtPrice(indicators.ema50)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">EMA200</span>
                <span className="text-white">{fmtPrice(indicators.ema200)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-black/30 p-2.5">
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Layers className="h-3 w-3 text-amber-300" />
              Macro Support / Resist
            </div>
            <div className="mt-1 space-y-0.5 font-mono-num text-xs">
              <div className="flex justify-between">
                <span className="text-pink-400">R1 ({model.r1_touches}x)</span>
                <span className="text-white">{fmtPrice(model.r1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-300">S1 ({model.s1_touches}x)</span>
                <span className="text-white">{fmtPrice(model.s1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">S2 / R2</span>
                <span className="text-slate-300">
                  {fmtPrice(model.s2)} / {fmtPrice(model.r2)}
                </span>
              </div>
            </div>
          </div>

          <div className="col-span-2 rounded-xl border border-white/5 bg-black/30 p-2.5 sm:col-span-1">
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <TrendingUp className="h-3 w-3 text-[#00f5d4]" />
              Momentum & Risk
            </div>
            <div className="mt-1 space-y-0.5 font-mono-num text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">MACD Hist</span>
                <span
                  className={
                    indicators.macd_improving ? 'text-[#00f5d4]' : 'text-[#ff2e97]'
                  }
                >
                  {indicators.macd_hist !== null && indicators.macd_hist !== undefined
                    ? `${indicators.macd_hist >= 0 ? '+' : ''}${indicators.macd_hist.toFixed(2)}`
                    : '—'}{' '}
                  {indicators.macd_improving ? '↑' : '↓'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Vol Ratio</span>
                <span className="text-white">
                  {indicators.volume_ratio ? `${indicators.volume_ratio.toFixed(2)}x` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ann. Vol</span>
                <span className="text-white">{indicators.annualized_vol_pct.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
