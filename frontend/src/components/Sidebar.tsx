import { BarChart3, FlaskConical, Radar, Star, Trash2, Zap } from 'lucide-react';
import type { ActiveTab } from '../types/stock';

interface SidebarProps {
  activeTab: ActiveTab;
  ticker: string;
  watchlist: string[];
  onChangeTab: (tab: ActiveTab) => void;
  onSelectTicker: (ticker: string) => void;
  onRemoveWatch: (ticker: string) => void;
}

export function Sidebar({
  activeTab,
  ticker,
  watchlist,
  onChangeTab,
  onSelectTicker,
  onRemoveWatch,
}: SidebarProps) {
  return (
    <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-white/10 lg:bg-[#090b12]/90">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff2e97]/15 ring-1 ring-[#ff2e97]/40 neon-glow-pink">
          <Zap className="h-5 w-5 text-[#ff2e97]" />
        </div>
        <div>
          <div className="text-base font-bold tracking-wide text-white">
            NEON <span className="neon-text-pink">QUANT</span>
          </div>
          <div className="text-[11px] text-slate-400">US Stock Terminal</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4">
        <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          โหมดการทำงาน
        </div>
        <nav className="space-y-1.5">
          <button
            type="button"
            onClick={() => onChangeTab('deep-dive')}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              activeTab === 'deep-dive'
                ? 'bg-[#ff2e97]/15 text-white ring-1 ring-[#ff2e97]/45 shadow-[0_0_20px_rgba(255,46,151,0.18)]'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
            }`}
          >
            <BarChart3
              className={`h-4 w-4 ${activeTab === 'deep-dive' ? 'text-[#ff2e97]' : ''}`}
            />
            Deep-Dive รายหุ้น
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('screener')}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              activeTab === 'screener'
                ? 'bg-[#ff2e97]/15 text-white ring-1 ring-[#ff2e97]/45 shadow-[0_0_20px_rgba(255,46,151,0.18)]'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
            }`}
          >
            <Radar
              className={`h-4 w-4 ${activeTab === 'screener' ? 'text-[#ff2e97]' : ''}`}
            />
            สแกนทั้งตลาด
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('backtest')}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              activeTab === 'backtest'
                ? 'bg-[#ff2e97]/15 text-white ring-1 ring-[#ff2e97]/45 shadow-[0_0_20px_rgba(255,46,151,0.18)]'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
            }`}
          >
            <FlaskConical
              className={`h-4 w-4 ${activeTab === 'backtest' ? 'text-[#ff2e97]' : ''}`}
            />
            Backtest กลยุทธ์
          </button>
        </nav>
      </div>

      {/* Watchlist */}
      <div className="flex-1 overflow-y-auto border-t border-white/10 p-4">
        <div className="mb-3 flex items-center justify-between px-2">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <Star className="h-3.5 w-3.5 text-[#ff2e97]" />
            หุ้นโปรด ({watchlist.length})
          </span>
        </div>

        {watchlist.length === 0 ? (
          <p className="px-2 text-xs text-slate-500">
            กดปุ่มดาวด้านบนเพื่อเพิ่มหุ้นโปรด (บันทึกอัตโนมัติในเครื่องนี้)
          </p>
        ) : (
          <div className="space-y-1">
            {watchlist.map((sym) => {
              const active = sym === ticker && activeTab === 'deep-dive';
              return (
                <div
                  key={sym}
                  className={`group flex items-center justify-between rounded-xl px-3 py-2 transition ${
                    active
                      ? 'bg-[#ff2e97]/15 text-white ring-1 ring-[#ff2e97]/40'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTicker(sym);
                      onChangeTab('deep-dive');
                    }}
                    className="flex flex-1 items-center gap-2 text-left font-mono-num text-sm font-semibold"
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        active ? 'bg-[#ff2e97] shadow-[0_0_8px_#ff2e97]' : 'bg-slate-600'
                      }`}
                    />
                    {sym}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveWatch(sym)}
                    title={`ลบ ${sym}`}
                    className="rounded-lg p-1 text-slate-500 opacity-0 transition hover:bg-white/10 hover:text-[#ff2e97] group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="border-t border-white/10 p-4 text-[11px] leading-relaxed text-slate-500">
        เพื่อการศึกษาและวิเคราะห์สถิติราคาเท่านั้น ไม่ใช่คำแนะนำการลงทุน
      </div>
    </aside>
  );
}
