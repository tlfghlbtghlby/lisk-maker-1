import React, { useMemo, useState } from 'react';
import { ShoppingCart, Boxes, FileText, Users, BarChart3, Settings, Briefcase, Clock, ExternalLink, Monitor } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ContextMenuWrapper } from './ContextMenuWrapper';

export type TabType = 'pos' | 'inventory' | 'invoices' | 'customers' | 'reports' | 'sales-reps' | 'shifts' | 'settings';

interface NavigationProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onSelectTab }) => {
  const { 
    products, 
    invoices, 
    customers, 
    shifts, 
    activeShift, 
    hasPermission, 
    settings, 
    storeFeatures,
    currentUser,
    sessionRole,
    activeSupervisorId,
    currentDeviceId 
  } = useApp();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // فحص صارم: الميزة يجب أن تكون مفعلة في ترخيص المتجر أولاً، ثم مطابقة لصلاحية الجلسة
  const isShiftsPermitted = storeFeatures?.enableShifts !== false && settings.enableShifts !== false && hasPermission('canAccessShifts');
  const isSalesRepsPermitted = storeFeatures?.enableSalesReps !== false && !!settings.enableSalesReps && hasPermission('canManageSalesReps');

  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
  const activeDebtCustomers = customers.filter((c) => c.totalDebt > 0).length;

  // إحصاء شفتات هذا المتجر وهذا الحساب تحديداً لعزلها عن أي حساب أو متجر آخر
  const accountShiftsCount = useMemo(() => {
    let list = shifts;
    if (currentUser?.uid) {
      list = list.filter(s => {
        if (s.storeUid && s.storeUid !== currentUser.uid) return false;
        if (s.openedBy?.uid && s.openedBy.uid.startsWith('user_') && s.openedBy.uid !== currentUser.uid) return false;
        return true;
      });
    }
    if (sessionRole !== 'admin') {
      list = list.filter(s => {
        const opId = (s as any).operatorId;
        const supId = (s as any).supervisorId;
        if (sessionRole === 'supervisor' && activeSupervisorId) {
          return supId === activeSupervisorId || opId?.includes(activeSupervisorId);
        }
        return (
          opId === `${currentUser?.uid}_${sessionRole}` ||
          (s.openedBy?.role === sessionRole && s.deviceId === currentDeviceId)
        );
      });
    }
    return list.length;
  }, [shifts, currentUser?.uid, sessionRole, activeSupervisorId, currentDeviceId]);

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
      badge: activeShift ? '🟢 شفت جارٍ' : (accountShiftsCount > 0 ? accountShiftsCount : undefined),
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
  const currentTabItem = navItems.find((item) => item.id === activeTab) || navItems[0];

  const handleOpenCurrentTabStandalone = async () => {
    if (!currentTabItem) return;
    try {
      const electron = (window as any).electronAPI || (window as any).electron;
      if (electron && typeof electron.openSectionWindow === 'function') {
        await electron.openSectionWindow({
          route: currentTabItem.id,
          title: currentTabItem.label,
        });
        showFeedback(`✅ تم فتح "${currentTabItem.label}" في نافذة مستقلة بنجاح!`);
        return;
      }

      const currentUrl = new URL(window.location.href);
      currentUrl.hash = `#${currentTabItem.id}?standalone=true`;
      currentUrl.searchParams.set('open-route', currentTabItem.id);
      currentUrl.searchParams.set('route', currentTabItem.id);
      currentUrl.searchParams.set('standalone', 'true');

      const win = window.open(
        currentUrl.toString(),
        `mufakir_win_${currentTabItem.id}_${Date.now()}`,
        'width=1280,height=820,left=100,top=80,menubar=no,toolbar=no,location=no,status=no'
      );
      if (win) {
        showFeedback(`✅ تم فتح "${currentTabItem.label}" في نافذة مستقلة متزامنة!`);
      } else {
        showFeedback('⚠️ يرجى السماح بالنوافذ المنبثقة من إعدادات المتصفح');
      }
    } catch (e: any) {
      console.warn('Open standalone error:', e);
      showFeedback('تعذر فتح النافذة المنفصلة');
    }
  };

  const handleCreateCurrentTabShortcut = async () => {
    if (!currentTabItem) return;
    try {
      const api = (window as any).electronAPI || (window as any).electron;
      if (api && typeof api.createDesktopShortcut === 'function') {
        const res = await api.createDesktopShortcut({
          route: currentTabItem.id,
          name: currentTabItem.label,
          title: currentTabItem.label,
        });

        if (res && res.success) {
          showFeedback(`✅ تم إنشاء اختصار "${currentTabItem.label}" على سطح المكتب بنجاح!`);
        } else {
          showFeedback('⚠️ تعذر إنشاء الاختصار على سطح المكتب');
        }
      } else {
        showFeedback('ℹ️ ميزة إنشاء اختصارات سطح المكتب تعمل داخل تطبيق البرنامج المثبت فقط');
      }
    } catch (err: any) {
      console.warn('Create shortcut error:', err);
      showFeedback('تعذر إنشاء الاختصار');
    }
  };

  return (
    <nav className="no-print bg-white dark:bg-[#0b1728] border-b border-slate-200 dark:border-slate-800/80 sticky top-0 z-20 shadow-xs transition-colors">
      <div className={`${isMobile ? 'max-w-2xl px-2.5 sm:px-4' : 'max-w-[1650px] px-3 sm:px-6'} mx-auto`}>
        <div className="flex items-center justify-between gap-2 py-1.5 sm:py-2">
          {/* شريط التبويبات مع دعم الكليك أيمن */}
          <div className="flex items-center space-x-1 space-x-reverse overflow-x-auto py-0.5 scrollbar-none flex-1 min-w-0">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <ContextMenuWrapper
                  key={item.id}
                  route={item.id}
                  title={item.label}
                  icon={item.icon}
                  onSelectTab={onSelectTab}
                >
                  <button
                    type="button"
                    onClick={() => onSelectTab(item.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer select-none ${
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
                </ContextMenuWrapper>
              );
            })}
          </div>

          {/* أزرار سريعة للقسم المفتوح حالياً */}
          {currentTabItem && (
            <div className="flex items-center gap-1.5 shrink-0 pr-1.5 border-r border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleOpenCurrentTabStandalone}
                title={`فتح "${currentTabItem.label}" في نافذة مستقلة ملء الشاشة`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200/80 dark:border-slate-700/80 transition cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="hidden lg:inline">نافذة مستقلة</span>
              </button>

              <button
                type="button"
                onClick={handleCreateCurrentTabShortcut}
                title={`إنشاء اختصار رسمي (.lnk) لـ "${currentTabItem.label}" على سطح المكتب`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-600 dark:hover:text-amber-400 border border-slate-200/80 dark:border-slate-700/80 transition cursor-pointer"
              >
                <Monitor className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="hidden lg:inline">اختصار سطح المكتب</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* إشعار عائم بدون alert */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-2 animate-fadeIn pointer-events-none">
          <span>{toastMessage}</span>
        </div>
      )}
    </nav>
  );
};

