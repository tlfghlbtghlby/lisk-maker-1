import React, { useState, useMemo } from 'react';
import { 
  X, 
  Printer, 
  Clock, 
  Receipt, 
  DollarSign, 
  TrendingUp, 
  Package, 
  Search, 
  User, 
  Calendar, 
  FileText,
  Eye,
  CheckCircle2,
  Hourglass,
  ArrowDownRight,
  Sparkles
} from 'lucide-react';
import { Shift, ShiftItemSold, Invoice } from '../types';
import { useApp } from '../context/AppContext';

interface ShiftDetailsModalProps {
  shift: Shift | null;
  onClose: () => void;
  onViewInvoice?: (invoice: Invoice) => void;
}

export const ShiftDetailsModal: React.FC<ShiftDetailsModalProps> = ({ 
  shift, 
  onClose,
  onViewInvoice 
}) => {
  const { invoices, formatMoney, settings } = useApp();
  const [activeTab, setActiveTab] = useState<'items' | 'stats' | 'invoices'>('items');
  const [searchItemQuery, setSearchItemQuery] = useState('');

  // جلب الفواتير المرتبطة بهذا الشفت
  const shiftInvoices = useMemo(() => {
    if (!shift) return [];
    return invoices.filter(inv => {
      if (inv.shiftId && inv.shiftId === shift.id) return true;
      if (!inv.shiftId && shift.startTime) {
        const invTime = new Date(inv.date).getTime();
        const start = new Date(shift.startTime).getTime();
        const end = shift.endTime ? new Date(shift.endTime).getTime() : Date.now();
        return invTime >= start && invTime <= end;
      }
      return false;
    });
  }, [shift, invoices]);

  // حساب المواد المبوعة إن لم تكن مخزنة (أو للشفت الجاري)
  const itemsSold: ShiftItemSold[] = useMemo(() => {
    if (!shift) return [];
    if (shift.itemsSold && shift.itemsSold.length > 0) {
      return shift.itemsSold;
    }
    // حسابها من الفواتير
    const itemsMap = new Map<string, ShiftItemSold>();
    shiftInvoices.forEach(inv => {
      if (inv.status === 'returned') return;
      (inv.items || []).forEach(item => {
        const key = item.productId || item.code || item.productName || 'unknown';
        const itemSales = item.total || (item.unitPrice * item.quantity);
        const itemCost = (item.costPrice || 0) * item.quantity;
        const itemProfit = itemSales - itemCost;

        const existing = itemsMap.get(key);
        if (existing) {
          existing.quantity += item.quantity;
          existing.totalSales += itemSales;
          existing.totalCost += itemCost;
          existing.totalProfit += itemProfit;
        } else {
          itemsMap.set(key, {
            productId: item.productId || key,
            productName: item.productName || (item as any).name || 'مادة',
            code: item.code || '',
            unit: item.unit || 'قطعة',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            costPrice: item.costPrice || 0,
            totalSales: itemSales,
            totalCost: itemCost,
            totalProfit: itemProfit,
          });
        }
      });
    });
    return Array.from(itemsMap.values()).sort((a, b) => b.totalSales - a.totalSales);
  }, [shift, shiftInvoices]);

  const filteredItems = useMemo(() => {
    if (!searchItemQuery.trim()) return itemsSold;
    const q = searchItemQuery.toLowerCase().trim();
    return itemsSold.filter(
      item =>
        item.productName.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q)
    );
  }, [itemsSold, searchItemQuery]);

  if (!shift) return null;

  // إحصائيات
  const totalSales = shift.totalSales || itemsSold.reduce((acc, i) => acc + i.totalSales, 0);
  const totalCost = shift.totalCost || itemsSold.reduce((acc, i) => acc + i.totalCost, 0);
  const totalProfit = shift.totalProfit !== undefined ? shift.totalProfit : (totalSales - totalCost);
  const totalPieces = itemsSold.reduce((acc, i) => acc + i.quantity, 0);
  const totalPaid = shift.totalPaid || 0;
  const totalRemaining = shift.totalRemaining || 0;

  // احتساب المدة
  const formatDuration = () => {
    const startMs = new Date(shift.startTime).getTime();
    const endMs = shift.endTime ? new Date(shift.endTime).getTime() : Date.now();
    const diffSec = Math.max(0, Math.floor((endMs - startMs) / 1000));
    const hours = Math.floor(diffSec / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);
    if (hours > 0) {
      return `${hours} ساعة و ${minutes} دقيقة`;
    }
    return `${minutes} دقيقة`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden text-right"
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white">
                  معلومات وتفاصيل شفت العمل #{shift.shiftNumber}
                </h3>
                {shift.status === 'active' ? (
                  <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>شفت نشط قيد العمل حالياً</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-slate-300 bg-slate-700/60 px-2.5 py-0.5 rounded-full border border-slate-600">
                    مكتمل ومغلق
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                كشف كامل بالمواد المبيوعة، مبالغ البيع، تكلفة الشراء وصافي الأرباح المحققة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
              title="طباعة تقرير الشفت"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">طباعة التقرير</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Info Bar: Time & Cashier */}
        <div className="bg-slate-100/80 border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-slate-700">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>البداية: <strong>{new Date(shift.startTime).toLocaleString('ar-IQ')}</strong></span>
            </div>
            {shift.endTime && (
              <div className="flex items-center gap-1.5 text-slate-700">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>الإغلاق: <strong>{new Date(shift.endTime).toLocaleString('ar-IQ')}</strong></span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
              <Hourglass className="w-3.5 h-3.5" />
              <span>المدة: {formatDuration()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-600">
            <User className="w-4 h-4 text-slate-500" />
            <span>المسؤول: <strong className="text-slate-900">{shift.openedBy?.name || 'الكاشير'}</strong></span>
          </div>
        </div>

        {/* 4 Main KPI Cards */}
        <div className="p-4 sm:p-5 bg-slate-50/50 border-b border-slate-200 shrink-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. إجمالي البيع */}
            <div className="bg-white border border-blue-200 rounded-xl p-3 shadow-2xs">
              <div className="flex items-center justify-between text-blue-700 text-xs font-bold mb-1">
                <span>إجمالي المبيعات</span>
                <DollarSign className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-base sm:text-lg font-black text-blue-950">
                {formatMoney(totalSales)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                <span>نقد: {formatMoney(totalPaid)}</span>
                <span className="text-amber-600">آجل: {formatMoney(totalRemaining)}</span>
              </div>
            </div>

            {/* 2. تكلفة المواد */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-600 text-xs font-bold mb-1">
                <span>تكلفة البضاعة المباعة</span>
                <Package className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-base sm:text-lg font-black text-slate-800">
                {formatMoney(totalCost)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                رأس مال المواد التي خرجت
              </div>
            </div>

            {/* 3. صافي الأرباح المحققة */}
            <div className="bg-white border border-emerald-300 rounded-xl p-3 shadow-2xs ring-1 ring-emerald-400/30">
              <div className="flex items-center justify-between text-emerald-700 text-xs font-bold mb-1">
                <span>صافي أرباح الشفت</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-base sm:text-lg font-black text-emerald-700">
                {formatMoney(totalProfit)}
              </div>
              <div className="text-[11px] text-emerald-600 mt-1 font-bold">
                هامش الربح: {totalSales > 0 ? `${((totalProfit / totalSales) * 100).toFixed(1)}%` : '0%'}
              </div>
            </div>

            {/* 4. عدد القوائم والقطع */}
            <div className="bg-white border border-purple-200 rounded-xl p-3 shadow-2xs">
              <div className="flex items-center justify-between text-purple-700 text-xs font-bold mb-1">
                <span>عدد القوائم والقطع</span>
                <Receipt className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-base sm:text-lg font-black text-purple-950">
                {shift.invoicesCount || shiftInvoices.length} قائمة
              </div>
              <div className="text-[11px] text-purple-700 mt-1 font-bold">
                إجمالي {totalPieces} قطعة مباعة
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Inside Modal */}
        <div className="flex items-center border-b border-slate-200 px-4 sm:px-6 bg-white shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`py-3 px-4 text-xs font-extrabold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'items'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>المواد المبيوعة في الشفت ({itemsSold.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`py-3 px-4 text-xs font-extrabold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'invoices'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>فواتير وقوائم الشفت ({shiftInvoices.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`py-3 px-4 text-xs font-extrabold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'stats'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>تفاصيل القاصة والملاحظات</span>
          </button>
        </div>

        {/* Tab 1: المواد المبيوعة */}
        {activeTab === 'items' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* Search items filter */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={searchItemQuery}
                  onChange={(e) => setSearchItemQuery(e.target.value)}
                  placeholder="بحث باسم المادة أو الباركود..."
                  className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                />
              </div>

              <div className="text-xs text-slate-500 font-bold">
                عرض {filteredItems.length} من أصل {itemsSold.length} مادة
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <div className="text-sm font-bold text-slate-600">لا توجد مواد مبيوعة مطابقة</div>
                <div className="text-xs text-slate-400 mt-1">لم يتم تسجيل مبيعات في هذا الشفت أو لا تطابق البحث</div>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">اسم المادة</th>
                      <th className="py-2.5 px-3">الكود</th>
                      <th className="py-2.5 px-3 text-center">الكمية المباعة</th>
                      <th className="py-2.5 px-3">إجمالي البيع</th>
                      <th className="py-2.5 px-3">إجمالي التكلفة</th>
                      <th className="py-2.5 px-3 text-emerald-700 font-black">صافي الربح</th>
                      <th className="py-2.5 px-3 text-center">% الربح</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.map((item, idx) => {
                      const profitRatio = item.totalSales > 0 
                        ? ((item.totalProfit / item.totalSales) * 100).toFixed(1)
                        : '0';

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 text-slate-400 text-[11px]">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-extrabold text-slate-900">
                            {item.productName}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                            {item.code || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-black text-slate-800">
                            <span className="bg-slate-100 px-2 py-0.5 rounded-md">
                              {item.quantity} {item.unit}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-blue-950">
                            {formatMoney(item.totalSales)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-medium">
                            {formatMoney(item.totalCost)}
                          </td>
                          <td className="py-2.5 px-3 font-black text-emerald-700">
                            +{formatMoney(item.totalProfit)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-black">
                              {profitRatio}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Footer Total Row */}
                  <tfoot className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-300">
                    <tr>
                      <td colSpan={3} className="py-3 px-3 text-right">المجموع الكلي للمواد:</td>
                      <td className="py-3 px-3 text-center text-sm font-black text-indigo-700">
                        {totalPieces} قطعة
                      </td>
                      <td className="py-3 px-3 text-blue-950 font-black">
                        {formatMoney(totalSales)}
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        {formatMoney(totalCost)}
                      </td>
                      <td className="py-3 px-3 text-emerald-800 font-black text-sm">
                        +{formatMoney(totalProfit)}
                      </td>
                      <td className="py-3 px-3 text-center font-black text-emerald-700">
                        {totalSales > 0 ? `${((totalProfit / totalSales) * 100).toFixed(1)}%` : '0%'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: فواتير وقوائم الشفت */}
        {activeTab === 'invoices' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {shiftInvoices.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <div className="text-sm font-bold text-slate-600">لا توجد فواتير مسجلة في هذا الشفت</div>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">رقم القائمة</th>
                      <th className="py-2.5 px-3">التوقيت</th>
                      <th className="py-2.5 px-3">اسم الزبون</th>
                      <th className="py-2.5 px-3">نوع البيع</th>
                      <th className="py-2.5 px-3">المبلغ الإجمالي</th>
                      <th className="py-2.5 px-3">المسدد</th>
                      <th className="py-2.5 px-3">المتبقي (آجل)</th>
                      <th className="py-2.5 px-3 text-emerald-700">صافي الربح</th>
                      <th className="py-2.5 px-3 text-center">معاينة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shiftInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {new Date(inv.date).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">
                          {inv.customerName}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            inv.type === 'direct' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {inv.type === 'direct' ? 'نقدي مباشر' : 'بيع آجل'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-black text-slate-900">
                          {formatMoney(inv.total)}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-700">
                          {formatMoney(inv.paidAmount)}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-amber-700">
                          {inv.remainingAmount > 0 ? formatMoney(inv.remainingAmount) : '-'}
                        </td>
                        <td className="py-2.5 px-3 font-black text-emerald-700">
                          +{formatMoney(inv.netProfit)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {onViewInvoice && (
                            <button
                              type="button"
                              onClick={() => onViewInvoice(inv)}
                              className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition cursor-pointer"
                              title="معاينة وطباعة الفاتورة"
                            >
                              <Eye className="w-4 h-4 mx-auto" />
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

        {/* Tab 3: تفاصيل القاصة والملاحظات */}
        {activeTab === 'stats' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cash drawer summary */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>حركة القاصة والنقدية في الشفت</span>
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                    <span className="text-slate-500">النقد الافتتاحي (صرافة البداية):</span>
                    <span className="font-bold text-slate-800">{formatMoney(shift.startingCash || 0)}</span>
                  </div>

                  <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                    <span className="text-slate-500">إجمالي النقد المقبوض من المبيعات:</span>
                    <span className="font-extrabold text-emerald-700">+{formatMoney(totalPaid)}</span>
                  </div>

                  <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                    <span className="text-slate-500">مجموع النقد المتوقع في الدرج:</span>
                    <span className="font-black text-indigo-950 text-sm">
                      {formatMoney((shift.startingCash || 0) + totalPaid)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-500">إجمالي المبيعات الآجلة (ديون في السوق):</span>
                    <span className="font-bold text-amber-700">{formatMoney(totalRemaining)}</span>
                  </div>
                </div>
              </div>

              {/* Responsible & notes */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <span>المسؤولية الإدارية والملاحظات</span>
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">مسؤول فتح الشفت:</span>
                    <span className="font-bold text-slate-900">
                      {shift.openedBy?.name} ({shift.openedBy?.role === 'admin' ? 'مدير' : shift.openedBy?.role === 'supervisor' ? 'مشرف' : 'موظف'})
                    </span>
                  </div>

                  {shift.closedBy && (
                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">مسؤول إغلاق الشفت:</span>
                      <span className="font-bold text-slate-900">
                        {shift.closedBy?.name} ({shift.closedBy?.role === 'admin' ? 'مدير' : shift.closedBy?.role === 'supervisor' ? 'مشرف' : 'موظف'})
                      </span>
                    </div>
                  )}

                  <div className="pt-2">
                    <span className="text-slate-500 block mb-1 font-bold">ملاحظات مسجلة:</span>
                    <div className="p-3 bg-slate-50 rounded-xl text-slate-700 border border-slate-200/80 min-h-[60px] text-xs">
                      {shift.notes || 'لا توجد ملاحظات مدونة لهذا الشفت.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-200 p-3 sm:p-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {settings.storeName} - كشف تفصيلي لشفت المبيعات
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
