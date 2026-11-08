import React, { useMemo, useState } from 'react';
import { X, ArrowDownCircle, ArrowUpCircle, History } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Product } from '../types';

interface Props {
  product: Product;
  onClose: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const num = (n: number) => (Math.round(n * 1000) / 1000).toLocaleString('en-US');

interface Row {
  key: string;
  date: string;
  kind: 'purchase' | 'adjust' | 'sale' | 'gift' | 'return';
  qty: number;
  label: string;
  estimated?: boolean;
}

export default function ProductMovementModal({ product, onClose }: Props) {
  const { invoices } = useApp();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { rows, totals } = useMemo(() => {
    const all: Row[] = [];
    let soldAll = 0; // صافي ما خرج من المخزون بالبيع (بما فيه الهدايا) بعد المرتجعات
    (invoices || []).forEach(inv => {
      (inv.items || []).forEach((it, idx) => {
        if (it.productId !== product.id) return;
        const q = Number(it.quantity) || 0;
        const pieces = typeof it.deductedPieces === 'number' ? it.deductedPieces : q;
        const ratio = q > 0 ? pieces / q : 1;
        const returned = inv.status === 'returned' ? q : Math.min(q, Number(it.returnedQuantity) || 0);
        const netPieces = Math.max(0, pieces - returned * ratio);
        soldAll += netPieces;
        if (netPieces <= 0) return;
        const isGift = Boolean(it.isGift);
        all.push({
          key: `${inv.id}_${idx}`,
          date: inv.date,
          kind: isGift ? 'gift' : 'sale',
          qty: netPieces,
          label: `${isGift ? 'هدية' : 'بيع'} - قائمة ${inv.invoiceNumber ?? ''}`.trim(),
        });
      });
    });

    const log = product.purchaseLog || [];
    let logPurchases = 0;
    let logAdjust = 0;
    log.forEach(e => {
      if (e.type === 'purchase') logPurchases += e.qty; else logAdjust += e.qty;
      all.push({
        key: e.id,
        date: e.date,
        kind: e.type,
        qty: e.qty,
        label: e.type === 'purchase' ? `شراء / إضافة مخزون${e.note ? ' (' + e.note + ')' : ''}` : `تنقيص يدوي${e.note ? ' (' + e.note + ')' : ''}`,
      });
    });

    // مشتريات سابقة لم تُسجَّل: نقدّرها من الرصيد الحالي + صافي المبيعات
    const unlogged = Math.max(0, Math.round(((product.stock || 0) + soldAll + logAdjust - logPurchases) * 1000) / 1000);
    if (unlogged > 0) {
      all.push({
        key: 'estimated',
        date: product.createdAt,
        kind: 'purchase',
        qty: unlogged,
        label: 'مشتريات سابقة (مقدّرة قبل تفعيل التتبع)',
        estimated: true,
      });
    }

    const f = fromDate, t = toDate;
    const inRange = (iso: string) => {
      const k = dayKey(iso);
      if (!k) return true;
      if (f && k < f) return false;
      if (t && k > t) return false;
      return true;
    };
    const filtered = all.filter(r => inRange(r.date)).sort((a, b) => (a.date < b.date ? 1 : -1));
    const sum = (kinds: Row['kind'][]) => filtered.filter(r => kinds.includes(r.kind)).reduce((s, r) => s + r.qty, 0);
    return {
      rows: filtered,
      totals: {
        purchased: sum(['purchase']),
        sold: sum(['sale']),
        gifts: sum(['gift']),
        adjusted: sum(['adjust']),
        hasEstimate: filtered.some(r => r.estimated),
      },
    };
  }, [invoices, product, fromDate, toDate]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-3" dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <History className="w-5 h-5 text-indigo-600 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-slate-800 text-sm">تاريخ حركة المادة</div>
              <div className="text-xs text-slate-500 truncate">{product.name} — المخزون الحالي: {num(product.stock || 0)}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-bold text-slate-600">من تاريخ
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="block mt-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs font-bold text-slate-600">إلى تاريخ
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="block mt-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
            </label>
            {(fromDate || toDate) && (
              <button onClick={() => { setFromDate(''); setToDate(''); }} className="text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">
                من البداية للآن
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
              <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1"><ArrowDownCircle className="w-3.5 h-3.5" /> إجمالي المشتريات</div>
              <div className="text-xl font-black text-emerald-800">{num(totals.purchased)}</div>
            </div>
            <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3">
              <div className="text-[11px] font-bold text-indigo-700 flex items-center gap-1"><ArrowUpCircle className="w-3.5 h-3.5" /> إجمالي المبيعات</div>
              <div className="text-xl font-black text-indigo-800">{num(totals.sold)}</div>
            </div>
          </div>
          {(totals.gifts > 0 || totals.adjusted > 0) && (
            <div className="text-xs text-slate-600 flex flex-wrap gap-3">
              {totals.gifts > 0 && <span>هدايا (عروض): <b>{num(totals.gifts)}</b></span>}
              {totals.adjusted > 0 && <span>تنقيص يدوي: <b>{num(totals.adjusted)}</b></span>}
            </div>
          )}
          <div className="text-[11px] text-slate-500">الكميات بالقطعة، والمبيعات بعد خصم المرتجعات.</div>
          {totals.hasEstimate && (
            <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
              المشتريات السابقة لهذا التحديث غير مسجّلة بتاريخها، لذلك قُدّرت من (المخزون الحالي + صافي المبيعات) ونُسبت لتاريخ إنشاء المادة. المشتريات الجديدة تُسجَّل بتاريخها بدقة.
            </div>
          )}

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr><th className="p-2 text-right">التاريخ</th><th className="p-2 text-right">الحركة</th><th className="p-2 text-center">الكمية</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={3} className="p-4 text-center text-slate-400">لا توجد حركة في هذه الفترة</td></tr>
                ) : rows.map(r => (
                  <tr key={r.key} className="border-t border-slate-100">
                    <td className="p-2 whitespace-nowrap">{r.estimated ? dayKey(r.date) : fmtDate(r.date)}</td>
                    <td className="p-2">{r.label}</td>
                    <td className={`p-2 text-center font-bold ${r.kind === 'purchase' ? 'text-emerald-700' : r.kind === 'sale' ? 'text-indigo-700' : 'text-slate-600'}`}>
                      {r.kind === 'purchase' ? '+' : '−'}{num(r.qty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
