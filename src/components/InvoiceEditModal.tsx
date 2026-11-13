import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, Search, Save, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Invoice, InvoiceItem, Product, SaleType } from '../types';
import { getPiecePrice } from '../utils/pricing';

interface Row {
  key: string;
  item: InvoiceItem;
  qty: string;
  price: string;
  disc: string;
}

const num = (s: string) => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
};
const toLocalInput = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const Editor: React.FC<{ invoice: Invoice; onClose: () => void }> = ({ invoice, onClose }) => {
  const { products, customers, settings, updateInvoice, formatMoney } = useApp();
  const reps = settings.salesReps || [];

  // المواد المرجعة سابقاً تُدمج: نعرض الصافي فقط (الكمية − المرجَع)
  const [rows, setRows] = useState<Row[]>(() =>
    invoice.items
      .map(it => ({ it, net: Math.max(0, (Number(it.quantity) || 0) - (it.returnedQuantity || 0)) }))
      .filter(x => x.net > 0)
      .map((x, i) => ({
        key: `r${i}`,
        item: { ...x.it, returnedQuantity: 0 },
        qty: String(x.net),
        price: String(x.it.unitPrice),
        // الخصم يُقسَّم بنسبة الكمية الصافية
        disc: String(Math.round(((x.it.discount || 0) * x.net) / Math.max(1, x.it.quantity))),
      }))
  );
  const [type, setType] = useState<SaleType>(invoice.type);
  const [customerId, setCustomerId] = useState(invoice.customerId || '');
  const [customerName, setCustomerName] = useState(invoice.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(invoice.customerPhone || '');
  const [date, setDate] = useState(toLocalInput(invoice.date));
  const [discount, setDiscount] = useState(String(invoice.discount || 0));
  const [paid, setPaid] = useState(String(invoice.paidAmount || 0));
  const [due, setDue] = useState(invoice.paymentDueDate || '');
  const [notes, setNotes] = useState(invoice.notes || '');
  const [repId, setRepId] = useState(invoice.salesRepId || '');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const subtotal = rows.reduce((s, r) => s + Math.max(0, num(r.price) * num(r.qty) - num(r.disc)), 0);
  const total = Math.max(0, subtotal - num(discount));
  const paidEff = type === 'direct' ? total : num(paid);
  const remaining = Math.max(0, total - paidEff);

  const hits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as Product[];
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)).slice(0, 8);
  }, [search, products]);

  const addProduct = (p: Product) => {
    const weighted = Boolean(p.isWeighted || p.unit === 'كغم' || p.unit === 'كيلو');
    const price = getPiecePrice(p, 'retail');
    setRows(prev => [
      ...prev,
      {
        key: `n${Date.now()}`,
        item: {
          productId: p.id,
          productName: p.name,
          code: p.code,
          unit: weighted ? 'كغم' : p.unit,
          priceType: 'retail',
          unitType: 'piece',
          piecesPerCarton: weighted ? 1 : (p.piecesPerCarton || 1),
          deductedPieces: 1,
          costPrice: p.costPrice,
          unitPrice: price,
          quantity: 1,
          isWeighted: weighted,
          total: price,
        },
        qty: '1',
        price: String(price),
        disc: '0',
      },
    ]);
    setSearch('');
  };

  const patch = (key: string, field: 'qty' | 'price' | 'disc', v: string) =>
    setRows(prev => prev.map(r => (r.key === key ? { ...r, [field]: v } : r)));

  const pickCustomer = (id: string) => {
    setCustomerId(id);
    const c = customers.find(x => x.id === id);
    if (c) {
      setCustomerName(c.name);
      setCustomerPhone(c.phone || '');
    }
  };

  const rep = reps.find(r => r.id === (invoice.salesRepId || ''));
  const settledWarn = !!(rep?.settledAt && new Date(invoice.date).getTime() <= new Date(rep.settledAt).getTime());

  const save = () => {
    setError(null);
    if (rows.length === 0) return setError('أضف مادة واحدة على الأقل.');
    if (rows.some(r => num(r.qty) <= 0)) return setError('كل المواد يجب أن تكون كميتها أكبر من صفر (احذف السطر إن لم يعد مطلوباً).');
    if (type === 'credit' && !customerId && remaining > 0 && !window.confirm('القائمة بالدين وبدون زبون مسجّل، فلن يُسجَّل الدين على أحد. متابعة؟')) return;
    const res = updateInvoice(invoice.id, {
      type,
      customerId: customerId || undefined,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      date: date ? new Date(date).toISOString() : undefined,
      discount: num(discount),
      paidAmount: paidEff,
      paymentDueDate: due,
      notes: notes.trim(),
      salesRepId: repId || undefined,
      items: rows.map(r => ({
        ...r.item,
        quantity: num(r.qty),
        unitPrice: num(r.price),
        discount: num(r.disc),
        isCustomPrice: r.item.isCustomPrice || num(r.price) !== r.item.unitPrice,
      })),
    });
    if (!res.success) return setError(res.error || 'تعذر حفظ التعديل.');
    onClose();
  };

  const inp = 'w-full px-2 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400';
  const lbl = 'block text-[10px] font-bold text-slate-600 mb-0.5';

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-center justify-center p-2" dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900">تعديل القائمة <span className="font-mono">{invoice.invoiceNumber}</span></h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto p-3 space-y-3 flex-1">
          <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 leading-5">
            عند الحفظ يُعاد حساب كل شيء تلقائياً: كميات المخزن، دين الزبون، مجاميع الشفت، وعمولة المندوب.
            {(invoice.returnedItems || []).length > 0 && ' المواد المرجعة سابقاً تظهر هنا بكمياتها الصافية فقط.'}
          </div>
          {settledWarn && (
            <div className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-2 flex items-start gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              هذه القائمة ضمن فترة صُفّيت أرباح مندوبها ودُفعت. التعديل يغيّر عمولتها المسجّلة لكن لا يغيّر المبلغ المدفوع سابقاً.
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <label className={lbl}>نوع البيع</label>
              <select value={type} onChange={e => setType(e.target.value as SaleType)} className={inp}>
                <option value="direct">نقدي</option>
                <option value="credit">بالدين / آجل</option>
              </select>
            </div>
            <div>
              <label className={lbl}>التاريخ والوقت</label>
              <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>الزبون المسجّل</label>
              <select value={customerId} onChange={e => (e.target.value ? pickCustomer(e.target.value) : setCustomerId(''))} className={inp}>
                <option value="">— بدون (نقدي / غير مسجّل) —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>اسم الزبون على القائمة</label>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>هاتف الزبون</label>
              <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className={inp} />
            </div>
            {reps.length > 0 && (
              <div>
                <label className={lbl}>المندوب</label>
                <select value={repId} onChange={e => setRepId(e.target.value)} className={inp}>
                  <option value="">— بدون مندوب —</option>
                  {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-black text-slate-800">المواد</div>
            {rows.map(r => {
              const line = Math.max(0, num(r.price) * num(r.qty) - num(r.disc));
              return (
                <div key={r.key} className="border border-slate-200 rounded-xl p-2 bg-slate-50/60">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="text-xs font-black text-slate-900 truncate">
                      {r.item.productName || r.item.name}
                      {r.item.isGift && <span className="mr-1 text-[10px] text-pink-700 bg-pink-50 border border-pink-200 rounded px-1">هدية</span>}
                      {r.item.unitType === 'carton' && <span className="mr-1 text-[10px] text-slate-500">({r.item.packLabel || 'كرتون'})</span>}
                    </div>
                    <button type="button" onClick={() => setRows(prev => prev.filter(x => x.key !== r.key))} className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer" title="حذف السطر">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 items-end">
                    <div><label className={lbl}>الكمية ({r.item.unit})</label><input type="number" min="0" step="any" value={r.qty} onChange={e => patch(r.key, 'qty', e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>السعر</label><input type="number" min="0" step="any" value={r.price} onChange={e => patch(r.key, 'price', e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>خصم السطر</label><input type="number" min="0" step="any" value={r.disc} onChange={e => patch(r.key, 'disc', e.target.value)} className={inp} /></div>
                    <div className="text-xs font-mono font-black text-slate-900 pb-1.5 text-center">{formatMoney(line)}</div>
                  </div>
                </div>
              );
            })}
            {rows.length === 0 && <div className="text-center text-xs text-slate-400 py-3">لا توجد مواد.</div>}

            <div className="relative">
              <div className="flex items-center gap-1.5 border border-slate-300 rounded-lg px-2 bg-white">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="أضف مادة: ابحث بالاسم أو الباركود" className="flex-1 py-1.5 text-xs bg-transparent focus:outline-none" />
              </div>
              {hits.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                  {hits.map(p => (
                    <button type="button" key={p.id} onClick={() => addProduct(p)} className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs hover:bg-indigo-50 cursor-pointer text-right">
                      <span className="font-bold text-slate-900 truncate">{p.name}</span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-500 font-mono shrink-0">{formatMoney(p.retailPrice)} <Plus className="w-3.5 h-3.5 text-indigo-600" /></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div><label className={lbl}>خصم على القائمة</label><input type="number" min="0" step="any" value={discount} onChange={e => setDiscount(e.target.value)} className={inp} /></div>
            {type === 'credit' && (
              <>
                <div><label className={lbl}>المدفوع</label><input type="number" min="0" step="any" value={paid} onChange={e => setPaid(e.target.value)} className={inp} /></div>
                <div><label className={lbl}>تاريخ الاستحقاق</label><input type="date" value={due} onChange={e => setDue(e.target.value)} className={inp} /></div>
              </>
            )}
            <div className="col-span-2 sm:col-span-4"><label className={lbl}>ملاحظات</label><input value={notes} onChange={e => setNotes(e.target.value)} className={inp} /></div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50 rounded-xl p-2 border border-slate-200"><div className="text-[10px] text-slate-500">الإجمالي الجديد</div><div className="text-sm font-black font-mono">{formatMoney(total)}</div><div className="text-[10px] text-slate-400">كان {formatMoney(invoice.total)}</div></div>
            <div className="bg-slate-50 rounded-xl p-2 border border-slate-200"><div className="text-[10px] text-slate-500">المدفوع</div><div className="text-sm font-black font-mono">{formatMoney(paidEff)}</div></div>
            <div className="bg-slate-50 rounded-xl p-2 border border-slate-200"><div className="text-[10px] text-slate-500">المتبقي (دين)</div><div className="text-sm font-black font-mono text-rose-700">{formatMoney(remaining)}</div></div>
          </div>

          {error && <div className="text-xs font-bold rounded-lg px-3 py-2 border text-rose-800 bg-rose-50 border-rose-300">{error}</div>}
        </div>

        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 cursor-pointer">إلغاء</button>
          <button type="button" onClick={save} className="px-5 py-2 text-xs font-black rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 cursor-pointer">
            <Save className="w-4 h-4" /> حفظ التعديل
          </button>
        </div>
      </div>
    </div>
  );
};

export const InvoiceEditModal: React.FC = () => {
  const { editingInvoiceId, closeInvoiceEditor, invoices } = useApp();
  const invoice = editingInvoiceId ? invoices.find(i => i.id === editingInvoiceId) : undefined;
  if (!invoice) return null;
  return <Editor key={invoice.id} invoice={invoice} onClose={closeInvoiceEditor} />;
};

export default InvoiceEditModal;
