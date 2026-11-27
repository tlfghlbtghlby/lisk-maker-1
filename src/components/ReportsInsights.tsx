import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Clock, PackageX, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getExpiryAlerts } from '../utils/expiryAlerts';

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** تقارير ذكية سريعة: اليوم مقابل أمس، آخر 7 أيام، ساعات الذروة، تنبيهات المخزون والصلاحية، كبار المدينين، المواد الراكدة */
export const ReportsInsights: React.FC = () => {
  const { invoices, products, customers, formatMoney, settings } = useApp() as any;
  const [warnDays, setWarnDays] = useState<number>(Number(settings?.expiryWarnDays) || 30);
  const expiryOn = settings?.enableProductExpiry === true;

  const data = useMemo(() => {
    const now = new Date();
    const today = dayKey(now);
    const y = new Date(now); y.setDate(y.getDate() - 1);
    const yesterday = dayKey(y);
    const perDay: Record<string, { sales: number; profit: number; count: number }> = {};
    const hours = new Array(24).fill(0) as number[];
    const lastSold: Record<string, number> = {};
    const cut30 = now.getTime() - 30 * 86400000;
    for (const inv of invoices || []) {
      const d = new Date(inv.date);
      if (isNaN(d.getTime())) continue;
      const k = dayKey(d);
      const e = (perDay[k] ||= { sales: 0, profit: 0, count: 0 });
      e.sales += inv.total || 0; e.profit += inv.netProfit || 0; e.count += 1;
      if (d.getTime() >= cut30) hours[d.getHours()] += inv.total || 0;
      for (const it of inv.items || []) lastSold[it.productId] = Math.max(lastSold[it.productId] || 0, d.getTime());
    }
    const week = Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(now); dd.setDate(dd.getDate() - (6 - i));
      const k = dayKey(dd);
      return { k, label: AR_DAYS[dd.getDay()], ...(perDay[k] || { sales: 0, profit: 0, count: 0 }) };
    });
    const dead = (products || [])
      .filter((p: any) => p.stock > 0 && !(lastSold[p.id] >= cut30) && new Date(p.createdAt || 0).getTime() < cut30)
      .map((p: any) => ({ p, capital: p.stock * p.costPrice }))
      .sort((a: any, b: any) => b.capital - a.capital);
    return { t: perDay[today] || { sales: 0, profit: 0, count: 0 }, yv: perDay[yesterday] || { sales: 0, profit: 0, count: 0 }, week, hours, dead };
  }, [invoices, products]);

  const low = useMemo(() => (products || []).filter((p: any) => p.stock <= p.minStock).sort((a: any, b: any) => a.stock - b.stock), [products]);
  const expiry = useMemo(() => (expiryOn ? getExpiryAlerts(products || [], warnDays) : []), [products, warnDays, expiryOn]);
  const debtors = useMemo(() => (customers || []).filter((c: any) => c.totalDebt > 0).sort((a: any, b: any) => b.totalDebt - a.totalDebt), [customers]);

  const maxWeek = Math.max(1, ...data.week.map(w => w.sales));
  const maxHour = Math.max(1, ...data.hours);
  const peak = data.hours.indexOf(Math.max(...data.hours));
  const diff = data.yv.sales > 0 ? ((data.t.sales - data.yv.sales) / data.yv.sales) * 100 : null;
  const deadCapital = data.dead.reduce((s: number, x: any) => s + x.capital, 0);

  const card = 'bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3';
  return (
    <div className="space-y-6" data-testid="reports-insights">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-slate-200" />
        <h2 className="text-sm font-extrabold text-slate-800">تقارير ذكية سريعة</h2>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {/* اليوم مقابل أمس */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={card} data-testid="ins-today-sales">
          <span className="text-xs text-slate-500">مبيعات اليوم</span>
          <strong className="block text-lg font-black text-slate-900">{formatMoney(data.t.sales)}</strong>
          <span className={`text-[11px] font-bold flex items-center gap-1 ${diff === null ? 'text-slate-400' : diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {diff === null ? 'لا مبيعات أمس للمقارنة' : <>{diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{Math.abs(diff).toFixed(0)}% عن أمس ({formatMoney(data.yv.sales)})</>}
          </span>
        </div>
        <div className={card}>
          <span className="text-xs text-slate-500">ربح اليوم</span>
          <strong className="block text-lg font-black text-emerald-700">{formatMoney(data.t.profit)}</strong>
          <span className="text-[11px] text-slate-400">أمس: {formatMoney(data.yv.profit)}</span>
        </div>
        <div className={card}>
          <span className="text-xs text-slate-500">عدد قوائم اليوم</span>
          <strong className="block text-lg font-black text-slate-900">{data.t.count}</strong>
          <span className="text-[11px] text-slate-400">أمس: {data.yv.count}</span>
        </div>
        <div className={card}>
          <span className="text-xs text-slate-500">متوسط القائمة اليوم</span>
          <strong className="block text-lg font-black text-slate-900">{formatMoney(data.t.count ? data.t.sales / data.t.count : 0)}</strong>
          <span className="text-[11px] text-slate-400">أمس: {formatMoney(data.yv.count ? data.yv.sales / data.yv.count : 0)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* آخر 7 أيام */}
        <div className={card} data-testid="ins-week">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2"><CalendarClock className="w-4 h-4 text-amber-500" />مبيعات آخر 7 أيام</h3>
          <div className="flex items-end gap-2 h-36">
            {data.week.map(w => (
              <div key={w.k} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${w.label}: ${formatMoney(w.sales)} — ${w.count} قائمة`}>
                <span className="text-[9px] text-slate-500 font-bold">{w.sales > 0 ? formatMoney(w.sales).replace(/\s*(د\.ع|IQD).*/, '') : ''}</span>
                <div className="w-full rounded-t-md bg-amber-500" style={{ height: `${Math.max(w.sales > 0 ? 4 : 1, (w.sales / maxWeek) * 100)}%`, opacity: w.sales > 0 ? 1 : 0.25 }} />
                <span className="text-[10px] text-slate-600">{w.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ساعات الذروة */}
        <div className={card} data-testid="ins-hours">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" />ساعات الذروة (آخر 30 يوماً)</h3>
          <div className="flex items-end gap-[3px] h-28" dir="ltr">
            {data.hours.map((v, h) => (
              <div key={h} className="flex-1 flex flex-col items-center justify-end h-full" title={`${h}:00 — ${formatMoney(v)}`}>
                <div className={`w-full rounded-t ${h === peak && v > 0 ? 'bg-rose-500' : 'bg-slate-300'}`} style={{ height: `${Math.max(v > 0 ? 4 : 1, (v / maxHour) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-slate-400" dir="ltr"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div>
          <p className="text-xs text-slate-600">{data.hours[peak] > 0 ? <>أكثر وقت بيعاً: <strong>{peak}:00 – {peak + 1}:00</strong></> : 'لا مبيعات كافية بعد.'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* قاربت على النفاد */}
        <div className={card} data-testid="ins-low">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-500" />قاربت على النفاد ({low.length})</h3>
          {low.length === 0 ? <p className="text-xs text-slate-400">لا توجد مواد ناقصة.</p> : (
            <ul className="divide-y divide-slate-100 text-xs max-h-56 overflow-y-auto">
              {low.slice(0, 30).map((p: any) => (
                <li key={p.id} className="py-1.5 flex justify-between gap-2"><span className="font-bold text-slate-800 truncate">{p.name}</span><span className={p.stock <= 0 ? 'text-rose-600 font-bold' : 'text-amber-700 font-bold'}>{p.stock <= 0 ? 'نفدت' : `${p.stock} / حد ${p.minStock}`}</span></li>
              ))}
            </ul>
          )}
        </div>

        {/* الصلاحية */}
        <div className={card} data-testid="ins-expiry">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2"><CalendarClock className="w-4 h-4 text-orange-500" />قاربت على انتهاء الصلاحية ({expiry.length})</h3>
            {expiryOn && (
              <select value={warnDays} onChange={e => setWarnDays(Number(e.target.value))} className="text-[11px] border border-slate-300 rounded-md px-1.5 py-1 bg-white" data-testid="ins-expiry-days">
                {Array.from(new Set([7, 15, 30, 60, 90, warnDays])).sort((a, b) => a - b).map(n => <option key={n} value={n}>خلال {n} يوم</option>)}
              </select>
            )}
          </div>
          {!expiryOn ? <p className="text-xs text-slate-400">فعّل «تاريخ الإنتاج وانتهاء الصلاحية» من الإعدادات لتتبع الصلاحية.</p>
            : expiry.length === 0 ? <p className="text-xs text-slate-400">لا توجد مواد قاربت على الانتهاء خلال {warnDays} يوماً.</p> : (
            <ul className="divide-y divide-slate-100 text-xs max-h-56 overflow-y-auto">
              {expiry.slice(0, 40).map(a => (
                <li key={a.product.id} className="py-1.5 flex justify-between gap-2">
                  <span className="font-bold text-slate-800 truncate">{a.product.name} <span className="text-slate-400 font-normal">({a.qty})</span></span>
                  <span className={a.days < 0 ? 'text-rose-600 font-bold' : a.days <= 7 ? 'text-orange-600 font-bold' : 'text-amber-700 font-bold'}>{a.days < 0 ? `منتهية منذ ${-a.days} يوم` : a.days === 0 ? 'تنتهي اليوم' : `بعد ${a.days} يوم`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* كبار المدينين */}
        <div className={card} data-testid="ins-debtors">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2"><Users className="w-4 h-4 text-amber-600" />أكبر الديون ({debtors.length} مدين)</h3>
          {debtors.length === 0 ? <p className="text-xs text-slate-400">لا توجد ديون.</p> : (
            <ul className="divide-y divide-slate-100 text-xs">
              {debtors.slice(0, 8).map((c: any) => (
                <li key={c.id} className="py-1.5 flex justify-between gap-2"><span className="font-bold text-slate-800 truncate">{c.name}</span><span className="text-amber-700 font-bold">{formatMoney(c.totalDebt)}</span></li>
              ))}
            </ul>
          )}
        </div>

        {/* راكدة */}
        <div className={card} data-testid="ins-dead">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2"><PackageX className="w-4 h-4 text-slate-500" />مواد راكدة (لم تُبع منذ 30 يوماً)</h3>
          {data.dead.length === 0 ? <p className="text-xs text-slate-400">لا توجد مواد راكدة.</p> : (
            <>
              <p className="text-[11px] text-slate-500">{data.dead.length} مادة — رأس مال مجمّد: <strong className="text-slate-800">{formatMoney(deadCapital)}</strong></p>
              <ul className="divide-y divide-slate-100 text-xs max-h-44 overflow-y-auto">
                {data.dead.slice(0, 15).map((x: any) => (
                  <li key={x.p.id} className="py-1.5 flex justify-between gap-2"><span className="font-bold text-slate-800 truncate">{x.p.name}</span><span className="text-slate-600">{formatMoney(x.capital)}</span></li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsInsights;
