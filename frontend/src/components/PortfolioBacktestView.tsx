import { useEffect, useState } from 'react';
import { ChevronRight, FlaskConical, Play, ShieldCheck } from 'lucide-react';
import { fetchPortfolioBacktest } from '../lib/api';
import { fmtPct } from '../lib/format';
import type { PortfolioBacktestResponse } from '../types/stock';

interface PortfolioBacktestViewProps {
  onOpenTicker: (ticker: string) => void;
}

const VERDICT_BADGE: Record<string, { label: string; color: string }> = {
  STRONG_EDGE: { label: 'STRONG EDGE', color: '#00f5d4' },
  MODERATE_EDGE: { label: 'MODERATE', color: '#facc15' },
  NO_EDGE: { label: 'NO EDGE', color: '#ff2e97' },
  INSUFFICIENT_DATA: { label: 'LOW DATA', color: '#94a3b8' },
};

export function PortfolioBacktestView({ onOpenTicker }: PortfolioBacktestViewProps) {
  const [period, setPeriod] = useState<'3y' | '5y'>('3y');
  const [minScore, setMinScore] = useState<number>(55);
  const [maxTickers, setMaxTickers] = useState<number>(25);
  const [requireConfirm, setRequireConfirm] = useState<boolean>(true);
  const [data, setData] = useState<PortfolioBacktestResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const runTest = () => {
    setLoading(true);
    setError(null);
    fetchPortfolioBacktest({
      period,
      minScore,
      maxTickers,
      requireConfirm,
    })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Backtest ทั้งตลาดล้มเหลว'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    runTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const badge = VERDICT_BADGE[data?.verdict ?? 'INSUFFICIENT_DATA'];

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="neon-card-pink rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-[#ff2e97]" />
              <h1 className="text-xl font-bold text-white sm:text-2xl">
                Portfolio Walk-Forward Backtest
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              ทดสอบกลยุทธ์รวมหลายหุ้นพร้อมกัน (Zero Lookahead + Slippage 0.1%) เพื่อพิสูจน์ Statistical Edge ในภาพรวม
            </p>
          </div>

          <button
            type="button"
            onClick={runTest}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff2e97] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(255,46,151,0.4)] transition hover:bg-[#ff4da6] active:scale-95 disabled:opacity-60"
          >
            <Play className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} />
            {loading ? 'กำลังรัน Walk-Forward...' : 'รัน Backtest ใหม่'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5 text-xs">
          <div className="flex rounded-xl bg-black/40 p-1 ring-1 ring-white/10">
            {(['3y', '5y'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-3 py-1 font-mono-num font-semibold ${
                  period === p ? 'bg-[#ff2e97] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>

          <select
            value={maxTickers}
            onChange={(e) => setMaxTickers(Number(e.target.value))}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 font-mono-num text-xs text-white"
          >
            <option value={15}>15 หุ้นหลัก</option>
            <option value={25}>25 หุ้น</option>
            <option value={58}>ทั้งหมด 58 หุ้น</option>
          </select>

          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 font-mono-num text-xs text-white"
          >
            {[50, 55, 60, 65].map((s) => (
              <option key={s} value={s}>
                Min Score ≥ {s}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setRequireConfirm((v) => !v)}
            className={`rounded-xl border px-3 py-1.5 font-medium ${
              requireConfirm
                ? 'border-[#00f5d4]/40 bg-[#00f5d4]/10 text-[#00f5d4]'
                : 'border-white/10 bg-black/30 text-slate-400'
            }`}
          >
            กันรับมีด: {requireConfirm ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[#ff2e97]/40 bg-[#ff2e97]/10 p-4 text-sm text-[#ff2e97]">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="neon-card h-64 animate-pulse rounded-2xl" />
      ) : data ? (
        <>
          {/* Aggregate Summary */}
          <div className="neon-card rounded-2xl p-4 sm:p-5">
            <div
              className="mb-4 flex flex-col gap-1 rounded-xl px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              style={{
                backgroundColor: `${badge.color}14`,
                border: `1px solid ${badge.color}44`,
              }}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" style={{ color: badge.color }} />
                <span className="text-xs font-bold" style={{ color: badge.color }}>
                  {badge.label} ({data.tickers_tested} หุ้น · {data.total_trades} ไม้)
                </span>
              </div>
              <span className="text-xs text-slate-300">{data.verdict_text}</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-xl border border-white/8 bg-black/35 p-3">
                <div className="text-[11px] text-slate-400">จำนวนไม้ทั้งหมด</div>
                <div className="mt-1 font-mono-num text-xl font-bold text-white">
                  {data.total_trades}
                </div>
                <div className="font-mono-num text-[10px] text-slate-500">
                  W:{data.wins} / L:{data.losses}
                </div>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/35 p-3">
                <div className="text-[11px] text-slate-400">Win Rate รวม</div>
                <div className="mt-1 font-mono-num text-xl font-bold text-white">
                  {data.win_rate_pct.toFixed(1)}%
                </div>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/35 p-3">
                <div className="text-[11px] text-slate-400">Profit Factor รวม</div>
                <div
                  className={`mt-1 font-mono-num text-xl font-bold ${
                    data.profit_factor >= 1.5
                      ? 'text-[#00f5d4]'
                      : data.profit_factor >= 1.0
                        ? 'text-amber-300'
                        : 'text-[#ff2e97]'
                  }`}
                >
                  {data.profit_factor.toFixed(2)}
                </div>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/35 p-3">
                <div className="text-[11px] text-slate-400">Expectancy / ไม้</div>
                <div
                  className={`mt-1 font-mono-num text-xl font-bold ${
                    data.expectancy_pct > 0 ? 'text-[#00f5d4]' : 'text-[#ff2e97]'
                  }`}
                >
                  {fmtPct(data.expectancy_pct)}
                </div>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/35 p-3">
                <div className="text-[11px] text-slate-400">Avg Win / Loss</div>
                <div className="mt-1 font-mono-num text-sm font-bold text-white">
                  <span className="text-[#00f5d4]">+{data.avg_win_pct.toFixed(1)}%</span> /{' '}
                  <span className="text-[#ff2e97]">{data.avg_loss_pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/35 p-3">
                <div className="text-[11px] text-slate-400">Realized R:R</div>
                <div className="mt-1 font-mono-num text-xl font-bold text-purple-300">
                  1:{data.realized_rr.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Per-Ticker Ranking */}
          <div className="neon-card overflow-hidden rounded-2xl">
            <div className="border-b border-white/10 px-4 py-3 text-xs font-semibold text-slate-300">
              ผลลัพธ์แยกตามหุ้น (เรียงตาม Expectancy สูงสุด — กดเพื่อดู Deep-Dive & Trade Log)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono-num text-xs">
                <thead className="border-b border-white/10 bg-black/40 text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5">Ticker</th>
                    <th className="px-3 py-2.5">Trades</th>
                    <th className="px-3 py-2.5">Win Rate</th>
                    <th className="px-3 py-2.5">PF</th>
                    <th className="px-3 py-2.5">Exp/Trade</th>
                    <th className="px-3 py-2.5">Strategy</th>
                    <th className="px-3 py-2.5">Buy & Hold</th>
                    <th className="px-3 py-2.5">Max DD</th>
                    <th className="px-3 py-2.5">Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.tickers.map((t) => {
                    const vb = VERDICT_BADGE[t.verdict] ?? VERDICT_BADGE.INSUFFICIENT_DATA;
                    return (
                      <tr
                        key={t.ticker}
                        onClick={() => onOpenTicker(t.ticker)}
                        className="cursor-pointer transition hover:bg-[#ff2e97]/8"
                      >
                        <td className="px-4 py-2.5 font-bold text-white">
                          <span className="inline-flex items-center gap-1">
                            {t.ticker}
                            <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">{t.total_trades}</td>
                        <td className="px-3 py-2.5 text-slate-200">{t.win_rate_pct.toFixed(1)}%</td>
                        <td className="px-3 py-2.5 text-slate-200">{t.profit_factor.toFixed(2)}</td>
                        <td
                          className={`px-3 py-2.5 font-bold ${
                            t.expectancy_pct > 0 ? 'text-[#00f5d4]' : 'text-[#ff2e97]'
                          }`}
                        >
                          {fmtPct(t.expectancy_pct)}
                        </td>
                        <td
                          className={`px-3 py-2.5 ${
                            t.total_return_pct >= 0 ? 'text-[#00f5d4]' : 'text-[#ff2e97]'
                          }`}
                        >
                          {fmtPct(t.total_return_pct)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-400">{fmtPct(t.buy_hold_return_pct)}</td>
                        <td className="px-3 py-2.5 text-[#ff2e97]">{t.max_drawdown_pct.toFixed(1)}%</td>
                        <td className="px-3 py-2.5">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ backgroundColor: `${vb.color}1f`, color: vb.color }}
                          >
                            {vb.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
