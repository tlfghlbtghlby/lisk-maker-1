import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { buildDebtMessage, buildInvoicePdf, buildStatementPdf, DebtEvent, normalizeWaPhone, sendViaWhatsApp } from '../utils/whatsapp';

interface Item { id: number; name: string; phone: string; text: string }

/** إشعارات صغيرة لا تحجب العمل: رسالة واتساب جاهزة لكل حركة دين لزبون فعّل له الخيار */
export const WhatsAppAutoPrompt: React.FC = () => {
  const { customers, settings, invoices, payments } = useApp() as any;
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const onEv = (e: Event) => {
      const ev = (e as CustomEvent).detail as DebtEvent;
      const c = customers.find((x: any) => x.id === ev.customerId);
      if (!c || c.whatsappAuto !== true) return;
      const phone = c.whatsappPhone || c.phone || '';
      if (!normalizeWaPhone(phone)) return;
      const text = buildDebtMessage(c, ev, settings.storeName || '', settings.currency || 'د.ع');
      const opts = { target: settings.waTarget as 'app' | 'web' | undefined, autoPaste: settings.waAutoPaste !== false };
      if (settings.waAutoOpen !== false) {
        // يفتح محادثة الزبون مباشرة بالرسالة جاهزة (وكشف الحساب PDF إن فُعّل)
        (async () => {
          try {
            let pdf;
            if (settings.waAttachPdf !== false) {
              const fresh = { ...c, totalDebt: ev.newDebt };
              if (ev.kind === 'invoice' && ev.invoice) {
                pdf = await buildInvoicePdf(ev.invoice, fresh, settings.storeName || '', settings.currency || 'د.ع', ev.prevDebt ?? 0, ev.newDebt);
              } else {
                pdf = await buildStatementPdf(fresh, invoices, payments, settings.storeName || '', settings.currency || 'د.ع');
              }
            }
            await sendViaWhatsApp(phone, text, pdf, opts);
          } catch { /* ignore */ }
        })();
        return;
      }
      setItems((p) => [...p, { id: Date.now() + Math.random(), name: c.name, phone, text }].slice(-3));
    };
    window.addEventListener('wa-debt', onEv);
    return () => window.removeEventListener('wa-debt', onEv);
  }, [customers, settings.storeName, settings.currency, settings.waTarget, settings.waAutoOpen, settings.waAutoPaste, settings.waAttachPdf, invoices, payments]);

  if (items.length === 0) return null;
  const drop = (id: number) => setItems((p) => p.filter((i) => i.id !== id));
  return (
    <div className="fixed bottom-4 left-4 z-[90] flex flex-col gap-2 w-72" data-testid="wa-prompts">
      {items.map((i) => (
        <div key={i.id} className="rounded-xl border border-emerald-400 bg-white shadow-xl p-3 text-xs">
          <div className="font-bold text-slate-900 mb-1">💬 رسالة واتساب جاهزة لـ {i.name}</div>
          <div className="text-slate-600 whitespace-pre-line line-clamp-4 mb-2">{i.text}</div>
          <div className="flex gap-2">
            <button onClick={async () => { await sendViaWhatsApp(i.phone, i.text, undefined, { target: settings.waTarget }); drop(i.id); }} className="flex-1 bg-emerald-600 text-white font-bold py-1.5 rounded-lg cursor-pointer">فتح وإرسال</button>
            <button onClick={() => drop(i.id)} className="px-3 bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer">تجاهل</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default WhatsAppAutoPrompt;
