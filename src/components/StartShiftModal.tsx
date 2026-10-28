import React, { useState, useEffect } from 'react';
import { Play, X, Clock, Wallet, FileText, UserCheck, Sparkles, KeyRound, ShieldAlert, CheckCircle2, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const StartShiftModal: React.FC = () => {
  const { 
    isStartShiftModalOpen, 
    setIsStartShiftModalOpen, 
    startShift, 
    currentUser, 
    sessionRole,
    settings,
    hasPermission,
    addPresetShift
  } = useApp();

  const presetShifts = settings.presetShifts || [];
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [shiftCode, setShiftCode] = useState<string>('');
  const [showCode, setShowCode] = useState(false);
  const [startingCash, setStartingCash] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick add preset shift modal state if no presets exist
  const [isCreatingQuickPreset, setIsCreatingQuickPreset] = useState(false);
  const [quickPresetName, setQuickPresetName] = useState('');
  const [quickPresetCode, setQuickPresetCode] = useState('');

  useEffect(() => {
    if (isStartShiftModalOpen) {
      if (presetShifts.length > 0) {
        setSelectedPresetId(presetShifts[0].id);
      } else {
        setSelectedPresetId('');
      }
      setShiftCode('');
      setErrorMsg(null);
      setStartingCash('0');
      setNotes('');
      setIsCreatingQuickPreset(false);
    }
  }, [isStartShiftModalOpen, presetShifts]);

  if (!isStartShiftModalOpen) return null;

  const handleCreateQuickPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPresetName.trim() || !quickPresetCode.trim()) {
      setErrorMsg('يرجى كتابة اسم الشفت والرمز السري الخاص به');
      return;
    }
    try {
      const created = await addPresetShift({
        name: quickPresetName.trim(),
        code: quickPresetCode.trim(),
        notes: 'شفت مسبق الإعداد',
      });
      setSelectedPresetId(created.id);
      setIsCreatingQuickPreset(false);
      setQuickPresetName('');
      setQuickPresetCode('');
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل في حفظ قالب الشفت');
    }
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (presetShifts.length === 0) {
      setErrorMsg('لا توجد شفتات معدة مسبقاً. يجب على الأدمن أو المشرف إعداد شفت أولاً.');
      return;
    }

    if (!selectedPresetId) {
      setErrorMsg('يرجى اختيار شفت معد مسبقاً من القائمة');
      return;
    }

    if (!shiftCode.trim()) {
      setErrorMsg('يرجى إدخال الرمز السري الخاص بهذا الشفت');
      return;
    }

    setIsSubmitting(true);
    try {
      const cash = parseFloat(startingCash) || 0;
      const res = await startShift(cash, notes, selectedPresetId, shiftCode);
      if (res.success) {
        setIsStartShiftModalOpen(false);
        setShiftCode('');
        setStartingCash('0');
        setNotes('');
        setErrorMsg(null);
      } else {
        setErrorMsg(res.error || 'فشل في بدء الشفت');
      }
    } catch (err: any) {
      console.error('فشل في بدء الشفت:', err);
      setErrorMsg(err.message || 'حدث خطأ غير متوقع أثناء بدء الشفت');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cashierRoleLabel = 
    sessionRole === 'admin' ? 'المدير العام (أدمن)' : 
    sessionRole === 'supervisor' ? 'المشرف المعتمد' : 
    'الموظف (الكاشير)';

  const selectedPresetObj = presetShifts.find(p => p.id === selectedPresetId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden text-right my-auto"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs text-white">
              <Play className="w-5 h-5 fill-current text-indigo-200" />
            </div>
            <div>
              <h3 className="text-base font-extrabold">بدء شفت عمل جديد</h3>
              <p className="text-xs text-indigo-200">اختر شفت معد مسبقاً وأدخل رمزه السري لبدء العمل</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsStartShiftModalOpen(false)}
            className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* Cashier / Session Info */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-700">المسؤول عن فتح الشفت:</span>
            </div>
            <div className="text-left">
              <span className="text-xs font-extrabold text-indigo-950 block">
                {currentUser?.displayName || currentUser?.storeName || 'المستخدم الحالي'}
              </span>
              <span className="text-[10px] text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full font-bold">
                {cashierRoleLabel}
              </span>
            </div>
          </div>

          {/* Quick preset creation inline if no presets or user clicked add */}
          {isCreatingQuickPreset ? (
            <form onSubmit={handleCreateQuickPreset} className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900 border-b border-amber-200 pb-2">
                <span className="flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-amber-700" />
                  إعداد شفت جديد مسبقاً
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreatingQuickPreset(false)}
                  className="text-amber-700 hover:text-amber-950"
                >
                  إلغاء
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم الشفت:</label>
                  <input
                    type="text"
                    value={quickPresetName}
                    onChange={(e) => setQuickPresetName(e.target.value)}
                    placeholder="مثلاً: شفت الصباح"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 outline-none focus:ring-1 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">الرمز السري للشفت:</label>
                  <input
                    type="text"
                    value={quickPresetCode}
                    onChange={(e) => setQuickPresetCode(e.target.value)}
                    placeholder="مثلاً: 1234"
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
              >
                حفظ الشفت المسبق
              </button>
            </form>
          ) : null}

          {/* Preset Shifts Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>اختر شفت العمل المعد مسبقاً:</span>
              </label>
              {(sessionRole === 'admin' || hasPermission('canConfigureShifts')) && !isCreatingQuickPreset && (
                <button
                  type="button"
                  onClick={() => setIsCreatingQuickPreset(true)}
                  className="text-[11px] text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة شفت مسبق</span>
                </button>
              )}
            </div>

            {presetShifts.length === 0 ? (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 space-y-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>لا توجد شفتات معدة مسبقاً في النظام!</span>
                </div>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  يجب إعداد شفت واحد على الأقل مع رمزه السري من قبل الأدمن أو المشرف المخوّل قبل السماح ببدء العمل.
                </p>
                {(sessionRole === 'admin' || hasPermission('canConfigureShifts')) && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingQuickPreset(true)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                  >
                    + إنشاء شفت مسبق الآن
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-0.5">
                {presetShifts.map((preset) => {
                  const isSelected = preset.id === selectedPresetId;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setSelectedPresetId(preset.id);
                        setErrorMsg(null);
                      }}
                      className={`p-3 rounded-xl border text-right transition flex items-center justify-between cursor-pointer ${
                        isSelected 
                          ? 'bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-500/30 text-indigo-950 font-black' 
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800 font-bold'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-400'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <div className="text-xs">{preset.name}</div>
                          {preset.notes && <div className="text-[10px] text-slate-500 font-normal">{preset.notes}</div>}
                        </div>
                      </div>
                      <KeyRound className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Form for Shift Code & Cash & Start */}
          <form onSubmit={handleStart} className="space-y-3.5">
            {/* Shift Secret Code Input */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-amber-600" />
                  <span>الرمز السري الخاص بالشفت:</span>
                </span>
                {selectedPresetObj && (
                  <span className="text-[11px] text-indigo-700 font-normal">
                    (مطلوب لبدء: {selectedPresetObj.name})
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showCode ? 'text' : 'password'}
                  value={shiftCode}
                  onChange={(e) => {
                    setShiftCode(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="أدخل رمز الشفت السري..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showCode ? 'إخفاء' : 'إظهار'}
                </button>
              </div>
            </div>

            {/* Starting Drawer Cash (اختياري) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>النقد الافتتاحي في القاصة / الصرافة الأولية:</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={startingCash}
                  onChange={(e) => setStartingCash(e.target.value)}
                  placeholder="0"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                  {settings.currency}
                </span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>ملاحظات بداية الشفت (اختياري):</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثلاً: كاشير 1، استلام عهدة..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
              />
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Feature highlights */}
            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
              <div className="flex items-center gap-2 text-indigo-700 font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>ملاحظات نظام الشفتات:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-slate-500 pr-1">
                <li>سيبدأ مؤقت الشفت فوراً ويستمر بالعد حتى إنهاء الوردية.</li>
                <li>يتم حظر البيع في جلسة الموظف بدون شفت نشط لضمان الدقة المالية.</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || presetShifts.length === 0}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-indigo-600/20 active:scale-98 disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{isSubmitting ? 'جاري التحقق والبدء...' : 'تأكيد الرمز وبدء الشفت الآن'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsStartShiftModalOpen(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

