import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, FileDown, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Customer } from '../types';
import { buildStatement } from '../utils/customerStatement';
import PromoFooter from './PromoFooter';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDT = (v: string) => { const d = new Date(v); if (isNaN(d.getTime())) return ''; const p = (n: number) => String(n).padStart(2, '0'); const h = d.getHours() % 12 || 12; return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(h)}:${p(d.getMinutes())} ${d.getHours() < 12 ? 'ص' : 'م'}`; };
const dayLabel = (s: string) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

/** كشف حساب زبون قابل للطباعة (A4) حسب الفترة التي يحددها صاحب المحل. نفس ترويسة ورقة المبيعات. */
export const CustomerStatementPrint: React.FC<{ customer: Customer; initialFrom?: string; initialTo?: string; onClose: () => void }> = ({ customer, initialFrom = '', initialTo = '', onClose }) => {
  const { invoices, payments, settings, formatMoney } = useApp() as any;
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.body.classList.add('stmt-print-open');
    return () => document.body.classList.remove('stmt-print-open');
  }, []);

  const debtEntries: any[] = (settings as any)?.customerDebtEntries || [];
  const stmt = useMemo(
    () => buildStatement(customer, invoices || [], payments || [], debtEntries, from, to),
    [customer, invoices, payments, debtEntries, from, to]
  );

  const money = (n: number | null | undefined) => (n === null || n === undefined ? '' : (Number(n) < 0 ? '\u200E-' : '') + Math.abs(Number(n)).toLocaleString('en-US'));
  const cur = settings?.currency || '';
  const today = new Date();
  const periodText = from || to ? `من ${from ? dayLabel(from) : 'البداية'} إلى ${to ? dayLabel(to) : dayLabel(iso(today))}` : 'كل الفترة';

  const quick = (kind: 'month' | 'last' | 'q' | 'year' | 'all') => {
    const y = today.getFullYear(), m = today.getMonth();
    if (kind === 'all') { setFrom(''); setTo(''); }
    else if (kind === 'month') { setFrom(iso(new Date(y, m, 1))); setTo(iso(new Date(y, m + 1, 0))); }
    else if (kind === 'last') { setFrom(iso(new Date(y, m - 1, 1))); setTo(iso(new Date(y, m, 0))); }
    else if (kind === 'q') { setFrom(iso(new Date(y, m - 2, 1))); setTo(iso(new Date(y, m + 1, 0))); }
    else { setFrom(iso(new Date(y, 0, 1))); setTo(iso(new Date(y, 11, 31))); }
  };

  const doPrint = () => window.print();
  const savePdf = async () => {
    const api = (window as any).electronAPI;
    if (!api?.printToPdf) { window.print(); return; } // المتصفح/الجوال: نافذة الطباعة فيها «حفظ كـ PDF»
    setBusy(true);
    try {
      const r = await api.printToPdf({ pageSize: 'A4' });
      if (r?.success && r.base64) {
        const bin = atob(r.base64); const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const a = document.createElement('a'); a.href = url; a.download = `كشف_حساب_${customer.name}.pdf`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } else window.print();
    } catch { window.print(); }
    setBusy(false);
  };

  const balCls = (_v: number | null) => ''; // الأسود للطباعة (يصلح للطابعات غير الملونة)
  const th = 'border border-black px-1.5 py-1 bg-slate-200 font-black text-black whitespace-nowrap';
  const td = 'border border-black px-1.5 py-1 align-top';

  return createPortal(
    <div className="stmt-print-root print-modal-overlay fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-2 sm:p-4" dir="rtl" data-testid="customer-statement-print">
      <div className="print-modal-card bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-4xl w-full max-h-[96vh] flex flex-col overflow-hidden">
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-end gap-2 no-print">
          <label className="text-[11px] font-bold text-slate-600">من تاريخ
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="block mt-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white" data-testid="stmt-from" />
          </label>
          <label className="text-[11px] font-bold text-slate-600">إلى تاريخ
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="block mt-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white" data-testid="stmt-to" />
          </label>
          <div className="flex flex-wrap gap-1">
            {([['month', 'هذا الشهر'], ['last', 'الشهر الماضي'], ['q', 'آخر 3 أشهر'], ['year', 'هذه السنة'], ['all', 'كل الفترة']] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => quick(k)} className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer">{l}</button>
            ))}
          </div>
          <div className="flex gap-2 mr-auto">
            <button type="button" onClick={doPrint} data-testid="stmt-print" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"><Printer className="w-4 h-4" />طباعة</button>
            <button type="button" disabled={busy} onClick={savePdf} className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"><FileDown className="w-4 h-4" />{busy ? '...' : 'PDF'}</button>
            <button type="button" onClick={onClose} className="p-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer" aria-label="إغلاق"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="print-invoice-scroll-area flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-300 flex flex-col items-center print:p-0 print:bg-transparent print:block">
          <div id="printable-invoice" className="keep-light bg-white text-black w-[794px] max-w-full p-6 font-sans text-[11px] shadow-xl print:shadow-none print:w-full print:p-0 box-border">
            {/* ترويسة المحل (نفس ورقة المبيعات) */}
            <div className="border-2 border-black rounded p-2.5 text-center">
              <h1 className="text-xl font-black text-black">{settings?.storeName || 'المحل'}</h1>
              <div className="text-[11px] font-bold text-black mt-0.5">
                {settings?.managerLabel || 'بإدارة'}: {settings?.ownerName || settings?.storeName} · {settings?.businessSubtitle || 'تجارة عامة'}
              </div>
              {(settings?.phone || settings?.address) && (
                <div className="text-[10px] text-black mt-0.5">{[settings?.address, settings?.phone && `هاتف: ${settings.phone}`].filter(Boolean).join(' — ')}</div>
              )}
            </div>
            <div className="text-center my-2">
              <span className="inline-block border-2 border-black rounded-full px-8 py-0.5 text-base font-black">كشف حساب</span>
            </div>

            <div className="border border-black rounded px-2.5 py-1.5 flex flex-wrap justify-between gap-x-4 gap-y-1 font-bold">
              <div>السيد: <span className="underline">{customer.name}</span></div>
              {customer.phone && <div>الهاتف: <span className="font-mono">{customer.phone}</span></div>}
              {customer.address && <div>العنوان: {customer.address}</div>}
              <div>الفترة: {periodText}</div>
              <div>تاريخ الطباعة: <span className="font-mono">{dayLabel(iso(today))}</span></div>
            </div>

            <table className="w-full border-collapse mt-2 text-[10.5px]">
              <thead>
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>التاريخ</th>
                  <th className={th}>البيان</th>
                  <th className={th}>رقم القائمة / السند</th>
                  <th className={th}>قيمة القائمة</th>
                  <th className={th}>المسدَّد</th>
                  <th className={th}>المتبقي (دين)</th>
                  <th className={th}>الرصيد بعدها</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-slate-100 font-black">
                  <td className={td} colSpan={7}>الرصيد السابق (قبل {from ? dayLabel(from) : 'أول حركة'})</td>
                  <td className={`${td} font-black ${balCls(stmt.opening)}`}>{money(stmt.opening)}</td>
                </tr>
                {stmt.rows.length === 0 && (
                  <tr><td className={`${td} text-center py-4`} colSpan={8}>لا توجد حركات في هذه الفترة</td></tr>
                )}
                {stmt.rows.map((r, i) => (
                  <tr key={r.key} className={r.voided || r.returned ? 'text-slate-500' : ''} style={r.voided ? { textDecoration: 'line-through' } : undefined}>
                    <td className={`${td} text-center`}>{i + 1}</td>
                    <td className={`${td} whitespace-nowrap`}>{fmtDT(r.date)}</td>
                    <td className={td}>{r.label}{r.note ? <div className="text-[9.5px] font-bold">ملاحظة: {r.note}</div> : null}</td>
                    <td className={`${td} font-mono font-bold`}>{r.ref}</td>
                    <td className={`${td} font-bold`}>{money(r.total)}</td>
                    <td className={`${td} font-bold`}>{money(r.paid)}</td>
                    <td className={`${td} font-bold`}>{r.kind === 'payment' ? '' : money(r.remaining)}</td>
                    <td className={`${td} font-black ${balCls(r.balance)}`}>{r.balance === null ? '—' : money(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-200 font-black">
                  <td className={td} colSpan={4}>المجموع ({stmt.totals.invoicesCount} قائمة)</td>
                  <td className={td}>{money(stmt.totals.invoices + stmt.totals.debtsAdded)}</td>
                  <td className={td}>{money(stmt.totals.paidOnInvoices + stmt.totals.payments)}</td>
                  <td className={td}>{money(stmt.totals.remainingOnInvoices + stmt.totals.debtsAdded)}</td>
                  <td className={`${td} ${balCls(stmt.closing)}`}>{money(stmt.closing)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="avoid-break mt-3 grid grid-cols-2 gap-2">
              <div className="border border-black rounded p-2 space-y-0.5 font-bold">
                <div className="flex justify-between"><span>الرصيد السابق</span><span>{money(stmt.opening)} {cur}</span></div>
                <div className="flex justify-between"><span>إجمالي القوائم الآجلة والنقدية</span><span>{money(stmt.totals.invoices)} {cur}</span></div>
                {stmt.totals.debtsAdded > 0 && <div className="flex justify-between"><span>ديون مضافة</span><span>{money(stmt.totals.debtsAdded)} {cur}</span></div>}
                <div className="flex justify-between"><span>المسدَّد من القوائم</span><span>{money(stmt.totals.paidOnInvoices)} {cur}</span></div>
                <div className="flex justify-between"><span>سندات التسديد</span><span>{money(stmt.totals.payments)} {cur}</span></div>
              </div>
              <div className="border-2 border-black rounded p-2 flex flex-col items-center justify-center text-center">
                <div className="text-[11px] font-black">الرصيد المستحق بنهاية الكشف</div>
                <div className={`text-xl font-black ${balCls(stmt.closing)}`}>{money(stmt.closing)} {cur}</div>
                {stmt.closing < 0 && <div className="text-[10px] font-bold">(رصيد دائن للزبون)</div>}
                {!(from || to) || !to ? <div className="text-[10px] mt-0.5">الدين الحالي: {formatMoney ? formatMoney(customer.totalDebt) : money(customer.totalDebt)}</div> : null}
              </div>
            </div>

            <div className="avoid-break mt-6 grid grid-cols-2 gap-8 text-center font-bold">
              <div><div className="border-t border-black pt-1">توقيع الزبون</div></div>
              <div><div className="border-t border-black pt-1">توقيع المحل</div></div>
            </div>
            {settings?.invoiceFooterNote ? <div className="mt-2 text-center text-[10px]">{settings.invoiceFooterNote}</div> : null}
            <PromoFooter className="mt-2" />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CustomerStatementPrint;
