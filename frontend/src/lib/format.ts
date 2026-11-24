export function fmtPrice(val?: number | null): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtPct(val?: number | null, showSign = true): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  const sign = showSign && val > 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

export function fmtCompact(val?: number | null): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return val.toLocaleString('en-US');
}

export function fmtVolume(val?: number | null): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
  return String(val);
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export const TREND_ALIGNMENT_LABELS: Record<string, { label: string; color: string }> = {
  BULLISH_ALIGNED: { label: 'ขาขึ้นแข็งแกร่ง (EMA เรียงตัวสวย)', color: '#00f5d4' },
  PULLBACK_IN_UPTREND: { label: 'ย่อตัวในขาขึ้น (Pullback)', color: '#a855f7' },
  UPTREND: { label: 'แนวโน้มขาขึ้น', color: '#38bdf8' },
  MIXED: { label: 'ผันผวน / ออกข้าง', color: '#facc15' },
  BEARISH: { label: 'แนวโน้มขาลง', color: '#ff2e97' },
};
