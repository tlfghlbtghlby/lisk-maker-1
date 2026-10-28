import React, { useState } from 'react';
import { loginWithEmailOrUsername } from '../supabase';
import { useApp } from '../context/AppContext';
import { 
  Lock, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  LogIn, 
  Cloud, 
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';

interface AuthViewProps {
  onSuccess?: () => void;
  onContinueAsGuest?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess, onContinueAsGuest }) => {
  const { loginUser } = useApp();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [logoutNotice, setLogoutNotice] = useState<string | null>(() => {
    try {
      const reason = sessionStorage.getItem('auth_logout_reason');
      if (reason === 'deleted') {
        sessionStorage.removeItem('auth_logout_reason');
        return '⚠️ تم حذف هذا الحساب نهائياً من قبل الإدارة. تم تسجيل الخروج التلقائي من النظام.';
      } else if (reason === 'disabled') {
        sessionStorage.removeItem('auth_logout_reason');
        return '⚠️ تم تعطيل وتجميد هذا الحساب من قبل الإدارة. تم تسجيل الخروج التلقائي. يرجى مراجعة المدير العام.';
      } else if (reason === 'trial_expired') {
        sessionStorage.removeItem('auth_logout_reason');
        return '⏳ عذراً، لقد انتهت الفترة التجريبية (3 أيام) أو انتهت صلاحية اشتراك هذا الحساب. تم تسجيل الخروج تلقائياً. يرجى التواصل مع المدير العام لتمديد أو تفعيل الحساب الدائمي.';
      }
    } catch {}
    return null;
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const targetIdentifier = identifier.trim();
    if (!targetIdentifier) {
      setErrorMessage('يرجى إدخال اسم المستخدم أو رقم الهاتف أو البريد الإلكتروني');
      return;
    }
    if (!password) {
      setErrorMessage('يرجى إدخال كلمة المرور');
      return;
    }

    setIsLoading(true);
    try {
      const loggedInUser = await loginWithEmailOrUsername(targetIdentifier, password);
      if (loginUser && loggedInUser) {
        await loginUser(loggedInUser);
      }
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.warn("Login attempt notice:", err?.message || err);
      let msg = err.message || 'بيانات الدخول غير صحيحة. يرجى التحقق من اسم المستخدم وكلمة المرور.';
      if (msg.includes('معطل') || msg.includes('تعطيل') || msg.includes('حذف') || msg.includes('تجريبية') || msg.includes('اشتراك')) {
        // رسائل التعطيل أو انتهاء الصلاحية تظهر كما هي
      } else if (
        err.code === 'auth/invalid-credential' || 
        err.code === 'auth/user-not-found' || 
        err.code === 'auth/wrong-password' ||
        msg.includes('auth/invalid-credential') ||
        msg.includes('api-key-not-valid') ||
        msg.includes('auth/')
      ) {
        msg = 'اسم المستخدم أو كلمة المرور غير صحيحة. يرجى التأكد من البيانات أو مراجعة المدير.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'تم حظر المحاولات مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى الانتظار دقيقة واحدة.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'تعذر الاتصال بالسيرفر. يرجى التأكد من اتصالك بالإنترنت.';
      }
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col justify-center items-center p-4 selection:bg-amber-500 selection:text-slate-950" 
      style={{
        background: 'radial-gradient(ellipse at center, #0e1c33 0%, #080f1d 60%, #03060c 100%)',
      }}
      dir="rtl"
    >
      
      <div className="w-full max-w-md my-auto space-y-4">
        
        {/* Brand & Cloud Status Header */}
        <div className="text-center space-y-2">
          <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl p-0.5 bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-600 shadow-2xl shadow-amber-500/25 mb-1">
            <img 
              src="/assets/aistudio/1792973910260_3946b0af.jpg" 
              alt="برنامج المفكر المحاسبي" 
              className="w-full h-full object-cover rounded-[14px]"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-200 tracking-wide font-['Tajawal','Almarai','Cairo',sans-serif] pb-1">
            برنامج المفكر المحاسبي
          </h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-amber-500/30 text-amber-300 text-xs font-semibold backdrop-blur-md">
            <Cloud className="w-3.5 h-3.5 text-amber-400" />
            <span>المفكر سمارت • AL-MUFAKIR SMART POS</span>
          </div>
        </div>

        {/* Main Login Card */}
        <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-amber-500/20 shadow-2xl shadow-black/60 p-6 sm:p-7 space-y-5 text-slate-100">
          
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-extrabold text-white">تسجيل الدخول للنظام</h2>
            </div>
            <span className="text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
              وصول سحابي مباشر
            </span>
          </div>

          {/* Feedback messages */}
          {logoutNotice && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-start gap-2.5 shadow-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                {logoutNotice}
              </div>
              <button
                type="button"
                onClick={() => setLogoutNotice(null)}
                className="text-amber-400 hover:text-amber-200 text-xs px-1 cursor-pointer"
                title="إغلاق التنبيه"
              >
                ✕
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                اسم المستخدم / البريد الإلكتروني / رقم الهاتف
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="أدخل اسم المستخدم أو البريد"
                  required
                  autoFocus
                  className="w-full pl-3 pr-10 py-2.5 text-sm border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-slate-800 text-white placeholder-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-slate-800 text-white placeholder-slate-500 text-left font-mono"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                  title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-500 hover:from-amber-500 hover:to-yellow-400 active:scale-[0.99] disabled:opacity-50 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/25 transition flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>جاري تسجيل الدخول والتحقق...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-slate-950" />
                  <span>تسجيل الدخول</span>
                </>
              )}
            </button>
          </form>

        </div>

        <div className="text-center text-xs text-slate-400">
          نظام المبيعات والمخزن السحابي · متاح لجميع الأجهزة والمنصات
        </div>

      </div>

    </div>
  );
};

export default AuthView;
