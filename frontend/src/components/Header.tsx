import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Search, Star, Zap } from 'lucide-react';
import type { ActiveTab } from '../types/stock';

interface HeaderProps {
  activeTab: ActiveTab;
  ticker: string;
  universe: string[];
  isWatched: boolean;
  isRefreshing: boolean;
  onSelectTicker: (ticker: string) => void;
  onToggleWatch: (ticker: string) => void;
  onRefresh: () => void;
}

export function Header({
  activeTab,
  ticker,
  universe,
  isWatched,
  isRefreshing,
  onSelectTicker,
  onToggleWatch,
  onRefresh,
}: HeaderProps) {
  const [query, setQuery] = useState(ticker);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(ticker);
  }, [ticker]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = query.trim()
    ? universe
        .filter((t) => t.startsWith(query.trim().toUpperCase()))
        .slice(0, 8)
    : universe.slice(0, 8);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = query.trim().toUpperCase();
    if (cleaned) {
      onSelectTicker(cleaned);
      setOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07080d]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-6">
        {/* Mobile Brand */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff2e97]/15 ring-1 ring-[#ff2e97]/40 neon-glow-pink">
            <Zap className="h-4 w-4 text-[#ff2e97]" />
          </div>
          <div className="hidden xs:block sm:block">
            <div className="text-sm font-bold tracking-wide text-white">
              NEON <span className="neon-text-pink">QUANT</span>
            </div>
          </div>
        </div>

        {/* Desktop Title */}
        <div className="hidden lg:flex lg:items-center lg:gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {activeTab === 'deep-dive'
              ? 'Deep-Dive Terminal'
              : activeTab === 'screener'
                ? 'Market-Wide Screener'
                : 'Walk-Forward Backtest'}
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff2e97] shadow-[0_0_10px_#ff2e97]" />
          <span className="text-xs text-slate-400">Log-Linear Quant Engine v2</span>
        </div>

        {/* Search + Actions */}
        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
          <div ref={boxRef} className="relative w-full max-w-xs sm:max-w-sm">
            <form onSubmit={handleSubmit} className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onFocus={() => setOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value.toUpperCase());
                  setOpen(true);
                }}
                placeholder="ค้นหาหุ้น US (เช่น NVDA, AAPL)..."
                className="w-full rounded-xl border border-white/10 bg-[#101421] py-2 pl-9 pr-14 text-sm font-medium text-white placeholder:text-slate-500 focus:border-[#ff2e97]/60 focus:outline-none focus:ring-2 focus:ring-[#ff2e97]/25"
              />
              <button
                type="submit"
                className="absolute right-1.5 rounded-lg bg-[#ff2e97] px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-[#ff4da6] active:scale-95"
              >
                ดู
              </button>
            </form>

            {open && filtered.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#0f1320]/98 p-1.5 shadow-2xl backdrop-blur-xl">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  หุ้นแนะนำในระบบ
                </div>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                  {filtered.map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => {
                        onSelectTicker(sym);
                        setQuery(sym);
                        setOpen(false);
                      }}
                      className={`rounded-lg px-2.5 py-1.5 text-left font-mono-num text-xs font-semibold transition ${
                        sym === ticker
                          ? 'bg-[#ff2e97]/20 text-[#ff2e97] ring-1 ring-[#ff2e97]/40'
                          : 'text-slate-200 hover:bg-white/5 hover:text-[#ff2e97]'
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onToggleWatch(ticker)}
            title={isWatched ? 'ลบออกจากหุ้นโปรด' : 'เพิ่มเป็นหุ้นโปรด'}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition active:scale-95 ${
              isWatched
                ? 'border-[#ff2e97]/50 bg-[#ff2e97]/15 text-[#ff2e97] shadow-[0_0_15px_rgba(255,46,151,0.25)]'
                : 'border-white/10 bg-[#101421] text-slate-400 hover:border-white/20 hover:text-white'
            }`}
          >
            <Star className={`h-4 w-4 ${isWatched ? 'fill-[#ff2e97]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="รีเฟรชราคาล่าสุด"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-[#101421] px-3 text-xs font-medium text-slate-200 transition hover:border-[#00f5d4]/40 hover:text-[#00f5d4] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-[#ff2e97]' : ''}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>
        </div>
      </div>
    </header>
  );
}
