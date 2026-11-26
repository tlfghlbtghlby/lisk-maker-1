import React, { useState } from 'react';
import { isPremiumButtons, setPremiumButtons } from '../utils/premiumButtons';

export default function PremiumButtonsToggle() {
  const [on, setOn] = useState<boolean>(() => isPremiumButtons());
  const toggle = (v: boolean) => { setOn(v); setPremiumButtons(v); };
  return (
    <label data-testid="premium-buttons" className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
      <input type="checkbox" checked={on} onChange={(e) => toggle(e.target.checked)} className="mt-0.5 w-4 h-4 rounded text-indigo-600" />
      <div>
        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">✨ أزرار بارزة (ظل احترافي)</div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          تعطي الأزرار الملونة لمعة علوية وظلاً سفلياً وتوهجاً ناعماً بلون الزر. يمكن إيقافها في أي وقت، وتُحفظ لهذا الجهاز فقط.
        </p>
      </div>
    </label>
  );
}
