import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';

/** مؤشر حالة المزامنة: متصل/غير متصل وعدد التعديلات المحلية التي لم تُرفع بعد (تقريبي، للطمأنة فقط). */
export const SyncStatusChip: React.FC = () => {
  const { products, customers, invoices, payments, settings, lastSyncTime, isSyncing } = useApp() as any;
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pending, setPending] = useState(0);
  const first = useRef(true);
  const lastSync = useRef(lastSyncTime);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // كل تغيير في البيانات المحلية = تعديل بانتظار الرفع
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setPending((n) => n + 1);
  }, [products, customers, invoices, payments, settings]);

  // عند اكتمال مزامنة ناجحة يتصفّر العدّاد
  useEffect(() => {
    if (lastSyncTime !== lastSync.current) {
      lastSync.current = lastSyncTime;
      if (online) setPending(0);
    }
  }, [lastSyncTime, online]);

  if (online && pending === 0 && !isSyncing) return null;
  const text = !online
    ? `بدون إنترنت — ${pending > 0 ? `${pending} تعديل محفوظ محلياً` : 'التعديلات تُحفظ محلياً'} وسيُرفع تلقائياً عند عودة الاتصال`
    : isSyncing
      ? 'جاري الرفع…'
      : `${pending} تعديل بانتظار المزامنة…`;
  return (
    <span
      data-testid="sync-chip"
      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap ${
        !online ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' : 'bg-sky-500/15 text-sky-300 border-sky-500/40'
      }`}
      title="التعديلات محفوظة على جهازك دائماً حتى لو لم تُرفع بعد"
    >
      {!online ? '📴 ' : '⏳ '}{text}
    </span>
  );
};

export default SyncStatusChip;
