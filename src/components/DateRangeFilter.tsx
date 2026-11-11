import React, { useCallback, useState } from 'react';

export type DateFilterKey = 'today' | 'month' | 'year' | 'all' | 'custom';

const LABELS: { key: DateFilterKey; label: string }[] = [
  { key: 'today', label: 'اليوم' },
  { key: 'month', label: 'هذا الشهر' },
  { key: 'year', label: 'هذه السنة' },
  { key: 'all', label: 'كامل الفترة' },
  { key: 'custom', label: 'فترة محددة' },
];

/** حالة فلتر الفترة وقاعدة المطابقة (بالتوقيت المحلي) */
export function useDateRangeFilter(initial: DateFilterKey = 'all') {
  const [filter, setFilter] = useState<DateFilterKey>(initial);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const matches = useCallback((iso: string | undefined | null): boolean => {
    if (filter === 'all') return true;
    const d = new Date(iso || '');
    if (isNaN(d.getTime())) return true;
    const now = new Date();
    if (filter === 'today') return d.toDateString() === now.toDateString();
    if (filter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (filter === 'year') return d.getFullYear() === now.getFullYear();
    if (from) {
      const [y, m, dd] = from.split('-').map(Number);
      if (d < new Date(y, m - 1, dd, 0, 0, 0, 0)) return false;
    }
    if (to) {
      const [y, m, dd] = to.split('-').map(Number);
      if (d > new Date(y, m - 1, dd, 23, 59, 59, 999)) return false;
    }
    return true;
  }, [filter, from, to]);

  return { filter, setFilter, from, setFrom, to, setTo, matches };
}

interface BarProps {
  state: ReturnType<typeof useDateRangeFilter>;
  className?: string;
}

export const DateRangeBar: React.FC<BarProps> = ({ state, className = '' }) => (
  <div className={`flex flex-wrap items-center gap-2 ${className}`}>
    <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold overflow-x-auto">
      {LABELS.map(o => (
        <button
          key={o.key}
          type="button"
          onClick={() => state.setFilter(o.key)}
          className={`px-3 py-1.5 rounded-md transition whitespace-nowrap ${state.filter === o.key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
    {state.filter === 'custom' && (
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
        <label className="flex items-center gap-1.5">
          من
          <input
            type="date"
            value={state.from}
            max={state.to || undefined}
            onChange={e => state.setFrom(e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-900"
          />
        </label>
        <label className="flex items-center gap-1.5">
          إلى
          <input
            type="date"
            value={state.to}
            min={state.from || undefined}
            onChange={e => state.setTo(e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-900"
          />
        </label>
      </div>
    )}
  </div>
);
