import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ThemeCustom, ThemeModeColors, MODE_DEFAULTS, PRESETS,
  applyThemeCustom, readThemeCustom, saveThemeCustom,
} from '../utils/themeCustom';

const FIELDS: { key: Exclude<keyof ThemeModeColors, 'soft'>; label: string }[] = [
  { key: 'page', label: 'خلفية الصفحة' },
  { key: 'surface', label: 'خلفية البطاقات والنوافذ' },
  { key: 'surface2', label: 'خلفية الحقول والصفوف الثانوية' },
  { key: 'text', label: 'لون الكتابة الأساسي' },
  { key: 'muted', label: 'لون الكتابة الثانوي' },
  { key: 'border', label: 'لون الحدود والخطوط' },
  { key: 'accent', label: 'اللون المميز (الأزرار الذهبية)' },
];

export default function ThemeCustomizer() {
  const { theme, settings, updateSettings } = useApp() as any;
  const [mode, setMode] = useState<'light' | 'dark'>(theme === 'light' ? 'light' : 'dark');
  const [custom, setCustom] = useState<ThemeCustom>(() => readThemeCustom() || settings?.themeCustom || {});
  const timer = useRef<any>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (next: ThemeCustom) => {
    setCustom(next);
    applyThemeCustom(next);
    saveThemeCustom(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => updateSettings({ themeCustom: next }), 800);
  };

  const cur: ThemeModeColors = custom[mode] || {};
  const setModeColors = (colors: ThemeModeColors) => commit({ ...custom, [mode]: colors });
  const setField = (k: keyof ThemeModeColors, v: any) => {
    const next = { ...cur, [k]: v };
    if (v === undefined) delete (next as any)[k];
    setModeColors(next);
  };

  const def = MODE_DEFAULTS[mode];
  const soft = Number(cur.soft) || 0;

  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3" data-testid="theme-customizer">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">🎨 تخصيص ألوان الثيم</span>
        <div className="flex gap-1">
          {(['light', 'dark'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-lg text-xs font-bold border cursor-pointer ${mode === m ? 'bg-amber-500 border-amber-500 text-slate-900' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}
            >
              {m === 'light' ? 'الثيم الفاتح' : 'الثيم الداكن'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        تعدّل ألوان الثيم المحدد أعلاه. التغييرات تظهر مباشرة، ولا تتأثر الطباعة. اترك اللون على «الافتراضي» إن لم ترد تغييره.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS[mode].map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => applyModeColors(p.colors)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-amber-500 cursor-pointer"
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {FIELDS.map((f) => {
          const v = cur[f.key];
          return (
            <div key={f.key} className="flex items-center gap-2">
              <input
                type="color"
                value={v || def[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
                className="w-9 h-8 p-0 border border-slate-300 dark:border-slate-600 rounded cursor-pointer bg-transparent"
                aria-label={f.label}
              />
              <span className="text-xs text-slate-700 dark:text-slate-300 flex-1">{f.label}</span>
              {v ? (
                <button type="button" onClick={() => setField(f.key, undefined)} className="text-[10px] text-amber-600 dark:text-amber-400 font-bold cursor-pointer">افتراضي</button>
              ) : (
                <span className="text-[10px] text-slate-400">افتراضي</span>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <label className="block text-xs text-slate-700 dark:text-slate-300 mb-1">
          {mode === 'light' ? 'تخفيف سطوع الأبيض (الخلفيات البيضاء)' : 'تخفيف سطوع الأبيض (الكتابة البيضاء)'}: <b>{soft}%</b>
        </label>
        <input
          type="range" min={0} max={100} step={5} value={soft}
          onChange={(e) => setField('soft', Number(e.target.value) || undefined)}
          className="w-full accent-amber-500"
        />
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">0% = أبيض صافي، وكلما زاد صار الأبيض أهدأ على العين.</p>
      </div>

      <button
        type="button"
        onClick={() => applyModeColors({})}
        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-300 text-red-600 dark:text-red-400 cursor-pointer"
      >
        إعادة ألوان {mode === 'light' ? 'الفاتح' : 'الداكن'} إلى الافتراضي
      </button>
    </div>
  );

  function applyModeColors(colors: ThemeModeColors) {
    const next = { ...custom };
    if (Object.keys(colors).length) (next as any)[mode] = { ...colors };
    else delete (next as any)[mode];
    commit(next);
  }
}
