import React, { useState, useEffect, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Navigation, TabType } from './components/Navigation';
import { POSView } from './components/POSView';
import { InventoryView } from './components/InventoryView';
import { InvoicesView } from './components/InvoicesView';
import { CustomersView } from './components/CustomersView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { ShiftsView } from './components/ShiftsView';
import { SalesRepsView } from './components/SalesRepsView';
import { ProductModal } from './components/ProductModal';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { SessionSwitchModal } from './components/SessionSwitchModal';
import { StartShiftModal } from './components/StartShiftModal';
import { EndShiftModal } from './components/EndShiftModal';
import { ShiftDetailsModal } from './components/ShiftDetailsModal';
import { AuthView } from './components/AuthView';
import { SplashScreen } from './components/SplashScreen';
import { CustomerPriceChecker } from './components/CustomerPriceChecker';
import { Product, Invoice } from './types';
import { 
  Boxes, 
  FileText, 
  Users, 
  BarChart3, 
  Settings, 
  ArrowRight,
  Clock,
  Briefcase
} from 'lucide-react';

const MainContent: React.FC = () => {
  const { 
    settings, 
    currentUser, 
    authLoading, 
    sessionRole, 
    hasPermission, 
    activeShift,
    selectedShiftForDetails,
    setSelectedShiftForDetails
  } = useApp();
  const [isGuest, setIsGuest] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('pos');

  // إعادة التوجيه لشاشة المبيعات إذا تحولت الجلسة لقسم غير مصرح به
  useEffect(() => {
    const isTabPermitted = () => {
      switch (activeTab) {
        case 'pos': return hasPermission('canSell');
        case 'inventory': return hasPermission('canAccessInventory');
        case 'invoices': return hasPermission('canViewInvoices');
        case 'customers': return hasPermission('canViewCustomers');
        case 'reports': return hasPermission('canViewReports');
        case 'sales-reps': return !!settings.enableSalesReps && (hasPermission('canManageSalesReps') || sessionRole === 'admin' || sessionRole === 'supervisor');
        case 'shifts': return hasPermission('canAccessShifts');
        case 'settings': return hasPermission('canAccessSettings');
        default: return true;
      }
    };
    if (!isTabPermitted()) {
      setActiveTab('pos');
    }
  }, [sessionRole, activeTab, hasPermission]);

  const isMobile = settings.deviceMode === 'mobile';
  const isFullComputerMode = !isMobile && (settings.desktopLayout === 'full');
  
  // Product modal
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [initialBarcodeForNewProduct, setInitialBarcodeForNewProduct] = useState<string | undefined>(undefined);

  // Invoice print modal (للمعاينة اليدوية)
  const [invoiceToPrint, setInvoiceToPrint] = useState<Invoice | null>(null);

  // فاتورة الطباعة الصامتة المباشرة لتطبيق Electron
  const [directInvoice, setDirectInvoice] = useState<Invoice | null>(null);

  // قفل لمنع إرسال أمر الطباعة مرتين لنفس الفاتورة
  const isPrintingRef = useRef(false);

  // Settings initial tab
  const [settingsInitialTab, setSettingsInitialTab] = useState<'store' | 'quick-add' | 'pricing' | 'security' | 'sessions' | 'all'>('store');

  const handleOpenNewProduct = (initialBarcode?: string) => {
    setProductToEdit(null);
    setInitialBarcodeForNewProduct(initialBarcode);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setProductToEdit(prod);
    setIsProductModalOpen(true);
  };

  // معالجة إنشاء الفاتورة: إذا ضغط "حفظ فقط" لا يطبع، وإذا ضغط "حفظ وطباعة" يرسل أمراً واحداً فقط
  const handleInvoiceCreated = (invoice: Invoice, andPrint: boolean) => {
    if (!andPrint) {
      return;
    }

    if (settings.directPrintEnabled) {
      if (isPrintingRef.current) return;
      setInvoiceToPrint(null);
      setDirectInvoice(invoice);
    } else {
      setDirectInvoice(null);
      setInvoiceToPrint(invoice);
    }
  };

  // تنفيذ الطباعة الصامتة اللحظية المباشرة (دون أي انتظار زمني)
  useEffect(() => {
    if (!directInvoice || isPrintingRef.current) return;

    isPrintingRef.current = true;
    let isMounted = true;

    const executeSilentPrint = async () => {
      const paperSize = settings.printerPaperSize || (settings.printFormat === 'thermal' ? 'thermal80' : 'a4');
      const pageSize = paperSize === 'a4' ? 'A4' : paperSize === 'thermal58' ? '58mm' : '80mm';

      const electronBridge = (window as any).electronAPI || (window as any).electron;

      if (typeof window !== 'undefined' && electronBridge) {
        try {
          if (typeof electronBridge.printDirect === 'function') {
            await electronBridge.printDirect({
              silent: true,
              deviceName: (settings as any).selectedPrinterName || '',
              paperSize,
              pageSize,
            });
          } else if (typeof electronBridge.printSilent === 'function') {
            await electronBridge.printSilent({
              silent: true,
              deviceName: (settings as any).selectedPrinterName || '',
              paperSize,
              pageSize,
            });
          }
        } catch (err) {
          console.error('فشل في تنفيذ الطباعة اللحظية المباشرة:', err);
        } finally {
          if (isMounted) {
            setDirectInvoice(null);
            setTimeout(() => {
              isPrintingRef.current = false;
            }, 80);
          }
        }
      } else {
        console.warn('تطبيق Electron غير متاح، فتح نافذة الطباعة الافتراضية للمتصفح.');
        window.print();
        if (isMounted) {
          setDirectInvoice(null);
          isPrintingRef.current = false;
        }
      }
    };

    executeSilentPrint();

    return () => {
      isMounted = false;
    };
  }, [directInvoice, settings.printerPaperSize, settings.printFormat, (settings as any).selectedPrinterName]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white" dir="rtl">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="text-base font-bold">جاري تحميل نظام المبيعات والمخزن...</div>
        <div className="text-xs text-slate-400 mt-1">الربط والمزامنة السحابية</div>
      </div>
    );
  }

  if (!currentUser && !isGuest) {
    return (
      <AuthView
        onSuccess={() => setIsGuest(false)}
        onContinueAsGuest={() => setIsGuest(true)}
      />
    );
  }

  const getActiveTabTitle = () => {
    switch (activeTab) {
      case 'inventory': return 'جدول المخزون الكامل';
      case 'invoices': return 'سجل الفواتير والقوائم';
      case 'shifts': return 'إدارة وسجل الشفتات والورديات';
      case 'customers': return 'حسابات الديون والعملاء';
      case 'reports': return 'الأرباح والتقارير المالية';
      case 'sales-reps': return 'مبيعات وأرباح المندوبين';
      case 'settings': return 'الإعدادات العامة والنسخ الاحتياطي';
      default: return '';
    }
  };

  return (
    <div className={`min-h-screen flex flex-col bg-slate-100 dark:bg-[#070d18] text-slate-800 dark:text-slate-100 transition-colors duration-200 print:min-h-0 print:h-auto print:block print:bg-white ${isMobile ? 'selection:bg-amber-500' : 'selection:bg-amber-500 selection:text-slate-950'}`}>
      <Header 
        onOpenAuth={() => setIsGuest(false)}
      />

      {!isFullComputerMode && (
        <Navigation
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
        />
      )}

      <main className={`no-print flex-1 w-full mx-auto ${
        isMobile 
          ? 'max-w-2xl px-2.5 sm:px-4 py-3 sm:py-4' 
          : 'max-w-[1650px] px-3 sm:px-6 py-3 sm:py-4'
      }`}>
        
        {isFullComputerMode && activeTab !== 'pos' && (
          <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl flex items-center justify-between mb-4 shadow-sm border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="text-slate-400">أنت تتصفح حالياً:</span>
              <span className="text-emerald-400">{getActiveTabTitle()}</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('pos')}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة لشاشة البيع الرئيسية</span>
            </button>
          </div>
        )}

        {isFullComputerMode && activeTab === 'pos' && (
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 bg-white dark:bg-[#0b1728] p-2 sm:px-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs text-xs transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-blue-900 dark:text-amber-300 bg-blue-50 dark:bg-amber-950/60 border border-blue-200 dark:border-amber-500/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-amber-400"></span>
                <span>وضع الكمبيوتر الكامل</span>
              </span>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('inventory')}
                className="px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition flex items-center gap-1 cursor-pointer"
                title="عرض جدول المواد والمخزون الكامل"
              >
                <Boxes className="w-3.5 h-3.5 text-slate-500 dark:text-amber-400" />
                <span>المخزون الكامل</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('invoices')}
                className="px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition flex items-center gap-1 cursor-pointer"
                title="عرض سجل الفواتير والقوائم السابقة"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-amber-400" />
                <span>سجل الفواتير</span>
              </button>
              {hasPermission('canAccessShifts') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('shifts')}
                  className="px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition flex items-center gap-1 cursor-pointer"
                  title="عرض سجل الشفتات وساعات العمل"
                >
                  <Clock className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span>الشفتات</span>
                  {activeShift && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  )}
                </button>
              )}
              {!!settings.enableSalesReps && (hasPermission('canManageSalesReps') || sessionRole === 'admin' || sessionRole === 'supervisor') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('sales-reps')}
                  className="px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition flex items-center gap-1 cursor-pointer"
                  title="عرض مبيعات وأرباح المندوبين"
                >
                  <Briefcase className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span>المندوبين</span>
                  {settings.salesReps && settings.salesReps.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded font-bold">
                      {settings.salesReps.length}
                    </span>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('customers')}
                className="px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition flex items-center gap-1 cursor-pointer"
                title="عرض حسابات ديون العملاء والبيع الآجل"
              >
                <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>الديون والعملاء</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reports')}
                className="px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition flex items-center gap-1 cursor-pointer"
                title="عرض الأرباح والتقارير المالية"
              >
                <BarChart3 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>التقارير</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition flex items-center gap-1 cursor-pointer"
                title="فتح إعدادات النظام والنسخ الاحتياطي"
              >
                <Settings className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>الإعدادات</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'pos' && (
          <POSView
            onInvoiceCreated={handleInvoiceCreated}
            onOpenNewProduct={handleOpenNewProduct}
            onEditProduct={handleOpenEditProduct}
            onOpenSettings={() => setActiveTab('settings')}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            onOpenNewProduct={handleOpenNewProduct}
            onEditProduct={handleOpenEditProduct}
            onOpenQuickAdd={() => {
              setSettingsInitialTab('quick-add');
              setActiveTab('settings');
            }}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoicesView
            onViewInvoice={(inv) => setInvoiceToPrint(inv)}
          />
        )}

        {activeTab === 'shifts' && (
          <ShiftsView
            onViewInvoice={(inv) => setInvoiceToPrint(inv)}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersView
            onViewInvoice={(inv) => setInvoiceToPrint(inv)}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView />
        )}

        {activeTab === 'sales-reps' && (
          <SalesRepsView
            onViewInvoice={(inv) => setInvoiceToPrint(inv)}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView initialTab={settingsInitialTab} />
        )}
      </main>

      <ProductModal
        isOpen={isProductModalOpen}
        productToEdit={productToEdit}
        initialCode={initialBarcodeForNewProduct}
        onClose={() => {
          setIsProductModalOpen(false);
          setProductToEdit(null);
          setInitialBarcodeForNewProduct(undefined);
        }}
      />

      <InvoicePrintModal
        invoice={invoiceToPrint}
        onClose={() => setInvoiceToPrint(null)}
      />

      <SessionSwitchModal />

      <StartShiftModal />

      <EndShiftModal onNavigateToShifts={() => setActiveTab('shifts')} />

      <ShiftDetailsModal
        shift={selectedShiftForDetails}
        onClose={() => setSelectedShiftForDetails(null)}
        onViewInvoice={(inv) => setInvoiceToPrint(inv)}
      />

      {directInvoice && (
        <div
          id="direct-print-offscreen-container"
          aria-hidden="true"
          className="fixed -left-[9999px] -top-[9999px] opacity-0 pointer-events-none direct-print-offscreen print:opacity-100 print:pointer-events-auto print:static print:left-auto print:top-auto print:block"
        >
          <InvoicePrintModal
            invoice={directInvoice}
            onClose={() => setDirectInvoice(null)}
          />
        </div>
      )}
    </div>
  );
};

function isCustomerCheckerRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const mode = params.get('mode');
  const hash = window.location.hash.toLowerCase();
  return (
    view === 'price-checker' ||
    view === 'customer' ||
    view === 'scanner' ||
    mode === 'price-checker' ||
    hash.includes('price-checker') ||
    hash.includes('customer-scanner')
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const isCustomerView = isCustomerCheckerRoute();

  if (isCustomerView) {
    return <CustomerPriceChecker />;
  }

  // فحص مباشر لمعاملات الرابط لتحديد ما إذا كان الزائر زبوناً لمسح الأسعار
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  const isPriceChecker = searchParams?.get('view') === 'price-checker' || hash.includes('price-checker');
  const storeId = searchParams?.get('store') || null;

  // إذا كان الرابط هو رابط مدقق الأسعار للزبائن، يتم عرضه فوراً وبشكل مستقل تماماً
  if (isPriceChecker) {
    return <CustomerPriceChecker storeId={storeId} />;
  }

  return (
    <AppProvider>
      {showSplash ? (
        <SplashScreen onComplete={() => setShowSplash(false)} />
      ) : (
        <MainContent />
      )}
    </AppProvider>
  );
}
