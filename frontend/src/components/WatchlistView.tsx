import { ChevronRight, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface WatchlistViewProps {
  watchlist: string[];
  onSelectTicker: (ticker: string) => void;
  onToggleWatch: (ticker: string) => void;
  onRemoveWatch: (ticker: string) => void;
}

export function WatchlistView({
  watchlist,
  onSelectTicker,
  onToggleWatch,
  onRemoveWatch,
}: WatchlistViewProps) {
  const [input, setInput] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = input.trim().toUpperCase();
    if (sym && !watchlist.includes(sym)) {
      onToggleWatch(sym);
      setInput('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="neon-card-pink rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-[#ff2e97] fill-[#ff2e97]" />
          <h1 className="text-lg font-bold text-white">หุ้นโปรดของคุณ (Watchlist)</h1>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          บันทึกไว้ในเบราว์เซอร์ของเครื่องนี้โดยเฉพาะ ไม่ปะปนกับผู้อื่น
        </p>

        <form onSubmit={handleAdd} className="mt-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="เพิ่มชื่อหุ้น (เช่น NVDA, AMD)..."
            className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#ff2e97]/60 focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-xl bg-[#ff2e97] px-4 py-2 text-sm font-semibold text-white active:scale-95"
          >
            <Plus className="h-4 w-4" />
            เพิ่ม
          </button>
        </form>
      </div>

      {watchlist.length === 0 ? (
        <div className="neon-card rounded-2xl p-10 text-center text-sm text-slate-400">
          ยังไม่มีหุ้นโปรด ลองเพิ่มชื่อหุ้นด้านบนได้เลย
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {watchlist.map((sym) => (
            <div
              key={sym}
              className="neon-card flex items-center justify-between rounded-2xl p-3.5"
            >
              <button
                type="button"
                onClick={() => onSelectTicker(sym)}
                className="flex flex-1 items-center gap-3 text-left"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff2e97] shadow-[0_0_10px_#ff2e97]" />
                <span className="font-mono-num text-base font-bold text-white">{sym}</span>
                <ChevronRight className="ml-auto h-4 w-4 text-slate-500" />
              </button>
              <button
                type="button"
                onClick={() => onRemoveWatch(sym)}
                className="ml-2 rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-[#ff2e97]"
                title={`ลบ ${sym}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
