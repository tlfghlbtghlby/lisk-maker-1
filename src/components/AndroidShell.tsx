import React, { useEffect, useState } from 'react';
import {
  ShoppingCart, Boxes, FileText, Users, BarChart3, Settings, Briefcase, Clock, Tag,
  LayoutGrid, RefreshCw, Cloud, WifiOff, UserCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TabType, useNavItems } from './Navigation';
import { Header } from './Header';

// واجهة أندرويد الأصلية (Material): شريط علوي، شريط تنقل سفلي، ولوحات سفلية.
// تُستخدم فقط داخل تطبيق الأندرويد (انظر App.tsx).

const ICONS: Record<TabType, React.ComponentType<{ className?: string }>> = {
  pos: ShoppingCart,
  inventory: Boxes,
  invoices: FileText,
  offers: Tag,
  'sales-reps': Briefcase,
  shifts: Clock,
  customers: Users,
  reports: BarChart3,
  settings: Settings,
};

const SHORT: Record<TabType, string> = {
  pos: 'البيع',
  inventory: 'المواد',
  invoices: 'الفواتير',
  offers: 'العروض',
  'sales-reps': 'المندوبون',
  shifts: 'الشفتات',
  customers: 'الديون',
  reports: 'التقارير',
  settings: 'الإعدادات',
};

const PRIMARY_ORDER: TabType[] = ['pos', 'inventory', 'invoices', 'customers'];

/** لوحة سفلية بتصميم Material */
export const AndroidSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" dir="rtl">
      <div data-sheet-scrim className="absolute inset-0 bg-black/50 android-scrim" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#0b1728] text-slate-900 dark:text-slate-100 rounded-t-[28px] shadow-2xl max-h-[88dvh] flex flex-col android-sheet-panel">
        <div className="pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-9 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        <div className="px-5 pb-2 pt-1 text-base font-black shrink-0">{title}</div>
        <div className="overflow-y-auto px-3 pb-[max(16px,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
};

/** الشريط العلوي: عنوان الصفحة + المزامنة + الحساب */
export const AndroidTopBar: React.FC<{ title: string; onOpenAuth: () => void }> = ({ title, onOpenAuth }) => {
  const { currentUser, syncNow, isSyncing, isCloudConnected, settings } = useApp();
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <>
      <div className="no-print sticky top-0 z-30 bg-[#0f172a] text-white shadow-md">
        <div className="h-14 px-3 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[17px] font-black leading-tight truncate">{title}</div>
            <div className="text-[11px] text-slate-400 leading-tight truncate">
              {settings.storeName || 'برنامج المفكر المحاسبي'}
            </div>
          </div>

          {currentUser && (
            <span
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                isCloudConnected ? 'text-emerald-400' : 'text-amber-300'
              }`}
              title={isCloudConnected ? 'متصل سحابياً' : 'محلي'}
            >
              {isCloudConnected ? <Cloud className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </span>
          )}

          {currentUser && (
            <button
              type="button"
              onClick={syncNow}
              disabled={isSyncing}
              aria-label="مزامنة الآن"
              className="android-icon-btn text-slate-100"
            >
              <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            aria-label="الحساب والجلسات"
            className="android-icon-btn text-slate-100"
          >
            <UserCircle2 className="w-6 h-6" />
          </button>
        </div>
      </div>

      <AndroidSheet open={accountOpen} onClose={() => setAccountOpen(false)} title="الحساب والجلسات والمزامنة">
        <Header onOpenAuth={() => { setAccountOpen(false); onOpenAuth(); }} />
      </AndroidSheet>
    </>
  );
};

/** شريط التنقل السفلي (Material 3) */
export const AndroidBottomNav: React.FC<{ activeTab: TabType; onSelectTab: (t: TabType) => void }> = ({
  activeTab,
  onSelectTab,
}) => {
  const items = useNavItems();
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = PRIMARY_ORDER.map((id) => items.find((i) => i.id === id)).filter(Boolean) as typeof items;
  const rest = items.filter((i) => !primary.some((p) => p.id === i.id));
  const moreActive = rest.some((i) => i.id === activeTab);

  useEffect(() => {
    setMoreOpen(false);
  }, [activeTab]);

  const Cell: React.FC<{
    active: boolean;
    label: string;
    onClick: () => void;
    badge?: boolean;
    children: React.ReactNode;
  }> = ({ active, label, onClick, badge, children }) => (
    <button
      type="button"
      onClick={onClick}
      className="android-nav-cell flex-1 flex flex-col items-center justify-center gap-1 min-w-0 pt-2 pb-1.5 cursor-pointer select-none"
      aria-current={active ? 'page' : undefined}
    >
      <span
        className={`relative flex items-center justify-center h-8 w-16 rounded-full transition-colors duration-200 ${
          active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'
        }`}
      >
        {children}
        {badge && <span className="absolute top-1 right-4 w-2 h-2 rounded-full bg-rose-500" />}
      </span>
      <span
        className={`text-[11.5px] leading-none truncate max-w-full ${
          active ? 'font-black text-slate-900 dark:text-white' : 'font-semibold text-slate-600 dark:text-slate-400'
        }`}
      >
        {label}
      </span>
    </button>
  );

  return (
    <>
      <nav
        className="android-bottom-nav no-print fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-[#0b1728] border-t border-slate-200 dark:border-slate-800 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        dir="rtl"
      >
        <div className="flex items-stretch h-[64px]">
          {primary.map((item) => {
            const Icon = ICONS[item.id];
            return (
              <Cell
                key={item.id}
                active={activeTab === item.id}
                label={SHORT[item.id]}
                onClick={() => onSelectTab(item.id)}
                badge={item.id === 'inventory' && typeof item.badge === 'string'}
              >
                <Icon className="w-[22px] h-[22px]" />
              </Cell>
            );
          })}
          {rest.length > 0 && (
            <Cell active={moreActive} label="المزيد" onClick={() => setMoreOpen(true)}>
              <LayoutGrid className="w-[22px] h-[22px]" />
            </Cell>
          )}
        </div>
      </nav>

      <AndroidSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="الأقسام">
        <div className="grid grid-cols-3 gap-2 pb-2">
          {rest.map((item) => {
            const Icon = ICONS[item.id];
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onSelectTab(item.id);
                }}
                className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl py-4 px-1 cursor-pointer ${
                  active
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200'
                    : 'bg-slate-100 text-slate-800 dark:bg-slate-800/70 dark:text-slate-200'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-[12.5px] font-bold text-center leading-tight">{SHORT[item.id]}</span>
                {item.badge !== undefined && (
                  <span className="absolute top-1.5 left-1.5 text-[10.5px] font-bold px-1.5 py-0.5 rounded-full bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </AndroidSheet>
    </>
  );
};
