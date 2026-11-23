import React from 'react';
import { useApp } from '../context/AppContext';

/** أي وضع يُفتح تلقائياً عند الضغط على «إرجاع مادة» في شاشة البيع */
export default function ReturnModeSetting() {
  const { settings, updateSettings } = useApp() as any;
  const mode: 'invoice' | 'loose' = settings?.returnDefaultMode === 'loose' ? 'loose' : 'invoice';
  const Opt = ({ v, title, hint }: { v: 'invoice' | 'loose'; title: string; hint: string }) => (
    <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-800 dark:text-slate-200">
      <input type="radio" name="return-default-mode" data-testid={`return-mode-${v}`} checked={mode === v} onChange={() => updateSettings({ returnDefaultMode: v })} className="w-4 h-4 mt-0.5 text-emerald-600" />
      <span><b>{title}</b><span className="block text-[11px] text-slate-500 dark:text-slate-400">{hint}</span></span>
    </label>
  );
  return (
    <div data-testid="return-mode-setting" className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3">
      <div className="text-xs font-black text-slate-900 dark:text-white">↩ ماذا يظهر عند الضغط على «إرجاع مادة»؟</div>
      <div className="space-y-2">
        <Opt v="invoice" title="رجوع من قائمة بيع" hint="الافتراضي: ابحث عن القائمة أو امسح مادة لتظهر القوائم." />
        <Opt v="loose" title="رجوع مواد صافي (بدون قائمة)" hint="امسح الباركود مباشرة؛ ثم Enter لتأكيد الإرجاع." />
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">في الوضعين: Enter على حقل البحث الفارغ يؤكّد الاسترجاع (بعد قراءة الباركود بلحظة).</p>
    </div>
  );
}
