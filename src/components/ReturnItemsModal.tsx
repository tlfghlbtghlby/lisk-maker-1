import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fmtDateTime } from '../utils/dateFmt';
import { useApp } from '../context/AppContext';
import { netUnitPrice } from '../utils/promotions';
import ReturnReceiptModal, { ReturnReceiptData } from './ReturnReceiptModal';

type Mode = 'loose' | 'invoice';
interface LooseLine { productId: string; name: string; code: string; quantity: number; unitPrice: number }

const norm = (s: any) => String(s ?? '').toLowerCase().trim();
const digitsOf = (s: string) => s.replace(/\D/g, '');
/** الرقم التسلسلي في آخر رقم القائمة: INV-XXXX-2026-0012 → 12 */
const seqOf = (n: string) => {
  const m = String(n || '').match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : NaN;
};

export default function ReturnItemsModal({ onClose, initialInvoiceId }: { onClose: () => void; initialInvoiceId?: string }) {
  const { products, invoices, customers, formatMoney, returnLooseItems, returnPartialInvoice, requestApproval, hasPermission, openInvoiceEditor, settings } = useApp() as any;
  // الوضع الافتراضي عند فتح النافذة يحدده الإعداد (رجوع من قائمة / رجوع مواد صافي)
  const [mode, setMode] = useState<Mode>(settings?.returnDefaultMode === 'loose' ? 'loose' : 'invoice');
  const lastAddRef = useRef(0); // Enter القادم مباشرة بعد قراءة الباركود لا يؤكّد
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---- قسم المواد الصافية ----
  const [lines, setLines] = useState<LooseLine[]>([]);
  const [customerId, setCustomerId] = useState('');

  // ---- قسم الرجوع من قائمة ----
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [retQty, setRetQty] = useState<Record<number, number>>({}); // مفتاح = رقم سطر المادة داخل القائمة
  // مواد مُسحت وليست في القائمة المختارة (تنبيه أحمر + تأكيد عند الحفظ)
  const [extras, setExtras] = useState<LooseLine[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [receipt, setReceipt] = useState<ReturnReceiptData | null>(null);
  const initDone = useRef(false);

  useEffect(() => { inputRef.current?.focus(); }, [mode]);
  useEffect(() => {
    if (initialInvoiceId && !initDone.current) { initDone.current = true; setMode('invoice'); setSelectedId(initialInvoiceId); }
  }, [initialInvoiceId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const q = norm(query);
  const productHits = useMemo(() => {
    if (!q) return [] as any[];
    return (products as any[]).filter(p => norm(p.name).includes(q) || norm(p.code).includes(q)).slice(0, 8);
  }, [products, q]);

  const exactProduct = (txt: string) => (products as any[]).find(p => [p.code, ...(p.extraCodes || [])].some((c: any) => c && norm(c) === norm(txt)));

  // ---------- المواد الصافية ----------
  const addLoose = (p: any) => {
    setMsg(null);
    lastAddRef.current = Date.now();
    setLines(prev => {
      const i = prev.findIndex(l => l.productId === p.id);
      if (i >= 0) return prev.map((l, k) => (k === i ? { ...l, quantity: l.quantity + 1 } : l));
      return [{ productId: p.id, name: p.name, code: p.code || '', quantity: 1, unitPrice: Number(p.retailPrice) || 0 }, ...prev];
    });
  };
  const looseTotal = lines.reduce((a, l) => a + Math.round((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)), 0);
  const cust = (customers as any[]).find(c => c.id === customerId);
  const custDebt = Number(cust?.totalDebt) || 0;
  const looseDebtCut = cust && custDebt > 0 ? Math.min(custDebt, looseTotal) : 0;

  const confirmLoose = () => {
    // النافذة تفتح للجميع؛ عند الحفظ يُطلب رمز/بصمة المشرف إن لم تتوفر صلاحية الاسترجاع (صالح لهذا الحفظ فقط)
    const run = () => {
      const r = returnLooseItems(lines, customerId || undefined, 'إرجاع مواد بدون قائمة', { grantId: 'loose' });
      if (!r.success) { setMsg({ ok: false, text: r.error || 'تعذّر الإرجاع' }); return; }
      setLines([]);
      setMsg({
        ok: true,
        text: `تم إرجاع المواد للمخزن. ${r.debtReduction > 0 ? `أُنقص ${formatMoney(r.debtReduction)} من دين الزبون. ` : ''}${r.cashRefund > 0 ? `المبلغ المُرجَع نقداً: ${formatMoney(r.cashRefund)}.` : ''}`,
      });
      inputRef.current?.focus();
    };
    requestApproval('return', 'loose', run);
  };

  // ---------- من قائمة ----------
  const invoiceResults = useMemo(() => {
    const list = (invoices as any[]).filter(i => i.status !== 'returned');
    if (!q) return list.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12);
    const dg = digitsOf(query);
    const asNumber = /^[\d\s-]*$/.test(query) || /^inv/i.test(query.trim());
    const out = list.filter(inv => {
      const num = String(inv.invoiceNumber || '');
      if (asNumber && dg) {
        const seq = seqOf(num);
        if (!Number.isNaN(seq) && seq === parseInt(dg, 10)) return true;
        if (num.toLowerCase().includes(q)) return true;
      }
      if (norm(num).includes(q)) return true;
      if (norm(inv.customerName).includes(q)) return true;
      return (inv.items || []).some((it: any) => norm(it.productName || it.name).includes(q) || norm(it.code) === q || norm(it.code).includes(q));
    });
    return out.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 30);
  }, [invoices, q, query]);

  const selected = (invoices as any[]).find(i => i.id === selectedId) || null;
  const selectInvoice = (inv: any) => { setSelectedId(inv.id); setRetQty({}); setExtras([]); setAlerts([]); setConfirming(false); setMsg(null); };

  const itemRemaining = (it: any) => Math.max(0, (it.quantity || 0) - (it.returnedQuantity || 0));
  const returnable = (it: any) => !(it.isGift && it.promoLabel) && itemRemaining(it) > 0;
  const setQty = (idx: number, v: number, max: number) =>
    setRetQty(prev => ({ ...prev, [idx]: Math.max(0, Math.min(max, Number.isFinite(v) ? v : 0)) }));

  const extrasTotal = extras.reduce((a, l) => a + Math.round((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)), 0);
  const invRefund = (selected
    ? selected.items.reduce((a: number, it: any, idx: number) => a + Math.round((retQty[idx] || 0) * netUnitPrice(it)), 0)
    : 0) + extrasTotal;
  const invDebtCut = selected && selected.remainingAmount > 0 ? Math.min(selected.remainingAmount, invRefund) : 0;

  const startSave = () => {
    if (!selected) return;
    const any = selected.items.some((_: any, idx: number) => (retQty[idx] || 0) > 0) || extras.some(e => e.quantity > 0);
    if (!any) { setMsg({ ok: false, text: 'حدّد كمية مادة واحدة على الأقل.' }); return; }
    if (extras.length) { setConfirming(true); return; } // مواد ليست في القائمة: تأكيد أولاً
    doSave();
  };

  const doSave = () => {
    if (!selected) return;
    setConfirming(false);
    // يجمع الكميات حسب المادة (الدالة تعمل بمعرّف المادة)
    const agg = new Map<string, number>();
    selected.items.forEach((it: any, idx: number) => {
      const qn = retQty[idx] || 0;
      if (qn > 0) agg.set(it.productId, (agg.get(it.productId) || 0) + qn);
    });
    const toReturn = Array.from(agg.entries()).map(([productId, quantity]) => ({ productId, quantity }));
    const run = async () => {
      let okAll = true; let err = '';
      const custBefore = (customers as any[]).find(c => c.id === selected.customerId);
      const prevDebt = custBefore ? Number(custBefore.totalDebt) || 0 : undefined;
      const rLines = [
        ...selected.items.map((it: any, idx: number) => ({ it, q: retQty[idx] || 0 })).filter((x: any) => x.q > 0)
          .map((x: any) => { const up = netUnitPrice(x.it); return { name: x.it.productName || x.it.name || '', quantity: x.q, unitPrice: up, amount: Math.round(x.q * up) }; }),
        ...extras.filter(e => e.quantity > 0).map(e => ({ name: e.name, quantity: e.quantity, unitPrice: e.unitPrice, amount: Math.round(e.quantity * e.unitPrice) })),
      ];
      const rTotal = rLines.reduce((a: number, l: any) => a + l.amount, 0);
      let extraCut = 0;
      if (extras.length) {
        const r = returnLooseItems(extras, selected.customerId || undefined, `إرجاع مادة ليست في القائمة ${selected.invoiceNumber}`, { grantId: selected.id, consume: toReturn.length === 0 });
        if (!r.success) { okAll = false; err = r.error || ''; } else extraCut = r.debtReduction || 0;
      }
      if (okAll && toReturn.length) {
        const r = await returnPartialInvoice(selected.id, toReturn, 'استرجاع من نافذة الاسترجاع');
        if (!r.success) { okAll = false; err = r.error || ''; }
      }
      if (okAll) {
        setMsg({ ok: true, text: `تم الاسترجاع على القائمة ${selected.invoiceNumber}.` });
        const itemsTotal = invRefund - extrasTotal;
        const cut = (toReturn.length && selected.remainingAmount > 0 ? Math.min(selected.remainingAmount, itemsTotal) : 0) + extraCut;
        setReceipt({
          invoiceNumber: selected.invoiceNumber, customerName: selected.customerName, date: new Date().toISOString(),
          lines: rLines, total: rTotal,
          prevDebt, currentDebt: prevDebt === undefined ? undefined : Math.max(0, prevDebt - cut),
          cashRefund: Math.max(0, rTotal - cut),
        });
        setSelectedId(null); setRetQty({}); setExtras([]); setAlerts([]);
        inputRef.current?.focus();
      } else setMsg({ ok: false, text: err || 'تعذّر الاسترجاع' });
    };
    // رمز/بصمة المشرف إن لم تتوفر الصلاحية؛ صالحة لهذا الاسترجاع فقط (تبقى جلسة الموظف كما هي)
    requestApproval('return', selected.id, run);
  };

  const editInvoice = (inv: any) => {
    // تعديل القائمة بالكامل (إنقاص/زيادة) — يتطلب إذن المشرف إن لم تتوفر صلاحية التعديل
    requestApproval('edit', inv.id, () => { onClose(); openInvoiceEditor(inv.id); });
  };

  // ---------- مدخل البحث / الماسح ----------
  const onEnter = () => {
    const txt = query.trim();
    if (!txt) {
      // Enter على حقل فارغ = إنهاء العمل وتأكيد الاسترجاع (يُتجاهل إن جاء مباشرة بعد قراءة باركود)
      if (Date.now() - lastAddRef.current < 600) return;
      if (confirming) { doSave(); return; }
      if (mode === 'loose') { if (lines.length && lines.every(l => (Number(l.quantity) || 0) > 0)) confirmLoose(); return; }
      if (selected && invRefund > 0) startSave();
      return;
    }
    const p = exactProduct(txt);
    if (mode === 'loose') {
      if (p) { addLoose(p); setQuery(''); return; }
      if (productHits.length === 1) { addLoose(productHits[0]); setQuery(''); return; }
      if (!productHits.length) setMsg({ ok: false, text: `لا توجد مادة بهذا الباركود/الاسم: ${txt}` });
      return;
    }
    // مسح باركود رقم القائمة المطبوع على الوصل (ورقة الكاشير): يختار القائمة مباشرة إن كان الرقم يطابق قائمة واحدة فقط
    if (!selected && !p) {
      const exact = invoiceResults.filter((inv: any) => String(inv.invoiceNumber) === txt);
      if (exact.length === 1) { selectInvoice(exact[0]); setQuery(''); return; }
    }
    // وضع القائمة: إن كانت قائمة مختارة والمادة منها → زد كمية الإرجاع، وإلا يبقى النص في البحث ويظهر القوائم
    if (selected && p) {
      const idx = selected.items.findIndex((it: any, k: number) => it.productId === p.id && returnable(it) && (retQty[k] || 0) < itemRemaining(it));
      lastAddRef.current = Date.now();
      if (idx >= 0) { setQty(idx, (retQty[idx] || 0) + 1, itemRemaining(selected.items[idx])); setQuery(''); setMsg(null); return; }
      const inInvoice = selected.items.some((it: any) => it.productId === p.id);
      const text = inInvoice ? `«${p.name}» أُرجعت كاملة من هذه القائمة.` : `⚠️ «${p.name}» غير موجودة في القائمة ${selected.invoiceNumber}.`;
      setAlerts(prev => (prev.includes(text) ? prev : [...prev, text]));
      if (!inInvoice) {
        setExtras(prev => {
          const k = prev.findIndex(l => l.productId === p.id);
          if (k >= 0) return prev.map((l, n) => (n === k ? { ...l, quantity: l.quantity + 1 } : l));
          return [...prev, { productId: p.id, name: p.name, code: p.code || '', quantity: 1, unitPrice: Number(p.retailPrice) || 0 }];
        });
      }
      setQuery('');
      return;
    }
    if (selected && !p && /^\d{6,}$/.test(txt)) {
      const text = `⚠️ الباركود ${txt} غير مسجّل في المخزن ولا في القائمة ${selected.invoiceNumber}.`;
      setAlerts(prev => (prev.includes(text) ? prev : [...prev, text]));
      setQuery('');
    }
  };

  const tabCls = (m: Mode) => `flex-1 py-2.5 rounded-xl text-sm font-black transition cursor-pointer ${mode === m ? 'bg-amber-500 text-slate-900 shadow' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`;
  const canLoose = hasPermission ? hasPermission('canReturnInvoice') : true;

  if (receipt) return <ReturnReceiptModal data={receipt} onClose={() => setReceipt(null)} />;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      dir="rtl"
      data-testid="return-modal"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-[#0b1728] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <h3 className="font-black text-base text-slate-900 dark:text-white">↩️ استرجاع المواد</h3>
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer">إغلاق (Esc)</button>
        </div>

        <div className="px-4 pt-3 flex gap-2">
          <button type="button" data-testid="tab-invoice" className={tabCls('invoice')} onClick={() => { setMode('invoice'); setMsg(null); setQuery(''); }}>رجوع من قائمة بيع</button>
          <button type="button" data-testid="tab-loose" className={tabCls('loose')} onClick={() => { setMode('loose'); setMsg(null); setQuery(''); }}>رجوع مواد صافي (بدون قائمة)</button>
        </div>

        <div className="px-4 pt-3">
          <input
            ref={inputRef}
            data-testid="return-search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setMsg(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
            placeholder={mode === 'loose' ? 'امسح باركود المادة أو ابحث باسمها…' : 'رقم القائمة (الرقم بعد INV فقط) أو اسم مادة أو باركودها أو اسم الزبون…'}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#070e1b] text-slate-900 dark:text-white text-sm font-bold"
          />
        </div>

        {msg && (
          <div data-testid="return-msg" className={`mx-4 mt-2 px-3 py-2 rounded-lg text-xs font-bold border ${msg.ok ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-700'}`}>{msg.text}</div>
        )}

        {mode === 'invoice' && alerts.length > 0 && (
          <div data-testid="return-alerts" className="mx-4 mt-2 space-y-1">
            {alerts.map((a, i) => (
              <div key={i} className="px-3 py-2 rounded-lg text-xs font-black border-2 border-red-500 bg-red-600 text-white flex items-center justify-between gap-2">
                <span>{a}</span>
                <button type="button" onClick={() => setAlerts(prev => prev.filter((_, k) => k !== i))} className="text-white/80 hover:text-white cursor-pointer">✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3 min-h-0">
          {/* ===================== المواد الصافية ===================== */}
          {mode === 'loose' && (
            <>
              {productHits.length > 1 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800" data-testid="loose-hits">
                  {productHits.map(p => (
                    <button type="button" key={p.id} onClick={() => { addLoose(p); setQuery(''); inputRef.current?.focus(); }} className="w-full text-right px-3 py-2 flex items-center justify-between hover:bg-amber-50 dark:hover:bg-slate-800 cursor-pointer">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{p.name} <span className="text-[10px] text-slate-500 font-mono">{p.code}</span></span>
                      <span className="text-xs font-mono text-slate-600 dark:text-slate-300">{formatMoney(p.retailPrice)}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 text-xs font-black text-slate-700 dark:text-slate-200">قائمة الاسترجاع</div>
                {lines.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">امسح باركود المادة أو ابحث عنها لتضاف هنا.</div>
                ) : (
                  <table className="w-full text-xs" data-testid="loose-table">
                    <thead className="text-slate-500 dark:text-slate-400">
                      <tr><th className="p-2 text-right">المادة</th><th className="p-2">الكمية</th><th className="p-2">السعر</th><th className="p-2">المبلغ</th><th /></tr>
                    </thead>
                    <tbody>
                      {lines.map((l, i) => (
                        <tr key={l.productId} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="p-2 font-bold text-slate-900 dark:text-white">{l.name}</td>
                          <td className="p-2 text-center">
                            <input type="number" min={0} step="any" value={l.quantity}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); lastAddRef.current = 0; onEnter(); } }}
                              onChange={(e) => setLines(prev => prev.map((x, k) => k === i ? { ...x, quantity: Number(e.target.value) } : x))}
                              className="w-20 px-2 py-1 text-center border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-[#070e1b] text-slate-900 dark:text-white font-mono" />
                          </td>
                          <td className="p-2 text-center">
                            <input type="number" min={0} step="any" value={l.unitPrice}
                              onChange={(e) => setLines(prev => prev.map((x, k) => k === i ? { ...x, unitPrice: Number(e.target.value) } : x))}
                              className="w-24 px-2 py-1 text-center border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-[#070e1b] text-slate-900 dark:text-white font-mono" />
                          </td>
                          <td className="p-2 text-center font-mono font-bold text-slate-900 dark:text-white">{formatMoney(Math.round((l.quantity || 0) * (l.unitPrice || 0)))}</td>
                          <td className="p-2"><button type="button" onClick={() => setLines(prev => prev.filter((_, k) => k !== i))} className="text-red-600 font-bold cursor-pointer">حذف</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">الزبون (اختياري — إن كان عليه دين يُخصم منه المبلغ)</label>
                <select data-testid="loose-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#070e1b] text-slate-900 dark:text-white text-sm">
                  <option value="">بدون زبون (إرجاع نقدي)</option>
                  {(customers as any[]).map(c => (
                    <option key={c.id} value={c.id}>{c.name}{Number(c.totalDebt) > 0 ? ` — دين ${formatMoney(c.totalDebt)}` : ''}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* ===================== من قائمة بيع ===================== */}
          {mode === 'invoice' && (
            <>
              {selected && (
                <div className="rounded-xl border-2 border-amber-400 overflow-hidden" data-testid="selected-invoice">
                  <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/30 flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-xs font-black text-slate-900 dark:text-white">
                      القائمة المختارة: <span className="font-mono">{selected.invoiceNumber}</span> — {selected.customerName}
                      {selected.remainingAmount > 0 && <span className="text-amber-700 dark:text-amber-300"> (عليها دين {formatMoney(selected.remainingAmount)})</span>}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => {
                        const all: Record<number, number> = {};
                        selected.items.forEach((it: any, i: number) => { if (returnable(it)) all[i] = itemRemaining(it); });
                        setRetQty(all);
                      }} className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold cursor-pointer">إرجاع الكل</button>
                      <button type="button" data-testid="edit-invoice" onClick={() => editInvoice(selected)} className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold cursor-pointer">✎ تعديل القائمة</button>
                      <button type="button" onClick={() => { setSelectedId(null); setRetQty({}); setExtras([]); setAlerts([]); }} className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer">إلغاء الاختيار</button>
                    </div>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="text-slate-500 dark:text-slate-400">
                      <tr><th className="p-2 text-right">المادة</th><th className="p-2">بيع</th><th className="p-2">أُرجع</th><th className="p-2">كمية الإرجاع</th><th className="p-2">المبلغ</th></tr>
                    </thead>
                    <tbody>
                      {selected.items.map((it: any, idx: number) => {
                        const max = itemRemaining(it);
                        const ok = returnable(it);
                        return (
                          <tr key={idx} className={`border-t border-slate-100 dark:border-slate-800 ${ok ? '' : 'opacity-50'}`}>
                            <td className="p-2 font-bold text-slate-900 dark:text-white">{it.productName || it.name}{it.packLabel ? ` (${it.packLabel})` : ''}</td>
                            <td className="p-2 text-center font-mono">{it.quantity}</td>
                            <td className="p-2 text-center font-mono">{it.returnedQuantity || 0}</td>
                            <td className="p-2 text-center">
                              {ok ? (
                                <div className="inline-flex items-center gap-1">
                                  <button type="button" onClick={() => setQty(idx, (retQty[idx] || 0) - 1, max)} className="w-7 h-7 rounded bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-black cursor-pointer">−</button>
                                  <input type="number" min={0} max={max} step="any" value={retQty[idx] || 0}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); lastAddRef.current = 0; onEnter(); } }}
                                    onChange={(e) => setQty(idx, Number(e.target.value), max)}
                                    className="w-16 px-1 py-1 text-center border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-[#070e1b] text-slate-900 dark:text-white font-mono" />
                                  <button type="button" onClick={() => setQty(idx, (retQty[idx] || 0) + 1, max)} className="w-7 h-7 rounded bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-black cursor-pointer">+</button>
                                </div>
                              ) : <span className="text-[10px] text-slate-500">{it.isGift && it.promoLabel ? 'هدية عرض' : 'أُرجعت كاملة'}</span>}
                            </td>
                            <td className="p-2 text-center font-mono font-bold text-slate-900 dark:text-white">{formatMoney(Math.round((retQty[idx] || 0) * netUnitPrice(it)))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {extras.length > 0 && (
                    <div className="border-t-2 border-red-400 bg-red-50 dark:bg-red-950/30" data-testid="extras">
                      <div className="px-3 py-1.5 text-[11px] font-black text-red-700">مواد ليست في هذه القائمة (ستُرجَع للمخزن وتُخصم من حساب الزبون)</div>
                      {extras.map((l, i) => (
                        <div key={l.productId} className="px-3 py-1.5 flex items-center gap-2 text-xs">
                          <span className="flex-1 font-bold text-slate-900 dark:text-white">{l.name}</span>
                          <input type="number" min={0} step="any" value={l.quantity} onChange={(e) => setExtras(prev => prev.map((x, k) => k === i ? { ...x, quantity: Number(e.target.value) } : x))} className="w-16 px-1 py-1 text-center border border-slate-300 rounded font-mono text-slate-900" />
                          <input type="number" min={0} step="any" value={l.unitPrice} onChange={(e) => setExtras(prev => prev.map((x, k) => k === i ? { ...x, unitPrice: Number(e.target.value) } : x))} className="w-24 px-1 py-1 text-center border border-slate-300 rounded font-mono text-slate-900" />
                          <button type="button" onClick={() => setExtras(prev => prev.filter((_, k) => k !== i))} className="text-red-600 font-bold cursor-pointer">حذف</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden" data-testid="invoice-results">
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 text-xs font-black text-slate-700 dark:text-slate-200">
                  {q ? `القوائم المطابقة (${invoiceResults.length})` : 'آخر القوائم — اكتب رقم القائمة أو امسح مادة لتظهر القوائم التي بيعت بها'}
                </div>
                {invoiceResults.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">لا توجد قوائم مطابقة.</div>
                ) : invoiceResults.map((inv: any) => {
                  const hit = q ? (inv.items || []).filter((it: any) => norm(it.productName || it.name).includes(q) || norm(it.code).includes(q)).slice(0, 3) : [];
                  const isSel = inv.id === selectedId;
                  return (
                    <div key={inv.id} onClick={() => selectInvoice(inv)}
                      className={`px-3 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 cursor-pointer hover:bg-amber-50 dark:hover:bg-slate-800 ${isSel ? 'bg-amber-50 dark:bg-slate-800' : ''}`}>
                      <div className="min-w-0">
                        <div className="text-xs font-black text-slate-900 dark:text-white font-mono">{inv.invoiceNumber}</div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300">{inv.customerName} · {fmtDateTime(inv.date)} · {formatMoney(inv.total)}</div>
                        {hit.length > 0 && <div className="text-[10px] text-emerald-700 dark:text-emerald-400 truncate">{hit.map((h: any) => `${h.productName || h.name} × ${h.quantity}`).join('، ')}</div>}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button type="button" onClick={(e) => { e.stopPropagation(); editInvoice(inv); }}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-black cursor-pointer">✎ تعديل</button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); selectInvoice(inv); }}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-900 text-xs font-black cursor-pointer">استرجاع</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* الشريط السفلي: المبلغ وزر التنفيذ */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 flex-wrap">
          {mode === 'loose' ? (
            <>
              <div className="text-xs text-slate-700 dark:text-slate-200" data-testid="loose-summary">
                <div>مبلغ الإرجاع: <b className="font-mono text-base">{formatMoney(looseTotal)}</b></div>
                {looseTotal > 0 && (looseDebtCut > 0
                  ? <div className="text-emerald-700 dark:text-emerald-400 font-bold">سيُنقص {formatMoney(looseDebtCut)} من دين الزبون{looseTotal - looseDebtCut > 0 ? `، والباقي ${formatMoney(looseTotal - looseDebtCut)} يُرجَع نقداً` : ''}.</div>
                  : <div className="text-slate-500">سيُرجَع المبلغ نقداً.</div>)}
                {!canLoose && <div className="text-amber-700 font-bold">سيُطلب رمز أو بصمة المشرف عند الحفظ.</div>}
              </div>
              <button type="button" data-testid="confirm-loose" disabled={!lines.length} onClick={confirmLoose}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 disabled:opacity-40 text-white text-sm font-black cursor-pointer">تأكيد الإرجاع</button>
            </>
          ) : (
            <>
              <div className="text-xs text-slate-700 dark:text-slate-200" data-testid="invoice-summary">
                <div>مبلغ الاسترجاع: <b className="font-mono text-base">{formatMoney(invRefund)}</b></div>
                {selected && !canLoose && <div className="text-amber-700 font-bold">سيُطلب رمز أو بصمة المشرف عند الحفظ.</div>}
                {invRefund > 0 && (invDebtCut > 0
                  ? <div className="text-emerald-700 dark:text-emerald-400 font-bold">سيُنقص {formatMoney(invDebtCut)} من الدين{invRefund - invDebtCut > 0 ? `، والباقي ${formatMoney(invRefund - invDebtCut)} يُرجَع نقداً` : ''}.</div>
                  : <div className="text-slate-500">سيُرجَع المبلغ نقداً.</div>)}
              </div>
              <button type="button" data-testid="confirm-invoice" disabled={!selected || invRefund <= 0} onClick={startSave}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 disabled:opacity-40 text-white text-sm font-black cursor-pointer">تأكيد الاسترجاع</button>
            </>
          )}
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" data-testid="extras-confirm">
          <div className="bg-white dark:bg-[#0b1728] rounded-2xl border-2 border-red-500 shadow-2xl max-w-md w-full p-5 text-right space-y-3">
            <h4 className="font-black text-red-700 text-base">⚠️ تحذير: مواد ليست في هذه القائمة</h4>
            <ul className="text-xs font-bold text-slate-800 dark:text-slate-200 list-disc pr-5 space-y-0.5">
              {extras.map(e => <li key={e.productId}>{e.name} × {e.quantity}</li>)}
            </ul>
            <p className="text-xs text-slate-600 dark:text-slate-300">هل أنت متأكد أنك تريد إرجاع هذه المواد رغم أنها ليست في القائمة {selected?.invoiceNumber}؟{!canLoose ? ' سيُطلب بعد ذلك رمز أو بصمة المشرف.' : ''}</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirming(false)} className="px-4 py-2 rounded-lg bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer">رجوع</button>
              <button type="button" data-testid="extras-confirm-yes" onClick={doSave} className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-black cursor-pointer">نعم، أرجِعها</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
