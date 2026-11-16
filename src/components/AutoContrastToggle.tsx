import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AC_LS_KEY, setAutoContrast } from '../utils/autoContrast';

export default function AutoContrastToggle() {
  const { settings, updateSettings } = useApp() as any;
  const [on, setOn] = useState<boolean>(() => {
    try { const l = localStorage.getItem(AC_LS_KEY); if (l !== null) return l === '1'; } catch { /* ignore */ }
    return settings?.autoContrast === true;
  });
  const toggle = (v: boolean) => {
    setOn(v);
    setAutoContrast(v);
    updateSettings({ autoContrast: v });
  };
  return (
    <label data-testid="auto-contrast" className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
      <input type="checkbox" checked={on} onChange={(e) => toggle(e.target.checked)} className="mt-0.5 w-4 h-4 rounded text-amber-500" />
      <div>
        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">🔄 عكس اللون (تباين تلقائي)</div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          أي كتابة يصبح لونها مغايراً للخلفية التي هي عليها: أسود على الخلفيات الفاتحة وأبيض على الداكنة. يساعد عند ضعف الرؤية أو سطوع الشاشة، ويعمل على الكمبيوتر والهاتف.
        </p>
      </div>
    </label>
  );
}
