import React, { useEffect, useRef, useState } from 'react';
import { cdChannel, cdPost, CDCart, CDDone, CDMessage } from '../utils/customerDisplay';

// شاشة الزبون (الشاشة الثانية). تعرض: المواد، الخصم، الإجمالي النهائي فقط.
export default function CustomerDisplay() {
  const [cart, setCart] = useState<CDCart | null>(null);
  const [done, setDone] = useState<CDDone | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    document.title = 'شاشة الزبون';
    const c = cdChannel();
    const onMsg = (e: MessageEvent<CDMessage>) => {
      const m = e.data;
      if (!m) return;
      if (m.kind === 'cart') setCart(m);
      else if (m.kind === 'done') {
        setDone(m);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setDone(null), 1100);
      }
    };
    c?.addEventListener('message', onMsg as any);
    cdPost({ kind: 'hello' });
    return () => { c?.removeEventListener('message', onMsg as any); if (timer.current) window.clearTimeout(timer.current); };
  }, []);

  const toggleFull = () => {
    try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch { /* ignore */ }
  };

  const empty = !cart || cart.lines.length === 0;
  return (
    <div dir="rtl" onDoubleClick={toggleFull} data-testid="customer-display" className="min-h-screen bg-[#0b1728] text-white flex flex-col select-none" style={{ fontFamily: 'inherit' }}>
      <div className="px-6 py-4 bg-[#091528] border-b border-amber-500/30 flex items-center justify-between">
        <div className="text-xl font-black text-amber-400" data-testid="cd-store">{cart?.storeName || 'أهلاً بكم'}</div>
        {cart?.customerName && cart.saleType === 'credit' && (
          <div className="text-sm font-bold bg-amber-500/15 border border-amber-500/40 rounded-full px-4 py-1.5" data-testid="cd-customer">الزبون: {cart.customerName}</div>
        )}
      </div>

      {empty ? (
        <div className="flex-1 flex items-center justify-center text-3xl font-black text-slate-400" data-testid="cd-empty">أهلاً وسهلاً بكم</div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-6 py-3">
            <table className="w-full text-right">
              <thead className="text-slate-400 text-sm">
                <tr><th className="py-2 font-bold">المادة</th><th className="py-2 font-bold text-center">الكمية</th><th className="py-2 font-bold">السعر</th><th className="py-2 font-bold">المجموع</th></tr>
              </thead>
              <tbody>
                {cart!.lines.map((l, i) => (
                  <tr key={i} className="border-t border-white/10 text-xl" data-testid="cd-line">
                    <td className="py-2.5 font-bold">{l.name}{l.gift ? <span className="mr-2 text-xs text-emerald-400">هدية</span> : null}{l.disc ? <span className="mr-2 text-xs text-rose-300">خصم {l.disc}</span> : null}</td>
                    <td className="py-2.5 text-center font-mono">{l.qty}</td>
                    <td className="py-2.5 font-mono text-slate-300">{l.price}</td>
                    <td className="py-2.5 font-mono font-black">{l.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-[#091528] border-t border-amber-500/30 space-y-1">
            {cart!.discount && (
              <div className="flex justify-between text-lg text-slate-300"><span>المجموع</span><span className="font-mono">{cart!.subtotal}</span></div>
            )}
            {cart!.discount && (
              <div className="flex justify-between text-lg text-rose-300" data-testid="cd-discount"><span>الخصم</span><span className="font-mono">- {cart!.discount}</span></div>
            )}
            <div className="flex justify-between items-center text-4xl font-black text-amber-400" data-testid="cd-total"><span>الإجمالي</span><span className="font-mono">{cart!.total}</span></div>
          </div>
        </>
      )}

      {done && (
        <div className="fixed inset-0 z-50 bg-emerald-600 flex flex-col items-center justify-center gap-4 text-center" data-testid="cd-done">
          <div className="text-7xl">✅</div>
          <div className="text-5xl font-black">تم بنجاح</div>
          <div className="text-2xl font-bold opacity-90">{done.saleType === 'credit' ? 'بيع آجل' : 'بيع نقد'}</div>
          {done.customerName && <div className="text-3xl font-black">{done.customerName}</div>}
        </div>
      )}
    </div>
  );
}
