import { useEffect, useRef, useState } from 'react';
import {
  ColorType,
  LineSeries,
  LineStyle,
  createChart,
} from 'lightweight-charts';
import { ChevronDown, ChevronUp, FlaskConical, ShieldCheck } from 'lucide-react';
import { fetchTickerBacktest } from '../lib/api';
import { fmtPct, fmtPrice } from '../lib/format';
import type { BacktestResponse } from '../types/stock';

interface BacktestPanelProps {
  ticker: string;
  windowDays: number;
  horizonDays: number;
}

const VERDICT_STYLES: Record<string, { label: string; color: string }> = {
  STRONG_EDGE: { label: 'STRONG EDGE — กลยุทธ์ได้เปรียบชัดเจน', color: '#00f5d4' },
  MODERATE_EDGE: { label: 'MODERATE EDGE — เป็นบวกแต่ต้องคัดกรองเพิ่ม', color: '#facc15' },
  NO_EDGE: { label: 'NO EDGE — ไม่เหมาะกับหุ้นตัวนี้', color: '#ff2e97' },
  INSUFFICIENT_DATA: { label: 'INSUFFICIENT DATA — จำนวนไม้น้อยเกินไป', color: '#94a3b8' },
};

export function BacktestPanel({ ticker, windowDays, horizonDays }: BacktestPanelProps) {
  const [period, setPeriod] = useState<'3y' | '5y'>('3y');
  const [minScore, setMinScore] = useState<number>(55);
  const [requireConfirm, setRequireConfirm] = useState<boolean>(true);
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showTrades, setShowTrades] = useState<boolean>(false);

  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTickerBacktest(ticker, {
      period,
      window: windowDays,
      horizon: horizonDays,
      minScore,
      requireConfirm,
    })
      .then((res) => {
        if (!cancelled) setResult(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Backtest ล้มเหลว');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, period, windowDays, horizonDays, minScore, requireConfirm]);

  useEffect(() => {
    const container = chartRef.current;
    if (!container || !result || result.equity_curve.length === 0) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0d16' },
        textColor: '#94a3b8',
        fontFamily: 'JetBrains Mono, Inter, sans-serif',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.08)' },
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.08)' },
      width: container.clientWidth,
      height: 210,
    });

    const stratSeries = chart.addSeries(LineSeries, {
      color: '#ff2e97',
      lineWidth: 2,
      title: 'Strategy',
    });
    stratSeries.setData(result.equity_curve.map((p) => ({ time: p.time, value: p.strategy })));

    const bhSeries = chart.addSeries(LineSeries, {
      color: '#64748b',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: 'Buy & Hold',
    });
    bhSeries.setData(result.equity_curve.map((p) => ({ time: p.time, value: p.buy_hold })));

    chart.timeScale().fitContent();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    ro.observe(container);
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [result]);

  const verdictStyle = VERDICT_STYLES[result?.verdict ?? 'INSUFFICIENT_DATA'];

  return (
    <div className="neon-card rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-[#ff2e97]" />
            <h3 className="text-sm font-semibold text-white">
              Walk-Forward Backtest — พิสูจน์กลยุทธ์บน {ticker} (Zero Lookahead)
            </h3>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">
            จำลองเข้าซื้อราคาเปิดวันถัดไป + หัก Slippage 0.1%/ขา · เช็ค SL ก่อน TP แบบเข้มงวด
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex rounded-lg bg-black/40 p-0.5 ring-1 ring-white/10">
            {(['3y', '5y'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-md px-2.5 py-1 font-mono-num font-semibold transition ${
                  period === p ? 'bg-[#ff2e97] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>

          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 font-mono-num text-xs text-slate-200 focus:border-[#ff2e97]/60 focus:outline-none"
          >
            {[50, 55, 60, 65].map((s) => (
              <option key={s} value={s}>
                Score ≥ {s}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setRequireConfirm((v) => !v)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
              requireConfirm
                ? 'border-[#00f5d4]/40 bg-[#00f5d4]/10 text-[#00f5d4]'
                : 'border-white/10 bg-black/30 text-slate-400'
            }`}
          >
            กันรับมีด: {requireConfirm ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {loading && !result ? (
        <div className="mt-4 h-44 animate-pulse rounded-xl bg-white/5" />
      ) : error ? (
        <div className="mt-4 rounded-xl border border-[#ff2e97]/30 bg-[#ff2e97]/10 p-3 text-xs text-[#ff2e97]">
          {error}
        </div>
      ) : result ? (
        <div className={`mt-4 space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {/* Verdict Banner */}
          <div
            className="flex flex-col gap-1 rounded-xl px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            style={{
              backgroundColor: `${verdictStyle.color}14`,
              border: `1px solid ${verdictStyle.color}44`,
            }}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: verdictStyle.color }} />
              <span className="text-xs font-bold" style={{ color: verdictStyle.color }}>
                {verdictStyle.label}
              </span>
            </div>
            <span className="text-xs text-slate-300">{result.verdict_text}</span>
          </div>

          {/* 6 Quant Metrics */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-white/8 bg-black/35 p-2.5">
              <div className="text-[11px] text-slate-400">Win Rate ({result.total_trades} ไม้)</div>
              <div className="mt-1 font-mono-num text-lg font-bold text-white">
                {result.win_rate_pct.toFixed(1)}%
              </div>
              <div className="font-mono-num text-[10px] text-slate-500">
                W:{result.wins} / L:{result.losses}
              </div>
            </div>

            <div className="rounded-xl border border-white/8 bg-black/35 p-2.5">
              <div className="text-[11px] text-slate-400">Profit Factor</div>
              <div
                className={`mt-1 font-mono-num text-lg font-bold ${
                  result.profit_factor >= 1.5
                    ? 'text-[#00f5d4]'
                    : result.profit_factor >= 1.0
                      ? 'text-amber-300'
                      : 'text-[#ff2e97]'
                }`}
              >
                {result.profit_factor.toFixed(2)}
              </div>
              <div className="font-mono-num text-[10px] text-slate-500">เป้า ≥ 1.50</div>
            </div>

            <div className="rounded-xl border border-white/8 bg-black/35 p-2.5">
              <div className="text-[11px] text-slate-400">Expectancy / ไม้</div>
              <div
                className={`mt-1 font-mono-num text-lg font-bold ${
                  result.expectancy_pct > 0 ? 'text-[#00f5d4]' : 'text-[#ff2e97]'
                }`}
              >
                {fmtPct(result.expectancy_pct)}
              </div>
              <div className="font-mono-num text-[10px] text-slate-500">
                R:R จริง 1:{result.realized_rr.toFixed(2)}
              </div>
            </div>

            <div className="rounded-xl border border-white/8 bg-black/35 p-2.5">
              <div className="text-[11px] text-slate-400">Strategy Return</div>
              <div
                className={`mt-1 font-mono-num text-lg font-bold ${
                  result.total_return_pct >= 0 ? 'text-[#00f5d4]' : 'text-[#ff2e97]'
                }`}
              >
                {fmtPct(result.total_return_pct)}
              </div>
              <div className="font-mono-num text-[10px] text-slate-500">
                B&H: {fmtPct(result.buy_hold_return_pct)}
              </div>
            </div>

            <div className="rounded-xl border border-white/8 bg-black/35 p-2.5">
              <div className="text-[11px] text-slate-400">Max Drawdown</div>
              <div className="mt-1 font-mono-num text-lg font-bold text-[#ff2e97]">
                {result.max_drawdown_pct.toFixed(1)}%
              </div>
              <div className="font-mono-num text-[10px] text-slate-500">
                Avg Loss: {result.avg_loss_pct.toFixed(1)}%
              </div>
            </div>

            <div className="rounded-xl border border-white/8 bg-black/35 p-2.5">
              <div className="text-[11px] text-slate-400">Sharpe Ratio</div>
              <div className="mt-1 font-mono-num text-lg font-bold text-purple-300">
                {result.sharpe_ratio.toFixed(2)}
              </div>
              <div className="font-mono-num text-[10px] text-slate-500">
                Avg Win: +{result.avg_win_pct.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Equity Curve */}
          {result.equity_curve.length > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Equity Curve (Base 100) · {result.period_start} → {result.period_end}
                </span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#ff2e97]" /> Strategy
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-500" /> Buy & Hold
                  </span>
                </div>
              </div>
              <div ref={chartRef} className="w-full overflow-hidden rounded-xl border border-white/5" />
            </div>
          )}

          {/* Expandable Trade Log */}
          {result.trades.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowTrades((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3.5 py-2 text-xs font-medium text-slate-300 hover:border-[#ff2e97]/40 hover:text-white"
              >
                <span>ประวัติการเข้า-ออกย้อนหลัง ({result.trades.length} ไม้)</span>
                {showTrades ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showTrades && (
                <div className="mt-2 overflow-x-auto rounded-xl border border-white/8">
                  <table className="w-full text-left font-mono-num text-xs">
                    <thead className="border-b border-white/10 bg-black/40 text-[10px] uppercase text-slate-400">
                      <tr>
                        <th className="px-3 py-2">เข้า</th>
                        <th className="px-3 py-2">ออก</th>
                        <th className="px-3 py-2">ราคาเข้า</th>
                        <th className="px-3 py-2">ราคาออก</th>
                        <th className="px-3 py-2">ผลตอบแทน</th>
                        <th className="px-3 py-2">สาเหตุ</th>
                        <th className="px-3 py-2">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {result.trades.map((t, idx) => (
                        <tr key={`${t.entry_date}-${idx}`} className="hover:bg-white/5">
                          <td className="px-3 py-2 text-slate-300">{t.entry_date}</td>
                          <td className="px-3 py-2 text-slate-400">{t.exit_date}</td>
                          <td className="px-3 py-2 text-slate-200">{fmtPrice(t.entry_price)}</td>
                          <td className="px-3 py-2 text-slate-200">{fmtPrice(t.exit_price)}</td>
                          <td
                            className={`px-3 py-2 font-bold ${
                              t.return_pct >= 0 ? 'text-[#00f5d4]' : 'text-[#ff2e97]'
                            }`}
                          >
                            {fmtPct(t.return_pct)}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                t.exit_reason === 'TAKE_PROFIT'
                                  ? 'bg-[#00f5d4]/15 text-[#00f5d4]'
                                  : t.exit_reason === 'STOP_LOSS'
                                    ? 'bg-[#ff2e97]/15 text-[#ff2e97]'
                                    : 'bg-slate-700/60 text-slate-300'
                              }`}
                            >
                              {t.exit_reason}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-400">{t.score.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
