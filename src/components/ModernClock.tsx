import React, { useEffect, useState } from 'react';

// ساعة وتاريخ عائمان أسفل يسار الشاشة في الوضع العصري (تُحسب في الجهاز، لا تُخزَّن ولا تُرسَل).
export default function ModernClock({ variant = 'card' }: { variant?: 'card' | 'inline' }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hh = now.getHours();
  const hour12 = hh % 12 || 12;
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const period = hh < 12 ? 'صباحاً' : 'مساءً';
  const date = now.toLocaleDateString('ar-IQ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div data-m="clock" data-testid="modern-clock" dir="rtl" aria-label="الساعة والتاريخ"
      className={`no-print flex items-center gap-3 rounded-2xl border select-none ${variant === 'inline' ? 'px-3 py-1' : 'px-4 py-2'}`}>
      <div className="flex items-baseline gap-1" dir="ltr">
        <span className={`${variant === 'inline' ? 'text-xl' : 'text-3xl'} font-black tabular-nums leading-none`} style={{ color: 'var(--m-accent)' }}>{hour12}:{mm}</span>
        <span className="text-sm font-bold tabular-nums opacity-60">{ss}</span>
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-xs font-black">{period}</span>
        <span className="text-[11px] font-bold opacity-70">{date}</span>
      </div>
    </div>
  );
}
