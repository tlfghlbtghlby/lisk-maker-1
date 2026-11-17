import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { FixedExpense, Invoice } from '../types';
import { inPeriod } from '../utils/expenses';
import { newId, todayIso } from '../utils/suppliers';

const inputCls = 'border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:border-rose-500';
const card = 'bg-white border border-slate-200 rounded-2xl shadow-xs';
const CYCLE_LABEL: Record<FixedExpense['cycle'], string> = { monthly: 'شهرياً', weekly: 'أسبوعياً', yearly: 'سنوياً' };
const CYCLE_DAYS: Record<FixedExpense['cycle'], number> = { monthly: 30, weekly: 7, yearly: 365 };

function localIso(d: string | number | Date): string {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
const firstOfMonth = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`; };
const daysBetween = (a: string, b: string) => Math.max(1, Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000) + 1);

/** المصروفات الثابتة (رواتب، إيجار...) + معاينة الأرباح مقابلها لمدة يحددها صاحب المحل */
export function FixedExpensesView() {
  const { settings, updateSettings, formatMoney, invoices, hasPermission } = useApp() as any;
  const showProfit = !!hasPermission?.('canViewCostPrice');
  const list: FixedExpense[] = settings.fixedExpenses || [];

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cycle, setCycle] = useState<FixedExpense['cycle']>('monthly');
  const [editId, setEditId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayIso());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!name.trim()) return setErr('اكتب اسم المصروف الثابت (مثل: راتب موظف، إيجار).');
    if (!(amt > 0)) return setErr('أدخل مبلغاً أكبر من صفر.');
    const entry: FixedExpense = { id: editId || newId('fx'), name: name.trim(), amount: amt, cycle };
    updateSettings({ fixedExpenses: editId ? list.map((x) => (x.id === editId ? entry : x)) : [...list, entry] });
    setName(''); setAmount(''); setCycle('monthly'); setEditId(null); setErr('');
  };
  const remove = (x: FixedExpense) => { if (window.confirm(`حذف «${x.name}»؟`)) updateSettings({ fixedExpenses: list.filter((y) => y.id !== x.id) }); };

  const days = daysBetween(from, to);
  const prorated = (x: FixedExpense) => Math.round((x.amount * days) / CYCLE_DAYS[x.cycle]);
  const fixedTotal = list.reduce((s, x) => s + prorated(x), 0);
  const profit = useMemo(
    () => ((invoices || []) as Invoice[]).filter((i) => inPeriod(localIso(i.date), 'custom', from, to)).reduce((s, i) => s + (Number(i.netProfit) || 0), 0),
    [invoices, from, to]
  );
  const net = profit - fixedTotal;
  const covered = fixedTotal > 0 ? Math.min(100, Math.max(0, Math.round((profit / fixedTotal) * 100))) : 100;

  return (
    <div className="space-y-4 text-slate-900" dir="rtl" data-testid="fixed-expenses">
      <div className={`${card} p-4`}>
        <div className="text-sm font-extrabold mb-1">المصروفات الثابتة</div>
        <p className="text-[11px] text-slate-500 mb-3">أضف ما يتكرر عليك: رواتب الموظفين، إيجار المحل، كهرباء... ثم عاين هل غطّت أرباحك هذه الثوابت.</p>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[160px]"><label className="block text-[11px] font-bold mb-1">الاسم</label><input data-testid="fx-name" className={`${inputCls} w-full`} value={name} onChange={(e) => setName(e.target.value)} placeholder="راتب موظف / إيجار محل" /></div>
          <div className="w-36"><label className="block text-[11px] font-bold mb-1">المبلغ</label><input data-testid="fx-amount" type="number" min={0} className={`${inputCls} w-full`} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="w-28"><label className="block text-[11px] font-bold mb-1">الدورة</label>
            <select className={`${inputCls} w-full`} value={cycle} onChange={(e) => setCycle(e.target.value as any)}>
              <option value="monthly">شهرياً</option><option value="weekly">أسبوعياً</option><option value="yearly">سنوياً</option>
            </select></div>
          <button data-testid="fx-add" type="submit" className="px-5 py-2 rounded-lg bg-rose-600 text-white text-sm font-black cursor-pointer">{editId ? 'حفظ' : 'إضافة'}</button>
          {editId && <button type="button" onClick={() => { setEditId(null); setName(''); setAmount(''); }} className="px-3 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm font-bold cursor-pointer">إلغاء</button>}
        </form>
        {err && <div className="mt-2 text-xs font-bold text-red-600">{err}</div>}
      </div>

      <div className={`${card} overflow-hidden`}>
        {list.length === 0 ? <div className="p-6 text-center text-xs text-slate-500">لا توجد مصروفات ثابتة بعد.</div> : (
          <table className="w-full text-sm">
            <tbody>
              {list.map((x) => (
                <tr key={x.id} className="border-b border-slate-100 last:border-0">
                  <td className="p-3 font-bold">{x.name}</td>
                  <td className="p-3 font-mono">{formatMoney(x.amount)} <span className="text-[11px] text-slate-500">{CYCLE_LABEL[x.cycle]}</span></td>
                  <td className="p-3 text-left whitespace-nowrap">
                    <button type="button" onClick={() => { setEditId(x.id); setName(x.name); setAmount(String(x.amount)); setCycle(x.cycle); }} className="text-xs font-bold text-indigo-600 ml-3 cursor-pointer">تعديل</button>
                    <button type="button" onClick={() => remove(x)} className="text-xs font-bold text-red-600 cursor-pointer">حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <button type="button" data-testid="fx-preview-btn" onClick={() => setPreviewOpen(true)} className="w-full py-3 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 text-white text-sm font-black cursor-pointer shadow">
        📊 معاينة الأرباح مقابل الخصومات الثابتة
      </button>

      {previewOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) setPreviewOpen(false); }}>
          <div data-testid="fx-preview" className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-5 space-y-3 max-h-[92vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between"><h3 className="font-black text-base">معاينة الأرباح مقابل الخصومات الثابتة</h3><button type="button" onClick={() => setPreviewOpen(false)} className="px-3 py-1 rounded-lg bg-slate-100 text-xs font-bold cursor-pointer">إغلاق</button></div>
            <div className="flex gap-2 items-end">
              <div className="flex-1"><label className="block text-[11px] font-bold mb-1">من تاريخ</label><input data-testid="fx-from" type="date" className={`${inputCls} w-full`} value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="flex-1"><label className="block text-[11px] font-bold mb-1">إلى تاريخ</label><input data-testid="fx-to" type="date" className={`${inputCls} w-full`} value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </div>
            <div className="text-[11px] text-slate-500">المدة: {days} يوم. تُحسب الثوابت بالتناسب مع عدد أيام المدة (الشهر = 30 يوماً).</div>
            {!showProfit ? (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs font-bold text-amber-800">عرض الأرباح يتطلب صلاحية سعر التكلفة.</div>
            ) : (
              <>
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm">
                  <div className="p-3 flex justify-between"><span>الأرباح المحققة في المدة</span><b className="font-mono text-emerald-700" data-testid="fx-profit">{formatMoney(profit)}</b></div>
                  <div className="p-3">
                    <div className="flex justify-between mb-1"><span>الخصومات الثابتة (للمدة)</span><b className="font-mono text-rose-700" data-testid="fx-total">{formatMoney(fixedTotal)}</b></div>
                    {list.map((x) => <div key={x.id} className="flex justify-between text-[11px] text-slate-500"><span>{x.name}</span><span className="font-mono">{formatMoney(prorated(x))}</span></div>)}
                  </div>
                  <div className="p-3 flex justify-between font-black"><span>{net >= 0 ? 'صافي الربح فوق الثوابت' : 'العجز عن تغطية الثوابت'}</span><b data-testid="fx-net" className={`font-mono ${net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatMoney(Math.abs(net))}</b></div>
                </div>
                <div>
                  <div className="h-3 rounded-full bg-slate-200 overflow-hidden"><div className={`h-full ${net >= 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${covered}%` }} /></div>
                  <div data-testid="fx-verdict" className={`mt-2 p-3 rounded-lg text-xs font-black border ${net >= 0 ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-700'}`}>
                    {fixedTotal === 0
                      ? 'لا توجد خصومات ثابتة محددة بعد.'
                      : net >= 0
                        ? `✓ غطّت الأرباح الخصومات الثابتة بالكامل وبدأ الربح الصافي بـ ${formatMoney(net)} فوقها.`
                        : `✗ لم تغطِّ الأرباح الثوابت بعد: تغطية ${covered}% ويتبقى ${formatMoney(-net)} حتى تبدأ بالربح.`}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
