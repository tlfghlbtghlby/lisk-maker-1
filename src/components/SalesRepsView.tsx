import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { SalesRep, Invoice } from '../types';
import { 
  Users, 
  UserPlus, 
  Percent, 
  Phone, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  FileText, 
  Package, 
  Eye, 
  EyeOff, 
  Pencil, 
  Trash2, 
  Check, 
  X, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  ChevronDown, 
  Briefcase,
  Sparkles,
  ShieldAlert,
  ArrowUpDown,
  Clock
} from 'lucide-react';

interface SalesRepsViewProps {
  onViewInvoice?: (invoice: Invoice) => void;
}

export const SalesRepsView: React.FC<SalesRepsViewProps> = ({ onViewInvoice }) => {
  const { 
    settings, 
    updateSettings, 
    invoices, 
    formatMoney, 
    addSalesRep, 
    updateSalesRep, 
    deleteSalesRep,
    sessionRole
  } = useApp();

  const reps: SalesRep[] = settings.salesReps || [];

  // Filter states
  const [selectedRepId, setSelectedRepId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'last_month' | 'all' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'invoices' | 'profiles'>('products');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRep, setEditingRep] = useState<SalesRep | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    commissionRate: 5,
    commissionType: (settings.repCommissionDefaultType || 'percentage_profit') as 'percentage_profit' | 'percentage_sales',
    showOnInvoice: settings.defaultShowRepOnInvoice ?? true,
    notes: '',
    isActive: true,
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Open modal for new
  const handleOpenNewModal = () => {
    setEditingRep(null);
    setFormData({
      name: '',
      phone: '',
      commissionRate: 5,
      commissionType: settings.repCommissionDefaultType || 'percentage_profit',
      showOnInvoice: settings.defaultShowRepOnInvoice ?? true,
      notes: '',
      isActive: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEditModal = (rep: SalesRep) => {
    setEditingRep(rep);
    setFormData({
      name: rep.name,
      phone: rep.phone,
      commissionRate: rep.commissionRate,
      commissionType: rep.commissionType || 'percentage_profit',
      showOnInvoice: rep.showOnInvoice ?? true,
      notes: rep.notes || '',
      isActive: rep.isActive ?? true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveRep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('يرجى إدخال اسم المندوب');
      return;
    }
    if (formData.commissionRate < 0 || formData.commissionRate > 100) {
      setFormError('نسبة المندوب يجب أن تكون بين 0% و 100%');
      return;
    }

    if (editingRep) {
      await updateSalesRep(editingRep.id, {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        commissionRate: Number(formData.commissionRate),
        commissionType: formData.commissionType,
        showOnInvoice: formData.showOnInvoice,
        notes: formData.notes.trim(),
        isActive: formData.isActive,
      });
    } else {
      await addSalesRep({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        commissionRate: Number(formData.commissionRate),
        commissionType: formData.commissionType,
        showOnInvoice: formData.showOnInvoice,
        notes: formData.notes.trim(),
        isActive: formData.isActive,
      });
    }

    setIsModalOpen(false);
  };

  const handleDeleteRep = async (rep: SalesRep) => {
    if (confirm(`هل أنت متأكد من حذف المندوب (${rep.name})؟ لن تتأثر الفواتير السابقة.`)) {
      await deleteSalesRep(rep.id);
      if (selectedRepId === rep.id) {
        setSelectedRepId('all');
      }
    }
  };

  // Date filtering logic
  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (dateFilter === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (dateFilter === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day; // Sunday start
      start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (dateFilter === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (dateFilter === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (dateFilter === 'custom' && customStartDate) {
      start = new Date(customStartDate + 'T00:00:00');
      end = customEndDate ? new Date(customEndDate + 'T23:59:59') : new Date();
    }

    return { start, end };
  }, [dateFilter, customStartDate, customEndDate]);

  // Filtered invoices for sales reps
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Must have a sales rep assigned (or if we filter by rep)
      if (!inv.salesRepId) return false;
      if (selectedRepId !== 'all' && inv.salesRepId !== selectedRepId) return false;

      // Filter returned invoices
      if (inv.status === 'returned') return false;

      // Date check
      if (dateRange.start) {
        const invDate = new Date(inv.date);
        if (invDate < dateRange.start) return false;
        if (dateRange.end && invDate > dateRange.end) return false;
      }

      return true;
    });
  }, [invoices, selectedRepId, dateRange]);

  // KPI Calculations
  const metrics = useMemo(() => {
    let totalSales = 0;
    let totalCost = 0;
    let totalGrossProfit = 0;
    let totalRepCommission = 0;
    let totalStoreNetProfit = 0;

    filteredInvoices.forEach(inv => {
      const invTotal = inv.total || 0;
      const invCost = inv.totalCost || 0;
      const rawProfit = Math.max(0, invTotal - invCost - (inv.discount || 0));

      totalSales += invTotal;
      totalCost += invCost;
      totalGrossProfit += rawProfit;

      const comm = inv.salesRepCommission !== undefined 
        ? inv.salesRepCommission 
        : 0;
      const storeNet = inv.storeNetProfit !== undefined 
        ? inv.storeNetProfit 
        : Math.max(0, rawProfit - comm);

      totalRepCommission += comm;
      totalStoreNetProfit += storeNet;
    });

    return {
      invoicesCount: filteredInvoices.length,
      totalSales,
      totalCost,
      totalGrossProfit,
      totalRepCommission,
      totalStoreNetProfit,
    };
  }, [filteredInvoices]);

  // Products sold by the selected rep(s) across the month/period
  const soldProductsList = useMemo(() => {
    const productMap = new Map<string, {
      productId: string;
      code: string;
      name: string;
      unit: string;
      totalQty: number;
      totalSales: number;
      totalCost: number;
      totalGrossProfit: number;
      repCommission: number;
      storeNetProfit: number;
    }>();

    filteredInvoices.forEach(inv => {
      // Find rep commission rate & type from settings if stored in invoice or fallback
      const rep = reps.find(r => r.id === inv.salesRepId);
      const repRate = rep ? rep.commissionRate : 0;
      const repType = rep?.commissionType || settings.repCommissionDefaultType || 'percentage_profit';

      (inv.items || []).forEach(item => {
        const returnedQty = item.returnedQuantity || 0;
        const netQty = Math.max(0, item.quantity - returnedQty);
        if (netQty <= 0) return;

        const lineSales = Math.round(netQty * item.unitPrice);
        const lineCost = Math.round(netQty * (item.costPrice || 0));
        const lineGrossProfit = Math.max(0, lineSales - lineCost);

        let lineRepComm = 0;
        if (repRate > 0) {
          if (repType === 'percentage_sales') {
            lineRepComm = Math.round((lineSales * repRate) / 100);
          } else {
            lineRepComm = Math.round((lineGrossProfit * repRate) / 100);
          }
        }
        const lineStoreProfit = Math.max(0, lineGrossProfit - lineRepComm);

        const key = item.productId || item.name || item.productName;
        const existing = productMap.get(key);

        if (existing) {
          existing.totalQty += netQty;
          existing.totalSales += lineSales;
          existing.totalCost += lineCost;
          existing.totalGrossProfit += lineGrossProfit;
          existing.repCommission += lineRepComm;
          existing.storeNetProfit += lineStoreProfit;
        } else {
          productMap.set(key, {
            productId: item.productId,
            code: item.code || '',
            name: item.name || item.productName || 'مادة',
            unit: item.unit || 'قطعة',
            totalQty: netQty,
            totalSales: lineSales,
            totalCost: lineCost,
            totalGrossProfit: lineGrossProfit,
            repCommission: lineRepComm,
            storeNetProfit: lineStoreProfit,
          });
        }
      });
    });

    const list = Array.from(productMap.values());

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return list.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
    }

    return list.sort((a, b) => b.totalSales - a.totalSales);
  }, [filteredInvoices, reps, settings.repCommissionDefaultType, searchQuery]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['المادة', 'الكود', 'الوحدة', 'الكمية المباعة', 'إجمالي المبيعات', 'تكلفة الشراء', 'أرباح المندوب', 'أرباح المالك'];
    const rows = soldProductsList.map(p => [
      `"${p.name}"`,
      `"${p.code}"`,
      `"${p.unit}"`,
      p.totalQty,
      p.totalSales,
      p.totalCost,
      p.repCommission,
      p.storeNetProfit,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `تقرير_مبيعات_المندوبين_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedRepObj = reps.find(r => r.id === selectedRepId);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header & Activation Check */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0 shadow-2xs">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                مبيعات وأرباح المندوبين
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                {reps.length} مندوب مسجل
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              متابعة المواد المباعة بواسطة كل مندوب على طول الشهر وحساب أرباح المالك وعمولات المندوبين بدقة.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={soldProductsList.length === 0}
            className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>تصدير Excel (CSV)</span>
          </button>

          <button
            type="button"
            onClick={handleOpenNewModal}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة مندوب جديد</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Representative Selector & Date Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Rep Selector */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-bold text-slate-700 shrink-0">المندوب:</span>
            <div className="relative flex-1 max-w-xs">
              <select
                value={selectedRepId}
                onChange={(e) => setSelectedRepId(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">جميع المندوبين ({reps.length})</option>
                {reps.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.commissionRate}% {r.commissionType === 'percentage_sales' ? 'مبيعات' : 'أرباح'}) {r.isActive === false ? '[معطل]' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {selectedRepObj && (
              <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span>{selectedRepObj.phone || 'بدون هاتف'}</span>
                <span className="mx-1 text-slate-300">|</span>
                <Percent className="w-3.5 h-3.5 text-indigo-600" />
                <span>النسبة: {selectedRepObj.commissionRate}%</span>
                <span className="mx-1 text-slate-300">|</span>
                <span>{selectedRepObj.showOnInvoice ? 'يظهر بالقائمة' : 'مخفي بالقائمة'}</span>
              </div>
            )}
          </div>

          {/* Date Range Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto bg-slate-100 p-1 rounded-xl scrollbar-none">
            <button
              type="button"
              onClick={() => setDateFilter('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                dateFilter === 'month'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              هذا الشهر
            </button>

            <button
              type="button"
              onClick={() => setDateFilter('last_month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                dateFilter === 'last_month'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الشهر الماضي
            </button>

            <button
              type="button"
              onClick={() => setDateFilter('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                dateFilter === 'week'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              آخر 7 أيام
            </button>

            <button
              type="button"
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                dateFilter === 'today'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              اليوم
            </button>

            <button
              type="button"
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                dateFilter === 'all'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              كل الأوقات
            </button>

            <button
              type="button"
              onClick={() => setDateFilter('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                dateFilter === 'custom'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              تاريخ مخصص
            </button>
          </div>
        </div>

        {dateFilter === 'custom' && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <span>من:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <span>إلى:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards: Sales, Owner Profit, Rep Commission, Invoices */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* أرباح المالك الصافية */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-100">أرباح المالك الصافية</span>
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-200" />
            </div>
          </div>
          <div className="text-2xl font-black mt-2 tracking-tight">
            {formatMoney(metrics.totalStoreNetProfit)}
          </div>
          <div className="text-[11px] text-emerald-100/90 mt-1 flex items-center gap-1">
            <span>صافي ربح المحل بعد خصم عمولات المندوب</span>
          </div>
        </div>

        {/* أرباح وعمولات المندوب */}
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-100">أرباح وعمولة المندوب</span>
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Percent className="w-4 h-4 text-indigo-200" />
            </div>
          </div>
          <div className="text-2xl font-black mt-2 tracking-tight">
            {formatMoney(metrics.totalRepCommission)}
          </div>
          <div className="text-[11px] text-indigo-100/90 mt-1 flex items-center gap-1">
            <span>المبلغ المستحق للمندوب حسب نسبته المحددة</span>
          </div>
        </div>

        {/* إجمالي المبيعات */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي المبيعات (القوائم)</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
            {formatMoney(metrics.totalSales)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            إجمالي مبالغ القوائم المباعة بواسطة المندوب
          </div>
        </div>

        {/* عدد القوائم */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">عدد القوائم الصادرة</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
            {metrics.invoicesCount} قائمة
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            قائمة تم تدوين بيعها بواسطة المندوب
          </div>
        </div>
      </div>

      {/* Sub Tabs: Products Sold, Invoices, Profiles */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/70 p-3 sm:p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSubTab('products')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'products'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>المواد المباعة وأرباحها ({soldProductsList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('invoices')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'invoices'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>فواتير وقوائم المندوب ({filteredInvoices.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('profiles')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'profiles'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>إدارة ملفات المندوبين ({reps.length})</span>
            </button>
          </div>

          {activeSubTab === 'products' && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في المواد المباعة..."
                className="w-full pl-3 pr-9 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
          )}
        </div>

        {/* Sub Tab 1: Products Sold with Owner & Rep Profit */}
        {activeSubTab === 'products' && (
          <div className="p-4 sm:p-6">
            {soldProductsList.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Package className="w-12 h-12 mx-auto stroke-1 text-slate-300 mb-2" />
                <div className="text-sm font-bold text-slate-700">لا توجد مواد مباعة مسجلة لهذا المندوب في هذه الفترة</div>
                <div className="text-xs text-slate-500 mt-1">
                  عند إتمام أي قائمة جديدة واختيار هذا المندوب، ستظهر المواد وأرباحها هنا مباشرة.
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">#</th>
                      <th className="py-3 px-3">اسم المادة</th>
                      <th className="py-3 px-3 text-center">الكمية المباعة</th>
                      <th className="py-3 px-3 text-center">إجمالي المبيعات</th>
                      <th className="py-3 px-3 text-center">تكلفة الشراء</th>
                      <th className="py-3 px-3 text-center text-indigo-700 bg-indigo-50/50">أرباح المندوب</th>
                      <th className="py-3 px-3 text-center text-emerald-700 bg-emerald-50/50">أرباح المالك الصافية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold">
                    {soldProductsList.map((prod, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <div className="text-slate-900 font-black">{prod.name}</div>
                          {prod.code && <div className="text-[10px] text-slate-500 font-mono">باركود: {prod.code}</div>}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono">
                            {prod.totalQty} {prod.unit}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-800">
                          {formatMoney(prod.totalSales)}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-500">
                          {formatMoney(prod.totalCost)}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-black text-indigo-700 bg-indigo-50/30">
                          {formatMoney(prod.repCommission)}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-black text-emerald-700 bg-emerald-50/30">
                          {formatMoney(prod.storeNetProfit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                    <tr>
                      <td colSpan={2} className="py-3 px-3">المجموع الكلي:</td>
                      <td className="py-3 px-3 text-center font-mono">
                        {soldProductsList.reduce((s, p) => s + p.totalQty, 0)} قطعة
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        {formatMoney(soldProductsList.reduce((s, p) => s + p.totalSales, 0))}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600">
                        {formatMoney(soldProductsList.reduce((s, p) => s + p.totalCost, 0))}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-indigo-800 bg-indigo-100/50">
                        {formatMoney(soldProductsList.reduce((s, p) => s + p.repCommission, 0))}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-emerald-800 bg-emerald-100/50">
                        {formatMoney(soldProductsList.reduce((s, p) => s + p.storeNetProfit, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Sub Tab 2: Invoices Breakdown */}
        {activeSubTab === 'invoices' && (
          <div className="p-4 sm:p-6">
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FileText className="w-12 h-12 mx-auto stroke-1 text-slate-300 mb-2" />
                <div className="text-sm font-bold text-slate-700">لا توجد فواتير صادرة بواسطة هذا المندوب في هذه الفترة</div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">رقم القائمة</th>
                      <th className="py-3 px-3">التاريخ</th>
                      <th className="py-3 px-3">الزبون</th>
                      <th className="py-3 px-3">المندوب</th>
                      <th className="py-3 px-3 text-center">المبلغ الكلي</th>
                      <th className="py-3 px-3 text-center text-indigo-700 bg-indigo-50/50">عمولة المندوب</th>
                      <th className="py-3 px-3 text-center text-emerald-700 bg-emerald-50/50">أرباح المالك</th>
                      <th className="py-3 px-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold">
                    {filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 font-mono font-black text-slate-900">{inv.invoiceNumber}</td>
                        <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                          {inv.date ? new Date(inv.date).toLocaleDateString('ar-EG') : '-'}
                        </td>
                        <td className="py-3 px-3 text-slate-800">{inv.customerName}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 text-[11px] font-bold border border-indigo-200">
                            {inv.salesRepName || 'مندوب'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-black text-slate-900">
                          {formatMoney(inv.total)}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-black text-indigo-700 bg-indigo-50/30">
                          {formatMoney(inv.salesRepCommission || 0)}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-black text-emerald-700 bg-emerald-50/30">
                          {formatMoney(inv.storeNetProfit ?? (inv.netProfit - (inv.salesRepCommission || 0)))}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {onViewInvoice && (
                            <button
                              type="button"
                              onClick={() => onViewInvoice(inv)}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1 mx-auto cursor-pointer"
                              title="معاينة وطباعة الفاتورة"
                            >
                              <Printer className="w-3.5 h-3.5 text-slate-500" />
                              <span>معاينة</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Sub Tab 3: Sales Rep Profiles Management */}
        {activeSubTab === 'profiles' && (
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">ملفات المندوبين ونسب الأرباح</h3>
                <p className="text-xs text-slate-500">حدد نسبة المندوب ورقم هاتفه وإمكانية إظهار أو إخفاء اسمه على القائمة المطبوعة.</p>
              </div>
              <button
                type="button"
                onClick={handleOpenNewModal}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>إضافة مندوب جديد</span>
              </button>
            </div>

            {reps.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl p-6">
                <Users className="w-12 h-12 mx-auto stroke-1 text-slate-300 mb-2" />
                <div className="text-sm font-bold text-slate-700">لم يتم تسجيل أي مندوب بعد</div>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  أضف مندوبي المبيعات لتمكين اختيارهم عند إتمام القوائم وحساب عمولاتهم تلقائياً.
                </p>
                <button
                  type="button"
                  onClick={handleOpenNewModal}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition cursor-pointer"
                >
                  إضافة أول مندوب الآن
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reps.map((rep) => {
                  const repInvoices = invoices.filter(i => i.salesRepId === rep.id && i.status !== 'returned');
                  const repTotalSales = repInvoices.reduce((s, i) => s + (i.total || 0), 0);
                  const repTotalCommission = repInvoices.reduce((s, i) => s + (i.salesRepCommission || 0), 0);
                  const repOwnerProfit = repInvoices.reduce((s, i) => s + (i.storeNetProfit ?? (i.netProfit - (i.salesRepCommission || 0))), 0);

                  return (
                    <div 
                      key={rep.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-indigo-300 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-black text-sm">
                              {rep.name.substring(0, 1)}
                            </div>
                            <div>
                              <div className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                                <span>{rep.name}</span>
                                {rep.isActive === false && (
                                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                    معطل
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{rep.phone || 'بدون هاتف'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(rep)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                              title="تعديل ملف المندوب"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRep(rep)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="حذف المندوب"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Commission Rate & Invoice Printing Setting */}
                        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-50 p-2 rounded-xl">
                            <span className="text-[10px] text-slate-500 block">نسبة العمولة:</span>
                            <span className="font-black text-indigo-700 text-sm">
                              {rep.commissionRate}%
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {rep.commissionType === 'percentage_sales' ? 'من المبيعات' : 'من صافي الربح'}
                            </span>
                          </div>

                          <div className="bg-slate-50 p-2 rounded-xl">
                            <span className="text-[10px] text-slate-500 block">القائمة المطبوعة:</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {rep.showOnInvoice ? (
                                <>
                                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="font-bold text-emerald-800 text-[11px]">يظهر اسمه</span>
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="font-bold text-slate-500 text-[11px]">مخفي</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Financial Summary */}
                        <div className="mt-3 bg-indigo-50/40 rounded-xl p-2.5 border border-indigo-100 space-y-1 text-xs">
                          <div className="flex items-center justify-between text-slate-600">
                            <span>إجمالي مبيعاته:</span>
                            <span className="font-mono font-bold text-slate-800">{formatMoney(repTotalSales)}</span>
                          </div>
                          <div className="flex items-center justify-between text-indigo-700 font-bold">
                            <span>أرباح وعمولات المندوب:</span>
                            <span className="font-mono font-black">{formatMoney(repTotalCommission)}</span>
                          </div>
                          <div className="flex items-center justify-between text-emerald-700 font-bold">
                            <span>أرباح المالك من هذا المندوب:</span>
                            <span className="font-mono font-black">{formatMoney(repOwnerProfit)}</span>
                          </div>
                        </div>

                        {rep.notes && (
                          <div className="text-[11px] text-slate-500 mt-2 italic bg-slate-50 p-2 rounded-lg">
                            {rep.notes}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {repInvoices.length} قائمة منجزة
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRepId(rep.id);
                            setActiveSubTab('products');
                          }}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                        >
                          عرض المواد المباعة ←
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Add / Edit Sales Rep */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  {editingRep ? `تعديل ملف المندوب (${editingRep.name})` : 'إضافة مندوب مبيعات جديد'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveRep} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم المندوب <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: أحمد سعد، محمد جاسم..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    رقم الهاتف
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="077XXXXXXXX"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نسبة المندوب (%) <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      required
                      value={formData.commissionRate}
                      onChange={(e) => setFormData({ ...formData, commissionRate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono font-bold"
                    />
                    <Percent className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              {/* Commission Calculation Mode */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  طريقة احتساب النسبة
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                    formData.commissionType === 'percentage_profit'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500/30'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="commissionType"
                      checked={formData.commissionType === 'percentage_profit'}
                      onChange={() => setFormData({ ...formData, commissionType: 'percentage_profit' })}
                      className="accent-indigo-600"
                    />
                    <div>
                      <div>من صافي الربح</div>
                      <div className="text-[10px] text-slate-500 font-normal">تقتطع النسبة من هامش الربح فقط</div>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                    formData.commissionType === 'percentage_sales'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500/30'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="commissionType"
                      checked={formData.commissionType === 'percentage_sales'}
                      onChange={() => setFormData({ ...formData, commissionType: 'percentage_sales' })}
                      className="accent-indigo-600"
                    />
                    <div>
                      <div>من إجمالي المبيعات</div>
                      <div className="text-[10px] text-slate-500 font-normal">تقتطع النسبة من إجمالي الفاتورة</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Show / Hide on Printed Invoice */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900">إظهار اسم المندوب في القائمة المطبوعة</div>
                    <div className="text-[11px] text-slate-500">
                      عند التفعيل، سيظهر بند (المندوب: {formData.name || 'اسم المندوب'}) في ترويسة القائمة المطبوعة للزبون.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showOnInvoice}
                      onChange={(e) => setFormData({ ...formData, showOnInvoice: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                  <div>
                    <div className="text-xs font-bold text-slate-900">حالة المندوب (نشط)</div>
                    <div className="text-[11px] text-slate-500">
                      إتاحة اسم المندوب في قائمة البيع بنقطة البيع.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظات إضافية
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="منطقة التوزيع، أيام العمل، أية شروط خاصة..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition cursor-pointer"
                >
                  {editingRep ? 'حفظ التعديلات' : 'إضافة المندوب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
