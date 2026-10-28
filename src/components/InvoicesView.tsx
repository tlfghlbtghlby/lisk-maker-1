import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Invoice, SaleType } from '../types';
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

interface InvoicesViewProps {
  onViewInvoice: (invoice: Invoice) => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({ onViewInvoice }) => {
  const { invoices, deleteInvoice, returnInvoice, formatMoney, hasPermission } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'direct' | 'credit' | 'unpaid' | 'returned'>('all');
  const [returningId, setReturningId] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const [selectedInvoiceForPartialReturn, setSelectedInvoiceForPartialReturn] = useState<Invoice | null>(null);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
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

      return matchSearch && matchType;
    });
  }, [invoices, searchQuery, typeFilter]);

  // Overall financial summary for active invoices (exclude returned from active sales)
  const activeInvoices = useMemo(() => invoices.filter(i => i.status !== 'returned'), [invoices]);
  const totalSales = activeInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaidCash = activeInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
  const totalRemainingCredit = activeInvoices.reduce((sum, inv) => sum + inv.remainingAmount, 0);
  const totalProfits = activeInvoices.reduce((sum, inv) => sum + inv.netProfit, 0);

  const handleReturn = async (inv: Invoice) => {
    if (inv.status === 'returned') {
      alert('هذه القائمة تم إرجاعها مسبقاً والمواد مستردة بالمخزن.');
      return;
    }

    const confirmed = confirm(
      `هل تراجع الزبون عن الشراء وتريد إرجاع القائمة رقم (${inv.invoiceNumber})؟\n\n` +
      `✓ ستعود كميات كافة المواد (${inv.items.length} مواد) فوراً إلى رصيد المخزن.\n` +
      `✓ سيتم إلغاء المتبقي من دين العميل لهذه القائمة تلقائياً.\n` +
      `✓ سيتم الاحتفاظ بسجل القائمة بحالة (مرتجعة) للتدقيق والشفافية.`
    );

    if (!confirmed) return;

    setReturningId(inv.id);
    try {
      const ok = await returnInvoice(inv.id);
      if (ok) {
        setFeedbackNotice(`تم إرجاع القائمة (${inv.invoiceNumber}) واسترداد كافة المواد إلى المخزن بنجاح!`);
        setTimeout(() => setFeedbackNotice(null), 5000);
      } else {
        alert('حدث خطأ أثناء إرجاع القائمة');
      }
    } catch (e: any) {
      alert('فشل إرجاع القائمة: ' + (e.message || e));
    } finally {
      setReturningId(null);
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

        {hasPermission('canViewReports') && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs text-slate-500 mb-1">إجمالي الأرباح المحققة</div>
            <div className="text-2xl font-black text-blue-700">
              {formatMoney(totalProfits)}
            </div>
          </div>
        )}

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
                {hasPermission('canViewReports') && (
                  <th className="py-3 px-4 text-blue-900">ربح القائمة</th>
                )}
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={hasPermission('canViewReports') ? 10 : 9} className="py-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">لا توجد قوائم مطابقة</p>
                    <p className="text-xs text-slate-400 mt-1">ابدأ بإنشاء قائمة جديدة من شاشة نقطة البيع</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
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
                      {hasPermission('canViewReports') && (
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

                          {/* زر استرجاع جزئي للمواد مع خانة السبب (للمشرفين والمدير) */}
                          {hasPermission('canReturnInvoice') && (
                            inv.status !== 'returned' ? (
                              <button
                                onClick={() => setSelectedInvoiceForPartialReturn(inv)}
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
                          {hasPermission('canReturnInvoice') && (
                            inv.status !== 'returned' ? (
                              <button
                                disabled={returningId === inv.id}
                                onClick={() => handleReturn(inv)}
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
      </div>

      {/* نافذة الاسترجاع الجزئي للقوائم */}
      <PartialReturnModal
        invoice={selectedInvoiceForPartialReturn}
        isOpen={!!selectedInvoiceForPartialReturn}
        onClose={() => setSelectedInvoiceForPartialReturn(null)}
        onSuccess={() => {
          setFeedbackNotice('تم استرجاع المواد المحددة وتسوية الحسابات والمخزن بنجاح!');
          setTimeout(() => setFeedbackNotice(null), 4000);
        }}
      />

    </div>
  );
};
