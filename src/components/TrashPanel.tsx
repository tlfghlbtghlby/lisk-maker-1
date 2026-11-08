import React, { useMemo, useState } from 'react';
import { Trash2, RotateCcw, X, AlertTriangle, GitMerge } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SyncSection, TRASH_RETENTION_MS } from '../utils/syncEngine';

const SECTION_LABELS: Record<SyncSection, string> = {
  products: 'المواد والمخزون',
  customers: 'الزبائن والديون',
  invoices: 'القوائم والفواتير',
  reps: 'المندوبون',
  shifts: 'الشفتات',
  payments: 'الدفعات',
};

interface TrashPanelProps {
  sections: SyncSection[];
  title?: string;
}

const remainingText = (deletedAt: string): string => {
  const left = new Date(deletedAt).getTime() + TRASH_RETENTION_MS - Date.now();
  if (left <= 0) return 'سيُحذف قريباً';
  const hours = Math.floor(left / 3600000);
  if (hours >= 24) return `يتبقى ${Math.floor(hours / 24)} يوم و${hours % 24} ساعة`;
  return `يتبقى ${hours} ساعة`;
};

export const TrashPanel: React.FC<TrashPanelProps> = ({ sections, title }) => {
  const { trash, restoreTrashEntry, purgeTrashEntry, emptyTrash } = useApp();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const entries = useMemo(() => trash.filter(e => sections.includes(e.section)), [trash, sections]);

  const handleRestore = (id: string) => {
    const ok = restoreTrashEntry(id);
    setNotice(ok ? 'تمت الاستعادة بنجاح' : 'تعذرت الاستعادة');
    setTimeout(() => setNotice(null), 2500);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
        title="سلة المحذوفات: تُحذف نهائياً بعد 3 أيام"
      >
        <Trash2 className="w-4 h-4" />
        <span>سلة المحذوفات</span>
        {entries.length > 0 && (
          <span className="bg-rose-600 text-white text-[10px] font-black rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
            {entries.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-md flex items-center justify-center p-3"
          dir="rtl"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white border border-slate-300 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  {title || 'سلة المحذوفات'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  كل ما يُحذف أو يُستبدل عند المزامنة يُحفظ هنا 3 أيام ثم يُحذف نهائياً تلقائياً.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {entries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('تفريغ السلة نهائياً؟ لا يمكن التراجع.')) emptyTrash(sections);
                    }}
                    className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer"
                  >
                    تفريغ السلة
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {notice && (
              <div className="mx-5 mt-3 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                {notice}
              </div>
            )}

            <div className="p-4 overflow-y-auto space-y-2">
              {entries.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm font-bold">السلة فارغة</div>
              ) : (
                entries.map(e => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 truncate flex items-center gap-1.5">
                        {e.reason === 'conflict' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5">
                            <GitMerge className="w-3 h-3" /> نسخة متعارضة
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-100 border border-rose-300 rounded px-1.5 py-0.5">
                            <AlertTriangle className="w-3 h-3" /> محذوف
                          </span>
                        )}
                        <span className="truncate">{e.label}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {SECTION_LABELS[e.section]} · {new Date(e.deletedAt).toLocaleString('ar-IQ')}
                        {e.deletedBy ? ` · بواسطة: ${e.deletedBy}` : ''} · {remainingText(e.deletedAt)}
                      </div>
                      {e.details && <div className="text-[10px] text-slate-400 mt-0.5">{e.details}</div>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRestore(e.id)}
                        className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        استعادة
                      </button>
                      <button
                        type="button"
                        onClick={() => purgeTrashEntry(e.id)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 cursor-pointer"
                        title="حذف نهائي"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TrashPanel;
