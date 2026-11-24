import { useCallback, useEffect, useState } from 'react';
import { DeepDiveView } from './components/DeepDiveView';
import { Header } from './components/Header';
import { MobileNav } from './components/MobileNav';
import { PortfolioBacktestView } from './components/PortfolioBacktestView';
import { ScreenerView } from './components/ScreenerView';
import { Sidebar } from './components/Sidebar';
import { WatchlistView } from './components/WatchlistView';
import { useWatchlist } from './hooks/useWatchlist';
import {
  fetchAnalysis,
  fetchScreener,
  fetchUniverse,
  runScreenerScan,
} from './lib/api';
import type { ActiveTab, AnalyzeResponse, ScreenerResponse } from './types/stock';

export default function App() {
  const { watchlist, toggleTicker, removeTicker, isWatched } = useWatchlist();

  const [activeTab, setActiveTab] = useState<ActiveTab>('deep-dive');
  const [ticker, setTicker] = useState<string>(() => watchlist[0] || 'NVDA');
  const [windowDays, setWindowDays] = useState<number>(90);
  const [horizonDays, setHorizonDays] = useState<number>(20);
  const [universe, setUniverse] = useState<string[]>([
    'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'PLTR',
  ]);

  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [screener, setScreener] = useState<ScreenerResponse | null>(null);
  const [screenerLoading, setScreenerLoading] = useState<boolean>(false);
  const [screenerScanning, setScreenerScanning] = useState<boolean>(false);
  const [screenerError, setScreenerError] = useState<string | null>(null);

  // Load universe autocomplete list once
  useEffect(() => {
    fetchUniverse()
      .then((list) => {
        if (list.length > 0) setUniverse(list);
      })
      .catch(() => {
        // fallback list already set
      });
  }, []);

  // Load Deep-Dive analysis
  const loadAnalysis = useCallback(
    async (sym: string, win: number, hor: number, forceRefresh = false) => {
      setAnalysisLoading(true);
      setAnalysisError(null);
      try {
        const res = await fetchAnalysis(sym, win, hor, forceRefresh);
        setAnalysis(res);
      } catch (err) {
        setAnalysisError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setAnalysisLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadAnalysis(ticker, windowDays, horizonDays, false);
  }, [ticker, windowDays, horizonDays, loadAnalysis]);

  // Load Screener results when opening Screener tab (or on first mount in background)
  const loadScreener = useCallback(async () => {
    setScreenerLoading(true);
    setScreenerError(null);
    try {
      const res = await fetchScreener();
      setScreener(res);
    } catch (err) {
      setScreenerError(err instanceof Error ? err.message : 'โหลดผลสแกนไม่สำเร็จ');
    } finally {
      setScreenerLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScreener();
  }, [loadScreener]);

  const handleRunScan = async () => {
    setScreenerScanning(true);
    setScreenerError(null);
    try {
      const res = await runScreenerScan();
      setScreener(res);
    } catch (err) {
      setScreenerError(err instanceof Error ? err.message : 'สแกนตลาดไม่สำเร็จ');
    } finally {
      setScreenerScanning(false);
    }
  };

  const handleSelectTicker = (sym: string) => {
    const cleaned = sym.trim().toUpperCase();
    if (!cleaned) return;
    setTicker(cleaned);
    setActiveTab('deep-dive');
  };

  const handleRefresh = () => {
    if (activeTab === 'screener') {
      loadScreener();
    } else {
      loadAnalysis(ticker, windowDays, horizonDays, true);
    }
  };

  return (
    <div className="bg-neon-mesh flex min-h-screen text-slate-100">
      {/* Desktop Sidebar */}
      <Sidebar
        activeTab={activeTab}
        ticker={ticker}
        watchlist={watchlist}
        onChangeTab={setActiveTab}
        onSelectTicker={handleSelectTicker}
        onRemoveWatch={removeTicker}
      />

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          activeTab={activeTab}
          ticker={ticker}
          universe={universe}
          isWatched={isWatched(ticker)}
          isRefreshing={analysisLoading || screenerLoading || screenerScanning}
          onSelectTicker={handleSelectTicker}
          onToggleWatch={toggleTicker}
          onRefresh={handleRefresh}
        />

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-3 py-4 pb-24 sm:px-6 sm:py-6 lg:pb-8">
          {activeTab === 'deep-dive' && (
            <DeepDiveView
              data={analysis}
              loading={analysisLoading}
              error={analysisError}
              windowDays={windowDays}
              horizonDays={horizonDays}
              onChangeWindow={setWindowDays}
              onChangeHorizon={setHorizonDays}
            />
          )}

          {activeTab === 'screener' && (
            <ScreenerView
              screener={screener}
              loading={screenerLoading}
              scanning={screenerScanning}
              error={screenerError}
              onRunScan={handleRunScan}
              onOpenTicker={handleSelectTicker}
            />
          )}

          {activeTab === 'backtest' && (
            <PortfolioBacktestView onOpenTicker={handleSelectTicker} />
          )}

          {activeTab === 'watchlist' && (
            <WatchlistView
              watchlist={watchlist}
              onSelectTicker={handleSelectTicker}
              onToggleWatch={toggleTicker}
              onRemoveWatch={removeTicker}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav
        activeTab={activeTab}
        watchlistCount={watchlist.length}
        onChangeTab={setActiveTab}
      />
    </div>
  );
}
