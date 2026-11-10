import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import CustomerTelegramModal from './CustomerTelegramModal';
import { Customer, Invoice, PaymentRecord } from '../types';
import { 
  Users, 
  Search, 
  Plus, 
  DollarSign, 
  CreditCard, 
  Receipt, 
  Phone, 
  MapPin, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  X,
  Printer,
  Lock
} from 'lucide-react';

interface CustomersViewProps {
  onViewInvoice: (invoice: Invoice) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({ onViewInvoice }) => {
  const { 
    customers, 
    invoices, 
    payments, 
    addCustomer, 
    updateCustomer, 
    recordPayment, 
    getUnappliedDebts,
    reconcileCustomerDebts,
    formatMoney,
    settings,
    hasPermission,
    openInvoiceEditor,
    openSessionModal,
    sendDebtReminder,
    featureOn
  } = useApp();
  const telegramOn = featureOn('enableTelegram');

  const [reminderState, setReminderState] = useState<Record<string, string>>({});
  const handleSendReminder = async (id: string) => {
    setReminderState(p => ({ ...p, [id]: 'جاري الإرسال...' }));
    const r = await sendDebtReminder(id);
    const msg = !r.ok ? (r.error || 'فشل الإرسال') : r.sent > 0 ? 'تم الإرسال ✅' : 'غير مرتبط بالتليجرام';
    setReminderState(p => ({ ...p, [id]: msg }));
    setTimeout(() => setReminderState(p => { const n = { ...p }; delete n[id]; return n; }), 4000);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDebtOnly, setFilterDebtOnly] = useState(false);

  // Modals state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [telegramCustomer, setTelegramCustomer] = useState<Customer | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  // فترة التصفية (تحدد قوائم ودفعات ومواد الزبون في كشف الحساب). فارغة = كل الفترة
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [showPurchasedItems, setShowPurchasedItems] = useState(false);
  const inPeriod = (iso: string): boolean => {
    if (!periodFrom && !periodTo) return true;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return true;
    if (periodFrom) {
      const [y, m, dd] = periodFrom.split('-').map(Number);
      if (d < new Date(y, m - 1, dd, 0, 0, 0, 0)) return false;
    }
    if (periodTo) {
      const [y, m, dd] = periodTo.split('-').map(Number);
      if (d > new Date(y, m - 1, dd, 23, 59, 59, 999)) return false;
    }
    return true;
  };
  const periodActive = !!(periodFrom || periodTo);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  
  // Payment modal state
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [recentReceipt, setRecentReceipt] = useState<PaymentRecord | null>(null);

  if (!hasPermission('canViewCustomers')) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md mx-auto my-12 space-y-4 shadow-sm" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-base font-extrabold text-slate-900">سجل الديون والعملاء مقفل</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          يتطلب الدخول لسجل حسابات الديون والزبائن تفعيل جلسة الأدمن أو المشرف لحماية خصوصية الحسابات المالية.
        </p>
        <button
          type="button"
          onClick={() => openSessionModal('admin')}
          className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
        >
          التحويل لجلسة الأدمن
        </button>
      </div>
    );
  }

  // Add Customer modal state
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustInitialDebt, setNewCustInitialDebt] = useState<number | ''>('');
  const [newCustNotes, setNewCustNotes] = useState('');
  const [newCustError, setNewCustError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((cust) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        cust.name.toLowerCase().includes(q) ||
        cust.phone.includes(q) ||
        (cust.address && cust.address.toLowerCase().includes(q));

      const matchDebt = !filterDebtOnly || cust.totalDebt > 0;
      return matchSearch && matchDebt;
    });
  }, [customers, searchQuery, filterDebtOnly]);

  // Overall Debt KPI stats
  const totalMarketDebt = customers.reduce((sum, c) => sum + c.totalDebt, 0);
  const indebtedCount = customers.filter((c) => c.totalDebt > 0).length;
  const zeroDebtCount = customers.filter((c) => c.totalDebt === 0).length;

  const customerInvoicesInPeriod = (cust: Customer) =>
    invoices.filter((i) => (i.customerId === cust.id || i.customerName === cust.name) && inPeriod(i.date));
  const customerPaymentsInPeriod = (cust: Customer) =>
    payments.filter((p) => p.customerId === cust.id && inPeriod(p.date));
  const periodDebtOf = (cust: Customer) =>
    customerInvoicesInPeriod(cust).filter((i) => i.status !== 'returned').reduce((sum, i) => sum + (Number(i.remainingAmount) || 0), 0);

  // Handle open statement
  const handleOpenStatement = (cust: Customer) => {
    setSelectedCustomer(cust);
    setIsStatementOpen(true);
  };

  // Handle open payment modal
  const handleOpenPayment = (cust: Customer) => {
    setSelectedCustomer(cust);
    setPaymentAmount(cust.totalDebt > 0 ? cust.totalDebt : '');
    setPaymentNotes('');
    setRecentReceipt(null);
    setPaymentError(null);
    setIsPaymentModalOpen(true);
  };

  // Submit payment
  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !paymentAmount || Number(paymentAmount) <= 0) {
      setPaymentError('الرجاء إدخال مبلغ سداد صحيح أكبر من الصفر');
      return;
    }
    setPaymentError(null);

    const receipt = recordPayment(
      selectedCustomer.id,
      Number(paymentAmount),
      paymentNotes.trim() || 'تسديد دفعة نقدية على الحساب'
    );

    setRecentReceipt(receipt);
    // Refresh selected customer state
    const updated = customers.find((c) => c.id === selectedCustomer.id);
    if (updated) setSelectedCustomer(updated);
  };

  // Submit new customer
  const handleCreateCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      setNewCustError('اسم الزبون مطلوب');
      return;
    }
    setNewCustError(null);

    addCustomer({
      name: newCustName.trim(),
      phone: newCustPhone.trim(),
      address: newCustAddress.trim(),
      initialDebt: Number(newCustInitialDebt) || 0,
      notes: newCustNotes.trim(),
    });

    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
    setNewCustInitialDebt('');
    setNewCustNotes('');
    setNewCustError(null);
    setIsAddCustomerOpen(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Debt Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 mb-1">إجمالي ديون البيع الآجل (في السوق)</div>
          <div className="text-2xl font-black text-amber-700">
            {formatMoney(totalMarketDebt)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">مبالغ مستحقة لدى الزبائن</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 mb-1">الزبائن الذين عليهم ذمم ومبالغ آجلة</div>
          <div className="text-2xl font-black text-slate-900 flex items-center justify-between">
            <span>{indebtedCount} زبون</span>
            <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
              ذمم نشطة
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">من أصل {customers.length} زبون مسجل</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 mb-1">زبائن رصيدهم خالص (0 دين)</div>
          <div className="text-2xl font-black text-emerald-700">
            {zeroDebtCount} زبون
          </div>
          <div className="text-[11px] text-slate-400 mt-1">سددوا كامل حساباتهم</div>
        </div>

      </div>

      {/* فترة عرض الديون والقوائم */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-end gap-3">
        <div className="text-xs font-bold text-slate-700 self-center">📅 الديون والقوائم حسب الفترة:</div>
        <label className="text-[11px] font-bold text-slate-600">من تاريخ
          <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} className="block mt-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
        </label>
        <label className="text-[11px] font-bold text-slate-600">إلى تاريخ
          <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className="block mt-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
        </label>
        {periodActive && (
          <button type="button" onClick={() => { setPeriodFrom(''); setPeriodTo(''); }} className="px-3 py-2 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200">
            كل الفترة
          </button>
        )}
        <div className="text-[11px] text-slate-500 self-center">
          {periodActive ? 'تظهر ديون الفترة تحت كل زبون، وعند فتح كشف الحساب تظهر قوائمه ودفعاته في هذه الفترة فقط.' : 'اختر فترة لعرض ديون وقوائم الزبائن فيها فقط.'}
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم الزبون، رقم الهاتف، أو العنوان..."
            className="w-full pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/50"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterDebtOnly(!filterDebtOnly)}
            className={`px-3 py-2 text-xs font-semibold rounded-lg border transition ${
              filterDebtOnly
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {filterDebtOnly ? 'عرض المدينين فقط ✓' : 'تصفية: أصحاب الديون فقط'}
          </button>

          {getUnappliedDebts().length > 0 && (
            <button
              onClick={() => {
                const list = getUnappliedDebts();
                const total = list.reduce((a, b) => a + b.amount, 0);
                const msg =
                  'سيتم إضافة ديون القوائم الآجلة القديمة إلى رصيد الزبائن (مرة واحدة فقط):\n\n' +
                  list.map(u => `• ${u.customerName || 'زبون'}: ${formatMoney(u.amount)} (${u.invoices} قائمة)`).join('\n') +
                  `\n\nالمجموع: ${formatMoney(total)}\n\nهل تريد المتابعة؟`;
                if (window.confirm(msg)) reconcileCustomerDebts();
              }}
              className="px-4 py-2 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg flex items-center gap-1.5 transition"
              title="احتساب الديون من القوائم الآجلة القديمة التي لم تُضف لرصيد الزبون"
            >
              <AlertCircle className="w-4 h-4" />
              <span>احتساب الديون القديمة</span>
            </button>
          )}


          <button
            onClick={() => setIsAddCustomerOpen(true)}
            className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة زبون جديد</span>
          </button>
        </div>

      </div>

      {/* Customers List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-100/80 text-slate-700 text-xs font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">اسم الزبون / العميل</th>
                <th className="py-3 px-4">رقم الهاتف</th>
                <th className="py-3 px-4">العنوان</th>
                <th className="py-3 px-4 text-amber-900">إجمالي الدين الحالي</th>
                <th className="py-3 px-4">حالة الحساب</th>
                <th className="py-3 px-4 text-center">الإجراءات والعمليات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">لا يوجد زبائن مطابقين</p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const hasDebt = cust.totalDebt > 0;
                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/70 transition">
                      {/* Name */}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{cust.name}</span>
                          {telegramOn && hasDebt && (
                            <button
                              type="button"
                              onClick={() => handleSendReminder(cust.id)}
                              disabled={reminderState[cust.id] === 'جاري الإرسال...'}
                              className="px-2 py-0.5 text-[11px] font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 rounded-md border border-sky-200 flex items-center gap-1 transition disabled:opacity-60"
                              title="إرسال إشعار للزبون عبر التليجرام بآخر دين وآخر تسديد والمتبقي عليه"
                            >
                              <span>🔔</span>
                              <span>إشعار</span>
                            </button>
                          )}
                          {telegramOn && reminderState[cust.id] && (
                            <span className="text-[11px] font-bold text-slate-500">{reminderState[cust.id]}</span>
                          )}
                        </div>
                        {cust.notes && (
                          <div className="text-[11px] text-slate-400 font-normal">{cust.notes}</div>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">
                        {cust.phone || '-'}
                      </td>

                      {/* Address */}
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {cust.address || '-'}
                      </td>

                      {/* Debt Amount */}
                      <td className="py-3 px-4 font-extrabold text-base">
                        <span className={hasDebt ? 'text-amber-800' : 'text-slate-400'}>
                          {formatMoney(cust.totalDebt)}
                        </span>
                        {periodActive && (
                          <div className="text-[11px] font-bold text-sky-700 mt-0.5">
                            دين الفترة: {formatMoney(periodDebtOf(cust))}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {hasDebt ? (
                          <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                            عليه دين مستحق
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            حساب خالص
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Record Payment Button */}
                          <button
                            onClick={() => handleOpenPayment(cust)}
                            className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 flex items-center gap-1 transition"
                            title="تسجيل دفعة سداد دين من الزبون"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>سداد دين</span>
                          </button>

                          {/* Statement Button */}
                          <button
                            onClick={() => handleOpenStatement(cust)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 flex items-center gap-1 transition"
                            title="كشف حساب تفصيلي للزبون"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>كشف حساب</span>
                          </button>

                          {telegramOn && (
                          <button
                            onClick={() => setTelegramCustomer(cust)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border flex items-center gap-1 transition ${
                              cust.telegramLinked
                                ? 'text-sky-800 bg-sky-50 border-sky-300'
                                : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-200'
                            }`}
                            title="رمز ربط الزبون ببوت التليجرام"
                          >
                            <span>✈️</span>
                            <span>{cust.telegramLinked ? 'مرتبط' : 'تليجرام'}</span>
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

      {/* Modal 1: Customer Account Statement (كشف الحساب التفصيلي) */}
      {isStatementOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  كشف حساب الزبون: {selectedCustomer.name}
                </h3>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                  {selectedCustomer.phone && <span>الهاتف: {selectedCustomer.phone}</span>}
                  {selectedCustomer.address && <span>العنوان: {selectedCustomer.address}</span>}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-300 text-right">
                  <div className="text-[10px] text-amber-900 font-bold">الدين الحالي المستحق</div>
                  <div className="font-black text-amber-950 text-sm">
                    {formatMoney(selectedCustomer.totalDebt)}
                  </div>
                </div>

                <button
                  onClick={() => setIsStatementOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* فترة الكشف + زر المواد المشتراة */}
              <div className="flex flex-wrap items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                <label className="text-[11px] font-bold text-slate-600">من تاريخ
                  <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} className="block mt-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white" />
                </label>
                <label className="text-[11px] font-bold text-slate-600">إلى تاريخ
                  <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className="block mt-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white" />
                </label>
                {periodActive && (
                  <button type="button" onClick={() => { setPeriodFrom(''); setPeriodTo(''); }} className="px-3 py-2 text-xs font-bold rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700">
                    كل الفترة
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPurchasedItems(v => !v)}
                  className={`px-3 py-2 text-xs font-bold rounded-lg border transition mr-auto ${showPurchasedItems ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'}`}
                >
                  {showPurchasedItems ? 'إخفاء المواد المشتراة' : '🛒 المواد المشتراة'}
                </button>
                {periodActive && (
                  <div className="w-full text-[11px] text-sky-800 font-bold">
                    ديون هذه الفترة: {formatMoney(periodDebtOf(selectedCustomer))} — المسدّد فيها: {formatMoney(customerPaymentsInPeriod(selectedCustomer).reduce((a, p) => a + (Number(p.amount) || 0), 0))}
                  </div>
                )}
              </div>

              {showPurchasedItems && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    المواد التي اشتراها الزبون{periodActive ? ' في الفترة المحددة' : ''}:
                  </h4>
                  {(() => {
                    const rows = customerInvoicesInPeriod(selectedCustomer)
                      .filter((i) => i.status !== 'returned')
                      .flatMap((inv) => (inv.items || []).map((it, idx) => ({ inv, it, key: `${inv.id}_${idx}` })))
                      .sort((a, b) => new Date(b.inv.date).getTime() - new Date(a.inv.date).getTime());
                    if (rows.length === 0) {
                      return <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-lg text-center">لا توجد مواد مشتراة في هذه الفترة</p>;
                    }
                    return (
                      <div className="border border-slate-200 rounded-lg overflow-hidden text-xs max-h-72 overflow-y-auto">
                        <table className="w-full text-right">
                          <thead className="bg-slate-100 font-bold text-slate-700 sticky top-0">
                            <tr>
                              <th className="py-2 px-3">المادة</th>
                              <th className="py-2 px-3">السعر</th>
                              <th className="py-2 px-3 text-center">الكمية</th>
                              <th className="py-2 px-3">تاريخ الشراء</th>
                              <th className="py-2 px-3">القائمة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {rows.map(({ inv, it, key }) => (
                              <tr key={key} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-bold text-slate-900">{it.productName}{it.isGift ? ' 🎁' : ''}</td>
                                <td className="py-2 px-3">{it.isGift ? 'هدية' : formatMoney(it.unitPrice)}</td>
                                <td className="py-2 px-3 text-center font-bold">
                                  {it.quantity}{it.returnedQuantity ? <span className="text-rose-600 font-normal"> (مُرجَع {it.returnedQuantity})</span> : null}
                                </td>
                                <td className="py-2 px-3 text-slate-500">{new Date(inv.date).toLocaleDateString('ar-EG')}</td>
                                <td className="py-2 px-3 font-mono">{inv.invoiceNumber}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}
              
              {/* Invoices by this customer */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  قوائم الشراء والفواتير السابقة:
                </h4>
                {customerInvoicesInPeriod(selectedCustomer).length === 0 ? (
                  <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-lg text-center">
                    {periodActive ? 'لا توجد فواتير لهذا الزبون في الفترة المحددة' : 'لا توجد فواتير مسجلة باسم هذا الزبون'}
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                    <table className="w-full text-right">
                      <thead className="bg-slate-100 font-bold text-slate-700">
                        <tr>
                          <th className="py-2 px-3">رقم القائمة</th>
                          <th className="py-2 px-3">التاريخ</th>
                          <th className="py-2 px-3">نوع البيع</th>
                          <th className="py-2 px-3">الإجمالي</th>
                          <th className="py-2 px-3">المدفوع</th>
                          <th className="py-2 px-3">المتبقي (دين)</th>
                          <th className="py-2 px-3 text-center">عرض</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {customerInvoicesInPeriod(selectedCustomer)
                          .map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-bold">{inv.invoiceNumber}</td>
                              <td className="py-2 px-3 text-slate-500">
                                {new Date(inv.date).toLocaleDateString('ar-EG')}
                              </td>
                              <td className="py-2 px-3">
                                {inv.type === 'direct' ? 'مباشر (نقدي)' : 'آجل (دين)'}
                              </td>
                              <td className="py-2 px-3 font-bold">{formatMoney(inv.total)}</td>
                              <td className="py-2 px-3 text-emerald-700 font-bold">
                                {formatMoney(inv.paidAmount)}
                              </td>
                              <td className="py-2 px-3 font-bold text-amber-800">
                                {formatMoney(inv.remainingAmount)}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  onClick={() => {
                                    setIsStatementOpen(false);
                                    onViewInvoice(inv);
                                  }}
                                  className="text-emerald-600 hover:underline font-bold"
                                >
                                  معاينة
                                </button>
                                {hasPermission('canEditInvoice') && inv.status !== 'returned' && (
                                  <button
                                    onClick={() => {
                                      setIsStatementOpen(false);
                                      openInvoiceEditor(inv.id);
                                    }}
                                    className="text-amber-700 hover:underline font-bold mr-3"
                                  >
                                    تعديل
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

              {/* Payments by this customer */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  سجل سندات تسديد الديون (الدفعات):
                </h4>
                {customerPaymentsInPeriod(selectedCustomer).length === 0 ? (
                  <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-lg text-center">
                    لم يتم تسجيل أي سندات تسديد لهذا الزبون بعد
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                    <table className="w-full text-right">
                      <thead className="bg-slate-100 font-bold text-slate-700">
                        <tr>
                          <th className="py-2 px-3">رقم السند</th>
                          <th className="py-2 px-3">التاريخ والوقت</th>
                          <th className="py-2 px-3">المبلغ المسدد</th>
                          <th className="py-2 px-3">ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {customerPaymentsInPeriod(selectedCustomer)
                          .map((pay) => (
                            <tr key={pay.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-bold text-blue-800">
                                {pay.receiptNumber}
                              </td>
                              <td className="py-2 px-3 text-slate-500">
                                {new Date(pay.date).toLocaleString('ar-EG')}
                              </td>
                              <td className="py-2 px-3 font-black text-emerald-700 text-sm">
                                {formatMoney(pay.amount)}
                              </td>
                              <td className="py-2 px-3 text-slate-600">{pay.notes || '-'}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setIsStatementOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition"
              >
                إغلاق الكشف
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal 2: Record Payment / Debt Settlement (تسجيل سند قبض وسداد دين) */}
      {isPaymentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">تسجيل سند تسديد دين</h3>
                <p className="text-xs text-slate-500">الزبون: {selectedCustomer.name}</p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {recentReceipt ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-black text-lg text-slate-900">تم تسجيل السداد بنجاح!</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    سند قبض رقم: <strong className="font-mono text-slate-800">{recentReceipt.receiptNumber}</strong>
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2 text-right">
                  <div className="flex justify-between">
                    <span>المبلغ المسدد:</span>
                    <strong className="text-emerald-700 font-bold">{formatMoney(recentReceipt.amount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>المتبقي في ذمة الزبون الآن:</span>
                    <strong className="text-amber-800 font-bold">{formatMoney(selectedCustomer.totalDebt)}</strong>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      window.scrollTo(0, 0);
                      window.print();
                    }}
                    className="flex-1 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center gap-1.5 transition"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة وصل القبض</span>
                  </button>
                  <button
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
                  >
                    تم
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRecordPaymentSubmit} className="p-6 space-y-4">
                {paymentError && (
                  <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2.5 rounded-xl text-xs font-bold">
                    {paymentError}
                  </div>
                )}
                
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs flex justify-between items-center text-amber-900">
                  <span>الدين الحالي المستحق:</span>
                  <span className="font-black text-sm">{formatMoney(selectedCustomer.totalDebt)}</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    المبلغ المسدد نقداً <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={paymentAmount}
                      onChange={(e) =>
                        setPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                      placeholder="0.00"
                      className="w-full px-3 py-2 text-base font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      autoFocus
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      {settings.currency}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ملاحظات سند القبض
                  </label>
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="مثال: تسديد دفعة نقدية، حوالة، شيك..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
                  >
                    تأكيد السداد وتخفيض الدين
                  </button>
                </div>

              </form>
            )}

          </div>
        </div>
      )}

      {/* Modal 3: Add New Customer */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">إضافة زبون جديد</h3>
              <button
                onClick={() => setIsAddCustomerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomerSubmit} className="p-6 space-y-4">
              {newCustError && (
                <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2.5 rounded-xl text-xs font-bold">
                  {newCustError}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم الزبون / الشركة <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="مثال: علي محمد، مكتب السلام للمقاولات..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم الهاتف
                </label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="07XXXXXXXXX"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  العنوان / المنطقة
                </label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="مثال: بغداد - المنصور"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رصيد دين سابق (إن وجد)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newCustInitialDebt}
                  onChange={(e) =>
                    setNewCustInitialDebt(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظات
                </label>
                <textarea
                  rows={2}
                  value={newCustNotes}
                  onChange={(e) => setNewCustNotes(e.target.value)}
                  placeholder="ملاحظات حول سداد العميل وتعامله..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
                >
                  حفظ الزبون
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {telegramCustomer && (
        <CustomerTelegramModal customer={telegramCustomer} onClose={() => setTelegramCustomer(null)} />
      )}
    </div>
  );
};
