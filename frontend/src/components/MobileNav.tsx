import { BarChart3, FlaskConical, Radar, Star } from 'lucide-react';
import type { ActiveTab } from '../types/stock';

interface MobileNavProps {
  activeTab: ActiveTab;
  watchlistCount: number;
  onChangeTab: (tab: ActiveTab) => void;
}

export function MobileNav({ activeTab, watchlistCount, onChangeTab }: MobileNavProps) {
  const items: { id: ActiveTab; label: string; icon: typeof BarChart3; badge?: number }[] = [
    { id: 'deep-dive', label: 'วิเคราะห์', icon: BarChart3 },
    { id: 'screener', label: 'สแกนตลาด', icon: Radar },
    { id: 'backtest', label: 'Backtest', icon: FlaskConical },
    { id: 'watchlist', label: 'หุ้นโปรด', icon: Star, badge: watchlistCount },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#090b12]/95 backdrop-blur-xl pb-safe lg:hidden">
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={`relative flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition ${
                active ? 'text-[#ff2e97]' : 'text-slate-400'
              }`}
            >
              {active && (
                <span className="absolute top-0 h-0.5 w-12 rounded-full bg-[#ff2e97] shadow-[0_0_12px_#ff2e97]" />
              )}
              <div className="relative">
                <Icon className="h-5 w-5" />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff2e97] px-1 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
