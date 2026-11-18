import React, { useEffect, useMemo, useState } from 'react';
import {
  ShoppingCart, Boxes, Truck, Users, FileText, BarChart3, Wallet, Tag, Clock, Briefcase, Settings, Wifi, WifiOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { TabType } from './Navigation';

interface Tile {
  id: TabType;
  label: string;
  sub: string;
  icon: React.ReactNode;
  grad: string;
  badge?: string;
  badgeTone?: string;
  permitted: boolean;
}

// الشاشة الرئيسية للوضع العصري: مربعات كبيرة بأيقونات ملوّنة (كلها مضمَّنة في البرنامج).
export default function ModernHome({ onSelectTab }: { onSelectTab: (tab: TabType) => void }) {
  const { products, invoices, customers, settings, hasPermission, storeFeatures, formatMoney, activeShift } = useApp() as any;
  const [now, setNow] = useState(() => new Date());
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { clearInterval(t); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const today = useMemo(() => {
    const d = now.toDateString();
    let total = 0, count = 0;
    (invoices || []).forEach((i: any) => {
      if (i.status === 'returned') return;
      if (new Date(i.date).toDateString() === d) { total += Number(i.total) || 0; count += 1; }
    });
    return { total, count };
  }, [invoices, now.toDateString()]);

  const lowStock = useMemo(() => (products || []).filter((p: any) => p.stock <= p.minStock).length, [products]);
  const debtors = useMemo(() => (customers || []).filter((c: any) => c.totalDebt > 0).length, [customers]);

  const shiftsOk = storeFeatures?.enableShifts !== false && settings.enableShifts !== false && hasPermission('canAccessShifts');
  const repsOk = storeFeatures?.enableSalesReps !== false && !!settings.enableSalesReps && hasPermission('canManageSalesReps');

  const tiles: Tile[] = [
    { id: 'pos', label: 'البيع السريع', sub: 'بدء قائمة جديدة', icon: <ShoppingCart />, grad: 'from-orange-400 to-rose-500', permitted: hasPermission('canSell') },
    { id: 'inventory', label: 'المخزن', sub: 'الجرد والمواد', icon: <Boxes />, grad: 'from-amber-400 to-orange-500', badge: lowStock > 0 ? `${lowStock} ناقص` : undefined, badgeTone: 'bg-rose-500', permitted: hasPermission('canAccessInventory') },
    { id: 'suppliers', label: 'المشتريات', sub: 'الموردون والطلبات', icon: <Truck />, grad: 'from-emerald-400 to-teal-600', permitted: hasPermission('canAccessInventory') },
    { id: 'customers', label: 'الديون', sub: 'سجل العملاء', icon: <Users />, grad: 'from-yellow-400 to-amber-600', badge: debtors > 0 ? `${debtors} مدين` : undefined, badgeTone: 'bg-amber-600', permitted: hasPermission('canViewCustomers') },
    { id: 'reports', label: 'التقارير', sub: 'الأرباح والتحليل', icon: <BarChart3 />, grad: 'from-sky-400 to-indigo-600', permitted: hasPermission('canViewReports') },
    { id: 'invoices', label: 'الفواتير', sub: 'سجل القوائم', icon: <FileText />, grad: 'from-violet-400 to-purple-600', permitted: hasPermission('canViewInvoices') },
    { id: 'shifts', label: 'الشفتات', sub: activeShift ? 'شفت جارٍ الآن' : 'فتح وإنهاء الشفت', icon: <Clock />, grad: 'from-cyan-400 to-blue-600', badge: activeShift ? 'جارٍ' : undefined, badgeTone: 'bg-emerald-500', permitted: shiftsOk },
    { id: 'expenses', label: 'المصروفات', sub: 'يدوية وثابتة', icon: <Wallet />, grad: 'from-rose-400 to-pink-600', permitted: hasPermission('canViewReports') && settings.showExpensesTab !== false },
    { id: 'offers', label: 'العروض', sub: 'الخصومات والعروض', icon: <Tag />, grad: 'from-fuchsia-400 to-pink-600', permitted: hasPermission('canAccessInventory') },
    { id: 'sales-reps', label: 'المندوبون', sub: 'المبيعات والأرباح', icon: <Briefcase />, grad: 'from-indigo-400 to-blue-700', permitted: repsOk },
    { id: 'settings', label: 'لوحة الضبط', sub: 'إعدادات وحماية', icon: <Settings />, grad: 'from-slate-400 to-slate-700', permitted: hasPermission('canAccessSettings') },
  ];
  const visible = tiles.filter((t) => t.permitted);

  const time = now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = now.toLocaleDateString('ar-IQ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const currency = settings.currency || 'د.ع';

  return (
    <div data-testid="modern-home" className="space-y-4" dir="rtl">
      <section className="bg-white dark:bg-[#0b1728] rounded-3xl border border-orange-200 dark:border-orange-400/30 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-lg sm:text-2xl font-black text-slate-800 dark:text-white">{settings.storeName || 'برنامج المفكر المحاسبي'}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{date}</div>
          <div className="text-2xl sm:text-3xl font-black text-orange-500 mt-1 tabular-nums" dir="ltr">{time}</div>
        </div>
        <div className="text-center">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">مبيعات اليوم</div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{formatMoney ? formatMoney(today.total) : today.total} <span className="text-sm">{currency}</span></div>
        </div>
        <div className="flex gap-3">
          <div className="rounded-2xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-400/30 px-4 py-2 text-center">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">قوائم اليوم</div>
            <div className="text-lg font-black text-orange-600 dark:text-orange-300">{today.count}</div>
          </div>
          <div className="rounded-2xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-400/30 px-4 py-2 text-center">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">عدد المواد</div>
            <div className="text-lg font-black text-orange-600 dark:text-orange-300">{(products || []).length}</div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {visible.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`home-tile-${t.id}`}
            onClick={() => onSelectTab(t.id)}
            className="relative group text-center bg-white dark:bg-[#0b1728] rounded-3xl border border-orange-200 dark:border-orange-400/25 px-3 py-5 sm:py-6 cursor-pointer hover:-translate-y-1 transition-transform"
          >
            {t.badge && <span className={`absolute top-2.5 left-2.5 text-[10px] font-bold text-white px-2 py-0.5 rounded-full ${t.badgeTone || 'bg-orange-500'}`}>{t.badge}</span>}
            <span className={`mx-auto mb-3 w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br ${t.grad} text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform [&>svg]:w-8 [&>svg]:h-8 sm:[&>svg]:w-10 sm:[&>svg]:h-10`}>
              {t.icon}
            </span>
            <span className="block text-sm sm:text-base font-black text-slate-800 dark:text-white">{t.label}</span>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t.sub}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
        {online ? <Wifi className="w-3.5 h-3.5 text-emerald-500" /> : <WifiOff className="w-3.5 h-3.5 text-rose-500" />}
        <span>{online ? 'متصل بالإنترنت — المزامنة تعمل' : 'غير متصل — تعمل أوفلاين وتُزامَن عند عودة الاتصال'}</span>
      </div>
    </div>
  );
}
