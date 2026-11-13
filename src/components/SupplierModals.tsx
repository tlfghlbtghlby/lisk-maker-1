import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product, Supplier, SupplierRep, SupplierTxn, SupplierTxnItem } from '../types';
import { newId, todayIso, owedTo, nextReceiptNo } from '../utils/suppliers';

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:border-emerald-500';
const labelCls = 'block text-xs font-bold text-slate-700 mb-1';

function Shell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`bg-white text-slate-900 rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[94vh] overflow-y-auto`} dir="rtl">
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="font-extrabold text-sm">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------- إضافة/تعديل مورد ومندوبيه ----------------
export function SupplierFormModal({ supplier, onClose, onSave }: { supplier: Supplier | null; onClose: () => void; onSave: (s: Supplier) => void }) {
  const [company, setCompany] = useState(supplier?.company || '');
  const [name, setName] = useState(supplier?.name || '');
  const [phone, setPhone] = useState(supplier?.phone || '');
  const [address, setAddress] = useState(supplier?.address || '');
  const [notes, setNotes] = useState(supplier?.notes || '');
  const [opening, setOpening] = useState(supplier?.openingDebt ? String(supplier.openingDebt) : '');
  const [reps, setReps] = useState<SupplierRep[]>(supplier?.reps?.length ? supplier.reps : []);
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim()) return setError('اكتب اسم الشركة أو المورد.');
    const now = new Date().toISOString();
    onSave({
      id: supplier?.id || newId('sup'),
      company: company.trim(),
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      reps: reps.filter((r) => r.name.trim()).map((r) => ({ ...r, name: r.name.trim(), phone: r.phone?.trim() || undefined })),
      openingDebt: parseFloat(opening) > 0 ? parseFloat(opening) : undefined,
      createdAt: supplier?.createdAt || now,
      updatedAt: now,
    });
  };

  return (
    <Shell title={supplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'} onClose={onClose}>
      <form onSubmit={submit} className="p-4 space-y-3">
        <div><label className={labelCls}>اسم الشركة / المورد *</label><input autoFocus value={company} onChange={(e) => { setCompany(e.target.value); setError(''); }} className={inputCls} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelCls}>اسم المسؤول (اختياري)</label><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>رقم الهاتف</label><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputCls} /></div>
        </div>
        <div><label className={labelCls}>العنوان</label><input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>دين سابق علينا لهذا المورد (اختياري)</label><input type="number" min="0" value={opening} onChange={(e) => setOpening(e.target.value)} className={inputCls} placeholder="0" /></div>
        <div><label className={labelCls}>ملاحظات</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} /></div>

        <div className="rounded-xl border border-slate-200 p-3 bg-slate-50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-800">مندوبو الشركة</span>
            <button type="button" onClick={() => setReps([...reps, { id: newId('rep'), name: '', phone: '' }])} className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-600"><Plus className="w-3.5 h-3.5" />إضافة مندوب</button>
          </div>
          {reps.length === 0 && <p className="text-[11px] text-slate-500">لا يوجد مندوبون مسجلون. أضف اسم المندوب ليظهر عند الاستلام والتسديد.</p>}
          {reps.map((r, i) => (
            <div key={r.id} className="flex gap-2 items-center">
              <input value={r.name} onChange={(e) => setReps(reps.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="اسم المندوب" className={inputCls} />
              <input value={r.phone || ''} onChange={(e) => setReps(reps.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} placeholder="هاتفه" inputMode="tel" className={inputCls} />
              <button type="button" onClick={() => setReps(reps.filter((_, j) => j !== i))} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg shrink-0" title="حذف المندوب"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-500">حفظ</button>
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700">إلغاء</button>
        </div>
      </form>
    </Shell>
  );
}

// ---------------- تسديد للمورد ----------------
export function SupplierPaymentModal({ supplier, onClose, onSave }: { supplier: Supplier; onClose: () => void; onSave: (t: SupplierTxn) => void }) {
  const { settings, formatMoney } = useApp() as any;
  const txns: SupplierTxn[] = settings.supplierTxns || [];
  const owed = owedTo(supplier, txns);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [rep, setRep] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const a = parseFloat(amount);
    if (!(a > 0)) return setError('أدخل مبلغاً أكبر من صفر.');
    if (owed > 0 && a > owed && !window.confirm(`المبلغ أكبر من الدين الحالي (${formatMoney(owed)}). متابعة وتسجيل الفرق كرصيد لنا عند المورد؟`)) return;
    onSave({
      id: newId('stx'), supplierId: supplier.id, type: 'payment', date, total: a,
      repName: rep.trim() || undefined, notes: notes.trim() || undefined,
      receiptNo: nextReceiptNo(txns), createdAt: new Date().toISOString(),
    });
  };

  return (
    <Shell title={`تسديد للمورد: ${supplier.company}`} onClose={onClose}>
      <form onSubmit={submit} className="p-4 space-y-3">
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm font-bold text-amber-900 flex justify-between"><span>الدين الحالي علينا</span><span>{formatMoney(owed)}</span></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelCls}>المبلغ المسدَّد</label><input autoFocus type="number" min="0" value={amount} onChange={(e) => { setAmount(e.target.value); setError(''); }} className={`${inputCls} font-mono font-bold`} /></div>
          <div><label className={labelCls}>التاريخ</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></div>
        </div>
        <div>
          <label className={labelCls}>المندوب المستلم</label>
          <input list="sup-reps-list" value={rep} onChange={(e) => setRep(e.target.value)} placeholder="اختر أو اكتب اسم المندوب" className={inputCls} />
          <datalist id="sup-reps-list">{supplier.reps.map((r) => <option key={r.id} value={r.name} />)}</datalist>
        </div>
        <div><label className={labelCls}>ملاحظات</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></div>
        {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-500">تسجيل التسديد</button>
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700">إلغاء</button>
        </div>
      </form>
    </Shell>
  );
}

// ---------------- استلام بضاعة ----------------
interface Line {
  key: string;
  productId?: string;
  name: string;
  unit: 'piece' | 'dozen' | 'carton';
  qty: string;
  cost: string;
  prod: string;
  exp: string;
}

export function ReceiveGoodsModal({ supplier, suppliers, onClose, onSave }: {
  supplier: Supplier | null;
  suppliers: Supplier[];
  onClose: () => void;
  onSave: (supplierId: string, txn: SupplierTxn, stock: { id: string; delta: number; note: string; productionDate?: string; expiryDate?: string; costPrice?: number }[]) => void;
}) {
  const { products, settings, formatMoney } = useApp() as any;
  const [supId, setSupId] = useState(supplier?.id || '');
  const sup = suppliers.find((s) => s.id === supId) || null;
  const [rep, setRep] = useState('');
  const [date, setDate] = useState(todayIso());
  const [invoiceNo, setInvoiceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [paid, setPaid] = useState('');
  const [updateCost, setUpdateCost] = useState(true);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const showDates = settings.enableProductExpiry === true;

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [] as Product[];
    return (products as Product[]).filter((p) => p.name.toLowerCase().includes(t) || String(p.code || '').toLowerCase().includes(t)).slice(0, 8);
  }, [q, products]);

  const multOf = (l: Line) => {
    const p = l.productId ? (products as Product[]).find((x) => x.id === l.productId) : undefined;
    if (!p) return 1;
    return l.unit === 'carton' ? Math.max(1, p.piecesPerCarton || 1) : l.unit === 'dozen' ? Math.max(1, p.piecesPerDozen || 1) : 1;
  };
  const lineTotal = (l: Line) => (parseFloat(l.qty) || 0) * (parseFloat(l.cost) || 0);
  const total = lines.reduce((s, l) => s + lineTotal(l), 0);
  const paidN = Math.max(0, parseFloat(paid) || 0);

  const addProduct = (p: Product) => {
    setLines((prev) => [...prev, { key: newId('ln'), productId: p.id, name: p.name, unit: 'piece', qty: '', cost: p.costPrice ? String(p.costPrice) : '', prod: '', exp: '' }]);
    setQ('');
  };
  const addFree = () => {
    const name = q.trim();
    if (!name) return;
    setLines((prev) => [...prev, { key: newId('ln'), name, unit: 'piece', qty: '', cost: '', prod: '', exp: '' }]);
    setQ('');
  };
  const patch = (key: string, u: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...u } : l)));
  const changeUnit = (l: Line, unit: Line['unit']) => {
    const p = l.productId ? (products as Product[]).find((x) => x.id === l.productId) : undefined;
    const old = multOf(l);
    const nm = unit === 'carton' ? Math.max(1, p?.piecesPerCarton || 1) : unit === 'dozen' ? Math.max(1, p?.piecesPerDozen || 1) : 1;
    const c = parseFloat(l.cost);
    patch(l.key, { unit, ...(c > 0 ? { cost: String(Math.round((c / old) * nm * 1000) / 1000) } : {}) });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sup) return setError('اختر المورد.');
    const valid = lines.filter((l) => (parseFloat(l.qty) || 0) > 0);
    if (valid.length === 0) return setError('أضف مادة واحدة على الأقل بكمية أكبر من صفر.');
    if (valid.some((l) => !(parseFloat(l.cost) >= 0) || l.cost === '')) return setError('أدخل سعر الشراء لكل مادة (يمكن أن يكون صفراً).');
    if (valid.some((l) => !l.productId && !l.name.trim())) return setError('اسم المادة مطلوب.');
    const bad = valid.find((l) => !l.productId ? false : ((parseFloat(l.qty) * multOf(l)) !== Math.floor(parseFloat(l.qty) * multOf(l)) && !(products as Product[]).find((x) => x.id === l.productId)?.isWeighted));
    if (bad) return setError(`الكمية للمادة «${bad.name}» يجب أن تكون عدداً صحيحاً.`);
    if (paidN > total) return setError('المدفوع أكبر من إجمالي القائمة.');
    const unitLabel = (l: Line) => (l.unit === 'carton' ? 'كرتون' : l.unit === 'dozen' ? 'درزن' : 'قطعة');
    const items: SupplierTxnItem[] = valid.map((l) => {
      const m = multOf(l);
      const qty = parseFloat(l.qty);
      const unitCost = parseFloat(l.cost) || 0;
      return {
        ...(l.productId ? { productId: l.productId } : {}),
        name: l.name,
        pieces: Math.round(qty * m * 1000) / 1000,
        qty,
        unitLabel: unitLabel(l),
        unitCost,
        total: Math.round(qty * unitCost),
        ...(l.exp ? { expiryDate: l.exp } : {}),
        ...(l.prod ? { productionDate: l.prod } : {}),
      };
    });
    const note = `استلام من ${sup.company}${invoiceNo.trim() ? ` · قائمة ${invoiceNo.trim()}` : ''}${rep.trim() ? ` · مندوب: ${rep.trim()}` : ''}`;
    const stock = valid.filter((l) => l.productId).map((l) => {
      const m = multOf(l);
      return {
        id: l.productId as string,
        delta: Math.round(parseFloat(l.qty) * m * 1000) / 1000,
        note,
        productionDate: l.prod || undefined,
        expiryDate: l.exp || undefined,
        costPrice: updateCost && parseFloat(l.cost) > 0 ? Math.round((parseFloat(l.cost) / m) * 1000) / 1000 : undefined,
      };
    });
    const txn: SupplierTxn = {
      id: newId('stx'), supplierId: sup.id, type: 'purchase', date,
      total: Math.round(items.reduce((s, i) => s + i.total, 0)), paid: paidN || undefined,
      repName: rep.trim() || undefined, invoiceNo: invoiceNo.trim() || undefined, notes: notes.trim() || undefined,
      items, createdAt: new Date().toISOString(),
    };
    onSave(sup.id, txn, stock);
  };

  return (
    <Shell title="استلام بضاعة من مورد" onClose={onClose} wide>
      <form onSubmit={submit} className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>المورد *</label>
            <select value={supId} onChange={(e) => { setSupId(e.target.value); setRep(''); setError(''); }} className={inputCls} disabled={!!supplier}>
              <option value="">— اختر المورد —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.company}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>المندوب</label>
            <input list="recv-reps" value={rep} onChange={(e) => setRep(e.target.value)} placeholder="اسم المندوب" className={inputCls} />
            <datalist id="recv-reps">{(sup?.reps || []).map((r) => <option key={r.id} value={r.name} />)}</datalist>
          </div>
          <div><label className={labelCls}>تاريخ الاستلام</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div><label className={labelCls}>رقم قائمة المورد (اختياري)</label><input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>ملاحظات</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3 bg-slate-50 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (results.length === 1) addProduct(results[0]); } }} placeholder="ابحث عن مادة بالاسم أو الباركود لإضافتها..." className={`${inputCls} pr-9`} />
            {q.trim() && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-56 overflow-auto">
                {results.map((p) => (
                  <button key={p.id} type="button" onClick={() => addProduct(p)} className="w-full text-right px-3 py-2 text-sm hover:bg-slate-100 border-b border-slate-100">
                    {p.name}{p.code ? <span className="text-slate-400 text-xs mr-2 font-mono">{p.code}</span> : null}
                  </button>
                ))}
                <button type="button" onClick={addFree} className="w-full text-right px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50">＋ إضافة «{q.trim()}» كسطر غير مسجل في المخزون (لا يزيد الرصيد)</button>
              </div>
            )}
          </div>

          {lines.length === 0 && <p className="text-[11px] text-slate-500">ابحث عن المواد المستلمة وأضفها، وحدد الكمية وسعر الشراء لكل منها. ستُضاف الكميات إلى المخزون تلقائياً.</p>}

          {lines.map((l) => {
            const p = l.productId ? (products as Product[]).find((x) => x.id === l.productId) : undefined;
            const hasCarton = (p?.piecesPerCarton || 1) > 1;
            const hasDozen = (p?.piecesPerDozen || 0) > 1;
            return (
              <div key={l.key} className="rounded-lg bg-white border border-slate-200 p-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold truncate">{l.name}{!l.productId && <span className="text-[10px] text-indigo-600 mr-1">(غير مسجلة)</span>}</span>
                  <button type="button" onClick={() => setLines(lines.filter((x) => x.key !== l.key))} className="p-1 text-rose-600 hover:bg-rose-50 rounded shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">الكمية</label>
                    <input type="number" min="0" step={p?.isWeighted ? '0.001' : '1'} value={l.qty} onChange={(e) => patch(l.key, { qty: e.target.value })} className={`${inputCls} text-center font-mono font-bold`} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">الوحدة</label>
                    <select value={l.unit} onChange={(e) => changeUnit(l, e.target.value as Line['unit'])} className={inputCls} disabled={!p || (!hasCarton && !hasDozen)}>
                      <option value="piece">{p?.isWeighted ? 'كغم' : 'قطعة'}</option>
                      {hasDozen && <option value="dozen">درزن ({p?.piecesPerDozen})</option>}
                      {hasCarton && <option value="carton">كرتون ({p?.piecesPerCarton})</option>}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">سعر الشراء للوحدة</label>
                    <input type="number" min="0" value={l.cost} onChange={(e) => patch(l.key, { cost: e.target.value })} className={`${inputCls} text-center font-mono`} />
                  </div>
                  <div className="text-xs font-extrabold text-slate-800 text-center pb-2">{formatMoney(lineTotal(l))}</div>
                </div>
                {showDates && l.productId && (
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-[11px] font-bold text-slate-600 mb-0.5">تاريخ الإنتاج</label><input type="date" value={l.prod} onChange={(e) => patch(l.key, { prod: e.target.value })} className={inputCls} /></div>
                    <div><label className="block text-[11px] font-bold text-slate-600 mb-0.5">تاريخ الانتهاء</label><input type="date" value={l.exp} onChange={(e) => patch(l.key, { exp: e.target.value })} className={inputCls} /></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
          <input type="checkbox" checked={updateCost} onChange={(e) => setUpdateCost(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
          تحديث سعر تكلفة المواد في المخزون بسعر هذا الاستلام
        </label>

        <div className="grid grid-cols-3 gap-2 items-end rounded-xl bg-emerald-50 border border-emerald-200 p-3">
          <div><div className="text-[11px] font-bold text-emerald-900">إجمالي القائمة</div><div className="text-sm font-black text-emerald-900">{formatMoney(total)}</div></div>
          <div><label className="block text-[11px] font-bold text-emerald-900 mb-0.5">المدفوع الآن</label><input type="number" min="0" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0" className={`${inputCls} text-center font-mono`} /></div>
          <div><div className="text-[11px] font-bold text-amber-900">يُسجَّل ديناً علينا</div><div className="text-sm font-black text-amber-800">{formatMoney(Math.max(0, total - paidN))}</div></div>
        </div>

        {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-500">حفظ الاستلام وإضافته للمخزون</button>
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700">إلغاء</button>
        </div>
      </form>
    </Shell>
  );
}
