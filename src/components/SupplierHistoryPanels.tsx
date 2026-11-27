import React, { useMemo, useState } from 'react';
import { Eye, Pencil, Undo2, Search } from 'lucide-react';
import type { Product, Supplier, SupplierTxn } from '../types';
import { fmtDate } from '../utils/suppliers';

const th = 'px-3 py-2 text-center';

/** قوائم الاستلام الخاصة بمورد/مندوب: معاينة وتعديل واسترجاع كامل */
export function SupplierReceiptsTab({ list, formatMoney, onPreview, onEdit, onReturn }: {
  list: SupplierTxn[];
  formatMoney: (n: number) => string;
  onPreview: (t: SupplierTxn) => void;
  onEdit: (t: SupplierTxn) => void;
  onReturn: (t: SupplierTxn) => void;
}) {
  const rows = list.filter((t) => t.type === 'purchase' || t.type === 'return').sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  const sum = rows.filter((t) => t.type === 'purchase' && !t.returned);
  const total = sum.reduce((a, t) => a + (Number(t.total) || 0), 0);
  const paid = sum.reduce((a, t) => a + Math.min(Number(t.total) || 0, Number(t.paid) || 0), 0);
  return (
    <div className="rounded-xl border border-slate-200 overflow-x-auto" data-testid="sup-receipts">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-slate-600"><tr>
          <th className="text-right px-3 py-2">التاريخ</th><th className="text-right px-3 py-2">رقم القائمة</th><th className="text-right px-3 py-2">الحركة</th>
          <th className="text-right px-3 py-2">المندوب</th><th className={th}>المواد</th><th className={th}>الإجمالي</th><th className={th}>المدفوع</th><th className={th}>المتبقي</th><th className={th}>إجراءات</th>
        </tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-500">لا توجد قوائم في هذه الفترة.</td></tr>}
          {rows.map((t) => {
            const tot = Number(t.total) || 0;
            const pd = t.type === 'purchase' ? Math.min(tot, Number(t.paid) || 0) : 0;
            const isRet = t.type === 'return';
            return (
              <tr key={t.id} className={`border-t border-slate-100 ${isRet || t.returned ? 'bg-rose-50/40' : ''}`} data-testid="sup-receipt-row">
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(t.date)}</td>
                <td className="px-3 py-2 font-mono">{t.invoiceNo || '—'}</td>
                <td className="px-3 py-2 font-bold">{isRet ? <span className="text-rose-700">مرتجع للمورد</span> : t.returned ? <span className="text-rose-700">استلام (مُسترجع)</span> : <span className="text-emerald-800">استلام بضاعة</span>}</td>
                <td className="px-3 py-2">{t.repName || '—'}</td>
                <td className="px-3 py-2 text-center">{t.items?.length || 0}</td>
                <td className="px-3 py-2 text-center font-bold">{isRet ? `- ${formatMoney(tot)}` : formatMoney(tot)}</td>
                <td className="px-3 py-2 text-center">{isRet ? '—' : formatMoney(pd)}</td>
                <td className={`px-3 py-2 text-center font-bold ${!isRet && tot - pd > 0 && !t.returned ? 'text-rose-600' : 'text-slate-400'}`}>{isRet || t.returned ? '—' : formatMoney(tot - pd)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 justify-center flex-wrap">
                    <button type="button" onClick={() => onPreview(t)} data-testid="rcpt-preview" className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 font-bold"><Eye className="w-3 h-3" />معاينة</button>
                    {!isRet && <button type="button" onClick={() => onEdit(t)} data-testid="rcpt-edit" className="flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold"><Pencil className="w-3 h-3" />تعديل</button>}
                    {!isRet && <button type="button" disabled={!!t.returned} onClick={() => onReturn(t)} data-testid="rcpt-return" className="flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold disabled:opacity-40"><Undo2 className="w-3 h-3" />استرجاع</button>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        {rows.length > 0 && (
          <tfoot className="bg-slate-50 font-extrabold border-t border-slate-200"><tr>
            <td className="px-3 py-2" colSpan={5}>المجموع (دون المسترجَع)</td>
            <td className="px-3 py-2 text-center">{formatMoney(total)}</td>
            <td className="px-3 py-2 text-center">{formatMoney(paid)}</td>
            <td className="px-3 py-2 text-center text-rose-600">{formatMoney(total - paid)}</td><td></td>
          </tr></tfoot>
        )}
      </table>
    </div>
  );
}

/** بحث مادة: كم اشتريناها من هذا المورد/المندوب، وكم مرة، ومتى (مع ترتيبها) */
export function SupplierProductSearch({ list, products, formatMoney }: { list: SupplierTxn[]; products: Product[]; formatMoney: (n: number) => string }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [asc, setAsc] = useState(false);

  const groups = useMemo(() => {
    const m = new Map<string, { key: string; name: string; productId?: string }>();
    for (const t of list) {
      if (t.type !== 'purchase' || t.returned) continue;
      for (const it of t.items || []) {
        const key = it.productId || `n:${it.name.trim().toLowerCase()}`;
        if (!m.has(key)) m.set(key, { key, name: it.name, productId: it.productId });
      }
    }
    return [...m.values()];
  }, [list]);

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = words.length ? groups.filter((g) => words.every((w) => g.name.toLowerCase().includes(w))).slice(0, 12) : [];
  const chosen = groups.find((g) => g.key === sel) || null;

  const detail = useMemo(() => {
    if (!chosen) return null;
    const rows: { t: SupplierTxn; qty: number; pieces: number; unitCost: number; total: number; label: string }[] = [];
    for (const t of list) {
      if (t.type !== 'purchase' || t.returned) continue;
      for (const it of t.items || []) {
        const key = it.productId || `n:${it.name.trim().toLowerCase()}`;
        if (key !== chosen.key) continue;
        const per = it.pieces > 0 ? it.total / it.pieces : it.unitCost;
        const label = typeof it.cartons === 'number' && it.cartons > 0 ? `${it.cartons} كرتون${it.loose ? ` + ${it.loose} قطعة` : ''}` : `${it.qty} ${it.unitLabel}`;
        rows.push({ t, qty: it.qty, pieces: it.pieces, unitCost: Math.round(per * 100) / 100, total: it.total, label });
      }
    }
    rows.sort((a, b) => (a.t.date + a.t.createdAt).localeCompare(b.t.date + b.t.createdAt));
    return rows;
  }, [chosen, list]);

  const prod = chosen?.productId ? products.find((p) => p.id === chosen.productId) : undefined;
  const totalPieces = (detail || []).reduce((a, r) => a + r.pieces, 0);
  const totalCost = (detail || []).reduce((a, r) => a + r.total, 0);
  const cap = Math.max(1, prod?.piecesPerCarton || 1);
  const shown = detail ? (asc ? detail : [...detail].reverse()) : [];

  return (
    <div className="space-y-3" data-testid="sup-product-search">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setSel(null); }} placeholder="ابحث عن مادة اشتريتها من هذا المورد/المندوب..." data-testid="sup-prod-q"
          className="w-full border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:border-indigo-500" />
      </div>
      {!chosen && q.trim() && (
        <div className="flex flex-wrap gap-2">
          {matches.length === 0 && <span className="text-xs text-slate-500">لا توجد مادة بهذا الاسم ضمن الفترة والمندوب المحددين.</span>}
          {matches.map((g) => <button key={g.key} type="button" onClick={() => setSel(g.key)} data-testid="sup-prod-pick" className="px-3 py-1.5 rounded-lg bg-white border border-indigo-300 text-xs font-bold text-indigo-800 hover:bg-indigo-50">{g.name}</button>)}
        </div>
      )}
      {!chosen && !q.trim() && <p className="text-[11px] text-slate-500">اكتب اسم المادة فيظهر إجمالي ما اشتريته منها وعدد المرات وتاريخ كل مرة.</p>}
      {chosen && detail && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-indigo-50 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-extrabold text-sm">{chosen.name}</div>
              <div className="text-[11px] text-slate-600" data-testid="sup-prod-summary">
                اشتريتها <strong>{detail.length}</strong> مرة · الإجمالي <strong>{totalPieces}</strong> قطعة{cap > 1 && !prod?.isWeighted ? ` (= ${Math.floor(totalPieces / cap)} كرتون و ${Math.round((totalPieces % cap) * 1000) / 1000} قطعة، السعة ${cap})` : ''} · بقيمة <strong>{formatMoney(totalCost)}</strong>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAsc(!asc)} className="px-2.5 py-1 rounded-md bg-white border border-slate-300 text-[11px] font-bold">{asc ? 'الأقدم أولاً ↑' : 'الأحدث أولاً ↓'}</button>
              <button type="button" onClick={() => setSel(null)} className="px-2.5 py-1 rounded-md bg-white border border-slate-300 text-[11px] font-bold">مادة أخرى</button>
            </div>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600"><tr>
              <th className={th}>الترتيب</th><th className="text-right px-3 py-2">التاريخ</th><th className="text-right px-3 py-2">رقم القائمة</th><th className="text-right px-3 py-2">المندوب</th>
              <th className={th}>الكمية</th><th className={th}>سعر القطعة</th><th className={th}>المجموع</th>
            </tr></thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.t.id + i} className="border-t border-slate-100" data-testid="sup-prod-row">
                  <td className="px-3 py-2 text-center font-mono text-slate-500">{asc ? i + 1 : detail.length - i}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.t.date)}</td>
                  <td className="px-3 py-2 font-mono">{r.t.invoiceNo || '—'}</td>
                  <td className="px-3 py-2">{r.t.repName || '—'}</td>
                  <td className="px-3 py-2 text-center">{r.label}<div className="text-[10px] text-slate-400">{r.pieces} قطعة</div></td>
                  <td className="px-3 py-2 text-center font-mono">{r.unitCost}</td>
                  <td className="px-3 py-2 text-center font-bold">{formatMoney(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** تعديل بيانات قائمة الاستلام (التاريخ، المندوب، الرقم، الملاحظات، المدفوع) — لا يغيّر المخزون */
export function EditReceiptModal({ t, supplier, onClose, onSave }: { t: SupplierTxn; supplier?: Supplier; onClose: () => void; onSave: (n: SupplierTxn) => void }) {
  const [date, setDate] = useState(t.date);
  const [rep, setRep] = useState(t.repName || '');
  const [no, setNo] = useState(t.invoiceNo || '');
  const [notes, setNotes] = useState(t.notes || '');
  const [paid, setPaid] = useState(String(t.paid || ''));
  const [err, setErr] = useState('');
  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:border-indigo-500';
  const lab = 'block text-xs font-bold text-slate-700 mb-1';
  const total = Number(t.total) || 0;
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const p = Math.max(0, parseFloat(paid) || 0);
    if (p > total) return setErr('المدفوع أكبر من إجمالي القائمة.');
    if (!date) return setErr('التاريخ مطلوب.');
    onSave({ ...t, date, repName: rep.trim() || undefined, invoiceNo: no.trim() || undefined, notes: notes.trim() || undefined, paid: p || undefined });
  };
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={save} dir="rtl" className="bg-white text-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-4 space-y-3" data-testid="edit-receipt">
        <h3 className="font-extrabold text-sm">تعديل قائمة الاستلام{supplier ? ` — ${supplier.company}` : ''}</h3>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={lab}>التاريخ</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
          <div><label className={lab}>رقم القائمة</label><input value={no} onChange={(e) => setNo(e.target.value)} className={inp} /></div>
        </div>
        <div>
          <label className={lab}>المندوب</label>
          <input list="edit-reps" value={rep} onChange={(e) => setRep(e.target.value)} className={inp} />
          <datalist id="edit-reps">{(supplier?.reps || []).map((r) => <option key={r.id} value={r.name} />)}</datalist>
        </div>
        <div><label className={lab}>المدفوع وقت الاستلام (الإجمالي {total.toLocaleString('en-US')})</label><input type="number" min="0" value={paid} onChange={(e) => setPaid(e.target.value)} data-testid="edit-paid" className={inp} /></div>
        <div><label className={lab}>ملاحظات</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inp} /></div>
        <p className="text-[11px] text-slate-500">التعديل هنا للبيانات والمبلغ المدفوع فقط، ولا يغيّر الكميات في المخزون. لتصحيح الكميات استعمل «استرجاع» ثم أعد الاستلام.</p>
        {err && <p className="text-xs font-bold text-rose-600">{err}</p>}
        <div className="flex gap-2">
          <button type="submit" className="flex-1 py-2 rounded-xl text-sm font-extrabold text-white bg-indigo-600 hover:bg-indigo-500">حفظ التعديل</button>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 text-slate-700">إلغاء</button>
        </div>
      </form>
    </div>
  );
}
