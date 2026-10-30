import React from 'react';
import { ShoppingCart, Boxes, FileText, Users, BarChart3, Settings, Briefcase, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';

export type TabType = 'pos' | 'inventory' | 'invoices' | 'customers' | 'reports' | 'sales-reps' | 'shifts' | 'settings';

interface NavigationProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onSelectTab }) => {
  const { products, invoices, customers, shifts, activeShift, hasPermission, settings, storeFeatures } = useApp();

  // فحص صارم: الميزة يجب أن تكون مفعلة في ترخيص المتجر أولاً، ثم مطابقة لصلاحية الجلسة
  const isShiftsPermitted = storeFeatures?.enableShifts !== false && settings.enableShifts !== false && hasPermission('canAccessShifts');
  const isSalesRepsPermitted = storeFeatures?.enableSalesReps !== false && !!settings.enableSalesReps && hasPermission('canManageSalesReps');

  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
  const activeDebtCustomers = customers.filter((c) => c.totalDebt > 0).length;

  const allNavItems: { id: TabType; label: string; icon: React.ReactNode; badge?: number | string; badgeColor?: string; permitted: boolean }[] = [
    {
      id: 'pos',
      label: 'نقطة البيع وقائمة جديدة',
      icon: <ShoppingCart className="w-4 h-4" />,
      permitted: hasPermission('canSell'),
    },
    {
      id: 'inventory',
      label: 'المواد والمخزون',
      icon: <Boxes className="w-4 h-4" />,
      badge: lowStockCount > 0 ? `${lowStockCount} ناقص` : undefined,
      badgeColor: 'text-rose-600 bg-rose-50',
      permitted: hasPermission('canAccessInventory'),
    },
    {
      id: 'invoices',
      label: 'سجل القوائم والفواتير',
      icon: <FileText className="w-4 h-4" />,
      badge: invoices.length,
      badgeColor: 'text-slate-600 bg-slate-100',
      permitted: hasPermission('canViewInvoices'),
    },
    {
      id: 'sales-reps',
      label: 'المندوبين والأرباح',
      icon: <Briefcase className="w-4 h-4" />,
      badge: (settings.salesReps && settings.salesReps.length > 0) ? settings.salesReps.length : undefined,
      badgeColor: 'text-indigo-700 bg-indigo-50 font-bold',
      permitted: isSalesRepsPermitted,
    },
    {
      id: 'shifts',
      label: 'الشفتات والورديات',
      icon: <Clock className="w-4 h-4" />,
      badge: activeShift ? '🟢 شفت جارٍ' : (shifts.length > 0 ? shifts.length : undefined),
      badgeColor: activeShift ? 'text-emerald-700 bg-emerald-100 animate-pulse font-bold' : 'text-slate-600 bg-slate-100',
      permitted: isShiftsPermitted,
    },
    {
      id: 'customers',
      label: 'البيع الآجل وحسابات الديون',
      icon: <Users className="w-4 h-4" />,
      badge: activeDebtCustomers > 0 ? `${activeDebtCustomers} مدين` : undefined,
      badgeColor: 'text-amber-700 bg-amber-50',
      permitted: hasPermission('canViewCustomers'),
    },
    {
      id: 'reports',
      label: 'الأرباح والتقارير المالية',
      icon: <BarChart3 className="w-4 h-4" />,
      permitted: hasPermission('canViewReports'),
    },
    {
      id: 'settings',
      label: 'الإعدادات والنسخ الاحتياطي',
      icon: <Settings className="w-4 h-4" />,
      permitted: hasPermission('canAccessSettings'),
    },
  ];

  const navItems = allNavItems.filter((item) => item.permitted);
  const isMobile = settings.deviceMode === 'mobile';

  return (
    <nav className="no-print bg-white dark:bg-[#0b1728] border-b border-slate-200 dark:border-slate-800/80 sticky top-0 z-20 shadow-xs transition-colors">
      <div className={`${isMobile ? 'max-w-2xl px-2.5 sm:px-4' : 'max-w-[1650px] px-3 sm:px-6'} mx-auto`}>
        <div className="flex items-center space-x-1 space-x-reverse overflow-x-auto py-2 scrollbar-none">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 dark:bg-gradient-to-r dark:from-amber-500 dark:via-amber-400 dark:to-yellow-500 text-white dark:text-slate-950 shadow-sm dark:shadow-md dark:shadow-amber-500/20 dark:border dark:border-amber-400/60'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-md font-bold transition ${
                      isActive
                        ? 'bg-white/20 dark:bg-slate-950/20 text-white dark:text-slate-950'
                        : item.badgeColor
                        ? `${item.badgeColor} dark:bg-slate-800 dark:text-amber-300 dark:border dark:border-slate-700`
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
