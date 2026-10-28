import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  X, 
  Trash2, 
  AlertTriangle, 
  Lock, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  ShieldAlert 
} from 'lucide-react';

interface WipeProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const WipeProductsModal: React.FC<WipeProductsModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { wipeAllProductsFromServer, products } = useApp();

  const [verificationCode, setVerificationCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleWipeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!verificationCode.trim()) {
      setErrorMessage('يرجى إدخال رمز الحساب لتأكيد العملية.');
      return;
    }

    setIsWiping(true);
    try {
      const res = await wipeAllProductsFromServer(verificationCode.trim());
      if (res.success) {
        setVerificationCode('');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || 'تعذر إتمام عملية المسح.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ غير متوقع أثناء المسح.');
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl border border-rose-300 shadow-2xl max-w-md w-full my-6 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Red Header */}
        <div className="p-4 sm:p-5 border-b border-rose-100 bg-gradient-to-r from-rose-50 via-white to-red-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-200 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-rose-950">مسح وتصفية كافة المواد</h2>
              <p className="text-xs text-rose-600 mt-0.5 font-bold">
                إجراء خطير يتطلب التحقق الأمني
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isWiping}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleWipeSubmit} className="p-4 sm:p-5 space-y-4">
          
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-2 text-xs text-rose-900">
            <div className="flex items-center gap-2 font-black text-rose-950">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>تحذير نهائي: تصفية المخزن من السيرفر</span>
            </div>
            <p className="leading-relaxed">
              سيتم حذف جميع المواد البالغ عددها (<strong className="font-mono text-rose-950">{products.length} مادة</strong>) نهائياً من قاعدة بيانات السيرفر ومن ذاكرة الجهاز. لا يمكن التراجع عن هذا الإجراء إلا باستعادة نسخة احتياطية سابقة.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-900">
              أدخل رمز الحساب / كلمة المرور للتأكيد: <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showCode ? 'text' : 'password'}
                required
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="كلمة مرور الحساب أو رمز المشرف..."
                className="w-full pl-10 pr-9 py-2.5 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowCode(!showCode)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showCode ? 'إخفاء' : 'إظهار'}
              >
                {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              يمكن استخدام كلمة مرور تسجيل الدخول الخاصة بك أو رمز المشرف/المدير.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-100/70 border border-rose-300 rounded-xl text-xs font-bold text-rose-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isWiping}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              إلغاء التراجع
            </button>

            <button
              type="submit"
              disabled={isWiping || !verificationCode.trim()}
              className="px-5 py-2.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 rounded-xl shadow-md shadow-rose-200 flex items-center gap-2 transition cursor-pointer"
            >
              {isWiping ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري مسح وتصفية السيرفر...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>مسح وتصفية المواد الآن</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

export default WipeProductsModal;
