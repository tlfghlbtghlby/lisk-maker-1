import React from 'react';
import { fmtDateTime } from '../utils/dateFmt';
import { useApp } from '../context/AppContext';

export interface ReturnReceiptLine { name: string; quantity: number; unitPrice: number; amount: number }
export interface ReturnReceiptData {
  invoiceNumber?: string;
  customerName?: string;
  date: string;
  lines: ReturnReceiptLine[];
  total: number;
  prevDebt?: number;      // الدين السابق (قبل الاسترجاع) — إن كان للزبون
  currentDebt?: number;   // الدين الحالي (بعد الاسترجاع)
  cashRefund?: number;
}

/** وصل استرجاع: المواد المسترجعة وأسعارها فقط + قيمة القائمة والدين السابق والحالي */
export default function ReturnReceiptModal({ data, onClose }: { data: ReturnReceiptData; onClose: () => void }) {
  const { settings } = useApp() as any;
  const cur = settings?.currency || 'د.ع';
  const n = (v: number) => `${Math.round(v || 0).toLocaleString()} ${cur}`;
  const hasDebt = data.prevDebt !== undefined && data.currentDebt !== undefined;
  return (
    <div className="print-modal-overlay fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-2 sm:p-4" dir="rtl" data-testid="return-receipt">
      <div className="print-modal-card bg-white rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-3 border-b bg-slate-50 flex items-center justify-between gap-2 no-print">
          <b className="text-sm">وصل استرجاع</b>
          <div className="flex gap-2">
            <button data-testid="return-receipt-print" onClick={() => window.print()} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold">🖨️ طباعة</button>
            <button data-testid="return-receipt-close" onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-200 text-xs font-bold">إغلاق</button>
          </div>
        </div>
        <div className="overflow-y-auto p-4">
          <div className="keep-light printable-invoice-page bg-white text-black text-sm print:p-0">
            <div className="text-center mb-2">
              <div className="font-black text-base">{settings?.storeName || 'المحل'}</div>
              <div className="font-bold text-rose-700">وصل استرجاع</div>
            </div>
            <div className="text-xs mb-2 space-y-0.5">
              {data.invoiceNumber && <div>القائمة الأصلية: <b>{data.invoiceNumber}</b></div>}
              {data.customerName && <div>الزبون: <b>{data.customerName}</b></div>}
              <div>التاريخ: {fmtDateTime(data.date)}</div>
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-y border-black">
                  <th className="text-right py-1">المادة</th>
                  <th className="py-1">الكمية</th>
                  <th className="py-1">السعر</th>
                  <th className="py-1">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l, i) => (
                  <tr key={i} className="border-b border-slate-300">
                    <td className="py-1">{l.name}</td>
                    <td className="py-1 text-center">{l.quantity}</td>
                    <td className="py-1 text-center">{Math.round(l.unitPrice).toLocaleString()}</td>
                    <td className="py-1 text-center font-bold">{Math.round(l.amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-xs space-y-1">
              <div className="flex justify-between font-black text-sm border-t border-black pt-1"><span>قيمة قائمة الاسترجاع</span><span data-testid="rr-total">{n(data.total)}</span></div>
              {hasDebt && <div className="flex justify-between"><span>الدين السابق</span><span data-testid="rr-prev">{n(data.prevDebt!)}</span></div>}
              {hasDebt && <div className="flex justify-between font-bold"><span>الدين الحالي</span><span data-testid="rr-cur">{n(data.currentDebt!)}</span></div>}
              {(data.cashRefund || 0) > 0 && <div className="flex justify-between"><span>المبلغ المُرجَع نقداً</span><span>{n(data.cashRefund!)}</span></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
