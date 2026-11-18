import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { isModernMode, MODERN_LS_KEY, setModernMode } from '../utils/modernMode';

export default function ModernModeToggle() {
  const { settings, updateSettings } = useApp() as any;
  const [on, setOn] = useState<boolean>(() => {
    try { const l = localStorage.getItem(MODERN_LS_KEY); if (l !== null) return l === '1'; } catch { /* ignore */ }
    return settings?.modernMode === true || isModernMode();
  });
  const toggle = (v: boolean) => {
    setOn(v);
    setModernMode(v);
    updateSettings({ modernMode: v });
  };
  return (
    <label data-testid="modern-mode" className="flex items-start gap-3 p-4 rounded-xl border border-orange-200 dark:border-orange-400/30 bg-gradient-to-l from-orange-50 to-amber-50 dark:from-orange-500/10 dark:to-amber-500/5 cursor-pointer">
      <input type="checkbox" checked={on} onChange={(e) => toggle(e.target.checked)} className="mt-0.5 w-4 h-4 rounded text-orange-500" />
      <div>
        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">✨ الوضع العصري للبرنامج كاملاً</div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          يغيّر شكل كل الواجهات إلى تصميم عصري: خلفية دافئة، بطاقات ناعمة بزوايا مدوّرة، تبويبات وأزرار وحقول ونوافذ بتنسيق جديد وحركة سلسة. يعمل مع الثيم الفاتح والداكن، ولا يغيّر بياناتك. أطفئه لتعود للشكل السابق فوراً.
        </p>
      </div>
    </label>
  );
}
