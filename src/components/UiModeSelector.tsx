import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { deskModeSupported, getUiMode, setUiMode, type UiMode } from '../utils/uiMode';

const OPTS: { id: UiMode; title: string; desc: string }[] = [
  { id: 'classic', title: 'اعتيادي', desc: 'الشكل المعتاد للبرنامج.' },
  { id: 'modern', title: 'عصري', desc: 'بطاقات ناعمة وألوان دافئة وحركة سلسة.' },
  { id: 'desk', title: 'سطح المكتب', desc: 'قائمة جانبية وشاشة رئيسية بمربعات داكنة وجداول بترويسة صفراء وأزرار سفلية، كبرامج المحاسبة المكتبية.' },
];

export default function UiModeSelector() {
  const { updateSettings } = useApp() as any;
  const [mode, setMode] = useState<UiMode>(() => getUiMode());
  const pick = (m: UiMode) => {
    setMode(m);
    setUiMode(m);
    // على الأندرويد لا نلمس deskMode كي لا نغيّر إعداد أجهزة الويندوز المتزامنة
    updateSettings(deskModeSupported ? { modernMode: m === 'modern', deskMode: m === 'desk' } : { modernMode: m === 'modern' });
  };
  return (
    <div data-testid="ui-mode" className="p-4 rounded-xl border border-orange-200 dark:border-orange-400/30 bg-gradient-to-l from-orange-50 to-amber-50 dark:from-orange-500/10 dark:to-amber-500/5">
      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">🎛️ شكل البرنامج كاملاً</div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 mb-3">
        يغيّر شكل كل الواجهات فوراً دون أن يمسّ بياناتك. يُحفظ لهذا الجهاز، ويمكنك الرجوع لأي وضع في أي وقت.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {OPTS.filter((o) => o.id !== 'desk' || deskModeSupported).map((o) => (
          <button
            key={o.id}
            type="button"
            data-testid={`ui-mode-${o.id}`}
            onClick={() => pick(o.id)}
            className={`text-right p-3 rounded-xl border-2 cursor-pointer transition ${
              mode === o.id
                ? 'border-orange-500 bg-white dark:bg-slate-900 shadow'
                : 'border-transparent bg-white/60 dark:bg-slate-800/60 hover:border-orange-300'
            }`}
          >
            <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-full border-2 ${mode === o.id ? 'border-orange-500 bg-orange-500' : 'border-slate-400'}`} />
              {o.title}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{o.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
