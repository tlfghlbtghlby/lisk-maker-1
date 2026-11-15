import React, { useState, useMemo, useEffect } from 'react';
import { DateRangeBar, useDateRangeFilter } from './DateRangeFilter';
import { useApp } from '../context/AppContext';
import TrashPanel from './TrashPanel';
import { Invoice, InvoiceItem, SaleType } from '../types';
import { 
  Search, 
  Printer, 
  Trash2, 
  Eye, 
  FileText, 
  DollarSign, 
  CreditCard, 
  Clock, 
  Calendar,
  Filter,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Undo2,
  PackageMinus
} from 'lucide-react';
import { PartialReturnModal } from './PartialReturnModal';
import { normalizeName } from '../utils/aiScan';

/** هل الكلمة تطابق جزءاً من كلمة المادة؟ (بداية الكلمة أو حروف متتابعة تبدأ بنفس الحرف: «زت» ← «زيت») */
const wordMatches = (word: string, token: string): boolean => {
  if (word.includes(token)) return true;
  if (token.length < 2 || word[0] !== token[0]) return false;
  let i = 0;
  for (const ch of word) { if (ch === token[i]) i++; if (i === token.length) return true; }
  return false;
};

interface InvoicesViewProps {
  onViewInvoice: (invoice: Invoice) => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({ onViewInvoice }) => {
  const { invoices, deleteInvoice, returnInvoice, formatMoney, hasPermission, openInvoiceEditor, requestApproval, clearApprovalGrant } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [itemQuery, setItemQuery] = useState('');
  const [returnDialog, setReturnDialog] = useState<Invoice | null>(null);
  const [returnReason, setReturnReason] = useState('رغبة الزبون');
  const dateRange = useDateRangeFilter('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'direct' | 'credit' | 'unpaid' | 'returned'>('all');
  const [returningId, setReturningId] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const [selectedInvoiceForPartialReturn, setSelectedInvoiceForPartialReturn] = useState<Invoice | null>(null);

  // حالة ترقيم الصفحات (Pagination)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('invoices_page_size');
      if (saved) return Number(saved);
    } catch (e) {}
    return 50;
  });

  // البحث بمادة: يطابق اسم المادة (جزءاً منه) أو باركودها، ويعرض الأحدث أولاً
  const itemMatches = useMemo(() => {
    const m = new Map<string, InvoiceItem[]>();
    const tokens = normalizeName(itemQuery).split(' ').filter(Boolean);
    const raw = itemQuery.trim().toLowerCase();
    if (!tokens.length && !raw) return null;
    for (const inv of invoices) {
      const hits = (inv.items || []).filter((it) => {
        const code = (it.code || '').toLowerCase();
        if (raw && code && (code === raw || (raw.length >= 4 && code.includes(raw)))) return true;
        const words = normalizeName(`${it.productName || ''} ${it.name || ''}`).split(' ').filter(Boolean);
        return tokens.length > 0 && tokens.every((t) => words.some((w) => wordMatches(w, t)));
      });
      if (hits.length) m.set(inv.id, hits);
    }
    return m;
  }, [invoices, itemQuery]);

  const filteredInvoices = useMemo(() => {
    const base = itemMatches ? invoices.filter((i) => itemMatches.has(i.id)).sort((a, b) => String(b.date).localeCompare(String(a.date))) : invoices;
    return base.filter((inv) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        (inv.customerPhone && inv.customerPhone.includes(q));

      let matchType = true;
      if (typeFilter === 'direct') matchType = inv.type === 'direct';
      else if (typeFilter === 'credit') matchType = inv.type === 'credit';
      else if (typeFilter === 'unpaid') matchType = inv.remainingAmount > 0 && inv.status !== 'returned';
      else if (typeFilter === 'returned') matchType = inv.status === 'returned' || !!inv.isPartiallyReturned || inv.status === 'partially_returned';

      return matchSearch && matchType && dateRange.matches(inv.date);
    });
  }, [invoices, itemMatches, searchQuery, typeFilter, dateRange.matches]);

  const effectivePageSize = pageSize === -1 ? (filteredInvoices.length || 1) : pageSize;
  const totalPages = Math.ceil(filteredInvoices.length / effectivePageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedInvoices = useMemo(() => {
    if (pageSize === -1) return filteredInvoices;
    const startIndex = (safeCurrentPage - 1) * effectivePageSize;
    return filteredInvoices.slice(startIndex, startIndex + effectivePageSize);
  }, [filteredInvoices, safeCurrentPage, effectivePageSize, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemQuery, typeFilter, dateRange.matches]);

  // Overall financial summary for active invoices (exclude returned from active sales)
  const activeInvoices = useMemo(() => invoices.filter(i => i.status !== 'returned'), [invoices]);
  const totalSales = activeInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaidCash = activeInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
  const totalRemainingCredit = activeInvoices.reduce((sum, inv) => sum + inv.remainingAmount, 0);
  const totalProfits = activeInvoices.reduce((sum, inv) => sum + inv.netProfit, 0);

  // الإرجاع الكامل: نافذة داخل التطبيق (window.prompt غير مدعومة في بعض البيئات مثل Electron)
  const handleReturn = (inv: Invoice) => {
    if (inv.status === 'returned') {
      alert('هذه القائمة تم إرجاعها مسبقاً والمواد مستردة بالمخزن.');
      return;
    }
    setReturnReason('رغبة الزبون');
    setReturnDialog(inv);
  };

  const confirmReturn = async () => {
    const inv = returnDialog;
    if (!inv) return;
    setReturnDialog(null);
    setReturningId(inv.id);
    try {
      const ok = await returnInvoice(inv.id, returnReason.trim() || 'غير مذكور');
      if (ok) {
        setFeedbackNotice(`تم إرجاع القائمة (${inv.invoiceNumber}) واسترداد كافة المواد إلى المخزن بنجاح!`);
        setTimeout(() => setFeedbackNotice(null), 5000);
      } else {
        alert('تعذر إرجاع القائمة (تحقق من الصلاحية أو أنها مرتجعة مسبقاً).');
      }
    } catch (e: any) {
      alert('فشل إرجاع القائمة: ' + (e?.message || e));
    } finally {
      setReturningId(null);
      clearApprovalGrant();
    }
  };

  const handleDelete = (inv: Invoice) => {
    if (
      confirm(
        `هل أنت متأكد من حذف القائمة رقم (${inv.invoiceNumber}) نهائياً؟\n` +
        (inv.status !== 'returned' ? 'سيتم إرجاع المواد المباعة إلى المخزن وتعديل حساب الزبون تلقائياً.' : 'سيتم حذف سجل الفاتورة المرتجعة نهائياً.')
      )
    ) {
      deleteInvoice(inv.id);
      setFeedbackNotice(`تم حذف القائمة (${inv.invoiceNumber})`);
      setTimeout(() => setFeedbackNotice(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <TrashPanel sections={['invoices', 'products', 'customers', 'reps', 'shifts', 'payments']} title="سلة المحذوفات (كل الأقسام)" />
      </div>
      
      {/* Top Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 mb-1">إجمالي المبيعات المسجلة</div>
          <div className="text-2xl font-black text-slate-900 flex items-center justify-between">
            <span>{formatMoney(totalSales)}</span>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {invoices.length} قائمة
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 mb-1">المقبوضات النقدية الفعلية</div>
          <div className="text-2xl font-black text-emerald-700">
            {formatMoney(totalPaidCash)}
          </div>
        </div>

        {hasPermission('canViewCustomers') && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs text-slate-500 mb-1">المبالغ الآجلة (ديون في القوائم)</div>
            <div className="text-2xl font-black text-amber-600">
              {formatMoney(totalRemainingCredit)}
            </div>
          </div>
        )}

        {hasPermission('canViewCostPrice') && hasPermission('canViewReports') && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs text-slate-500 mb-1">إجمالي الأرباح المحققة</div>
            <div className="text-2xl font-black text-blue-700">
              {formatMoney(totalProfits)}
            </div>
          </div>
        )}

      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <DateRangeBar state={dateRange} />
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث برقم القائمة، اسم الزبون، أو رقم الهاتف..."
            className="w-full pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/50"
          />
        </div>

        {/* بحث عن مادة داخل القوائم */}
        <div className="relative flex-1">
          <PackageMinus className="w-4 h-4 text-indigo-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={itemQuery}
            onChange={(e) => setItemQuery(e.target.value)}
            placeholder="بحث عن مادة: اسم (يكفي جزء منه مثل «زت زي») أو باركود"
            className="w-full pl-8 pr-10 py-2 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-indigo-50/40"
          />
          {itemQuery && <button type="button" onClick={() => setItemQuery('')} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 font-bold">×</button>}
        </div>

        {/* Filter Segmented Buttons */}
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              typeFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            جميع القوائم ({invoices.length})
          </button>

          <button
            onClick={() => setTypeFilter('direct')}
            className={`px-3 py-1.5 rounded-lg transition ${
              typeFilter === 'direct'
                ? 'bg-emerald-700 text-white'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            بيع مباشر ({invoices.filter((i) => i.type === 'direct').length})
          </button>

          <button
            onClick={() => setTypeFilter('credit')}
            className={`px-3 py-1.5 rounded-lg transition ${
              typeFilter === 'credit'
                ? 'bg-amber-700 text-white'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            بيع آجل ({invoices.filter((i) => i.type === 'credit').length})
          </button>

          <button
            onClick={() => setTypeFilter('unpaid')}
            className={`px-3 py-1.5 rounded-lg transition ${
              typeFilter === 'unpaid'
                ? 'bg-rose-700 text-white'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            غير مسدد ({invoices.filter((i) => i.remainingAmount > 0 && i.status !== 'returned').length})
          </button>

          <button
            onClick={() => setTypeFilter('returned')}
            className={`px-3 py-1.5 rounded-lg transition ${
              typeFilter === 'returned'
                ? 'bg-purple-700 text-white'
                : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
            }`}
          >
            مرتجعة / جزئية ({invoices.filter((i) => i.status === 'returned' || !!i.isPartiallyReturned || i.status === 'partially_returned').length})
          </button>
        </div>

      </div>

      {/* Feedback Toast Notice */}
      {feedbackNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackNotice}</span>
          </div>
          <button
            onClick={() => setFeedbackNotice(null)}
            className="text-[11px] text-emerald-700 hover:text-emerald-900 underline"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-100/80 text-slate-700 text-xs font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">رقم القائمة</th>
                <th className="py-3 px-4">التاريخ والوقت</th>
                <th className="py-3 px-4">نوع البيع</th>
                <th className="py-3 px-4">اسم الزبون</th>
                <th className="py-3 px-4">عدد المواد</th>
                <th className="py-3 px-4 text-slate-900">المبلغ الإجمالي</th>
                <th className="py-3 px-4 text-emerald-800">المسدد نقداً</th>
                <th className="py-3 px-4 text-amber-800">المتبقي (آجل)</th>
                {hasPermission('canViewCostPrice') && hasPermission('canViewReports') && (
                  <th className="py-3 px-4 text-blue-900">ربح القائمة</th>
                )}
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={(hasPermission('canViewCostPrice') && hasPermission('canViewReports')) ? 10 : 9} className="py-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">لا توجد قوائم مطابقة</p>
                    <p className="text-xs text-slate-400 mt-1">ابدأ بإنشاء قائمة جديدة من شاشة نقطة البيع</p>
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv) => {
                  const dateObj = new Date(inv.date);
                  const dateFormatted = dateObj.toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });
                  const timeFormatted = dateObj.toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                      {/* Invoice # */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{inv.invoiceNumber}</span>
                          {inv.status === 'returned' && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300 text-[10px] font-black">
                              مرتجعة بالكامل
                            </span>
                          )}
                          {(inv.isPartiallyReturned || inv.status === 'partially_returned') && (
                            <span 
                              className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-300 text-[10px] font-black"
                              title={inv.totalReturnedAmount ? `تم استرجاع مواد بقيمة ${formatMoney(inv.totalReturnedAmount)}` : 'تم استرجاع مواد جزئياً'}
                            >
                              مرتجعة جزئياً
                            </span>
                          )}
                        </div>
                        {itemMatches?.get(inv.id) && (
                          <div className="mt-1.5 flex flex-wrap gap-1 font-sans">
                            {itemMatches.get(inv.id)!.slice(0, 4).map((it, k) => (
                              <span key={k} className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-900 text-[10px] font-bold">
                                {it.productName || it.name} × {it.quantity}{it.unitType === 'carton' ? ` ${it.packLabel || 'كرتون'}` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 px-4 text-xs text-slate-600">
                        <div>{dateFormatted}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{timeFormatted}</div>
                      </td>

                      {/* Sale Type */}
                      <td className="py-3 px-4">
                        {inv.type === 'direct' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            <DollarSign className="w-3 h-3" />
                            مباشر (نقدي)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                            <CreditCard className="w-3 h-3" />
                            آجل (دين)
                          </span>
                        )}
                      </td>

                      {/* Customer Name */}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div>{inv.customerName}</div>
                        {inv.customerPhone && (
                          <div className="text-[11px] text-slate-400 font-mono font-normal">
                            {inv.customerPhone}
                          </div>
                        )}
                      </td>

                      {/* Items count */}
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {inv.items.length} مواد ({inv.items.reduce((s, i) => s + (i.quantity - (i.returnedQuantity || 0)), 0)} قطعة متبقية)
                      </td>

                      {/* Total */}
                      <td className="py-3 px-4 font-extrabold text-slate-900">
                        <div>{formatMoney(inv.total)}</div>
                        {inv.totalReturnedAmount && inv.totalReturnedAmount > 0 ? (
                          <div className="text-[10px] text-indigo-700 font-normal">
                            (مسترجع: {formatMoney(inv.totalReturnedAmount)})
                          </div>
                        ) : null}
                      </td>

                      {/* Paid */}
                      <td className="py-3 px-4 font-bold text-emerald-700">
                        {formatMoney(inv.paidAmount)}
                      </td>

                      {/* Remaining */}
                      <td className="py-3 px-4 font-bold">
                        {inv.remainingAmount > 0 ? (
                          <span className="text-rose-600">{formatMoney(inv.remainingAmount)}</span>
                        ) : (
                          <span className="text-slate-400 font-normal">خالص</span>
                        )}
                      </td>

                      {/* Net Profit */}
                      {hasPermission('canViewCostPrice') && hasPermission('canViewReports') && (
                        <td className="py-3 px-4 text-xs font-bold text-blue-700">
                          +{formatMoney(inv.netProfit)}
                        </td>
                      )}

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onViewInvoice(inv)}
                            className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                            title="معاينة وطباعة القائمة"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {inv.status !== 'returned' && (
                            <button
                              type="button"
                              onClick={() => requestApproval('edit', inv.id, () => openInvoiceEditor(inv.id))}
                              className="px-2 py-1 rounded-lg text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300 hover:bg-amber-100 transition cursor-pointer"
                              title="تعديل القائمة بالكامل"
                            >
                              تعديل
                            </button>
                          )}

                          {/* زر استرجاع جزئي للمواد مع خانة السبب (للمشرفين والمدير) */}
                          {(
                            inv.status !== 'returned' ? (
                              <button
                                onClick={() => requestApproval('return', inv.id, () => setSelectedInvoiceForPartialReturn(inv))}
                                className="p-1.5 rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 transition cursor-pointer flex items-center gap-1"
                                title="استرجاع جزئي لمواد محددة مع تحديد السبب"
                              >
                                <PackageMinus className="w-4 h-4" />
                              </button>
                            ) : (
                              <span 
                                className="p-1.5 text-slate-300 cursor-not-allowed" 
                                title="تم إرجاع كامل القائمة"
                              >
                                <PackageMinus className="w-4 h-4" />
                              </span>
                            )
                          )}

                          {/* زر إرجاع كامل المشتريات / القائمة (للمصرح لهم فقط) */}
                          {(
                            inv.status !== 'returned' ? (
                              <button
                                disabled={returningId === inv.id}
                                onClick={() => requestApproval('return', inv.id, () => handleReturn(inv))}
                                className="p-1.5 rounded-lg text-purple-600 hover:text-purple-800 hover:bg-purple-50 transition cursor-pointer flex items-center gap-1"
                                title="إرجاع كامل القائمة واسترداد المواد للمخزن"
                              >
                                <RotateCcw className={`w-4 h-4 ${returningId === inv.id ? 'animate-spin' : ''}`} />
                              </button>
                            ) : (
                              <span 
                                className="p-1.5 text-slate-300 cursor-not-allowed" 
                                title="تم إرجاع هذه القائمة والمواد مستردة"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </span>
                            )
                          )}

                          {/* زر حذف القائمة (للأدمن فقط) */}
                          {hasPermission('canDeleteInvoice') && (
                            <button
                              onClick={() => handleDelete(inv)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="إلغاء وحذف القائمة نهائياً"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredInvoices.length > 0 && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="font-medium">عرض:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                  try {
                    localStorage.setItem('invoices_page_size', String(val));
                  } catch (err) {}
                }}
                className="bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-800 focus:outline-none"
              >
                <option value={25}>25 قائمة</option>
                <option value={50}>50 قائمة</option>
                <option value={100}>100 قائمة</option>
                <option value={-1}>عرض الكل ({filteredInvoices.length})</option>
              </select>
              <span className="text-slate-500">
                | عرض {((safeCurrentPage - 1) * effectivePageSize) + 1} إلى {Math.min(safeCurrentPage * effectivePageSize, filteredInvoices.length)} من أصل {filteredInvoices.length} قائمة
              </span>
            </div>

            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold cursor-pointer"
                >
                  السابق
                </button>
                <div className="flex items-center gap-1 font-bold">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                    let pageNum = idx + 1;
                    if (totalPages > 5 && safeCurrentPage > 3) {
                      pageNum = safeCurrentPage - 2 + idx;
                      if (pageNum > totalPages) pageNum = totalPages - 4 + idx;
                    }
                    if (pageNum < 1 || pageNum > totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded-lg transition text-xs font-bold cursor-pointer ${
                          safeCurrentPage === pageNum
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold cursor-pointer"
                >
                  التالي
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {returnDialog && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) { setReturnDialog(null); clearApprovalGrant(); } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-3 text-right" dir="rtl">
            <h3 className="font-black text-base text-slate-900">إرجاع كامل القائمة ({returnDialog.invoiceNumber})</h3>
            <ul className="text-xs text-slate-700 space-y-1 leading-relaxed">
              <li>✓ ستعود كميات كل المواد ({returnDialog.items.length}) إلى رصيد المخزن.</li>
              <li>✓ يُلغى المتبقي من دين الزبون لهذه القائمة تلقائياً.</li>
              <li>✓ يبقى سجل القائمة بحالة «مرتجعة» للتدقيق.</li>
            </ul>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">سبب الإرجاع (يُرسل ضمن إشعار التليجرام)</label>
              <input value={returnReason} onChange={(e) => setReturnReason(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') confirmReturn(); }} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => { setReturnDialog(null); clearApprovalGrant(); }} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold">إلغاء</button>
              <button type="button" onClick={confirmReturn} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-black">تأكيد الإرجاع</button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة الاسترجاع الجزئي للقوائم */}
      <PartialReturnModal
        invoice={selectedInvoiceForPartialReturn}
        isOpen={!!selectedInvoiceForPartialReturn}
        onClose={() => { clearApprovalGrant(); setSelectedInvoiceForPartialReturn(null); }}
        onSuccess={() => {
          setFeedbackNotice('تم استرجاع المواد المحددة وتسوية الحسابات والمخزن بنجاح!');
          setTimeout(() => setFeedbackNotice(null), 4000);
        }}
      />

    </div>
  );
};
