import React, { useState } from 'react';
import { X, Send, FileText } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Customer } from '../types';
import { buildDebtMessage, buildStatementPdf, buildStatementText, normalizeWaPhone, sendViaWhatsApp } from '../utils/whatsapp';

interface Props { customer: Customer; onClose: () => void }

export const CustomerWhatsAppModal: React.FC<Props> = ({ customer, onClose }) => {
  const { customers, updateCustomer, settings, invoices, payments } = useApp() as any;
  const live: Customer = customers.find((c: Customer) => c.id === customer.id) || customer;
  const currency = settings.currency || 'د.ع';
  const storeName = settings.storeName || '';
  const [phone, setPhone] = useState(live.whatsappPhone ?? live.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const valid = !!normalizeWaPhone(phone);

  const savePhone = () => { if ((live.whatsappPhone ?? '') !== phone.trim()) updateCustomer(live.id, { whatsappPhone: phone.trim() }); };

  const sendNotice = async () => {
    savePhone();
    const text = buildDebtMessage(live, { customerId: live.id, kind: 'notice', amount: 0, newDebt: live.totalDebt }, storeName, currency);
    const r = await sendViaWhatsApp(phone, text, undefined, { target: settings.waTarget });
    setMsg({ ok: r.ok, text: r.note });
  };

  const sendStatement = async () => {
    savePhone();
    setBusy(true); setMsg(null);
    try {
      const text = buildStatementText(live, invoices, payments, storeName, currency);
      const pdf = await buildStatementPdf(live, invoices, payments, storeName, currency);
      const r = await sendViaWhatsApp(phone, text, pdf, { target: settings.waTarget, autoPaste: settings.waAutoPaste !== false });
      setMsg({ ok: r.ok, text: r.note });
    } catch (e: any) {
      setMsg({ ok: false, text: 'تعذر تجهيز كشف الحساب: ' + (e?.message || '') });
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">💬 واتساب — {live.name}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">رقم واتساب الزبون</label>
            <input
              type="tel" inputMode="tel" dir="ltr" value={phone}
              onChange={(e) => setPhone(e.target.value)} onBlur={savePhone}
              placeholder="07XXXXXXXXX"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 bg-white focus:outline-none focus:border-emerald-500"
            />
            <div className="text-[11px] text-slate-500 mt-1">{valid ? `سيُرسل إلى: +${normalizeWaPhone(phone)}` : 'أدخل الرقم (يُحوَّل تلقائياً للصيغة الدولية العراقية)'}</div>
          </div>

          <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
            <div>
              <span className="text-xs font-bold text-slate-800 block">تجهيز رسالة تلقائياً عند كل حركة دين</span>
              <span className="text-[11px] text-slate-500">عند أي قائمة آجلة أو دفعة لهذا الزبون يظهر إشعار صغير برسالة جاهزة، وتضغط «إرسال» لتفتح محادثته.</span>
            </div>
            <input type="checkbox" checked={live.whatsappAuto === true}
              onChange={(e) => updateCustomer(live.id, { whatsappAuto: e.target.checked })}
              className="mt-1 w-4 h-4 rounded text-emerald-600" />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button disabled={!valid} onClick={sendNotice}
              className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer">
              <Send className="w-3.5 h-3.5" /> إرسال إشعار الدين
            </button>
            <button disabled={!valid || busy} onClick={sendStatement}
              className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer">
              <FileText className="w-3.5 h-3.5" /> {busy ? 'جاري التجهيز...' : 'كشف الحساب الآن (نص + PDF)'}
            </button>
          </div>

          {msg && <div className={`text-xs font-bold rounded-lg px-3 py-2 border ${msg.ok ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'}`}>{msg.text}</div>}
          <div className="text-[11px] text-slate-500 leading-relaxed">
            ملاحظة: واتساب لا يسمح للبرامج بالإرسال الصامت عبر التطبيق المثبّت؛ يُفتح الحوار والنص جاهزان وتضغط «إرسال» (ومع ملف PDF: الصقه بـ Ctrl+V).
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerWhatsAppModal;
