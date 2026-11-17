import React from 'react';
import { useApp } from '../context/AppContext';

/** إظهار/إخفاء خانة المصروفات (الخصومات) وأقسامها: اليدوية والثابتة */
export default function ExpensesSettingsCard() {
  const { settings, updateSettings } = useApp() as any;
  const tab = settings.showExpensesTab !== false;
  const manual = settings.expensesShowManual !== false;
  const fixed = settings.expensesShowFixed !== false;
  const Row = ({ label, desc, on, onChange, testid, disabled }: any) => (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input data-testid={testid} type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 w-4 h-4 rounded text-amber-500" />
      <div><div className="text-xs font-bold text-slate-800 dark:text-slate-200">{label}</div><p className="text-[11px] text-slate-500 dark:text-slate-400">{desc}</p></div>
    </label>
  );
  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-2.5" data-testid="expenses-settings">
      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">💸 خانة المصروفات (الخصومات)</div>
      <Row testid="set-exp-tab" label="إظهار خانة المصروفات في القائمة" desc="أطفئها لإخفاء الخانة بالكامل." on={tab} onChange={(v: boolean) => updateSettings({ showExpensesTab: v })} />
      <Row testid="set-exp-manual" disabled={!tab} label="إظهار الخصومات اليدوية" desc="تسجيل المصروفات يوماً بيوم (الواجهة الحالية)." on={manual} onChange={(v: boolean) => updateSettings({ expensesShowManual: v })} />
      <Row testid="set-exp-fixed" disabled={!tab} label="إظهار الخصومات الثابتة" desc="رواتب، إيجار... مع زر «معاينة الأرباح مقابل الخصومات»." on={fixed} onChange={(v: boolean) => updateSettings({ expensesShowFixed: v })} />
    </div>
  );
}
