import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { SessionRole } from '../types';
import { 
  ShieldCheck, 
  UserCheck, 
  Users, 
  Lock, 
  KeyRound, 
  Check, 
  X, 
  Eye, 
  EyeOff, 
  AlertCircle,
  Delete
} from 'lucide-react';

export const SessionSwitchModal: React.FC = () => {
  const { 
    sessionRole, 
    switchSession, 
    isSessionModalOpen, 
    setIsSessionModalOpen,
    targetSessionForModal,
    setTargetSessionForModal,
    targetSupervisorIdForModal,
    setTargetSupervisorIdForModal,
    currentUser,
    settings,
    activeSupervisorId
  } = useApp();

  const supervisors = settings.supervisors || [];
  const isSupervisorEnabled = settings.enableSupervisor !== false && (currentUser as any)?.enableSupervisor !== false;
  const isEmployeeEnabled = settings.enableEmployee !== false && (currentUser as any)?.enableEmployee !== false;

  const [selectedRole, setSelectedRole] = useState<SessionRole>('admin');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | null>(null);
  const [passwordOrPin, setPasswordOrPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isSessionModalOpen) {
      if (targetSupervisorIdForModal && isSupervisorEnabled) {
        setSelectedRole('supervisor');
        setSelectedSupervisorId(targetSupervisorIdForModal);
      } else if (targetSessionForModal === 'supervisor' && isSupervisorEnabled) {
        setSelectedRole('supervisor');
        setSelectedSupervisorId(activeSupervisorId || (supervisors[0]?.id || null));
      } else if (targetSessionForModal === 'employee' && isEmployeeEnabled) {
        setSelectedRole('employee');
      } else if (targetSessionForModal === 'admin') {
        setSelectedRole('admin');
      } else {
        // اقتراح جلسة مناسبة ومفعلة
        if (sessionRole === 'employee') {
          setSelectedRole('admin');
        } else if (isEmployeeEnabled) {
          setSelectedRole('employee');
        } else if (isSupervisorEnabled) {
          setSelectedRole('supervisor');
        } else {
          setSelectedRole('admin');
        }
      }
      setPasswordOrPin('');
      setErrorMsg(null);
      setShowPassword(false);
    }
  }, [isSessionModalOpen, targetSessionForModal, targetSupervisorIdForModal, sessionRole, activeSupervisorId, supervisors, isSupervisorEnabled, isEmployeeEnabled]);

  if (!isSessionModalOpen) return null;

  const handleSwitch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    if (selectedRole === 'supervisor' && !isSupervisorEnabled) {
      setErrorMsg('تم إلغاء تفعيل جلسة المشرف لهذا المتجر من قبل إدارة النظام.');
      return;
    }
    if (selectedRole === 'employee' && !isEmployeeEnabled) {
      setErrorMsg('تم إلغاء تفعيل جلسة الموظف لهذا المتجر من قبل إدارة النظام.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await switchSession(selectedRole, passwordOrPin, selectedSupervisorId || undefined);
      if (result.success) {
        setIsSessionModalOpen(false);
        setTargetSessionForModal(null);
        setTargetSupervisorIdForModal(null);
        setPasswordOrPin('');
      } else {
        setErrorMsg(result.error || 'فشل التحقق من الرمز المدخل');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء التبديل');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNumClick = (num: string) => {
    setErrorMsg(null);
    setPasswordOrPin(prev => prev + num);
  };

  const handleBackspace = () => {
    setErrorMsg(null);
    setPasswordOrPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setErrorMsg(null);
    setPasswordOrPin('');
  };

  const selectedSupervisor = supervisors.find(s => s.id === selectedSupervisorId) || supervisors[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-fadeIn overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden my-auto">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">التبديل بين جلسات النظام</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                الجلسة الحالية: <span className="font-bold text-emerald-400">
                  {sessionRole === 'admin' ? 'جلسة الأدمن (المدير العام)' : sessionRole === 'supervisor' ? 'جلسة المشرف' : 'جلسة الموظف العادي'}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsSessionModalOpen(false);
              setTargetSessionForModal(null);
              setTargetSupervisorIdForModal(null);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 flex flex-col gap-4">
          
          {/* Session Selection Cards */}
          <div className="grid grid-cols-3 gap-2">
            
            {/* 1. Admin */}
            <button
              type="button"
              onClick={() => {
                setSelectedRole('admin');
                setErrorMsg(null);
              }}
              className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 cursor-pointer ${
                selectedRole === 'admin'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-emerald-500/50'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className={`w-5 h-5 ${selectedRole === 'admin' ? 'text-emerald-400' : 'text-slate-600'}`} />
              <div className="text-xs font-black">جلسة الأدمن</div>
              <div className={`text-[10px] leading-tight ${selectedRole === 'admin' ? 'text-slate-300' : 'text-slate-500'}`}>
                كامل الصلاحيات
              </div>
            </button>

            {/* 2. Supervisor */}
            {isSupervisorEnabled ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('supervisor');
                  if (!selectedSupervisorId && supervisors.length > 0) {
                    setSelectedSupervisorId(supervisors[0].id);
                  }
                  setErrorMsg(null);
                }}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 cursor-pointer ${
                  selectedRole === 'supervisor'
                    ? 'bg-blue-900 text-white border-blue-900 shadow-md ring-2 ring-blue-400/50'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <UserCheck className={`w-5 h-5 ${selectedRole === 'supervisor' ? 'text-blue-400' : 'text-slate-600'}`} />
                <div className="text-xs font-black">جلسة المشرف</div>
                <div className={`text-[10px] leading-tight ${selectedRole === 'supervisor' ? 'text-blue-200' : 'text-slate-500'}`}>
                  {supervisors.length > 1 ? `${supervisors.length} مشرفين` : 'صلاحيات وسطية'}
                </div>
              </button>
            ) : (
              <div
                className="p-3 rounded-xl border border-dashed border-slate-200 bg-slate-100/50 text-slate-400 text-center flex flex-col items-center justify-center gap-1 opacity-60 cursor-not-allowed select-none"
                title="تم إلغاء تفعيل جلسة المشرف من قبل إدارة النظام"
              >
                <UserCheck className="w-5 h-5 text-slate-400" />
                <div className="text-xs font-bold line-through">جلسة المشرف</div>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-bold">
                  معطل من الإدارة
                </span>
              </div>
            )}

            {/* 3. Employee */}
            {isEmployeeEnabled ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('employee');
                  setErrorMsg(null);
                }}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 cursor-pointer ${
                  selectedRole === 'employee'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/50'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Users className={`w-5 h-5 ${selectedRole === 'employee' ? 'text-white' : 'text-slate-600'}`} />
                <div className="text-xs font-black">جلسة الموظف</div>
                <div className={`text-[10px] leading-tight ${selectedRole === 'employee' ? 'text-emerald-100' : 'text-slate-500'}`}>
                  بيع وإضافة مواد
                </div>
              </button>
            ) : (
              <div
                className="p-3 rounded-xl border border-dashed border-slate-200 bg-slate-100/50 text-slate-400 text-center flex flex-col items-center justify-center gap-1 opacity-60 cursor-not-allowed select-none"
                title="تم إلغاء تفعيل جلسة الموظف من قبل إدارة النظام"
              >
                <Users className="w-5 h-5 text-slate-400" />
                <div className="text-xs font-bold line-through">جلسة الموظف</div>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-bold">
                  معطل من الإدارة
                </span>
              </div>
            )}
          </div>

          {/* Multiple Supervisors Selector when Supervisor role is selected */}
          {selectedRole === 'supervisor' && supervisors.length > 0 && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5 space-y-1.5">
              <span className="text-xs font-bold text-blue-900 block">
                اختر المشرف المطلوب للدخول بجلسته:
              </span>
              <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                {supervisors.map((sup) => {
                  const isCur = selectedSupervisorId === sup.id || (!selectedSupervisorId && sup.id === supervisors[0].id);
                  return (
                    <button
                      key={sup.id}
                      type="button"
                      onClick={() => {
                        setSelectedSupervisorId(sup.id);
                        setErrorMsg(null);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-between cursor-pointer border ${
                        isCur
                          ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                          : 'bg-white text-blue-950 border-blue-200 hover:bg-blue-100/60'
                      }`}
                    >
                      <span className="truncate">{sup.name}</span>
                      {sup.canConfigureShifts && (
                        <span className={`text-[9px] px-1 py-0.2 rounded font-normal ${
                          isCur ? 'bg-blue-700 text-blue-100' : 'bg-blue-100 text-blue-700'
                        }`}>
                          إعداد شفتات
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description of Selected Role */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-1">
            {selectedRole === 'admin' && (
              <>
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تتطلب كلمة مرور الحساب المسجل:</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  تتيح فتح جميع أقسام البرنامج (الأرباح، الديون، حذف واستعادة الفواتير، الإعدادات، وتعديل صلاحيات الجلسات).
                </p>
                {currentUser && (
                  <div className="text-[11px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 mt-1">
                    حساب المدير النشط: {currentUser.displayName || currentUser.username}
                  </div>
                )}
              </>
            )}

            {selectedRole === 'supervisor' && (
              <>
                <div className="font-bold text-blue-900 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                  <span>تتطلب الرمز السري للمشرف ({selectedSupervisor?.name || 'المشرف'}):</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  تتيح للمشرف صلاحية البيع، إضافة المواد، معاينة واستعادة الفواتير، وإدارة الزبائن، مع إمكانية إعداد الشفتات إن كانت ممنوحة له من قبل الأدمن.
                </p>
              </>
            )}

            {selectedRole === 'employee' && (
              <>
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>التحويل فوري بدون الحاجة لكلمة مرور:</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  تسمح للموظف بالبيع السريع وإضافة المواد ومعاينة سجل الفواتير، مع منع الحذف أو الاسترجاع أو الدخول للديون والتقارير أو الإعدادات.
                </p>
              </>
            )}
          </div>

          {/* Password / PIN Input (Only needed for Admin and Supervisor) */}
          {selectedRole !== 'employee' && (
            <form onSubmit={handleSwitch} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {selectedRole === 'admin' 
                    ? 'أدخل كلمة مرور الحساب (رمز الحساب):' 
                    : `أدخل الرمز السري للمشرف (${selectedSupervisor?.name || 'المشرف'}):`}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordOrPin}
                    onChange={(e) => {
                      setPasswordOrPin(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder={selectedRole === 'admin' ? 'أدخل كلمة المرور (أحرف أو أرقام)...' : 'الرمز السري (1122)...'}
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900"
                    autoFocus
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title={showPassword ? 'إخفاء الرمز' : 'إظهار الرمز'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {selectedRole === 'admin' ? (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 px-0.5">
                    <span className="text-emerald-700 font-bold">يدعم الحروف (ABC)، الأرقام (123)، والرموز</span>
                    <span>الكتابة عبر لوحة المفاتيح مباشرة</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-1 px-0.5">
                    أدخل الرمز المكون من 4 أرقام المخصص لجلسة المشرف
                  </p>
                )}
              </div>

              {/* Touch Numpad for convenience on POS tablets & touchscreens */}
              <div className="space-y-1 pt-1">
                {selectedRole === 'admin' && (
                  <div className="text-[10px] text-slate-400 font-bold text-center">
                    لوحة أرقام سريعة (أو اكتب الأحرف والأرقام من الكيبورد)
                  </div>
                )}
                <div className="grid grid-cols-3 gap-1.5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleNumClick(n)}
                      className="py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-lg text-sm font-mono font-extrabold transition cursor-pointer"
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClear}
                    className="py-2.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    مسح
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNumClick('0')}
                    className="py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-lg text-sm font-mono font-extrabold transition cursor-pointer"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="py-2.5 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center"
                    title="حذف خانة واحدة"
                  >
                    <Delete className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>
          )}

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => handleSwitch()}
              disabled={isSubmitting || (selectedRole !== 'employee' && !passwordOrPin.trim())}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm text-white ${
                selectedRole === 'admin'
                  ? 'bg-slate-900 hover:bg-slate-800'
                  : selectedRole === 'supervisor'
                  ? 'bg-blue-600 hover:bg-blue-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Check className="w-4 h-4" />
              <span>
                {selectedRole === 'admin'
                  ? 'تأكيد ودخول جلسة الأدمن'
                  : selectedRole === 'supervisor'
                  ? 'تأكيد ودخول جلسة المشرف'
                  : 'التحويل لجلسة الموظف فوراً'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSessionModalOpen(false);
                setTargetSessionForModal(null);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer border border-slate-200"
            >
              إلغاء
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
