import React, { useState, useMemo, useEffect } from 'react';
import { 
  Clock, 
  Play, 
  CheckCircle, 
  Receipt, 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Search, 
  User, 
  Eye, 
  Trash2, 
  Hourglass,
  Sparkles,
  ArrowRight,
  Filter,
  BarChart3,
  Layers,
  Plus,
  Edit2,
  KeyRound,
  Lock,
  CheckCircle2,
  X,
  Monitor,
  Smartphone,
  Globe,
  Cpu,
  Users
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Shift, Invoice, PresetShift } from '../types';
import { ActiveSessionsModal } from './ActiveSessionsModal';

interface ShiftsViewProps {
  onViewInvoice?: (invoice: Invoice) => void;
}

export const ShiftsView: React.FC<ShiftsViewProps> = ({ onViewInvoice }) => {
  const { 
    shifts, 
    activeShift, 
    hasPermission, 
    setIsStartShiftModalOpen, 
    setIsEndShiftModalOpen,
    setSelectedShiftForDetails,
    getShiftStats,
    deleteShift,
    formatMoney,
    sessionRole,
    settings,
    addPresetShift,
    updatePresetShift,
    deletePresetShift,
    currentDeviceId,
    deviceSessions,
    isActiveSessionsModalOpen,
    setIsActiveSessionsModalOpen
  } = useApp();

  const otherActiveShifts = useMemo(() => {
    return shifts.filter(s => s.status === 'active' && s.id !== activeShift?.id);
  }, [shifts, activeShift]);

  const [mainTab, setMainTab] = useState<'records' | 'presets'>('records');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeElapsed, setActiveElapsed] = useState('00:00:00');

  // إعدادات الشفتات المسبقة
  const [isAddingPreset, setIsAddingPreset] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [presetCode, setPresetCode] = useState('');
  const [presetNotes, setPresetNotes] = useState('');
  const [presetFeedback, setPresetFeedback] = useState<string | null>(null);

  // عداد الوقت المباشر للشفت النشط
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
      setActiveElapsed(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeShift]);

  // تصفية الشفتات حسب التاريخ والبحث
  const filteredShifts = useMemo(() => {
    let list = [...shifts];

    // فلتر التاريخ
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    if (dateFilter === 'today') {
      list = list.filter(s => new Date(s.startTime).getTime() >= startOfToday);
    } else if (dateFilter === 'yesterday') {
      list = list.filter(s => {
        const time = new Date(s.startTime).getTime();
        return time >= startOfYesterday && time < startOfToday;
      });
    } else if (dateFilter === 'week') {
      list = list.filter(s => new Date(s.startTime).getTime() >= startOfWeek);
    } else if (dateFilter === 'month') {
      list = list.filter(s => new Date(s.startTime).getTime() >= startOfMonth);
    }

    // فلتر البحث
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s => {
        const shiftNumStr = String(s.shiftNumber || '');
        const cashierName = s.openedBy?.name?.toLowerCase() || '';
        const notes = s.notes?.toLowerCase() || '';
        return shiftNumStr.includes(q) || cashierName.includes(q) || notes.includes(q);
      });
    }

    return list;
  }, [shifts, dateFilter, searchQuery]);

  // إحصائيات الفترة المحددة
  const periodTotals = useMemo(() => {
    let sales = 0;
    let profit = 0;
    let invoicesCount = 0;
    let totalSeconds = 0;

    filteredShifts.forEach(s => {
      sales += s.totalSales || 0;
      profit += s.totalProfit || 0;
      invoicesCount += s.invoicesCount || 0;

      const startMs = new Date(s.startTime).getTime();
      const endMs = s.endTime ? new Date(s.endTime).getTime() : Date.now();
      totalSeconds += Math.max(0, Math.floor((endMs - startMs) / 1000));
    });

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    return {
      sales,
      profit,
      invoicesCount,
      durationStr: `${hours} س و ${minutes} د`,
      count: filteredShifts.length,
    };
  }, [filteredShifts]);

  // تنسيق مدة الشفت
  const getDuration = (shift: Shift) => {
    const startMs = new Date(shift.startTime).getTime();
    const endMs = shift.endTime ? new Date(shift.endTime).getTime() : Date.now();
    const diffSec = Math.max(0, Math.floor((endMs - startMs) / 1000));
    const hours = Math.floor(diffSec / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);
    if (hours > 0) {
      return `${hours} ساعة و ${minutes} د`;
    }
    return `${minutes} دقيقة`;
  };

  // إظهار معلومات الشفت
  const handleShowDetails = (shift: Shift) => {
    if (shift.status === 'active') {
      const liveStats = getShiftStats(shift);
      setSelectedShiftForDetails({
        ...shift,
        invoicesCount: liveStats.invoicesCount,
        totalSales: liveStats.totalSales,
        totalPaid: liveStats.totalPaid,
        totalRemaining: liveStats.totalRemaining,
        totalCost: liveStats.totalCost,
        totalProfit: liveStats.totalProfit,
        itemsSold: liveStats.itemsSold,
        invoicesIds: liveStats.invoices.map(i => i.id)
      });
    } else {
      setSelectedShiftForDetails(shift);
    }
  };

  // حذف شفت
  const handleDelete = async (shift: Shift) => {
    if (!window.confirm(`هل أنت متأكد من حذف سجل الشفت #${shift.shiftNumber} نهائياً؟`)) {
      return;
    }
    await deleteShift(shift.id);
  };

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim() || !presetCode.trim()) {
      setPresetFeedback('يرجى إدخال اسم الشفت والرمز السري الخاص به');
      return;
    }
    try {
      if (editingPresetId) {
        await updatePresetShift(editingPresetId, {
          name: presetName.trim(),
          code: presetCode.trim(),
          notes: presetNotes.trim(),
        });
        setPresetFeedback('تم حفظ تعديلات الشفت بنجاح');
      } else {
        await addPresetShift({
          name: presetName.trim(),
          code: presetCode.trim(),
          notes: presetNotes.trim(),
        });
        setPresetFeedback('تمت إضافة قالب الشفت الجديد بنجاح');
      }
      setIsAddingPreset(false);
      setEditingPresetId(null);
      setPresetName('');
      setPresetCode('');
      setPresetNotes('');
      setTimeout(() => setPresetFeedback(null), 4000);
    } catch (err: any) {
      setPresetFeedback(err.message || 'حدث خطأ أثناء حفظ قالب الشفت');
    }
  };

  const handleStartEditPreset = (preset: PresetShift) => {
    setEditingPresetId(preset.id);
    setPresetName(preset.name);
    setPresetCode(preset.code);
    setPresetNotes(preset.notes || '');
    setIsAddingPreset(false);
  };

  const handleDeletePreset = async (preset: PresetShift) => {
    if (!window.confirm(`هل أنت متأكد من حذف قالب الشفت (${preset.name})؟`)) {
      return;
    }
    try {
      await deletePresetShift(preset.id);
      setPresetFeedback('تم حذف قالب الشفت بنجاح');
      setTimeout(() => setPresetFeedback(null), 4000);
    } catch (err: any) {
      setPresetFeedback(err.message || 'فشل في حذف الشفت');
    }
  };

  const activeStats = activeShift ? getShiftStats(activeShift) : null;
  const canConfigure = sessionRole === 'admin' || hasPermission('canConfigureShifts');

  return (
    <div className="space-y-5" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              إدارة وسجل شفتات العمل (الورديات)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              متابعة ساعات العمل، الشفتات المسبقة، فواتير المبيعات وصافي الأرباح لكل وردية
            </p>
          </div>
        </div>

        {/* Buttons: Sessions + Start/End Shift */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsActiveSessionsModalOpen(true)}
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
            title="عرض الأجهزة والهواتف المتصلة ومواقعها والشفت المفتوح على كل جهاز"
          >
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>جلسات الأجهزة المتصلة</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold">
              {deviceSessions.length}
            </span>
          </button>

          {hasPermission('canManageShifts') && (
            <div>
              {!activeShift ? (
                <button
                  type="button"
                  onClick={() => setIsStartShiftModalOpen(true)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-indigo-600/20 active:scale-98"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>بدء شفت جديد في هذا الجهاز</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEndShiftModalOpen(true)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-amber-600/20 active:scale-98"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>إنهاء شفت هذا الجهاز</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sub-Tabs: سجل الشفتات | إعداد قوالب الشفتات (للأدمن والمشرف المخول) */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMainTab('records')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              mainTab === 'records'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>سجل الشفتات والورديات السابقة</span>
            <span className="text-[10px] bg-slate-800 text-white px-2 py-0.5 rounded-full font-mono">
              {shifts.length}
            </span>
          </button>

          {canConfigure && (
            <button
              type="button"
              onClick={() => setMainTab('presets')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                mainTab === 'presets'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <KeyRound className="w-4 h-4 text-indigo-400" />
              <span>قوالب الشفتات المسبقة (الاسم والرمز)</span>
              <span className="text-[10px] bg-indigo-700 text-white px-2 py-0.5 rounded-full font-mono">
                {(settings.presetShifts || []).length}
              </span>
            </button>
          )}
        </div>
      </div>

      {presetFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2 shadow-2xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{presetFeedback}</span>
        </div>
      )}

      {/* View 1: Preset Shifts Management */}
      {mainTab === 'presets' && canConfigure && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-indigo-600" />
                  <span>إعداد قوالب الشفتات المسبقة ومشاركتها مع الكاشير</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  كل شفت له اسم ورمز سري مخصص لبدئه. لا يستطيع الموظف البيع إلا باختيار أحد هذه الشفتات وإدخال رمزه السري.
                </p>
              </div>

              {!isAddingPreset && !editingPresetId && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingPreset(true);
                    setEditingPresetId(null);
                    setPresetName('');
                    setPresetCode('');
                    setPresetNotes('');
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة شفت مسبق جديد</span>
                </button>
              )}
            </div>

            {/* Add / Edit Form */}
            {(isAddingPreset || editingPresetId) && (
              <form onSubmit={handleSavePreset} className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-indigo-200/80 pb-2">
                  <span className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                    {editingPresetId ? <Edit2 className="w-4 h-4 text-indigo-600" /> : <Plus className="w-4 h-4 text-indigo-600" />}
                    <span>{editingPresetId ? 'تعديل بيانات قالب الشفت' : 'إضافة قالب شفت جديد'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingPreset(false);
                      setEditingPresetId(null);
                    }}
                    className="text-xs text-indigo-700 hover:text-indigo-900 font-bold p-1 cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      اسم الشفت: <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="مثال: الشفت الصباحي / شفت المساء"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      الرمز السري الخاص بالشفت: <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={presetCode}
                      onChange={(e) => setPresetCode(e.target.value)}
                      placeholder="مثال: 1234 أو رمزه الخاص"
                      className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ملاحظات أو تعليمات الشفت (اختياري):
                  </label>
                  <input
                    type="text"
                    value={presetNotes}
                    onChange={(e) => setPresetNotes(e.target.value)}
                    placeholder="مثال: دوام من الساعة 8 صباحاً حتى 4 عصراً"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingPreset(false);
                      setEditingPresetId(null);
                    }}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    {editingPresetId ? 'حفظ التعديلات' : 'إضافة الشفت'}
                  </button>
                </div>
              </form>
            )}

            {/* List of Presets */}
            {(!settings.presetShifts || settings.presetShifts.length === 0) ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                <KeyRound className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold text-slate-600">لا توجد قوالب شفتات مسبقة حتى الآن</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  قم بإضافة الشفتات المعتمدة لموظفيك (مثلاً: صباحي، مسائي) مع تحديد رمز خاص لكل شفت.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {settings.presetShifts.map((preset) => (
                  <div
                    key={preset.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-300 transition shadow-2xs flex flex-col justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-extrabold text-sm text-slate-900 block">
                            {preset.name}
                          </span>
                          {preset.notes && (
                            <span className="text-[11px] text-slate-500 mt-0.5 block">
                              {preset.notes}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono font-black bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full border border-indigo-200 shrink-0">
                          رمز: {preset.code}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                      <span className="text-[10px] text-slate-400">
                        {preset.createdAt ? new Date(preset.createdAt).toLocaleDateString('ar-IQ') : 'معد مسبقاً'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEditPreset(preset)}
                          className="px-2 py-1 text-xs font-bold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>تعديل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePreset(preset)}
                          className="px-2 py-1 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* View 2: Records History (Only show when mainTab === 'records') */}
      {mainTab === 'records' && (
        <>
          {/* Active Shift Hero Card (إذا كان هناك شفت نشط حالياً) */}
          {activeShift && activeStats && (
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-lg border border-amber-500/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-amber-300">
                      شفت رقم #{activeShift.shiftNumber} (نشط قيد العمل)
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                      مؤقت جاري
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    بدأ في {new Date(activeShift.startTime).toLocaleTimeString('ar-IQ')} بواسطة {activeShift.openedBy?.name}
                  </span>
                </div>
              </div>

              {/* Running Timer */}
              <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl px-4 py-2 flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="text-[10px] text-slate-400 block">مدة العمل الحالية:</span>
                  <span className="font-mono font-black text-amber-300 text-base">
                    {activeElapsed}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Live Numbers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">مبيعات الشفت الحالي:</span>
                <span className="text-base font-black text-white">{formatMoney(activeStats.totalSales)}</span>
                <span className="text-[10px] text-emerald-400 block mt-0.5">نقد: {formatMoney(activeStats.totalPaid)}</span>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">صافي الأرباح الجارية:</span>
                <span className="text-base font-black text-emerald-400">{formatMoney(activeStats.totalProfit)}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  هامش: {activeStats.totalSales > 0 ? `${((activeStats.totalProfit / activeStats.totalSales) * 100).toFixed(1)}%` : '0%'}
                </span>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">القوائم الصادرة:</span>
                <span className="text-base font-black text-white">{activeStats.invoicesCount} قائمة</span>
                <span className="text-[10px] text-indigo-300 block mt-0.5">{activeStats.itemsSold.length} صنف مباع</span>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex flex-col justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleShowDetails(activeShift)}
                  className="w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>إظهار معلومات الشفت</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEndShiftModalOpen(true)}
                  className="w-full py-1.5 px-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>إنهاء الشفت</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* شفتات الأجهزة المتصلة الأخرى النشطة في نفس الوقت */}
      {otherActiveShifts.length > 0 && (
        <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200/80 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                <Monitor className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-indigo-950">
                  شفتات نشطة في أجهزة أخرى في نفس الوقت ({otherActiveShifts.length})
                </h4>
                <p className="text-[11px] text-indigo-700">
                  محطات كاشير وهواتف أخرى تعمل بالتوازي ومبيعاتها معزولة ومستقلة لحظياً دون تداخل.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsActiveSessionsModalOpen(true)}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer self-start sm:self-auto"
            >
              معاينة كافة الجلسات والأجهزة
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {otherActiveShifts.map((otherShift) => {
              const stats = getShiftStats(otherShift);
              return (
                <div
                  key={otherShift.id}
                  className="bg-white border border-indigo-100 rounded-xl p-3 shadow-2xs flex flex-col justify-between gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                        <span className="font-bold text-xs text-slate-900">
                          {otherShift.presetShiftName || `شفت #${otherShift.shiftNumber}`}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        الكاشير: <strong className="text-slate-700">{otherShift.openedBy?.name}</strong>
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        الجهاز: {otherShift.deviceName || 'جهاز متصل'}
                      </span>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                      نشط الآن
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">المبيعات:</span>
                      <span className="font-black text-slate-800">{formatMoney(stats.totalSales)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleShowDetails(otherShift)}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>عرض</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Period KPI Summary Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Shifts Sales */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-blue-700 text-xs font-bold mb-1">
            <span>إجمالي مبيعات الشفتات</span>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-lg font-black text-blue-950">
            {formatMoney(periodTotals.sales)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            في الفترة المحددة ({periodTotals.count} شفت)
          </div>
        </div>

        {/* Total Shifts Profit */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-bold mb-1">
            <span>صافي أرباح الشفتات</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-black text-emerald-700">
            {formatMoney(periodTotals.profit)}
          </div>
          <div className="text-[11px] text-emerald-600 font-bold mt-1">
            هامش الربح: {periodTotals.sales > 0 ? `${((periodTotals.profit / periodTotals.sales) * 100).toFixed(1)}%` : '0%'}
          </div>
        </div>

        {/* Invoices Count */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-purple-700 text-xs font-bold mb-1">
            <span>إجمالي القوائم المنفذة</span>
            <Receipt className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-lg font-black text-purple-950">
            {periodTotals.invoicesCount} قائمة
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            متوسط {periodTotals.count > 0 ? (periodTotals.invoicesCount / periodTotals.count).toFixed(1) : 0} قائمة لكل شفت
          </div>
        </div>

        {/* Total Working Time */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-indigo-700 text-xs font-bold mb-1">
            <span>مجموع ساعات الدوام</span>
            <Hourglass className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-lg font-black text-indigo-950">
            {periodTotals.durationStr}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            ساعات العمل المحسوبة
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Date Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none text-xs">
          {[
            { id: 'all' as const, label: 'كل الشفتات' },
            { id: 'today' as const, label: 'اليوم' },
            { id: 'yesterday' as const, label: 'أمس' },
            { id: 'week' as const, label: 'آخر 7 أيام' },
            { id: 'month' as const, label: 'هذا الشهر' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDateFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                dateFilter === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث برقم الشفت أو اسم الكاشير..."
            className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
          />
        </div>
      </div>

      {/* Shifts Table */}
      {filteredShifts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 mx-auto flex items-center justify-center">
            <Clock className="w-8 h-8" />
          </div>
          <h3 className="text-base font-extrabold text-slate-800">لا توجد سجلات شفتات في هذه الفترة</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            يمكنك بدء شفت جديد بالضغط على زر "بدء الشفت" بجانب وضع الحاسبة لتشغيل المؤقت واحتساب كافة المبيعات والمواد.
          </p>
          {hasPermission('canManageShifts') && !activeShift && (
            <button
              type="button"
              onClick={() => setIsStartShiftModalOpen(true)}
              className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>بدء شفت الآن</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-extrabold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3.5">رقم الشفت</th>
                  <th className="py-3 px-3.5">الحالة</th>
                  <th className="py-3 px-3.5">وقت البدء</th>
                  <th className="py-3 px-3.5">وقت الإغلاق</th>
                  <th className="py-3 px-3.5">مدة الشفت</th>
                  <th className="py-3 px-3.5">المسؤول / الكاشير</th>
                  <th className="py-3 px-3.5 text-center">القوائم</th>
                  <th className="py-3 px-3.5">إجمالي المبيعات</th>
                  <th className="py-3 px-3.5">المقبوض نقد</th>
                  <th className="py-3 px-3.5 text-emerald-700 font-black">صافي الربح</th>
                  <th className="py-3 px-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredShifts.map(shift => {
                  const isCurrentActive = shift.status === 'active';

                  return (
                    <tr 
                      key={shift.id} 
                      className={`hover:bg-slate-50/80 transition ${
                        isCurrentActive ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="font-mono font-black text-slate-900 block text-xs">
                          #{shift.shiftNumber}
                        </span>
                        {shift.presetShiftName && (
                          <span className="inline-block text-[10px] font-sans font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 mt-0.5">
                            {shift.presetShiftName}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3.5">
                        {isCurrentActive ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>نشط قيد العمل</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full w-fit">
                            مكتمل ومغلق
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                        <div className="font-bold">
                          {new Date(shift.startTime).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(shift.startTime).toLocaleDateString('ar-IQ')}
                        </div>
                      </td>

                      <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                        {shift.endTime ? (
                          <>
                            <div className="font-bold">
                              {new Date(shift.endTime).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(shift.endTime).toLocaleDateString('ar-IQ')}
                            </div>
                          </>
                        ) : (
                          <span className="text-amber-600 font-bold text-[11px]">- قيد العمل -</span>
                        )}
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded-md font-bold text-[11px]">
                          {isCurrentActive ? activeElapsed : getDuration(shift)}
                        </span>
                      </td>

                      <td className="py-3 px-3.5 font-bold text-slate-800 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{shift.openedBy?.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block pr-5">
                          {shift.openedBy?.role === 'admin' ? 'المدير' : shift.openedBy?.role === 'supervisor' ? 'مشرف' : 'كاشير'}
                        </span>
                      </td>

                      <td className="py-3 px-3.5 text-center font-bold text-slate-900">
                        {shift.invoicesCount || 0}
                      </td>

                      <td className="py-3 px-3.5 font-black text-blue-950 whitespace-nowrap">
                        {formatMoney(shift.totalSales || 0)}
                      </td>

                      <td className="py-3 px-3.5 font-bold text-slate-700 whitespace-nowrap">
                        {formatMoney(shift.totalPaid || 0)}
                      </td>

                      <td className="py-3 px-3.5 font-black text-emerald-700 whitespace-nowrap">
                        +{formatMoney(shift.totalProfit || 0)}
                      </td>

                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* زر إظهار معلومات الشفت */}
                          <button
                            type="button"
                            onClick={() => handleShowDetails(shift)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer border border-indigo-200 shadow-2xs"
                            title="إظهار معلومات الشفت والمواد المبيوعة والأرباح"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>إظهار معلومات الشفت</span>
                          </button>

                          {/* زر حذف للأدمن فقط */}
                          {hasPermission('canDeleteInvoice') && (
                            <button
                              type="button"
                              onClick={() => handleDelete(shift)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="حذف هذا الشفت"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>
      )}

      {/* نافذة استعراض وإدارة جلسات الأجهزة المتصلة */}
      <ActiveSessionsModal
        isOpen={isActiveSessionsModalOpen}
        onClose={() => setIsActiveSessionsModalOpen(false)}
      />
    </div>
  );
};
