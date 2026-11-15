import React, { useMemo, useState } from 'react';
import { Wallet, Plus, Trash2, Pencil, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { ExpenseEntry, Invoice } from '../types';
import { inPeriod, PeriodFilter, EXPENSE_CATEGORIES } from '../utils/expenses';
import { newId, todayIso, fmtDate } from '../utils/suppliers';

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:border-rose-500';
const card = 'bg-white border border-slate-200 rounded-2xl shadow-xs';

/** المصروفات: تسجيل كل مصروف (مستلزمات، رواتب، إيجار...) مع خيار خصمها من الأرباح */
export function ExpensesView() {
  const { settings, updateSettings, formatMoney, invoices, activeShift } = useApp() as any;
  const list: ExpenseEntry[] = settings.expenses || [];
  const affect = settings.expensesAffectProfit !== false;

  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [catFilter, setCatFilter] = useState('');
  const [q, setQ] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [fromDrawer, setFromDrawer] = useState(true);

  const categories = useMemo(() => Array.from(new Set([...EXPENSE_CATEGORIES, ...list.map((x) => x.category)])), [list]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return list
      .filter((x) => inPeriod(x.date, period) && (!catFilter || x.category === catFilter) && (!t || `${x.category} ${x.description || ''}`.toLowerCase().includes(t)))
      .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  }, [list, period, catFilter, q]);

  const total = rows.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const byCat = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((x) => { m[x.category] = (m[x.category] || 0) + (Number(x.amount) || 0); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const periodProfit = useMemo(() => {
    return ((invoices || []) as Invoice[]).filter((i) => inPeriod(localIso(i.date), period)).reduce((s, i) => s + (Number(i.netProfit) || 0), 0);
  }, [invoices, period]);

  const reset = () => { setEditId(null); setDate(todayIso()); setDesc(''); setAmount(''); setError(''); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!category.trim()) return setError('اختر أو اكتب تصنيف المصروف.');
    if (!(amt > 0)) return setError('أدخل مبلغاً أكبر من صفر.');
    if (!date) return setError('اختر التاريخ.');
    if (editId) {
      updateSettings({ expenses: list.map((x) => (x.id === editId ? { ...x, date, category: category.trim(), description: desc.trim() || undefined, amount: amt, ...(x.shiftId ? { fromCash: fromDrawer } : {}) } : x)) });
    } else {
      const entry: ExpenseEntry = { id: newId('exp'), date, category: category.trim(), description: desc.trim() || undefined, amount: amt, createdAt: new Date().toISOString(), ...(activeShift ? { shiftId: activeShift.id, shiftNumber: activeShift.shiftNumber, fromCash: fromDrawer } : {}) };
      updateSettings({ expenses: [...list, entry] });
    }
    reset();
  };

  const startEdit = (x: ExpenseEntry) => { setEditId(x.id); setDate(x.date); setCategory(x.category); setDesc(x.description || ''); setAmount(String(x.amount)); setFromDrawer(x.fromCash !== false); setError(''); window.scrollTo?.({ top: 0, behavior: 'smooth' }); };
  const remove = (x: ExpenseEntry) => { if (window.confirm(`حذف مصروف «${x.category}» بمبلغ ${formatMoney(x.amount)}؟`)) updateSettings({ expenses: list.filter((y) => y.id !== x.id) }); };

  const periods: { id: PeriodFilter; label: string }[] = [
    { id: 'today', label: 'اليوم' }, { id: 'week', label: 'أسبوع' }, { id: 'month', label: 'الشهر' }, { id: 'year', label: 'السنة' }, { id: 'all', label: 'الكل' },
  ];

  return (
    <div className="space-y-4 text-slate-900" dir="rtl">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center"><Wallet className="w-5 h-5" /></div>
        <div>
          <h2 className="text-base font-extrabold">المصروفات</h2>
          <p className="text-[11px] text-slate-500">سجّل مصاريف المحل: مستلزمات، رواتب، إيجار وغيرها</p>
        </div>
      </div>

      {/* خيار احتساب المصروفات من الأرباح */}
      <div className={`${card} p-3 flex items-center justify-between gap-3 ${affect ? 'border-emerald-300 bg-emerald-50/50' : ''}`}>
        <div className="min-w-0">
          <div className="text-sm font-extrabold">خصم المصروفات من الأرباح</div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            {affect
              ? 'مفعّل: تُخصم المصروفات من صافي الأرباح في «التقارير»، فيظهر «صافي الربح بعد المصروفات».'
              : 'متوقف: المصروفات تُسجَّل للمعرفة فقط ولا تؤثر على الأرباح في التقارير.'}
          </p>
        </div>
        <button type="button" role="switch" aria-checked={affect} onClick={() => updateSettings({ expensesAffectProfit: !affect })} className={`relative shrink-0 w-12 h-7 rounded-full transition ${affect ? 'bg-emerald-600' : 'bg-slate-300'}`}>
          <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${affect ? 'right-0.5' : 'right-[22px]'}`} />
        </button>
      </div>

      <form onSubmit={submit} className={`${card} p-3 space-y-2`}>
        <div className="text-xs font-extrabold text-slate-700">{editId ? 'تعديل المصروف' : 'تسجيل مصروف جديد'}</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div><label className="block text-[11px] font-bold text-slate-600 mb-0.5">التاريخ</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-0.5">التصنيف</label>
            <input list="exp-cats" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} />
            <datalist id="exp-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="col-span-2 md:col-span-1"><label className="block text-[11px] font-bold text-slate-600 mb-0.5">الوصف (اختياري)</label><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="مثال: أكياس، راتب أحمد" className={inputCls} /></div>
          <div><label className="block text-[11px] font-bold text-slate-600 mb-0.5">المبلغ</label><input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls} font-mono text-center`} /></div>
          <div className="flex items-end gap-2">
            <button type="submit" className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-extrabold"><Plus className="w-4 h-4" />{editId ? 'حفظ' : 'إضافة'}</button>
            {editId && <button type="button" onClick={reset} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold">إلغاء</button>}
          </div>
        </div>
        {(activeShift || (editId && list.find((x) => x.id === editId)?.shiftId)) && (
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={fromDrawer} onChange={(e) => setFromDrawer(e.target.checked)} className="w-4 h-4 accent-rose-600" />
            خرج من صندوق الشفت (يُخصم من النقد المتوقع ويظهر في معلومات الشفت{activeShift ? ` #${activeShift.shiftNumber}` : ''})
          </label>
        )}
        {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-slate-300 overflow-hidden text-xs font-bold">
          {periods.map((p) => <button key={p.id} onClick={() => setPeriod(p.id)} className={`px-3 py-2 ${period === p.id ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>{p.label}</button>)}
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold bg-white">
          <option value="">كل التصنيفات</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث..." className="w-full border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-sm bg-white" />
        </div>
      </div>

      <div className={`grid grid-cols-1 ${affect ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
        <div className={`${card} p-3`}><div className="text-[11px] font-bold text-slate-500">إجمالي المصروفات</div><div className="text-lg font-black text-rose-600">{formatMoney(total)}</div><div className="text-[10px] text-slate-400">{rows.length} مصروف</div></div>
        {affect && <div className={`${card} p-3`}><div className="text-[11px] font-bold text-slate-500">أرباح المبيعات في الفترة</div><div className="text-lg font-black text-emerald-700">{formatMoney(periodProfit)}</div></div>}
        {affect && <div className={`${card} p-3`}><div className="text-[11px] font-bold text-slate-500">الصافي بعد المصروفات</div><div className={`text-lg font-black ${periodProfit - total >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatMoney(periodProfit - total)}</div></div>}
        {!affect && <div className={`${card} p-3`}><div className="text-[11px] font-bold text-slate-500">ملاحظة</div><div className="text-[11px] text-slate-600 mt-1">المصروفات لا تؤثر على الأرباح حالياً.</div></div>}
      </div>

      {byCat.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {byCat.map(([c, v]) => <span key={c} className="text-[11px] font-bold bg-slate-100 rounded-full px-3 py-1">{c}: <span className="text-rose-700">{formatMoney(v)}</span></span>)}
        </div>
      )}

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600"><tr>
            <th className="text-right px-3 py-2">التاريخ</th><th className="text-right px-3 py-2">التصنيف</th><th className="text-right px-3 py-2">الوصف</th><th className="px-3 py-2">المبلغ</th><th className="px-3 py-2 w-20"></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">لا توجد مصروفات في هذه الفترة.</td></tr>}
            {rows.map((x) => (
              <tr key={x.id} className="border-t border-slate-100">
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(x.date)}</td>
                <td className="px-3 py-2 font-bold">{x.category}{x.shiftId && x.fromCash !== false && <span className="mr-1.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 rounded px-1.5 py-0.5">شفت #{x.shiftNumber ?? ''}</span>}</td>
                <td className="px-3 py-2 text-slate-600">{x.description || '—'}</td>
                <td className="px-3 py-2 text-center font-black text-rose-700">{formatMoney(x.amount)}</td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  <button onClick={() => startEdit(x)} className="p-1 text-slate-600 hover:bg-slate-100 rounded" title="تعديل"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => remove(x)} className="p-1 text-rose-600 hover:bg-rose-50 rounded" title="حذف"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** تاريخ الفاتورة (ISO كامل) إلى YYYY-MM-DD بالتوقيت المحلي */
function localIso(d: string | number | Date): string {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
