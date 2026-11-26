import React from 'react';

export interface DeskAction { label: string; icon?: React.ReactNode; onClick: () => void; hotkey?: string; tone?: 'green' | 'red' | 'blue' | 'plain'; testid?: string }

/** شريط أزرار سفلي داكن لوضع سطح المكتب (أيقونة فوق الاسم كبرامج المحاسبة المكتبية). يُرسم فقط عند استدعائه. */
export const DeskActionBar: React.FC<{ actions: DeskAction[] }> = ({ actions }) => (
  <div className="desk-actionbar no-print" dir="rtl" data-testid="desk-actionbar">
    {actions.map((a, i) => (
      <button key={i} type="button" onClick={a.onClick} data-testid={a.testid} className={`desk-act desk-act-${a.tone || 'plain'}`}>
        <span className="desk-act-ic">{a.icon}</span>
        <span className="desk-act-lb">{a.label}{a.hotkey ? <b>{a.hotkey}</b> : null}</span>
      </button>
    ))}
  </div>
);
