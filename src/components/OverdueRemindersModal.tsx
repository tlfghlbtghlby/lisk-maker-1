import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Customer, Invoice } from '../types';
import { normalizeWaPhone, sendViaWhatsApp } from '../utils/whatsapp';

/** الزبائن الذين تجاوزت قوائمهم الآجلة تاريخ الاستحقاق، مع تذكير واتساب جاهز لكل منهم. */
export const OverdueRemindersModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { customers, invoices, settings, formatMoney } = useApp() as any;
  const [note, setNote] = useState<Record<string, string>>({});
  const today = new Date().toISOString().slice(0, 10);
  const storeName = settings.storeName || '';
  const currency = settings.currency || 'د.ع';

  const rows = useMemo(() => {
    const by = new Map<string, { c: Customer; inv: Invoice[]; amount: number; oldest: string }>();
    (invoices as Invoice[]).forEach((i) => {
      if (!i.customerId || i.status === 'returned') return;
      if (!i.paymentDueDate || (Number(i.remainingAmount) || 0) <= 0) return;
      if (i.paymentDueDate.slice(0, 10) >= today) return;
      const c = (customers as Customer[]).find((x) => x.id === i.customerId);
      if (!c) return;
      const e = by.get(c.id) || { c, inv: [], amount: 0, oldest: i.paymentDueDate };
      e.inv.push(i);
      e.amount += Number(i.remainingAmount) || 0;
      if (i.paymentDueDate < e.oldest) e.oldest = i.paymentDueDate;
      by.set(c.id, e);
    });
    return [...by.values()].sort((a, b) => a.oldest.localeCompare(b.oldest));
  }, [invoices, customers, today]);

  const days = (d: string) => Math.max(1, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));

  const send = async (r: (typeof rows)[number]) => {
    const phone = r.c.whatsappPhone ?? r.c.phone ?? '';
    const lines = r.inv.slice(0, 8).map((i) => `• قائمة ${i.invoiceNumber}: ${Number(i.remainingAmount).toLocaleString('en-US')} ${currency} (استحقت ${i.paymentDueDate!.slice(0, 10)})`).join('\n');
    const text = `تذكير بالدفع — ${storeName}\nالسيد/ة ${r.c.name}\nلديكم مبالغ آجلة مستحقة السداد بمجموع ${r.amount.toLocaleString('en-US')} ${currency}:\n${lines}\n\nنرجو التفضل بالتسديد. شكراً لتعاملكم.`;
    const res = await sendViaWhatsApp(phone, text, undefined, { target: settings.waTarget });
    setNote((n) => ({ ...n, [r.c.id]: res.ok ? '✅ فُتحت المحادثة' : '⚠️ ' + res.note }));
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4" onClick={onClose} dir="rtl" data-testid="overdue-modal">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">⏰ تذكير المتأخرين عن السداد ({rows.length})</h3>
          <button type="button" onClick={onClose} className="px-2 text-slate-500 cursor-pointer">✕</button>
        </div>
        <div className="p-3 overflow-y-auto space-y-2">
          {rows.length === 0 && <div className="text-center text-xs text-slate-500 py-8">لا توجد قوائم آجلة تجاوزت تاريخ استحقاقها. (يُحدَّد الاستحقاق عند البيع الآجل.)</div>}
          {rows.map((r) => {
            const ok = !!normalizeWaPhone(r.c.whatsappPhone ?? r.c.phone ?? '');
            return (
              <div key={r.c.id} className="border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2" data-testid="overdue-row">
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-900 truncate">{r.c.name}</div>
                  <div className="text-[11px] text-rose-700 font-bold">{formatMoney(r.amount)} · متأخر {days(r.oldest)} يوم · {r.inv.length} قائمة</div>
                  {note[r.c.id] && <div className="text-[11px] text-slate-600">{note[r.c.id]}</div>}
                </div>
                <button type="button" disabled={!ok} onClick={() => send(r)} title={ok ? '' : 'لا يوجد رقم واتساب صالح'} className="px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white disabled:opacity-40 cursor-pointer shrink-0">📲 تذكير</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OverdueRemindersModal;
