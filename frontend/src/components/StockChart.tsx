import { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
} from 'lightweight-charts';
import type { AnalyzeResponse } from '../types/stock';

interface StockChartProps {
  data: AnalyzeResponse;
}

export function StockChart({ data }: StockChartProps) {
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);

  const [showChannel, setShowChannel] = useState(true);
  const [showForecast, setShowForecast] = useState(true);
  const [showEma, setShowEma] = useState(true);
  const [showLevels, setShowLevels] = useState(true);
  const [showRsi, setShowRsi] = useState(true);

  useEffect(() => {
    const container = mainContainerRef.current;
    if (!container) return;

    const chart: IChartApi = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0d16' },
        textColor: '#94a3b8',
        fontFamily: 'JetBrains Mono, Inter, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255, 46, 151, 0.45)', labelBackgroundColor: '#ff2e97' },
        horzLine: { color: 'rgba(255, 46, 151, 0.45)', labelBackgroundColor: '#ff2e97' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        rightOffset: 10,
        barSpacing: 6,
        timeVisible: false,
      },
      width: container.clientWidth,
      height: window.innerWidth < 640 ? 340 : 460,
    });

    // 1. Candlesticks (Cyan-Green Up / Neon Pink Down)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00f5d4',
      downColor: '#ff2e97',
      borderUpColor: '#00f5d4',
      borderDownColor: '#ff2e97',
      wickUpColor: '#00f5d4',
      wickDownColor: '#ff2e97',
    });

    candleSeries.setData(
      data.chart.candles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    // 2. Volume Histogram (bottom 18%)
    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    volSeries.setData(
      data.chart.candles.map((c) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(0, 245, 212, 0.22)' : 'rgba(255, 46, 151, 0.24)',
      }))
    );

    // 3. Log-Linear Regression Channel
    if (showChannel) {
      const evSeries = chart.addSeries(LineSeries, {
        color: '#22d3ee',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      evSeries.setData(data.chart.ev_line);

      const upperSeries = chart.addSeries(LineSeries, {
        color: '#ff2e97',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      upperSeries.setData(data.chart.upper_band);

      const lowerSeries = chart.addSeries(LineSeries, {
        color: '#00f5d4',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      lowerSeries.setData(data.chart.lower_band);
    }

    // 4. EMA 20 / 50 / 200
    if (showEma) {
      const ema20Series = chart.addSeries(LineSeries, {
        color: 'rgba(250, 204, 21, 0.75)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ema20Series.setData(data.chart.ema20);

      const ema50Series = chart.addSeries(LineSeries, {
        color: 'rgba(168, 85, 247, 0.85)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ema50Series.setData(data.chart.ema50);

      if (data.chart.ema200.length > 0) {
        const ema200Series = chart.addSeries(LineSeries, {
          color: 'rgba(248, 250, 252, 0.5)',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        ema200Series.setData(data.chart.ema200);
      }
    }

    // 5. Volatility-Scaled Forecast Cone
    if (showForecast && data.forecast.points.length > 0) {
      const lastCandle = data.chart.candles[data.chart.candles.length - 1];
      const anchor = lastCandle ? { time: lastCandle.time, value: data.model.ev_target } : null;

      const fcPath = chart.addSeries(LineSeries, {
        color: '#c084fc',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: true,
        title: `Target ${data.forecast.horizon_days}d`,
      });
      fcPath.setData([
        ...(anchor ? [anchor] : []),
        ...data.forecast.points.map((p) => ({ time: p.time, value: p.value })),
      ]);

      const fcHigh = chart.addSeries(LineSeries, {
        color: 'rgba(192, 132, 252, 0.45)',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      fcHigh.setData(data.forecast.points.map((p) => ({ time: p.time, value: p.high })));

      const fcLow = chart.addSeries(LineSeries, {
        color: 'rgba(192, 132, 252, 0.45)',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      fcLow.setData(data.forecast.points.map((p) => ({ time: p.time, value: p.low })));
    }

    // 6. Macro S/R + Buy Zone + Stop Loss price lines
    if (showLevels) {
      if (data.model.s1) {
        candleSeries.createPriceLine({
          price: data.model.s1,
          color: '#facc15',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `S1 (${data.model.s1_touches}x)`,
        });
      }
      if (data.model.r1) {
        candleSeries.createPriceLine({
          price: data.model.r1,
          color: '#f472b6',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `R1 (${data.model.r1_touches}x)`,
        });
      }
      if (data.entry_setup.entry_high && data.entry_setup.entry_low) {
        candleSeries.createPriceLine({
          price: data.entry_setup.entry_high,
          color: '#00f5d4',
          lineWidth: 1,
          lineStyle: LineStyle.SparseDotted,
          axisLabelVisible: true,
          title: 'Buy Zone Hi',
        });
        candleSeries.createPriceLine({
          price: data.entry_setup.entry_low,
          color: '#00f5d4',
          lineWidth: 1,
          lineStyle: LineStyle.SparseDotted,
          axisLabelVisible: false,
          title: 'Buy Zone Lo',
        });
      }
      if (data.entry_setup.stop_loss) {
        candleSeries.createPriceLine({
          price: data.entry_setup.stop_loss,
          color: '#ff2e97',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: 'Stop (ATR)',
        });
      }
    }

    // Focus recent ~140 bars + forecast room so chart looks crisp immediately
    const totalBars = data.chart.candles.length;
    if (totalBars > 120) {
      chart.timeScale().setVisibleLogicalRange({
        from: totalBars - 135,
        to: totalBars + (showForecast ? data.forecast.points.length + 4 : 6),
      });
    } else {
      chart.timeScale().fitContent();
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({
          width: entry.contentRect.width,
          height: window.innerWidth < 640 ? 340 : 460,
        });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [data, showChannel, showForecast, showEma, showLevels]);

  // RSI (14) sub-chart
  useEffect(() => {
    const container = rsiContainerRef.current;
    if (!container || !showRsi || data.chart.rsi14.length === 0) return;

    const rsiChart = createChart(container, {
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
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        rightOffset: 10,
        barSpacing: 6,
        visible: false,
      },
      width: container.clientWidth,
      height: 115,
    });

    const rsiSeries = rsiChart.addSeries(LineSeries, {
      color: '#ff2e97',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    rsiSeries.setData(data.chart.rsi14);

    rsiSeries.createPriceLine({
      price: 70,
      color: 'rgba(255, 46, 151, 0.45)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: '70',
    });
    rsiSeries.createPriceLine({
      price: 30,
      color: 'rgba(0, 245, 212, 0.45)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: '30',
    });

    const total = data.chart.rsi14.length;
    if (total > 120) {
      rsiChart.timeScale().setVisibleLogicalRange({ from: total - 135, to: total + 6 });
    } else {
      rsiChart.timeScale().fitContent();
    }

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        rsiChart.applyOptions({ width: entry.contentRect.width });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      rsiChart.remove();
    };
  }, [data, showRsi]);

  const toggles = [
    { label: 'Channel', active: showChannel, set: setShowChannel, dot: '#22d3ee' },
    { label: 'Forecast', active: showForecast, set: setShowForecast, dot: '#c084fc' },
    { label: 'EMA 20/50/200', active: showEma, set: setShowEma, dot: '#facc15' },
    { label: 'S/R & Setup', active: showLevels, set: setShowLevels, dot: '#00f5d4' },
    { label: 'RSI (14)', active: showRsi, set: setShowRsi, dot: '#ff2e97' },
  ];

  return (
    <div className="neon-card overflow-hidden rounded-2xl p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#ff2e97] shadow-[0_0_8px_#ff2e97]" />
          <h3 className="text-sm font-semibold text-white">
            Log-Linear Channel & Technical Chart ({data.ticker})
          </h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {toggles.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => t.set(!t.active)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                t.active
                  ? 'border-white/20 bg-white/10 text-white'
                  : 'border-white/5 bg-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: t.active ? t.dot : '#475569' }}
              />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={mainContainerRef} className="w-full overflow-hidden rounded-xl border border-white/5" />

      {showRsi && (
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between px-1 text-[11px] text-slate-400">
            <span>RSI (14) Momentum</span>
            <span className="font-mono-num text-[#ff2e97]">
              {data.indicators.rsi14 !== null && data.indicators.rsi14 !== undefined
                ? data.indicators.rsi14.toFixed(1)
                : '—'}
            </span>
          </div>
          <div ref={rsiContainerRef} className="w-full overflow-hidden rounded-xl border border-white/5" />
        </div>
      )}
    </div>
  );
}
