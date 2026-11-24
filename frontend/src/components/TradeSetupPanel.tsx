import { AlertTriangle, CheckCircle2, Crosshair, Layers, ShieldAlert, Target } from 'lucide-react';
import { fmtPct, fmtPrice } from '../lib/format';
import type { AnalyzeResponse } from '../types/stock';

interface TradeSetupPanelProps {
  data: AnalyzeResponse;
  windowDays: number;
  horizonDays: number;
  onChangeWindow: (w: number) => void;
  onChangeHorizon: (h: number) => void;
}

const HORIZONS = [
  { days: 5, label: '1 สัปดาห์' },
  { days: 10, label: '2 สัปดาห์' },
  { days: 20, label: '1 เดือน' },
  { days: 60, label: '3 เดือน' },
];

const WINDOWS = [60, 90, 120, 180];

const STRENGTH_META: Record<string, { label: string; color: string }> = {
  HIGH: { label: 'Confluence แข็งแกร่งมาก', color: '#00f5d4' },
  MEDIUM: { label: 'Confluence ปานกลาง', color: '#facc15' },
  LOW: { label: 'Confluence ต่ำ', color: '#94a3b8' },
  NONE: { label: 'ไม่มีแผนขาขึ้น', color: '#64748b' },
};

export function TradeSetupPanel({
  data,
  windowDays,
  horizonDays,
  onChangeWindow,
  onChangeHorizon,
}: TradeSetupPanelProps) {
  const { forecast, entry_setup: setup } = data;
  const hasSetup = setup.entry_low !== null && setup.entry_low !== undefined;
  const strength = STRENGTH_META[setup.zone_strength] ?? STRENGTH_META.LOW;

  return (
    <div className="neon-card-pink rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-[#ff2e97]" />
          <h3 className="text-sm font-semibold text-white">
            พยากรณ์ราคา & โซนเข้าซื้อ (Multi-Confluence + ATR)
          </h3>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            backgroundColor: `${setup.entry_status_color}1f`,
            color: setup.entry_status_color,
            border: `1px solid ${setup.entry_status_color}55`,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: setup.entry_status_color }}
          />
          {setup.entry_status_label}
        </span>
      </div>

      {/* Controls */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-slate-400">ระยะเวลาพยากรณ์ (Forecast)</div>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-black/40 p-1 ring-1 ring-white/10">
            {HORIZONS.map((h) => (
              <button
                key={h.days}
                type="button"
                onClick={() => onChangeHorizon(h.days)}
                className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                  horizonDays === h.days
                    ? 'bg-[#ff2e97] text-white shadow-[0_0_14px_rgba(255,46,151,0.45)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-medium text-slate-400">หน้าต่างถดถอย (Regression Window)</div>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-black/40 p-1 ring-1 ring-white/10">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => onChangeWindow(w)}
                className={`rounded-lg py-1.5 font-mono-num text-xs font-semibold transition ${
                  windowDays === w
                    ? 'bg-[#00f5d4]/20 text-[#00f5d4] ring-1 ring-[#00f5d4]/50'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {w}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key Setup Cards */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <div className="rounded-xl border border-[#00f5d4]/25 bg-[#00f5d4]/5 p-3">
          <div className="flex items-center gap-1 text-[11px] text-[#00f5d4]">
            <Crosshair className="h-3 w-3" />
            โซนเข้าซื้อ (Demand Zone)
          </div>
          <div className="mt-1 font-mono-num text-sm font-bold text-white sm:text-base">
            {hasSetup ? `${fmtPrice(setup.entry_low)} – ${fmtPrice(setup.entry_high)}` : '—'}
          </div>
          <div className="mt-0.5 text-[11px]" style={{ color: strength.color }}>
            {hasSetup ? `${strength.label} (${setup.confluence_count} ปัจจัย)` : 'เทรนด์ขาลง'}
          </div>
        </div>

        <div className="rounded-xl border border-[#ff2e97]/30 bg-[#ff2e97]/5 p-3">
          <div className="flex items-center gap-1 text-[11px] text-[#ff2e97]">
            <ShieldAlert className="h-3 w-3" />
            จุดตัดขาดทุน (1.5× ATR)
          </div>
          <div className="mt-1 font-mono-num text-lg font-bold text-[#ff2e97]">
            {hasSetup ? fmtPrice(setup.stop_loss) : '—'}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            ATR(14): {fmtPrice(data.indicators.atr14)} ({data.indicators.atr_pct ?? '—'}%)
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/35 p-3">
          <div className="text-[11px] text-slate-400">TP1 (แนวต้าน/EV) & TP2 ({forecast.horizon_label})</div>
          <div className="mt-1 font-mono-num text-sm font-bold text-white sm:text-base">
            {hasSetup ? `${fmtPrice(setup.tp1)} / ${fmtPrice(setup.tp2)}` : fmtPrice(forecast.target_price)}
          </div>
          <div className="mt-0.5 font-mono-num text-[11px] text-[#00f5d4]">
            {hasSetup
              ? `R:R 1:${(setup.risk_reward ?? 0).toFixed(2)} · TP2 1:${(setup.risk_reward_tp2 ?? 0).toFixed(2)}`
              : `Forecast ${fmtPct(forecast.target_change_pct)}`}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/35 p-3">
          <div className="text-[11px] text-slate-400">
            ช่วงความเชื่อมั่น {Math.round(forecast.confidence * 100)}%
          </div>
          <div className="mt-1 font-mono-num text-sm font-bold text-purple-300 sm:text-base">
            {fmtPrice(forecast.target_low)} – {fmtPrice(forecast.target_high)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            POC: {fmtPrice(data.indicators.poc)} · √t Vol
          </div>
        </div>
      </div>

      {/* Confluence Factors Strip */}
      {hasSetup && setup.confluence_factors.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-white/8 bg-black/30 px-3 py-2">
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
            <Layers className="h-3.5 w-3.5 text-[#00f5d4]" />
            ปัจจัยรองรับโซนนี้:
          </span>
          {setup.confluence_factors.map((factor) => (
            <span
              key={factor}
              className="rounded-md border border-[#00f5d4]/30 bg-[#00f5d4]/10 px-2 py-0.5 text-[11px] font-medium text-[#00f5d4]"
            >
              {factor}
            </span>
          ))}
          {setup.candle_confirmed && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              แท่งเทียนยืนยันการทรงตัว
            </span>
          )}
        </div>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/70" />
        <span>
          คำนวณจาก Log-Linear Regression + Multi-Confluence Demand Zone (S1, EMA, Volume Profile)
          และควรตรวจสถิติ Walk-Forward Backtest ด้านล่างก่อนตัดสินใจเสมอ
        </span>
      </p>
    </div>
  );
}
