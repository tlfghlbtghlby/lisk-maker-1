import React, { useState, useEffect } from 'react';
import { Play, Clock, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface ShiftHeaderButtonProps {
  onOpenShiftsTab?: () => void;
}

export const ShiftHeaderButton: React.FC<ShiftHeaderButtonProps> = ({ onOpenShiftsTab }) => {
  const { 
    activeShift, 
    hasPermission, 
    setIsStartShiftModalOpen, 
    setIsEndShiftModalOpen,
    setSelectedShiftForDetails,
    getShiftStats
  } = useApp();

  const [elapsed, setElapsed] = useState<string>('00:00:00');

  // عداد الوقت المباشر للوقت المنقضي منذ بدء الشفت
  useEffect(() => {
    if (!activeShift || !activeShift.startTime) {
      setElapsed('00:00:00');
      return;
    }

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

  // إذا لم يكن هناك شفت نشط ولا يملك صلاحية بدء الشفت
  if (!activeShift && !hasPermission('canManageShifts')) {
    return null;
  }

  // إذا لم يكن هناك شفت نشط -> إظهار زر "بدء الشفت"
  if (!activeShift) {
    return (
      <button
        type="button"
        onClick={() => setIsStartShiftModalOpen(true)}
        className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer shadow-xs whitespace-nowrap bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500 active:scale-95"
        title="انقر لبدء شفت عمل جديد واختيار قالب الشفت والرمز السري"
      >
        <Play className="w-3.5 h-3.5 fill-current text-indigo-200 shrink-0" />
        <span>بدء الشفت</span>
      </button>
    );
  }

  // إذا كان هناك شفت نشط -> إظهار المؤقت الحي مع خيار إنهاء الشفت أو معاينته
  const handleShiftClick = () => {
    if (hasPermission('canManageShifts')) {
      setIsEndShiftModalOpen(true);
    } else {
      const liveStats = getShiftStats(activeShift);
      setSelectedShiftForDetails({
        ...activeShift,
        ...liveStats
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleShiftClick}
      className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border transition cursor-pointer shadow-sm whitespace-nowrap bg-slate-900 border-amber-500/70 text-white hover:bg-slate-800 ring-2 ring-amber-500/30 group active:scale-95"
      title={
        activeShift.presetShiftName 
          ? `شفت: ${activeShift.presetShiftName} (#${activeShift.shiftNumber}) قيد العمل - انقر لإظهار الملخص أو الإنهاء`
          : `شفت رقم #${activeShift.shiftNumber} قيد العمل - انقر لإظهار الملخص أو الإنهاء`
      }
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>

      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 group-hover:rotate-12 transition-transform" />
      
      <span className="font-mono font-black text-amber-300 tracking-wider">
        {elapsed}
      </span>

      {activeShift.presetShiftName && (
        <span className="text-[10px] text-slate-300 hidden md:inline font-normal bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
          {activeShift.presetShiftName}
        </span>
      )}

      {hasPermission('canManageShifts') ? (
        <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-500/30">
          إنهاء الشفت
        </span>
      ) : (
        <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded text-[10px] font-bold border border-emerald-500/30">
          نشط
        </span>
      )}
    </button>
  );
};
