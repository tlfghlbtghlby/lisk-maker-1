import React, { useEffect, useMemo, useState } from 'react';
import {
  ShoppingCart, Boxes, Truck, Users, FileText, BarChart3, Wallet, Tag, Clock, Briefcase, Settings, Wifi, WifiOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { TabType } from './Navigation';
import { TabContextMenu } from './TabContextMenu';

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
  const { products, customers, settings, hasPermission, storeFeatures, activeShift } = useApp() as any;
  const [menu, setMenu] = useState<{ x: number; y: number; tile: Tile } | null>(null);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

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


  return (
    <div data-testid="modern-home" className="space-y-4" dir="rtl">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {visible.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`home-tile-${t.id}`}
            onClick={() => onSelectTab(t.id)}
            onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, tile: t }); }}
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

      {menu && (
        <TabContextMenu
          x={menu.x}
          y={menu.y}
          tabId={menu.tile.id}
          tabLabel={menu.tile.label}
          tabIcon={menu.tile.icon}
          onClose={() => setMenu(null)}
          onSelectTab={(tab) => { setMenu(null); onSelectTab(tab); }}
        />
      )}

      <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
        {online ? <Wifi className="w-3.5 h-3.5 text-emerald-500" /> : <WifiOff className="w-3.5 h-3.5 text-rose-500" />}
        <span>{online ? 'متصل بالإنترنت — المزامنة تعمل' : 'غير متصل — تعمل أوفلاين وتُزامَن عند عودة الاتصال'}</span>
      </div>
    </div>
  );
}
