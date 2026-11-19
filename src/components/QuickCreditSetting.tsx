import React from 'react';
import { useApp } from '../context/AppContext';

/** وضع زرّي البيع «نقد» و«دين آجل»: يستبدل أزرار الحفظ والحفظ والطباعة، ولكل زر إجراء يختاره المستخدم. */
export default function QuickCreditSetting() {
  const { settings, updateSettings } = useApp() as any;
  const on = settings.quickCreditButton === true;
  const cash = settings.cashSaleAction === 'save' ? 'save' : 'print';
  const credit = settings.creditSaleAction === 'print' ? 'print' : 'save';
  type KA = 'cash' | 'credit' | 'print' | 'save' | 'none';
  const enter: KA = settings.quickEnterAction || 'cash';
  const ctrl: KA = settings.quickCtrlEnterAction || 'print';
  const KEY_OPTS: { v: KA; t: string }[] = [
    { v: 'cash', t: '💵 نقد' }, { v: 'credit', t: '🧾 دين آجل' }, { v: 'print', t: 'حفظ + طباعة' }, { v: 'save', t: 'حفظ فقط' }, { v: 'none', t: 'لا شيء' },
  ];
  const KeyPick = ({ label, value, onChange }: { label: string; value: KA; onChange: (v: KA) => void }) => (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 w-24 font-mono">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as KA)} className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-800 dark:text-slate-100">
        {KEY_OPTS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
      </select>
    </div>
  );
  const Pick = ({ label, value, onChange }: { label: string; value: 'print' | 'save'; onChange: (v: 'print' | 'save') => void }) => (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 w-24">{label}</span>
      {(['print', 'save'] as const).map((v) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`px-3 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${value === v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'}`}>
          {v === 'print' ? 'حفظ + طباعة' : 'حفظ فقط'}
        </button>
      ))}
    </div>
  );
  return (
    <div data-testid="quick-credit-setting" className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3">
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={on} onChange={(e) => updateSettings({ quickCreditButton: e.target.checked })} className="mt-0.5 w-4 h-4 rounded text-amber-500" />
        <div>
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">💵🧾 وضع زرّي «نقد» و«دين آجل» في واجهة البيع</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            يظهر زران فقط: «نقد» أخضر يبيع مباشرة، و«دين آجل» تختار له الزبون فتُحفظ القائمة عليه ديناً. وتختفي أزرار «حفظ» و«حفظ وطباعة».
          </p>
        </div>
      </label>
      {on && (
        <div className="space-y-2 pr-7" data-testid="quick-actions">
          <Pick label="عند «نقد»:" value={cash} onChange={(v) => updateSettings({ cashSaleAction: v })} />
          <Pick label="عند «دين آجل»:" value={credit} onChange={(v) => updateSettings({ creditSaleAction: v })} />
          <div className="pt-2 mt-1 border-t border-slate-200 dark:border-slate-700 space-y-2" data-testid="quick-keys">
            <div className="text-[11px] font-black text-slate-700 dark:text-slate-300">⌨️ الاختصارات</div>
            <KeyPick label="Enter:" value={enter} onChange={(v) => updateSettings({ quickEnterAction: v })} />
            <KeyPick label="Ctrl + Enter:" value={ctrl} onChange={(v) => updateSettings({ quickCtrlEnterAction: v })} />
            <button type="button" data-testid="swap-keys" onClick={() => updateSettings({ quickEnterAction: ctrl, quickCtrlEnterAction: enter })} className="px-3 py-1 rounded-lg text-[11px] font-bold border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer">🔁 عكس الاختصارين</button>
            <p className="text-[11px] text-slate-500">مع وضع Enter (لوحة المفاتيح) يبقى Enter للتنقل بين الخلايا ويعمل Ctrl+Enter فقط. في وضع القائمة: Enter على سطر الإدخال الفارغ ينفّذ إجراء Enter.</p>
          </div>
        </div>
      )}
    </div>
  );
}
