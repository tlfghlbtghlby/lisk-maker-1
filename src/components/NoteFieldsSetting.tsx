import React from 'react';
import { useApp } from '../context/AppContext';

/** تفعيل/إطفاء خانات الملاحظة في شاشة البيع (ملاحظات الوصل + الملاحظة الخاصة الداخلية وزر تفعيلها) */
export default function NoteFieldsSetting() {
  const { settings, updateSettings } = useApp() as any;
  const on = settings?.showInvoiceNoteFields !== false;
  return (
    <label data-testid="note-fields-setting" className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
      <input type="checkbox" data-testid="note-fields-toggle" checked={on} onChange={(e) => updateSettings({ showInvoiceNoteFields: e.target.checked })} className="mt-1 w-4 h-4 accent-emerald-600" />
      <span>
        <span className="block text-xs font-black text-slate-900 dark:text-white">📝 إظهار خانات الملاحظة في شاشة البيع</span>
        <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">عند الإطفاء تختفي من شاشة البيع خانة «ملاحظات تظهر بالوصل» وخانة الملاحظة الخاصة (الداخلية) وزر تفعيلها، وتبقى «ملاحظة أسفل القوائم» أعلاه تُطبع كما هي.</span>
      </span>
    </label>
  );
}
