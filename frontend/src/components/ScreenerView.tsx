import { useMemo, useState } from 'react';
import { ArrowUpDown, ChevronRight, Play, Radar, Search } from 'lucide-react';
import { fmtDateTime, fmtPct, fmtPrice } from '../lib/format';
import type { ScreenerResponse, ScreenerRow } from '../types/stock';

interface ScreenerViewProps {
  screener: ScreenerResponse | null;
  loading: boolean;
  scanning: boolean;
  error: string | null;
  onRunScan: () => void;
  onOpenTicker: (ticker: string) => void;
}

type SortKey = 'score' | 'r_squared' | 'upside_pct' | 'risk_reward' | 'price';

export function ScreenerView({
  screener,
  loading,
  scanning,
  error,
  onRunScan,
  onOpenTicker,
}: ScreenerViewProps) {
  const [minScore, setMinScore] = useState(50);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDesc, setSortDesc] = useState(true);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const isRowInZone = (status: string) =>
    status === 'IN_ZONE' || status === 'CONFIRMED_ENTRY' || status === 'IN_ZONE_WAIT_CONFIRM';

  const statusBadgeText = (status: string) => {
    if (status === 'CONFIRMED_ENTRY') return 'ยืนยันเข้าซื้อ';
    if (status === 'IN_ZONE_WAIT_CONFIRM') return 'ในโซน (รอยืนยัน)';
    if (status === 'IN_ZONE') return 'ในโซนซื้อ';
    if (status === 'WAIT_FOR_PULLBACK') return 'รอย่อตัว';
    if (status === 'BELOW_ZONE_RISK') return 'หลุดโซน';
    return 'ขาลง';
  };

  const filtered = useMemo(() => {
    const rows = screener?.rows ?? [];
    const q = search.trim().toUpperCase();
    return rows
      .filter((r) => {
        if (r.score < minScore) return false;
        if (statusFilter === 'IN_ZONE' && !isRowInZone(r.entry_status)) return false;
        if (statusFilter !== 'ALL' && statusFilter !== 'IN_ZONE' && r.entry_status !== statusFilter) {
          return false;
        }
        if (q && !r.ticker.includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const av = a[sortKey] ?? -99999;
        const bv = b[sortKey] ?? -99999;
        return sortDesc ? bv - av : av - bv;
      });
  }, [screener, minScore, statusFilter, search, sortKey, sortDesc]);

  const statusChips = [
    { id: 'ALL', label: 'ทั้งหมด' },
    { id: 'IN_ZONE', label: 'อยู่ในโซนซื้อ' },
    { id: 'WAIT_FOR_PULLBACK', label: 'รอย่อตัว' },
    { id: 'BELOW_ZONE_RISK', label: 'หลุดโซน' },
  ];

  const renderScorePill = (score: number) => {
    const isHigh = score >= 70;
    const isMid = score >= 55;
    return (
      <span
        className={`inline-flex min-w-[46px] items-center justify-center rounded-lg px-2 py-0.5 font-mono-num text-xs font-bold ${
          isHigh
            ? 'bg-[#ff2e97]/20 text-[#ff2e97] ring-1 ring-[#ff2e97]/50'
            : isMid
              ? 'bg-[#00f5d4]/15 text-[#00f5d4] ring-1 ring-[#00f5d4]/40'
              : 'bg-white/5 text-slate-300 ring-1 ring-white/10'
        }`}
      >
        {score.toFixed(1)}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header & Summary */}
      <div className="neon-card-pink rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-[#ff2e97]" />
              <h1 className="text-xl font-bold text-white sm:text-2xl">
                ผลการสแกนทั้งตลาด (US Screener)
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              อัปเดตล่าสุด: {fmtDateTime(screener?.scanned_at)} · กดที่หุ้นใดก็ได้เพื่อเปิดหน้า Deep-Dive ทันที
            </p>
          </div>

          <button
            type="button"
            onClick={onRunScan}
            disabled={scanning}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff2e97] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(255,46,151,0.4)] transition hover:bg-[#ff4da6] active:scale-95 disabled:opacity-60"
          >
            <Play className={`h-4 w-4 ${scanning ? 'animate-pulse' : ''}`} />
            {scanning ? 'กำลังสแกนหุ้นทั้งตลาด...' : 'สแกนตลาดใหม่ตอนนี้'}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-white/10 bg-black/35 p-3">
            <div className="text-[11px] text-slate-400">สแกนทั้งหมด</div>
            <div className="mt-0.5 font-mono-num text-xl font-bold text-white">
              {screener?.total ?? 0}
            </div>
          </div>
          <div className="rounded-xl border border-[#ff2e97]/25 bg-[#ff2e97]/5 p-3">
            <div className="text-[11px] text-[#ff2e97]">ผ่านเกณฑ์ (≥55)</div>
            <div className="mt-0.5 font-mono-num text-xl font-bold text-[#ff2e97]">
              {screener?.actionable ?? 0}
            </div>
          </div>
          <div className="rounded-xl border border-[#00f5d4]/25 bg-[#00f5d4]/5 p-3">
            <div className="text-[11px] text-[#00f5d4]">อยู่ในโซนเข้าซื้อ</div>
            <div className="mt-0.5 font-mono-num text-xl font-bold text-[#00f5d4]">
              {screener?.in_zone ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="neon-card rounded-2xl p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {statusChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setStatusFilter(chip.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === chip.id
                    ? 'bg-[#ff2e97] text-white shadow-[0_0_12px_rgba(255,46,151,0.4)]'
                    : 'border border-white/10 bg-black/30 text-slate-300 hover:border-white/25'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <span className="whitespace-nowrap text-xs text-slate-400">
                Score ≥ <strong className="font-mono-num text-[#ff2e97]">{minScore}</strong>
              </span>
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-28 accent-[#ff2e97] sm:w-36"
              />
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value.toUpperCase())}
                placeholder="กรองชื่อหุ้น..."
                className="w-full rounded-xl border border-white/10 bg-black/40 py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-[#ff2e97]/60 focus:outline-none sm:w-40"
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[#ff2e97]/40 bg-[#ff2e97]/10 p-4 text-sm text-[#ff2e97]">
          {error}
        </div>
      )}

      {loading && !screener ? (
        <div className="neon-card h-64 animate-pulse rounded-2xl" />
      ) : filtered.length === 0 ? (
        <div className="neon-card rounded-2xl p-10 text-center text-sm text-slate-400">
          ไม่พบหุ้นที่ตรงกับเงื่อนไข — ลองลดค่า Signal Score ขั้นต่ำ หรือกดปุ่ม "สแกนตลาดใหม่ตอนนี้"
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="neon-card hidden overflow-hidden rounded-2xl md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-black/40 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Ticker</th>
                    <th className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort('score')}
                        className="inline-flex items-center gap-1 hover:text-white"
                      >
                        Score <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort('price')}
                        className="inline-flex items-center gap-1 hover:text-white"
                      >
                        Price <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort('r_squared')}
                        className="inline-flex items-center gap-1 hover:text-white"
                      >
                        R² <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort('upside_pct')}
                        className="inline-flex items-center gap-1 hover:text-white"
                      >
                        EV Upside <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-3 py-3">RSI</th>
                    <th className="px-3 py-3">Buy Zone</th>
                    <th className="px-3 py-3">Stop</th>
                    <th className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort('risk_reward')}
                        className="inline-flex items-center gap-1 hover:text-white"
                      >
                        R:R <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map((row: ScreenerRow) => (
                    <tr
                      key={row.ticker}
                      onClick={() => onOpenTicker(row.ticker)}
                      className="cursor-pointer transition hover:bg-[#ff2e97]/8"
                    >
                      <td className="px-4 py-3 font-mono-num text-sm font-bold text-white">
                        {row.ticker}
                      </td>
                      <td className="px-3 py-3">{renderScorePill(row.score)}</td>
                      <td className="px-3 py-3 font-mono-num text-slate-200">
                        {fmtPrice(row.price)}
                      </td>
                      <td className="px-3 py-3 font-mono-num text-slate-300">
                        {row.r_squared.toFixed(1)}%
                      </td>
                      <td
                        className={`px-3 py-3 font-mono-num font-semibold ${
                          row.upside_pct >= 0 ? 'text-[#00f5d4]' : 'text-[#ff2e97]'
                        }`}
                      >
                        {fmtPct(row.upside_pct)}
                      </td>
                      <td className="px-3 py-3 font-mono-num text-slate-300">
                        {row.rsi14 !== null && row.rsi14 !== undefined ? row.rsi14.toFixed(1) : '—'}
                      </td>
                      <td className="px-3 py-3 font-mono-num text-slate-200">
                        {row.entry_low && row.entry_high
                          ? `${fmtPrice(row.entry_low)}–${fmtPrice(row.entry_high)}`
                          : '—'}
                      </td>
                      <td className="px-3 py-3 font-mono-num text-[#ff2e97]">
                        {fmtPrice(row.stop_loss)}
                      </td>
                      <td className="px-3 py-3 font-mono-num text-purple-300">
                        {row.risk_reward !== null && row.risk_reward !== undefined
                          ? `1:${row.risk_reward.toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                          style={{
                            backgroundColor: `${row.entry_status_color}1a`,
                            color: row.entry_status_color,
                          }}
                        >
                          {statusBadgeText(row.entry_status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List */}
          <div className="space-y-2.5 md:hidden">
            {filtered.map((row: ScreenerRow) => (
              <button
                key={row.ticker}
                type="button"
                onClick={() => onOpenTicker(row.ticker)}
                className="neon-card block w-full rounded-2xl p-3.5 text-left transition active:scale-[0.99]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono-num text-base font-bold text-white">
                      {row.ticker}
                    </span>
                    {renderScorePill(row.score)}
                  </div>
                  <div className="flex items-center gap-1 font-mono-num text-base font-bold text-white">
                    {fmtPrice(row.price)}
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-3 gap-2 rounded-xl bg-black/35 p-2.5 text-[11px]">
                  <div>
                    <div className="text-slate-500">EV Upside</div>
                    <div
                      className={`font-mono-num font-semibold ${
                        row.upside_pct >= 0 ? 'text-[#00f5d4]' : 'text-[#ff2e97]'
                      }`}
                    >
                      {fmtPct(row.upside_pct)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">R² / RSI</div>
                    <div className="font-mono-num text-slate-200">
                      {row.r_squared.toFixed(0)}% / {row.rsi14 ? row.rsi14.toFixed(0) : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">R:R</div>
                    <div className="font-mono-num text-purple-300">
                      {row.risk_reward ? `1:${row.risk_reward.toFixed(2)}` : '—'}
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="font-mono-num text-slate-400">
                    Buy:{' '}
                    <strong className="text-slate-200">
                      {row.entry_low && row.entry_high
                        ? `${fmtPrice(row.entry_low)}–${fmtPrice(row.entry_high)}`
                        : '—'}
                    </strong>
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 font-medium"
                    style={{
                      backgroundColor: `${row.entry_status_color}1f`,
                      color: row.entry_status_color,
                    }}
                  >
                    {statusBadgeText(row.entry_status)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
