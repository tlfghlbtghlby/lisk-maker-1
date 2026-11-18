import React, { useEffect, useState } from 'react';

// ساعة وتاريخ حيّان لترويسة الوضع العصري (تُحسب في الجهاز، لا تُخزَّن ولا تُرسَل).
export default function ModernClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = now.toLocaleDateString('ar-IQ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div data-m="clock" data-testid="modern-clock" className="hidden md:flex flex-col items-center justify-center px-5 py-1.5 rounded-2xl border shrink-0" dir="rtl">
      <span className="text-2xl font-black tabular-nums leading-tight" style={{ color: 'var(--m-accent)' }} dir="ltr">{time}</span>
      <span className="text-[11px] font-bold opacity-70">{date}</span>
    </div>
  );
}
