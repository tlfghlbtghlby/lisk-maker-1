import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle, 
  Clock, 
  Receipt, 
  DollarSign, 
  TrendingUp, 
  Package, 
  AlertCircle,
  Eye,
  FileText
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface EndShiftModalProps {
  onNavigateToShifts?: () => void;
}

export const EndShiftModal: React.FC<EndShiftModalProps> = ({ onNavigateToShifts }) => {
  const { 
    activeShift, 
    isEndShiftModalOpen, 
    setIsEndShiftModalOpen, 
    endShift, 
    getShiftStats, 
    formatMoney, 
    setSyncNotice,
    setSelectedShiftForDetails
  } = useApp();

  const [notes, setNotes] = useState<string>('');
  const [elapsed, setElapsed] = useState<string>('00:00:00');
  const [isEnding, setIsEnding] = useState<boolean>(false);

  // تحديث عداد وقت الشفت
  useEffect(() => {
    if (!activeShift || !activeShift.startTime) return;

    const updateTimer = () => {
      const startMs = new Date(activeShift.startTime).getTime();
      const nowMs = Date.now();
      const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));

      const hours = Math.floor(diffSec / 3600);
      const minutes = Math.floor((diffSec % 3600) / 60);
      const seconds = diffSec % 60;

      const pad = (n: number) => String(n).padStart(2, '0');
      setElapsed(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeShift]);

  if (!isEndShiftModalOpen || !activeShift) return null;

  const stats = getShiftStats(activeShift);
  const totalPiecesSold = stats.itemsSold.reduce((acc, curr) => acc + (curr.quantity || 0), 0);

  const handleConfirmEnd = async () => {
    setIsEnding(true);
    try {
      const closed = await endShift(notes);
      setIsEndShiftModalOpen(false);
      setNotes('');
      setSyncNotice(`✅ تم إنهاء شفت العمل #${activeShift.shiftNumber} بنجاح وحفظ كامل بياناته ومبيعاته.`);
      setTimeout(() => setSyncNotice(null), 4000);
      if (onNavigateToShifts) {
        onNavigateToShifts();
      }
    } catch (err) {
      console.error('فشل في إنهاء الشفت:', err);
    } finally {
      setIsEnding(false);
    }
  };

  const handleOpenLiveDetails = () => {
    // تجهيز شفت وهمي يحمل الإحصائيات الحالية لمعاينته
    const liveShiftSnapshot = {
      ...activeShift,
      invoicesCount: stats.invoicesCount,
      totalSales: stats.totalSales,
      totalPaid: stats.totalPaid,
      totalRemaining: stats.totalRemaining,
      totalCost: stats.totalCost,
      totalProfit: stats.totalProfit,
      itemsSold: stats.itemsSold,
      invoicesIds: stats.invoices.map(i => i.id)
    };
    setSelectedShiftForDetails(liveShiftSnapshot);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden text-right"
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">إنهاء شفت العمل وحفظه</h3>
                <span className="text-[11px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                  شفت رقم #{activeShift.shiftNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                مراجعة إجمالي المبيعات، المواد المبوعة والأرباح وتأكيد الإغلاق
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsEndShiftModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Time & Cashier Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">بدأ الشفت في:</span>
              <span className="font-bold text-slate-800">
                {new Date(activeShift.startTime).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })} - {new Date(activeShift.startTime).toLocaleDateString('ar-IQ')}
              </span>
            </div>
            <div className="text-left">
              <span className="text-slate-500 block text-[11px]">مدة العمل الحالية:</span>
              <span className="font-mono font-black text-indigo-700 text-sm">
                ⏱️ {elapsed}
              </span>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {/* Total Sales */}
            <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-blue-700 mb-1">
                <DollarSign className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold">إجمالي المبيعات</span>
              </div>
              <div className="text-sm font-black text-blue-950">
                {formatMoney(stats.totalSales)}
              </div>
              <div className="text-[10px] text-blue-600 mt-0.5">
                نقد: {formatMoney(stats.totalPaid)}
              </div>
            </div>

            {/* Total Profit */}
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-emerald-700 mb-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold">صافي الأرباح</span>
              </div>
              <div className="text-sm font-black text-emerald-950">
                {formatMoney(stats.totalProfit)}
              </div>
              <div className="text-[10px] text-emerald-600 mt-0.5">
                هامش: {stats.totalSales > 0 ? `${((stats.totalProfit / stats.totalSales) * 100).toFixed(1)}%` : '0%'}
              </div>
            </div>

            {/* Invoices Count */}
            <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-purple-700 mb-1">
                <Receipt className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold">القوائم المبيوعة</span>
              </div>
              <div className="text-sm font-black text-purple-950">
                {stats.invoicesCount} قائمة
              </div>
              <div className="text-[10px] text-purple-600 mt-0.5">
                {totalPiecesSold} قطعة مباعة
              </div>
            </div>
          </div>

          {/* Quick Materials Snapshot button */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-600" />
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  المواد المبيوعة في هذا الشفت ({stats.itemsSold.length} صنف مختلف)
                </span>
                <span className="text-[11px] text-slate-500">
                  يمكنك معاينة تفاصيل كل مادة وربحها قبل الإغلاق
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenLiveDetails}
              className="px-3 py-1.5 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>معاينة المواد</span>
            </button>
          </div>

          {/* Closing Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-500" />
              <span>ملاحظات إغلاق الشفت (اختياري):</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثلاً: تم جرد القاصة وتسليمها للمشرف..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none transition resize-none"
            />
          </div>

          {/* Reminder Notice */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              عند النقر على تأكيد الإنهاء، سيتم إيقاف المؤقت وتجميد هذا الشفت وحفظه في سجل الشفتات للرجوع إليه وطباعته في أي وقت.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleConfirmEnd}
              disabled={isEnding}
              className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-amber-600/20 active:scale-98 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{isEnding ? 'جاري إنهاء وحفظ الشفت...' : 'تأكيد إنهاء الشفت وحفظه'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEndShiftModalOpen(false)}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              متابعة العمل في الشفت
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
