import React from 'react';
import { useApp } from '../context/AppContext';

/** خيارات اختيارية (كلها مغلقة افتراضياً): كاشير سريع + إعادة عرض كل الأسعار القديم. */
export default function ViewOptionsSetting() {
  const { settings, updateSettings } = useApp() as any;
  const Row = ({ k, title, desc, defaultOn }: { k: 'fastCashierMode' | 'showAllPricesList' | 'enableChangeCalculator'; title: string; desc: string; defaultOn?: boolean }) => (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" data-testid={`opt-${k}`} checked={defaultOn ? settings[k] !== false : settings[k] === true} onChange={(e) => updateSettings({ [k]: e.target.checked })} className="mt-0.5 w-4 h-4 rounded text-emerald-600" />
      <div>
        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{title}</div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
      </div>
    </label>
  );
  return (
    <div data-testid="view-options-setting" className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3">
      <Row k="showAllPricesList" title="🏷️ عرض كل الأسعار مع زر إضافة تحت كل سعر (الواجهة القديمة)" desc="في عرض القائمة: يظهر سعر المفرد والجملة وغيرها معاً، ولكل سعر زر إضافة خاص به، بدل إظهار سعر واحد حسب نوع الزبون." />
      <Row k="fastCashierMode" title="⚡ وضع «كاشير سريع»" desc="اختصارات: F2 للبحث، F8 حفظ القائمة فقط، F9 حفظ وطباعة. اتركه مغلقاً إن كان المستخدمون مجهزي قوائم وليسوا كاشيراً." />
      <Row k="enableChangeCalculator" defaultOn title="💵 حاسبة الباقي (F5)" desc="زر مستقل عن وضع الكاشير: يفتح فئات النقود لمعرفة الباقي (F5 أو زر «حاسبة الباقي»). عند الإيقاف يعمل F5 كتحديث عادي للصفحة." />
    </div>
  );
}
