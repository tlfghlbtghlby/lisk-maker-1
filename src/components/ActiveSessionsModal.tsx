import React, { useState, useEffect } from 'react';
import { 
  X, 
  Monitor, 
  Smartphone, 
  Tablet, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  LogOut, 
  RefreshCw, 
  Layers, 
  CheckCircle2, 
  Wifi, 
  WifiOff, 
  AlertCircle,
  Cpu,
  Globe
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DeviceSession } from '../types';

interface ActiveSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActiveSessionsModal: React.FC<ActiveSessionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { 
    currentUser, 
    deviceSessions, 
    currentDeviceId, 
    currentSessionId,
    refreshSessions,
    terminateSession,
    shifts,
    activeShift,
    isCloudConnected
  } = useApp();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      refreshSessions();
    }
  }, [isOpen]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshSessions();
    setIsRefreshing(false);
  };

  const handleTerminate = async (session: DeviceSession) => {
    if (session.deviceId === currentDeviceId) {
      if (!window.confirm('هل تريد تسجيل الخروج من هذا الجهاز الحالي؟')) return;
    } else {
      if (!window.confirm(`هل أنت متأكد من إنهاء جلسة الجهاز (${session.deviceName}) وتسجيل خروجه عن بعد؟`)) return;
    }

    const res = await terminateSession(session.id);
    if (res.success) {
      setNotice(`✅ تم بنجاح إنهاء جلسة (${session.deviceName}).`);
      setTimeout(() => setNotice(null), 3500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-fadeIn" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  جلسات الأجهزة المتصلة والمتزامنة
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                  {deviceSessions.length} أجهزة مسجلة
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                تتبع الهواتف والحواسيب التي تسجل بالبرنامج، ومواقعها، وإمكانية فتح شفت مختلف في آن واحد.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualRefresh}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="تحديث قائمة الجلسات"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notice */}
        {notice && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-xs font-bold text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Guarantees Banner */}
        <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-indigo-50 to-emerald-50 border-b border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-950 font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>شفتات متزامنة ومستقلة: يمكن لكل هاتف أو كمبيوتر فتح شفت عمل منفصل في نفس الوقت دون أي تداخل.</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-semibold shrink-0">
            {isCloudConnected ? (
              <span className="flex items-center gap-1 text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                <Wifi className="w-3 h-3" />
                سحابي + محلي
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full">
                <WifiOff className="w-3 h-3" />
                أوفلاين دائم مدى الحياة
              </span>
            )}
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {deviceSessions.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Monitor className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-bold text-slate-700">جهازك الحالي مسجل ونشط</p>
              <p className="text-xs text-slate-400 mt-1">
                عند تسجيل الدخول من أي هاتف أو جهاز آخر ستظهر جلسته هنا فوراً.
              </p>
            </div>
          ) : (
            deviceSessions.map((session) => {
              const isCurrent = session.deviceId === currentDeviceId;
              
              // Find active shift on this device
              const deviceActiveShift = shifts.find(
                s => s.status === 'active' && (s.deviceId === session.deviceId || (isCurrent && s.id === activeShift?.id))
              );

              return (
                <div
                  key={session.id}
                  className={`p-4 rounded-2xl border transition shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-500/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Device Icon */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                      isCurrent
                        ? 'bg-emerald-600 text-white'
                        : session.deviceType === 'mobile'
                        ? 'bg-amber-100 text-amber-800'
                        : session.deviceType === 'tablet'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      {session.deviceType === 'mobile' ? (
                        <Smartphone className="w-5 h-5" />
                      ) : session.deviceType === 'tablet' ? (
                        <Tablet className="w-5 h-5" />
                      ) : (
                        <Monitor className="w-5 h-5" />
                      )}
                    </div>

                    {/* Device Info */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-xs sm:text-sm text-slate-900">
                          {session.deviceName}
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black">
                            هذا الجهاز (الجلسة الحالية)
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                          {session.os || 'نظام التشغيل'} · {session.browser || 'المتصفح'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>الموقع: <strong className="text-slate-700">{session.location}</strong></span>
                        </span>
                        {session.ip && session.ip !== '127.0.0.1' && (
                          <span className="flex items-center gap-1 font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">
                            <Globe className="w-3 h-3 text-slate-400" />
                            IP: {session.ip}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>آخر نشاط: {new Date(session.lastActive).toLocaleTimeString('ar-IQ')}</span>
                        </span>
                      </div>

                      {/* Active Shift Info */}
                      <div className="pt-1">
                        {deviceActiveShift ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-900 text-xs font-bold border border-indigo-200">
                            <Layers className="w-3.5 h-3.5 text-indigo-600" />
                            <span>شفت مفتوح حالياً: <strong>{deviceActiveShift.presetShiftName || `شفت #${deviceActiveShift.shiftNumber}`}</strong> (قيد البيع)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                            <span>لا يوجد شفت عمل مفتوح في هذا الجهاز حالياً</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTerminate(session)}
                      className="px-3 py-1.5 text-xs font-bold text-rose-700 hover:text-rose-900 hover:bg-rose-50 border border-rose-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                      title="إنهاء الجلسة وتسجيل الخروج من هذا الجهاز"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{isCurrent ? 'تسجيل الخروج' : 'إنهاء الجلسة'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500">
            معرف جهازك الحالي: <code className="font-mono text-slate-700 font-bold">{currentDeviceId.slice(0, 16)}...</code>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition cursor-pointer w-full sm:w-auto"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
