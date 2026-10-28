import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Invoice, InvoiceItem } from '../types';
import { 
  X, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  PackageMinus, 
  DollarSign, 
  CreditCard, 
  HelpCircle, 
  Plus, 
  Minus,
  Sparkles,
  Info
} from 'lucide-react';

interface PartialReturnModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const COMMON_REASONS = [
  'رغبة الزبون / تبديل',
  'تالف / عيب مصنعي',
  'خطأ في المقاس أو الطلب',
  'سعر مختلف / غير مناسب',
  'تأخر أو فائض عن الحاجة',
  'أخرى'
];

export const PartialReturnModal: React.FC<PartialReturnModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { returnPartialInvoice, formatMoney, settings } = useApp();

  // Map of productId -> quantity to return this time
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [selectedPresetReason, setSelectedPresetReason] = useState<string>('رغبة الزبون / تبديل');
  const [customReasonText, setCustomReasonText] = useState<string>('');
  const [additionalNotes, setAdditionalNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize quantities when modal opens or invoice changes
  React.useEffect(() => {
    if (invoice) {
      setReturnQuantities({});
      setSelectedPresetReason('رغبة الزبون / تبديل');
      setCustomReasonText('');
      setAdditionalNotes('');
      setErrorMessage(null);
    }
  }, [invoice, isOpen]);

  if (!isOpen || !invoice) return null;

  // Calculate returnable items
  const itemsWithReturnable = invoice.items.map(item => {
    const alreadyReturned = item.returnedQuantity || 0;
    const maxReturnable = Math.max(0, item.quantity - alreadyReturned);
    const currentSelected = returnQuantities[item.productId] || 0;
    return {
      ...item,
      alreadyReturned,
      maxReturnable,
      currentSelected,
      lineRefund: currentSelected * item.unitPrice,
    };
  });

  const totalSelectedPieces = Object.values(returnQuantities).reduce((sum, q) => sum + (q || 0), 0);
  const totalRefundAmount = itemsWithReturnable.reduce((sum, it) => sum + it.lineRefund, 0);

  // Financial impact calculation
  const debtDeduction = invoice.remainingAmount > 0 
    ? Math.min(invoice.remainingAmount, totalRefundAmount)
    : 0;
  const cashRefund = Math.max(0, totalRefundAmount - debtDeduction);

  const handleSetQuantity = (productId: string, val: number, max: number) => {
    const safeVal = Math.max(0, Math.min(val, max));
    setReturnQuantities(prev => ({
      ...prev,
      [productId]: safeVal
    }));
    if (errorMessage) setErrorMessage(null);
  };

  const handleReturnAllItem = (productId: string, max: number) => {
    handleSetQuantity(productId, max, max);
  };

  const handleResetItem = (productId: string) => {
    handleSetQuantity(productId, 0, 0);
  };

  const handleSelectAllMax = () => {
    const all: Record<string, number> = {};
    itemsWithReturnable.forEach(it => {
      all[it.productId] = it.maxReturnable;
    });
    setReturnQuantities(all);
    if (errorMessage) setErrorMessage(null);
  };

  const handleResetAll = () => {
    setReturnQuantities({});
  };

  const finalReason = customReasonText.trim() 
    ? customReasonText.trim() 
    : selectedPresetReason;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (totalSelectedPieces <= 0) {
      setErrorMessage('يرجى تحديد كمية مادة واحدة على الأقل للإرجاع (الكمية الحالية 0).');
      return;
    }

    if (!finalReason) {
      setErrorMessage('يرجى تحديد أو كتابة سبب الاسترجاع في الخانة المخصصة.');
      return;
    }

    const itemsToReturn = Object.entries(returnQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, quantity]) => ({
        productId,
        quantity,
      }));

    setIsSubmitting(true);
    try {
      const res = await returnPartialInvoice(
        invoice.id,
        itemsToReturn,
        finalReason,
        additionalNotes
      );

      if (res.success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || 'تعذر إتمام عملية الاسترجاع.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ غير متوقع أثناء الاسترجاع.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full my-6 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-purple-50 via-white to-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-200 shrink-0">
              <PackageMinus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">استرجاع جزئي للقائمة</h2>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                  {invoice.invoiceNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                العميل: <strong className="text-slate-800 font-bold">{invoice.customerName}</strong>
                {invoice.type === 'direct' ? ' (نقدي)' : ' (آجل / دين)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-5 overflow-y-auto max-h-[75vh]">
          
          {/* Quick Notice */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>ملاحظة هامة:</strong> سيتم إعادة الكميات المحددة فوراً إلى رصيد المستودع، وخصم قيمتها تلقائياً من ذمة الزبون أو الصندوق وتوثيق العملية في سجل القائمة.
            </div>
          </div>

          {/* Action Bar for items selection */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-bold text-slate-700">
              حدد المواد والكميات المراد إرجاعها:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllMax}
                className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-md transition"
              >
                تحديد الكل للإرجاع
              </button>
              {totalSelectedPieces > 0 && (
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md transition"
                >
                  تصفير
                </button>
              )}
            </div>
          </div>

          {/* Items Table / Cards */}
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
            {itemsWithReturnable.map((item, idx) => {
              const isFullyReturned = item.maxReturnable <= 0;
              const hasSelected = item.currentSelected > 0;

              return (
                <div 
                  key={item.productId || idx}
                  className={`p-3 sm:p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isFullyReturned 
                      ? 'bg-slate-50 opacity-60' 
                      : hasSelected 
                      ? 'bg-purple-50/40' 
                      : 'hover:bg-slate-50/60'
                  }`}
                >
                  {/* Item info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-900 truncate">
                        {item.productName || (item as any).name || 'مادة'}
                      </span>
                      {item.code && (
                        <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {item.code}
                        </span>
                      )}
                      {item.alreadyReturned > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                          مسترجع سابقاً: {item.alreadyReturned} {item.unit || 'قطعة'}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                      <span>السعر: <strong className="text-slate-800 font-bold">{formatMoney(item.unitPrice)}</strong></span>
                      <span>الكمية بالقائمة: <strong className="text-slate-800 font-bold">{item.quantity}</strong></span>
                      <span className="text-purple-700 font-bold">
                        المتبقي القابل للإرجاع: {item.maxReturnable} {item.unit || 'قطعة'}
                      </span>
                    </div>
                  </div>

                  {/* Quantity Stepper & Subtotal */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    {isFullyReturned ? (
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg">
                        تم استرجاع كامل الكمية
                      </span>
                    ) : (
                      <>
                        <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleSetQuantity(item.productId, item.currentSelected - 1, item.maxReturnable)}
                            disabled={item.currentSelected <= 0}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          
                          <input
                            type="number"
                            min="0"
                            max={item.maxReturnable}
                            value={item.currentSelected === 0 ? '' : item.currentSelected}
                            placeholder="0"
                            onChange={(e) => {
                              const num = parseInt(e.target.value) || 0;
                              handleSetQuantity(item.productId, num, item.maxReturnable);
                            }}
                            className="w-14 text-center font-bold text-slate-900 text-sm py-1 border-x border-slate-200 focus:outline-hidden"
                          />

                          <button
                            type="button"
                            onClick={() => handleSetQuantity(item.productId, item.currentSelected + 1, item.maxReturnable)}
                            disabled={item.currentSelected >= item.maxReturnable}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleReturnAllItem(item.productId, item.maxReturnable)}
                          className="text-[11px] font-bold text-slate-600 hover:text-purple-700 border border-slate-200 hover:border-purple-300 bg-slate-50 hover:bg-purple-50 px-2 py-1.5 rounded-lg transition"
                          title="إرجاع كامل المتبقي لهذه المادة"
                        >
                          الكل ({item.maxReturnable})
                        </button>

                        <div className="min-w-20 text-left font-mono font-bold text-xs text-purple-900">
                          {formatMoney(item.lineRefund)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Section: Reason for Return (خانة سبب الاسترجاع) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-purple-600" />
                <span>خانة سبب الاسترجاع (إلزامي للتوثيق والشفافية):</span>
              </label>
              <span className="text-[11px] text-slate-400">اختر أو اكتب السبب</span>
            </div>

            {/* Quick Reason Chips */}
            <div className="flex flex-wrap gap-1.5">
              {COMMON_REASONS.map((reason) => {
                const isSelected = selectedPresetReason === reason && !customReasonText;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => {
                      setSelectedPresetReason(reason);
                      setCustomReasonText('');
                    }}
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-bold transition border ${
                      isSelected
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300 hover:text-purple-700'
                    }`}
                  >
                    {reason}
                  </button>
                );
              })}
            </div>

            {/* Free text field for Reason */}
            <div>
              <input
                type="text"
                value={customReasonText}
                onChange={(e) => setCustomReasonText(e.target.value)}
                placeholder={selectedPresetReason ? `السبب المختار: "${selectedPresetReason}" (أو اكتب سبباً مخصصاً هنا...)` : "اكتب سبب إرجاع المادة..."}
                className="w-full text-xs font-semibold px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Optional Additional Notes */}
            <div>
              <input
                type="text"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="ملاحظات تفصيلية إضافية (اختياري)..."
                className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden text-slate-700"
              />
            </div>
          </div>

          {/* Financial Summary Box */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-4 space-y-2.5 shadow-md">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>إجمالي المواد المحددة للإرجاع:</span>
              <span className="font-bold font-mono text-white text-sm">{totalSelectedPieces} قطعة</span>
            </div>

            <div className="flex items-center justify-between text-sm font-extrabold border-t border-slate-700 pt-2">
              <span className="text-purple-300">إجمالي المبلغ المسترد:</span>
              <span className="text-lg font-mono text-emerald-400">{formatMoney(totalRefundAmount)}</span>
            </div>

            {/* Breakdown of Refund Settlement */}
            {totalRefundAmount > 0 && (
              <div className="text-xs bg-slate-800/80 rounded-lg p-2.5 border border-slate-700 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-300">طريقة تسوية المبلغ المسترد:</div>
                {debtDeduction > 0 && (
                  <div className="flex items-center justify-between text-amber-300">
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5" />
                      خصم تلقائي من دين الزبون المتبقي:
                    </span>
                    <span className="font-mono font-bold">-{formatMoney(debtDeduction)}</span>
                  </div>
                )}
                {cashRefund > 0 && (
                  <div className="flex items-center justify-between text-emerald-300">
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      إرجاع نقدي للزبون من الصندوق:
                    </span>
                    <span className="font-mono font-bold">+{formatMoney(cashRefund)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Message Notice */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={isSubmitting || totalSelectedPieces <= 0}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold flex items-center gap-2 shadow-md shadow-purple-200 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <RotateCcw className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
              <span>{isSubmitting ? 'جاري التنفيذ والتسوية...' : 'تأكيد الاسترجاع الجزئي'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

export default PartialReturnModal;
