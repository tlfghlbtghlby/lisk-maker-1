import React from 'react';
import { uiScale, useUiScale, MIN_PCT, MAX_PCT } from '../utils/uiScale';

/** حجم الخط داخل البرنامج (منفصل عن إعدادات الكمبيوتر/الهاتف، ويخص هذا الجهاز فقط) */
export default function UiScaleSetting() {
  const s = useUiScale();
  const presets = [{ l: 'صغير جداً', v: 70 }, { l: 'صغير', v: 90 }, { l: 'عادي', v: 100 }, { l: 'كبير', v: 125 }, { l: 'كبير جداً', v: 160 }, { l: 'ضخم', v: 250 }];
  return (
    <div data-testid="ui-scale-setting" className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3">
      <div className="text-xs font-black text-slate-900 dark:text-white">🔠 حجم الخط والنصوص داخل البرنامج</div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">يغيّر حجم كل النصوص والأزرار داخل المفكر فقط، دون الاعتماد على إعدادات الجهاز. يُحفظ على هذا الجهاز.</p>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button key={p.v} type="button" data-testid={`scale-${p.v}`} onClick={() => uiScale.set({ pct: p.v })} className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${s.pct === p.v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'}`}>{p.l}</button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-slate-500">{MIN_PCT}%</span>
        <input type="range" data-testid="scale-range" min={MIN_PCT} max={MAX_PCT} step={5} value={s.pct} onChange={(e) => uiScale.set({ pct: Number(e.target.value) })} className="flex-1" />
        <span className="text-[11px] text-slate-500">{MAX_PCT}%</span>
        <span className="w-12 text-center text-xs font-black text-emerald-700">{s.pct}%</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">الخط:
          <select data-testid="scale-font" value={s.font} onChange={(e) => uiScale.set({ font: e.target.value as any })} className="h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2">
            <option value="default">الافتراضي</option><option value="tajawal">Tajawal</option><option value="cairo">Cairo</option><option value="system">خط النظام</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 dark:text-slate-200"><input type="checkbox" checked={s.bold} onChange={(e) => uiScale.set({ bold: e.target.checked })} /> خط أثقل</label>
        <button type="button" onClick={() => uiScale.reset()} className="mr-auto px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-100 cursor-pointer">استعادة الافتراضي</button>
      </div>
      <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm">معاينة: بيبسي علبة 330مل — 1,500 دينار</div>
    </div>
  );
}
