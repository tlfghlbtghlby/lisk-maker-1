import React, { useEffect, useRef } from 'react';

export interface DeskAction { label: string; icon?: React.ReactNode; onClick: () => void; hotkey?: string; tone?: 'green' | 'red' | 'blue' | 'plain'; testid?: string }

/** شريط أزرار سفلي داكن لوضع سطح المكتب (أيقونة فوق الاسم كبرامج المحاسبة المكتبية). يُرسم فقط عند استدعائه. */
export const DeskActionBar: React.FC<{ actions: DeskAction[] }> = ({ actions }) => {
  // اختصارات لوحة المفاتيح (F2، F3 ...) تعمل فعلاً ما دام الشريط ظاهراً؛ تُعطَّل عند فتح نافذة منبثقة
  const ref = useRef(actions);
  ref.current = actions;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      if (!/^F\d{1,2}$/.test(e.key)) return;
      if (document.querySelector('.fixed.inset-0')) return; // نافذة مفتوحة: لا نتدخل
      const a = ref.current.find((x) => x.hotkey && x.hotkey.trim() === e.key);
      if (!a) return;
      e.preventDefault();
      a.onClick();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
  <div className="desk-actionbar no-print" dir="rtl" data-testid="desk-actionbar">
    {actions.map((a, i) => (
      <button key={i} type="button" onClick={a.onClick} data-testid={a.testid} className={`desk-act desk-act-${a.tone || 'plain'}`}>
        <span className="desk-act-ic">{a.icon}</span>
        <span className="desk-act-lb">{a.label}{a.hotkey ? <b>{a.hotkey}</b> : null}</span>
      </button>
    ))}
  </div>
  );
};
