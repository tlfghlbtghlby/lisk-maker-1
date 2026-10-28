import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CustomBackupOptions } from '../context/AppContext';
import { 
  X, 
  Download, 
  Package, 
  Settings, 
  Database, 
  Sliders, 
  CheckCircle2, 
  ShieldCheck, 
  Users, 
  FileText, 
  Clock, 
  CreditCard 
} from 'lucide-react';

interface ExportBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportBackupModal: React.FC<ExportBackupModalProps> = ({ isOpen, onClose }) => {
  const { exportCustomBackup, products, customers, invoices, shifts } = useApp();

  const [selectedScope, setSelectedScope] = useState<'products_only' | 'settings_only' | 'all' | 'custom'>('products_only');

  // Custom checkboxes state
  const [includeProducts, setIncludeProducts] = useState(true);
  const [includeCustomers, setIncludeCustomers] = useState(false);
  const [includeInvoices, setIncludeInvoices] = useState(false);
  const [includePayments, setIncludePayments] = useState(false);
  const [includeShifts, setIncludeShifts] = useState(false);
  const [includeSettings, setIncludeSettings] = useState(false);
  const [anonymizeProducts, setAnonymizeProducts] = useState(true);

  if (!isOpen) return null;

  const handleDownload = () => {
    let options: CustomBackupOptions;

    if (selectedScope === 'products_only') {
      options = {
        scope: 'products_only',
        anonymizeProducts: true,
      };
    } else if (selectedScope === 'settings_only') {
      options = {
        scope: 'settings_only',
      };
    } else if (selectedScope === 'all') {
      options = {
        scope: 'all',
      };
    } else {
      options = {
        scope: 'custom',
        includeProducts,
        includeCustomers,
        includeInvoices,
        includePayments,
        includeShifts,
        includeSettings,
        anonymizeProducts,
      };
    }

    const jsonStr = exportCustomBackup(options);
    const dateStr = new Date().toISOString().split('T')[0];
    
    let fileName = `backup-${dateStr}.json`;
    if (selectedScope === 'products_only' || (selectedScope === 'custom' && includeProducts && !includeCustomers && !includeInvoices)) {
      fileName = `products-catalog-${dateStr}.json`;
    } else if (selectedScope === 'settings_only') {
      fileName = `store-settings-${dateStr}.json`;
    } else if (selectedScope === 'all') {
      fileName = `full-backup-${dateStr}.json`;
    }

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full my-6 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-white to-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200 shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">خيارات تحميل النسخة الاحتياطية</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                حدد بدقة ما ترغب بحفظه في ملف النسخة الاحتياطية وفق رغبتك
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          
          <div className="text-xs font-bold text-slate-700">اختر نوع ومحتوى النسخة المطلوبة:</div>

          {/* Preset Options Grid */}
          <div className="space-y-3">
            
            {/* 1. Products Only (Clean / Anonymized) */}
            <div
              onClick={() => setSelectedScope('products_only')}
              className={`p-3.5 rounded-xl border cursor-pointer transition select-none flex items-start gap-3 ${
                selectedScope === 'products_only'
                  ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="backupScope"
                checked={selectedScope === 'products_only'}
                onChange={() => setSelectedScope('products_only')}
                className="mt-1 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                      نسخة المواد والمخزن فقط (نقية ومستقلة)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {products.length} مادة
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  تحفظ فقط المواد وأسعارها وتكاليفها والباركود والرصيد، مع <strong>حذف وتجريد تام لكافة معلومات الزبائن أو الفواتير أو ديون العملاء</strong>. جاهزة للنقل ورفعها على أي حساب آخر كأنها أُدخلت يدوياً.
                </p>
              </div>
            </div>

            {/* 2. Settings Only */}
            <div
              onClick={() => setSelectedScope('settings_only')}
              className={`p-3.5 rounded-xl border cursor-pointer transition select-none flex items-start gap-3 ${
                selectedScope === 'settings_only'
                  ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="backupScope"
                checked={selectedScope === 'settings_only'}
                onChange={() => setSelectedScope('settings_only')}
                className="mt-1 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-blue-600" />
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                    نسخة إعدادات الحساب والمتجر
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  تحفظ اسم المحل، الترويسة، الأختام، العملة، شروط الفواتير، ونظام وصلاحيات الجلسات.
                </p>
              </div>
            </div>

            {/* 3. Full Backup */}
            <div
              onClick={() => setSelectedScope('all')}
              className={`p-3.5 rounded-xl border cursor-pointer transition select-none flex items-start gap-3 ${
                selectedScope === 'all'
                  ? 'bg-purple-50/70 border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="backupScope"
                checked={selectedScope === 'all'}
                onChange={() => setSelectedScope('all')}
                className="mt-1 text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-600" />
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                      نسخة شاملة متكاملة (كل شيء)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    كافة السجلات
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  تحفظ كافة البيانات: المواد، العملاء والديون ({customers.length})، الفواتير ({invoices.length})، المقبوضات، الشفتات ({shifts.length})، وإعدادات النظام.
                </p>
              </div>
            </div>

            {/* 4. Custom Selection */}
            <div
              onClick={() => setSelectedScope('custom')}
              className={`p-3.5 rounded-xl border cursor-pointer transition select-none flex items-start gap-3 ${
                selectedScope === 'custom'
                  ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="backupScope"
                checked={selectedScope === 'custom'}
                onChange={() => setSelectedScope('custom')}
                className="mt-1 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-600" />
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                    تخصيص يدوي حر للعناصر
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  حدد بمربعات الاختيار العناصر التي ترغب بحفظها تحديداً على مزاجك.
                </p>
              </div>
            </div>

          </div>

          {/* Custom Selection Options Box */}
          {selectedScope === 'custom' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3 animate-in fade-in duration-100">
              <div className="text-xs font-black text-slate-800">حدد الأقسام المراد تضمينها:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                
                <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeProducts}
                    onChange={(e) => setIncludeProducts(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <Package className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-bold text-slate-800">قائمة المواد والمخزن</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCustomers}
                    onChange={(e) => setIncludeCustomers(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-bold text-slate-800">الزبائن وسجلات الديون</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeInvoices}
                    onChange={(e) => setIncludeInvoices(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <FileText className="w-3.5 h-3.5 text-purple-600" />
                  <span className="font-bold text-slate-800">فواتير وقوائم المبيعات</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePayments}
                    onChange={(e) => setIncludePayments(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-bold text-slate-800">سندات وسجلات المقبوضات</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeShifts}
                    onChange={(e) => setIncludeShifts(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="font-bold text-slate-800">سجل الشفتات والورديات</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSettings}
                    onChange={(e) => setIncludeSettings(e.target.checked)}
                    className="rounded text-slate-600 focus:ring-slate-500"
                  />
                  <Settings className="w-3.5 h-3.5 text-slate-600" />
                  <span className="font-bold text-slate-800">إعدادات المحل والطباعة</span>
                </label>
              </div>

              {includeProducts && !includeCustomers && !includeInvoices && (
                <div className="pt-1">
                  <label className="flex items-center gap-2 text-xs text-emerald-800 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={anonymizeProducts}
                      onChange={(e) => setAnonymizeProducts(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>تجريد المواد من أي ارتباطات سابقة لتكون جاهزة لأي حساب آخر</span>
                  </label>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="px-5 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-200 flex items-center gap-2 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تنزيل النسخة الاحتياطية المختارة</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default ExportBackupModal;
