import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  ShoppingBag, 
  CreditCard, 
  TrendingUp, 
  AlertTriangle,
  Monitor,
  Smartphone,
  Tag,
  EyeOff,
  Cloud,
  WifiOff,
  LogOut,
  LogIn,
  Store,
  RefreshCw,
  CheckCircle2,
  Lock,
  Cpu,
  Sun,
  Moon
} from 'lucide-react';
import { SessionBadgeButton } from './SessionBadgeButton';
import { ShiftHeaderButton } from './ShiftHeaderButton';
import { ActiveSessionsModal } from './ActiveSessionsModal';

interface HeaderProps {
  onOpenSettings?: () => void;
  onOpenAuth?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAuth }) => {
  const { 
    products, 
    invoices, 
    customers, 
    settings, 
    updateSettings, 
    formatMoney,
    currentUser,
    logout,
    isCloudConnected,
    syncNow,
    isSyncing,
    lastSyncTime,
    syncNotice,
    setSyncNotice,
    hasPermission,
    sessionRole,
    deviceSessions,
    isActiveSessionsModalOpen,
    setIsActiveSessionsModalOpen,
    theme,
    toggleTheme
  } = useApp();

  // Metrics calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todayInvoices = invoices.filter((inv) => inv.date.startsWith(todayStr));
  const todaySalesTotal = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const todayProfitTotal = todayInvoices.reduce((sum, inv) => sum + inv.netProfit, 0);

  const totalMarketDebt = customers.reduce((sum, cust) => sum + cust.totalDebt, 0);
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  const isMobile = settings.deviceMode === 'mobile';

  return (
    <header className="no-print bg-[#091528] dark:bg-[#060e1d] text-white border-b border-slate-800 dark:border-amber-500/20 shadow-md">
      <div className={`${isMobile ? 'max-w-2xl px-2.5 sm:px-4' : 'max-w-[1650px] px-3 sm:px-6'} w-full mx-auto py-3 space-y-3`}>
        
        {/* Main Row: اسم المحل والتحكم بدون أي تداخل أو قص للكلمات */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          
          {/* Right Side: اسم المحل والشارة وحالة المزامنة */}
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-xl p-0.5 bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-600 shadow-md shadow-amber-500/20 shrink-0">
                <img 
                  src="/assets/aistudio/1792973910260_3946b0af.jpg" 
                  alt="المفكر سمارت"
                  className="w-full h-full object-cover rounded-[10px]" 
                />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-black text-white tracking-wide font-['Tajawal','Almarai','Cairo',sans-serif]">
                    {settings.storeName || 'برنامج المفكر المحاسبي'}
                  </h1>
                  <span className="text-xs text-slate-400 hidden sm:inline">·</span>
                  <span className="text-xs text-amber-300 font-bold bg-amber-950/70 border border-amber-500/40 px-2 py-0.5 rounded-md shadow-xs">
                    المفكر سمارت • POS
                  </span>
                </div>
                {settings.ownerName && (
                  <div className="text-xs text-slate-400 mt-0.5">
                    إدارة: <span className="text-slate-200 font-medium">{settings.ownerName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Offline/Online status badge (Mobile quick badge) */}
            {currentUser && (
              <div className="lg:hidden">
                {isCloudConnected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold whitespace-nowrap">
                    <Cloud className="w-3.5 h-3.5" />
                    <span>متصل سحابياً</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold whitespace-nowrap">
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>محلي</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Left Side: أزرار التحكم كاملة الكلمات بدون أي قص أو نقاط */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Instant Sync Button (زر المزامنة الفورية في أعلى الشاشة) */}
            {currentUser && (
              <button
                type="button"
                onClick={syncNow}
                disabled={isSyncing}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer shadow-xs whitespace-nowrap ${
                  isSyncing
                    ? 'bg-emerald-700 text-white border-emerald-600 opacity-90'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                }`}
                title="مزامنة فورية للبيانات"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة فورية'}</span>
                {lastSyncTime && (
                  <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded font-mono">
                    {lastSyncTime}
                  </span>
                )}
              </button>
            )}

            {/* Wholesale Price Visibility Toggle */}
            <button
              type="button"
              onClick={() => updateSettings({ enableWholesale: !settings.enableWholesale })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border cursor-pointer whitespace-nowrap ${
                settings.enableWholesale
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 hover:bg-amber-500/30'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title={
                settings.enableWholesale
                  ? 'سعر بيع الجملة: ظاهر'
                  : 'سعر بيع الجملة: مخفي'
              }
            >
              {settings.enableWholesale ? (
                <>
                  <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>سعر بيع الجملة: ظاهر</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>سعر بيع الجملة: مخفي</span>
                </>
              )}
            </button>

            {/* Session Switch Button (زر التبديل بين جلسات النظام) */}
            <SessionBadgeButton />

            {/* Shift Start/End Live Button (زر بدء وإنهاء الشفت والمؤقت الحي) */}
            <ShiftHeaderButton />

            {/* Connected Devices & Sessions Button (زر الجلسات المتصلة) */}
            <button
              type="button"
              onClick={() => setIsActiveSessionsModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer shadow-xs whitespace-nowrap"
              title="إدارة الأجهزة والجلسات المتصلة"
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">الجلسات</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                {deviceSessions.length}
              </span>
            </button>

            {/* Device Mode Toggle */}
            <button
              type="button"
              onClick={() => updateSettings({ deviceMode: isMobile ? 'desktop' : 'mobile' })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer shadow-xs whitespace-nowrap ${
                isMobile
                  ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500'
                  : 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500'
              }`}
              title={isMobile ? 'التبديل إلى وضع الحاسبة' : 'التبديل إلى وضع الهاتف'}
            >
              {isMobile ? (
                <>
                  <Smartphone className="w-3.5 h-3.5 text-white shrink-0" />
                  <span>وضع الهاتف</span>
                </>
              ) : (
                <>
                  <Monitor className="w-3.5 h-3.5 text-white shrink-0" />
                  <span>وضع الحاسبة</span>
                </>
              )}
            </button>

            {/* Desktop Layout Mode Switcher */}
            {!isMobile && (
              <button
                type="button"
                onClick={() => updateSettings({ desktopLayout: settings.desktopLayout === 'full' ? 'partial' : 'full' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer whitespace-nowrap ${
                  settings.desktopLayout === 'full'
                    ? 'bg-indigo-600/30 border-indigo-400/60 text-indigo-200 hover:bg-indigo-600/40'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
                title={
                  settings.desktopLayout === 'full'
                    ? 'التبديل إلى وضع التبويبات'
                    : 'التبديل إلى الوضع الكامل'
                }
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                <span>{settings.desktopLayout === 'full' ? 'الوضع الكامل' : 'وضع التبويبات'}</span>
              </button>
            )}

            {/* Theme Switcher Button (فاتح / داكن) */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer shadow-xs whitespace-nowrap ${
                theme === 'dark'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                  : 'bg-sky-500/15 border-sky-400/40 text-sky-200 hover:bg-sky-500/25'
              }`}
              title={theme === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
            >
              {theme === 'dark' ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>داكن</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
                  <span>فاتح</span>
                </>
              )}
            </button>

            {/* Cloud User Account & Sync Status & Logout */}
            {currentUser ? (
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap">
                <div 
                  className={`flex items-center gap-1.5 ${isCloudConnected ? 'text-emerald-400' : 'text-amber-400'}`} 
                  title={isCloudConnected ? 'الحساب متصل سحابياً مع السيرفر والأجهزة الأخرى' : 'العمل بالذاكرة المحلية (أوفلاين) ويُزامن تلقائياً عند توفر الإنترنت'}
                >
                  {isCloudConnected ? <Cloud className="w-3.5 h-3.5 shrink-0" /> : <WifiOff className="w-3.5 h-3.5 shrink-0" />}
                  <span className="text-[11px] font-bold hidden xl:inline">
                    {isCloudConnected ? 'سحابي متصل' : 'محلي (أوفلاين)'}
                  </span>
                </div>
                
                <span className="font-bold text-slate-200 border-r border-slate-700 pr-2">
                  {currentUser.displayName || currentUser.email?.split('@')[0]}
                </span>

                <button
                  type="button"
                  onClick={logout}
                  className="p-1 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded transition cursor-pointer"
                  title="تسجيل الخروج والعودة لشاشة الدخول"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {onOpenAuth && (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 transition cursor-pointer shadow-xs whitespace-nowrap"
                    title="تسجيل الدخول إلى حسابك السحابي"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>تسجيل الدخول</span>
                  </button>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Second Row: التفاصيل والإحصائيات السريعة */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none text-xs pt-1 border-t border-slate-800/80">
          
          {/* Today Sales */}
          <div className="bg-slate-800/90 border border-slate-700/70 rounded-lg px-3 py-1.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
            <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">مبيعات اليوم ({todayInvoices.length} قائمة)</span>
              <span className="font-bold text-white text-xs">{formatMoney(todaySalesTotal)}</span>
            </div>
          </div>

          {/* Today Profit (للأدمن والمصرح لهم فقط) */}
          {hasPermission('canViewReports') && (
            <div className="bg-slate-800/90 border border-slate-700/70 rounded-lg px-3 py-1.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
              <div className="w-6 h-6 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">أرباح اليوم الصافية</span>
                <span className="font-bold text-emerald-400 text-xs">{formatMoney(todayProfitTotal)}</span>
              </div>
            </div>
          )}

          {/* Total Market Debt (للأدمن والمشرف) */}
          {hasPermission('canViewCustomers') && (
            <div className="bg-slate-800/90 border border-slate-700/70 rounded-lg px-3 py-1.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
              <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">ديون السوق (البيع الآجل)</span>
                <span className="font-bold text-amber-300 text-xs">{formatMoney(totalMarketDebt)}</span>
              </div>
            </div>
          )}

          {/* Low Stock Warning */}
          {lowStockCount > 0 && (
            <div className="bg-rose-950/50 border border-rose-800/60 rounded-lg px-3 py-1.5 flex items-center gap-2 text-rose-200 shrink-0 whitespace-nowrap">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="text-xs font-bold">{lowStockCount} مواد قاربت على النفاد بالمخزن</span>
            </div>
          )}
        </div>

      </div>

      {/* Real-time Sync Status Notification Banner */}
      {syncNotice && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between border-t border-emerald-500 shadow-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0 animate-pulse" />
            <span>{syncNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncNotice(null)}
            className="text-emerald-200 hover:text-white px-2 py-0.5 rounded cursor-pointer text-sm font-black"
            title="إغلاق التنبيه"
          >
            ✕
          </button>
        </div>
      )}

      {/* Active Sessions Modal */}
      <ActiveSessionsModal
        isOpen={isActiveSessionsModalOpen}
        onClose={() => setIsActiveSessionsModalOpen(false)}
      />
    </header>
  );
};
