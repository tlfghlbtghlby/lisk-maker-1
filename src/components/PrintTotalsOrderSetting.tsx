import React from 'react';
import { useApp } from '../context/AppContext';
import { TOTALS_ROWS, resolveTotalsLayout, defaultTotalsLayout } from '../utils/invoiceTotalsLayout';

/** إعدادات الطابع: ترتيب صفوف المجاميع أسفل الوصل (الدين السابق، المجموع، الخصم، الهدايا…) وإظهارها */
export default function PrintTotalsOrderSetting() {
  const { settings, updateSettings } = useApp() as any;
  const layout = resolveTotalsLayout(settings?.invoiceTotalsLayout);
  const save = (order: string[], hidden: string[]) => updateSettings({ invoiceTotalsLayout: { order, hidden } });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= layout.order.length) return;
    const o = [...layout.order];
    [o[i], o[j]] = [o[j], o[i]];
    save(o, layout.hidden);
  };
  const toggle = (id: string) => save(layout.order, layout.hidden.includes(id) ? layout.hidden.filter((x) => x !== id) : [...layout.hidden, id]);
  const label = (id: string) => TOTALS_ROWS.find((r) => r.id === id)?.label || id;
  return (
    <div data-testid="print-totals-setting" className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3">
      <div className="text-xs font-black text-slate-900 dark:text-white">🧾 ترتيب مجاميع الوصل المطبوع</div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">رتّب صفوف المجاميع أسفل الوصل بالأسهم، وأظهر أو أخفِ ما تريد. «خصم القائمة» يظهر فقط حين يوجد خصم.</p>
      <ul className="space-y-1">
        {layout.order.map((id, i) => {
          const off = layout.hidden.includes(id);
          return (
            <li key={id} data-testid={`totals-row-${id}`} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs ${off ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400' : 'bg-white dark:bg-[#0b1728] border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100'}`}>
              <input type="checkbox" checked={!off} onChange={() => toggle(id)} className="w-3.5 h-3.5 accent-emerald-600" title="إظهار في الوصل" />
              <span className="flex-1 font-bold">{label(id)}</span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 disabled:opacity-30 cursor-pointer" title="للأعلى">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === layout.order.length - 1} className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 disabled:opacity-30 cursor-pointer" title="للأسفل">↓</button>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={() => { const d = defaultTotalsLayout(); save(d.order, d.hidden); }} className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-100 cursor-pointer">الترتيب الافتراضي</button>
    </div>
  );
}
