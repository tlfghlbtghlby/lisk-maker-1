import React, { useMemo, useRef, useState } from 'react';
import { fmtDateTime } from '../utils/dateFmt';
import { useApp } from '../context/AppContext';
import type { Invoice } from '../types';
import { readBackupFileText } from '../utils/backupFile';
import { archiveGetAll } from '../utils/invoiceArchive';
import { InvoicePrintModal } from './InvoicePrintModal';

/** تصفح أو استعادة الفواتير فقط من ملف نسخة قديمة (.json/.gz) أو من الأرشيف المحلي. */
export const InvoiceArchiveModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { invoices, formatMoney, restoreInvoicesFromBackup } = useApp() as any;
  const fileRef = useRef<HTMLInputElement>(null);
  const [list, setList] = useState<Invoice[]>([]);
  const [source, setSource] = useState('');
  const [mode, setMode] = useState<'browse' | 'restore'>('browse');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const have = useMemo(() => new Set((invoices as Invoice[]).map((i) => String(i.id))), [invoices]);

  const load = (arr: any[], label: string) => {
    const seen = new Set<string>();
    const out: Invoice[] = [];
    for (const i of arr) {
      if (!i || i.id === undefined || !Array.isArray(i.items)) continue;
      const k = String(i.id);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(i);
    }
    out.sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')));
    setList(out);
    setSource(label);
    setPicked(new Set());
    setMsg(null);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const text = await readBackupFileText(f);
      const data = JSON.parse(text);
      const arr = [...(Array.isArray(data.invoices) ? data.invoices : []), ...(Array.isArray(data.archivedInvoices) ? data.archivedInvoices : [])];
      if (!arr.length) throw new Error('لا توجد فواتير في هذا الملف.');
      load(arr, f.name);
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message || 'ملف غير صالح.' });
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const loadLocal = async () => {
    setBusy(true);
    try {
      const arr = await archiveGetAll();
      if (!arr.length) setMsg({ ok: false, text: 'الأرشيف المحلي فارغ على هذا الجهاز.' });
      else load(arr, 'الأرشيف المحلي لهذا الجهاز');
    } catch {
      setMsg({ ok: false, text: 'تعذر قراءة الأرشيف المحلي.' });
    }
    setBusy(false);
  };

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return list.filter((i) => {
      const d = String(i.date || i.createdAt || '').slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (!t) return true;
      return String(i.invoiceNumber || '').toLowerCase().includes(t) || String(i.customerName || '').toLowerCase().includes(t);
    });
  }, [list, q, from, to]);

  const doRestore = (items: Invoice[]) => {
    const fresh = items.filter((i) => !have.has(String(i.id)));
    if (!fresh.length) { setMsg({ ok: false, text: 'كلها موجودة في البرنامج مسبقاً.' }); return; }
    if (!window.confirm(`استعادة ${fresh.length} فاتورة إلى البرنامج؟\nتُضاف سجلات الفواتير فقط، دون تغيير المخزون أو ديون الزبائن أو الشفتات.`)) return;
    const r = restoreInvoicesFromBackup(fresh);
    setMsg({ ok: true, text: `تمت استعادة ${r.added} فاتورة${r.skipped ? ` (تخطّي ${r.skipped})` : ''}.` });
    setPicked(new Set());
  };

  const toggle = (id: string) =>
    setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3" dir="rtl" onClick={onClose} data-testid="invoice-archive-modal">
      <div className="bg-white dark:bg-[#0b1728] w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-black text-slate-900 dark:text-white">🧾 تصفح / استعادة الفواتير من نسخة قديمة</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{source ? `المصدر: ${source} · ${list.length} فاتورة` : 'اختر ملف نسخة (.json أو .json.gz من تليجرام) أو الأرشيف المحلي.'}</div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-lg px-2 cursor-pointer">✕</button>
        </div>

        <div className="p-3 flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800">
          <input ref={fileRef} type="file" accept=".json,.gz,application/gzip" onChange={onFile} className="hidden" data-testid="archive-file" />
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50">📂 اختيار ملف نسخة</button>
          <button type="button" disabled={busy} onClick={loadLocal} className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50">🗄 الأرشيف المحلي</button>
          <div className="flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600 mr-auto">
            {([['browse', '👁 تصفح فقط'], ['restore', '♻️ استعادة']] as const).map(([m, l]) => (
              <button key={m} type="button" data-testid={`mode-${m}`} onClick={() => setMode(m)} className={`px-3 py-1.5 text-xs font-bold cursor-pointer ${mode === m ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'}`}>{l}</button>
            ))}
          </div>
        </div>

        {list.length > 0 && (
          <div className="p-3 flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث برقم القائمة أو اسم الزبون" className="flex-1 min-w-[180px] px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#060b13] text-slate-900 dark:text-white" />
            <label className="text-[11px] text-slate-500">من <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#060b13] text-slate-900 dark:text-white" /></label>
            <label className="text-[11px] text-slate-500">إلى <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#060b13] text-slate-900 dark:text-white" /></label>
            {mode === 'restore' && (
              <>
                <button type="button" data-testid="restore-selected" disabled={!picked.size} onClick={() => doRestore(list.filter((i) => picked.has(String(i.id))))} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer disabled:opacity-40">استعادة المحدد ({picked.size})</button>
                <button type="button" data-testid="restore-shown" onClick={() => doRestore(shown)} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold cursor-pointer">استعادة كل المعروض ({shown.length})</button>
              </>
            )}
          </div>
        )}

        {msg && <div className={`mx-3 mt-2 text-xs font-bold rounded-lg px-3 py-2 border ${msg.ok ? 'text-emerald-800 bg-emerald-50 border-emerald-300' : 'text-rose-800 bg-rose-50 border-rose-300'}`}>{msg.text}</div>}

        <div className="flex-1 overflow-y-auto p-3">
          {list.length === 0 ? (
            <div className="text-center text-xs text-slate-500 py-12">لم يُحمَّل شيء بعد.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-slate-500 dark:text-slate-400 text-[11px]">
                <tr className="text-right">
                  {mode === 'restore' && <th className="w-8 p-1.5" />}
                  <th className="p-1.5">رقم القائمة</th><th className="p-1.5">التاريخ</th><th className="p-1.5">الزبون</th><th className="p-1.5">المجموع</th><th className="p-1.5">الحالة</th><th className="p-1.5" />
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, 500).map((i) => {
                  const exists = have.has(String(i.id));
                  return (
                    <tr key={String(i.id)} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      {mode === 'restore' && (
                        <td className="p-1.5"><input type="checkbox" disabled={exists} checked={picked.has(String(i.id))} onChange={() => toggle(String(i.id))} /></td>
                      )}
                      <td className="p-1.5 font-mono font-bold text-slate-900 dark:text-white">{i.invoiceNumber}</td>
                      <td className="p-1.5 text-slate-600 dark:text-slate-300">{fmtDateTime(i.date || i.createdAt)}</td>
                      <td className="p-1.5 text-slate-800 dark:text-slate-200">{i.customerName || '—'}</td>
                      <td className="p-1.5 font-bold text-emerald-700 dark:text-emerald-400">{formatMoney(i.total)}</td>
                      <td className="p-1.5">{exists ? <span className="text-slate-400">موجودة</span> : <span className="text-amber-600 font-bold">غير موجودة</span>}</td>
                      <td className="p-1.5"><button type="button" onClick={() => setViewing(i)} className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-bold cursor-pointer">عرض</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {shown.length > 500 && <div className="text-center text-[11px] text-slate-500 pt-2">يُعرض أول 500 نتيجة، ضيّق البحث لرؤية الباقي.</div>}
        </div>
      </div>
      {viewing && <InvoicePrintModal invoice={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
};

export default InvoiceArchiveModal;
