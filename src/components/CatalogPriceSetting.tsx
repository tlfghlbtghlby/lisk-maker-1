import React from 'react';
import { useApp } from '../context/AppContext';

/** أي سعر من الكتالوج المشترك يُستعمل في «تحديث السعر» وعند تعبئة مادة من الكتالوج */
export default function CatalogPriceSetting() {
  const { settings, updateSettings } = useApp() as any;
  const mode: 'max' | 'min' = settings?.catalogPriceMode === 'min' ? 'min' : 'max';
  const Opt = ({ v, title, hint }: { v: 'max' | 'min'; title: string; hint: string }) => (
    <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-800 dark:text-slate-200">
      <input type="radio" name="cat-price-mode" data-testid={`cat-price-${v}`} checked={mode === v} onChange={() => updateSettings({ catalogPriceMode: v })} className="w-4 h-4 mt-0.5 text-emerald-600" />
      <span><b>{title}</b><span className="block text-[11px] text-slate-500 dark:text-slate-400">{hint}</span></span>
    </label>
  );
  return (
    <div data-testid="catalog-price-setting" className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3">
      <div className="text-xs font-black text-slate-900 dark:text-white">💲 سعر الكتالوج المشترك (زر «تحديث السعر» وتعبئة المادة)</div>
      <div className="space-y-2">
        <Opt v="max" title="أعلى سعر بين المحلات" hint="الافتراضي: الأعلى الذي ظهر لهذا الباركود في المتاجر." />
        <Opt v="min" title="أقل سعر بين المحلات" hint="الأقل الذي ظهر لهذا الباركود (يتطلب أن يكون سعر المتاجر قد رُفع بالنسخة الجديدة)." />
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">الأسعار هنا نطاق مأخوذ من متاجر متعددة وليست سعر السوق الحالي. راجعها قبل الحفظ.</p>
    </div>
  );
}
