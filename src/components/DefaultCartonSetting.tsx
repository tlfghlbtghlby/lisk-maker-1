import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

/** التعبئة الافتراضية للكرتون عند إضافة مادة جديدة (الافتراضي 24) */
export default function DefaultCartonSetting() {
  const { settings, updateSettings } = useApp() as any;
  const [v, setV] = useState<string>(String(settings.defaultCartonSize || 24));
  const commit = (raw: string) => {
    const n = Math.max(1, Math.round(Number(raw) || 24));
    setV(String(n));
    if (n !== (settings.defaultCartonSize || 24)) updateSettings({ defaultCartonSize: n });
  };
  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-3 flex-wrap" data-testid="default-carton">
      <div>
        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">📦 التعبئة الافتراضية للكرتون</div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">تظهر تلقائياً (قطعة/كرتون) عند إضافة مادة جديدة، ويمكن تغييرها في كل مادة.</p>
      </div>
      <input data-testid="default-carton-input" type="number" min={1} value={v} onChange={(e) => setV(e.target.value)} onBlur={(e) => commit(e.target.value)}
        className="w-24 px-3 py-2 text-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#070e1b] text-slate-900 dark:text-white font-bold" />
    </div>
  );
}
