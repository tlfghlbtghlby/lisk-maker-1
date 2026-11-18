import React from 'react';
import { useApp } from '../context/AppContext';

/** زر «بيع آجل» في واجهة البيع: عند الضغط تظهر قائمة الزبائن، وباختيار زبون تُحفظ القائمة آجلاً عليه مباشرة. */
export default function QuickCreditSetting() {
  const { settings, updateSettings } = useApp() as any;
  const on = settings.quickCreditButton === true;
  return (
    <label data-testid="quick-credit-setting" className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
      <input type="checkbox" checked={on} onChange={(e) => updateSettings({ quickCreditButton: e.target.checked })} className="mt-0.5 w-4 h-4 rounded text-amber-500" />
      <div>
        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">🧾 زر «بيع آجل» السريع في واجهة البيع</div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          يظهر زر في شاشة البيع؛ عند الضغط عليه تظهر قائمة الزبائن، وبمجرد اختيار زبون تُحفظ القائمة عليه آجلاً (دين بكامل المبلغ) دون الحاجة للرجوع والضغط على حفظ.
        </p>
      </div>
    </label>
  );
}
