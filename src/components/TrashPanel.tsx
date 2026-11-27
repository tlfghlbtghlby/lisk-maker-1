import React, { useMemo, useState } from 'react';
import { Trash2, RotateCcw, X, AlertTriangle, GitMerge, Eye, HelpCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SyncSection, TRASH_RETENTION_MS, TrashEntry } from '../utils/syncEngine';

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


const FIELD_LABELS: Record<string, string> = {
  name: 'الاسم', code: 'الباركود', category: 'التصنيف', unit: 'الوحدة', costPrice: 'سعر التكلفة', retailPrice: 'سعر المفرق', wholesalePrice: 'سعر الجملة',
  superWholesalePrice: 'جملة الجملة', specialPrice: 'السعر الخاص', stock: 'المخزون', minStock: 'حد النقص', piecesPerCarton: 'تعبئة الكرتون', piecesPerDozen: 'تعبئة الدرزن',
  phone: 'الهاتف', address: 'العنوان', totalDebt: 'الدين', notes: 'ملاحظات', createdAt: 'تاريخ الإنشاء', updatedAt: 'آخر تعديل',
  invoiceNumber: 'رقم القائمة', type: 'النوع', customerName: 'الزبون', items: 'المواد', subtotal: 'المجموع', discount: 'الخصم', total: 'الإجمالي',
  paidAmount: 'المدفوع', remainingAmount: 'المتبقي', previousDebt: 'الدين السابق', currentTotalDebt: 'الدين بعد القائمة', date: 'التاريخ', status: 'الحالة',
  repName: 'المندوب', shiftNumber: 'رقم الشفت', openedAt: 'فتح', closedAt: 'إغلاق', expiryDate: 'تاريخ الانتهاء', productionDate: 'تاريخ الإنتاج', expiryBatches: 'دفعات الصلاحية',
  purchaseLog: 'سجل الشراء', isWeighted: 'مادة وزنية', image: 'الصورة',
};
const HIDE_PREVIEW = new Set(['id', 'ownerUid', 'storeUid', 'storeId', 'seal', 'storeCode', 'lastSavedByClient', 'purchaseLog']);
const fmtVal = (v: any): string => {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
  if (typeof v === 'number') return v.toLocaleString('en-US');
  if (Array.isArray(v)) return `${v.length} عنصر`;
  if (typeof v === 'object') return 'بيانات مركبة';
  const t = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) { try { return new Date(t).toLocaleString('ar-IQ'); } catch { return t; } }
  return t.length > 120 ? t.slice(0, 120) + '…' : t;
};
const when = (iso?: string) => { if (!iso) return 'غير معروف'; try { return new Date(iso).toLocaleString('ar-IQ'); } catch { return iso; } };

const PreviewBody: React.FC<{ e: TrashEntry }> = ({ e }) => {
  const d = e.data || {};
  const rows = Object.keys(d).filter(k => !HIDE_PREVIEW.has(k) && typeof d[k] !== 'object').map(k => [FIELD_LABELS[k] || k, fmtVal(d[k])]);
  const items: any[] = Array.isArray(d.items) ? d.items : [];
  return (
    <div className="space-y-3" data-testid="trash-preview">
      <table className="w-full text-xs"><tbody>
        {rows.map(([k, v]) => (<tr key={k} className="border-t border-slate-100"><td className="py-1.5 pl-3 font-bold text-slate-500 whitespace-nowrap w-1/3">{k}</td><td className="py-1.5 text-slate-900 break-words">{v}</td></tr>))}
      </tbody></table>
      {items.length > 0 && (
        <div>
          <div className="text-xs font-black mb-1">المواد ({items.length})</div>
          <div className="rounded-lg border border-slate-200 overflow-x-auto"><table className="w-full text-[11px]"><thead className="bg-slate-50 text-slate-600"><tr><th className="text-right px-2 py-1">المادة</th><th className="px-2 py-1">الكمية</th><th className="px-2 py-1">السعر</th><th className="px-2 py-1">المجموع</th></tr></thead><tbody>
            {items.slice(0, 60).map((it, i) => (<tr key={i} className="border-t border-slate-100"><td className="px-2 py-1 font-bold">{it.productName || it.name || '—'}</td><td className="px-2 py-1 text-center">{fmtVal(it.quantity ?? it.qty)}</td><td className="px-2 py-1 text-center">{fmtVal(it.unitPrice ?? it.price)}</td><td className="px-2 py-1 text-center font-bold">{fmtVal(it.total)}</td></tr>))}
          </tbody></table></div>
        </div>
      )}
    </div>
  );
};

const ReasonBody: React.FC<{ e: TrashEntry }> = ({ e }) => {
  const x = e.explain;
  const sec = SECTION_LABELS[e.section];
  const left = remainingText(e.deletedAt);
  const P: React.FC<{ t: string; children: React.ReactNode }> = ({ t, children }) => (<div><div className="text-[11px] font-black text-slate-500 mb-0.5">{t}</div><div className="text-xs text-slate-900 leading-relaxed">{children}</div></div>);
  if (e.reason === 'deleted') {
    return (
      <div className="space-y-3" data-testid="trash-reason">
        <P t="ما الذي حدث؟">حُذف «{e.label}» ({sec}) حذفاً عادياً من البرنامج، فنُقل إلى هذه السلة بدلاً من إزالته نهائياً.</P>
        <P t="من حذفه؟">{e.deletedBy || x?.actor || 'غير معروف'}{x?.shiftNo !== undefined && x?.shiftNo !== '' ? ` — أثناء الشفت رقم ${x.shiftNo}` : ''}</P>
        <P t="متى؟">{when(e.deletedAt)}</P>
        {e.details && <P t="ملاحظة">{e.details}</P>}
        <P t="ماذا يحدث الآن؟">سُجّلت «علامة حذف» حتى تحذفه الأجهزة الأخرى عند المزامنة ولا يعود من تلقاء نفسه. المدة المتبقية في السلة: {left}، ثم يُمحى نهائياً.</P>
        <P t="إن استعدته">يرجع بكامل بياناته وقت الحذف، وتُزال علامة الحذف فيعود ظاهراً على كل الأجهزة. إن وُجدت نسخة بنفس المعرّف حالياً فتُحفظ هنا كنسخة متعارضة.</P>
      </div>
    );
  }
  if (e.reason === 'conflict' && x?.kind === 'restore') {
    return (
      <div className="space-y-3" data-testid="trash-reason">
        <P t="ما الذي حدث؟">استُعيد عنصر محذوف له نفس معرّف «{e.label}»، فاستُبدلت النسخة الموجودة وقتها بالنسخة المستعادة وحُفظت هي هنا حتى لا يضيع شيء.</P>
        <P t="من فعل ذلك؟">{x.actor || e.deletedBy || 'غير معروف'}</P>
        <P t="متى؟">{when(e.deletedAt)}</P>
        <P t="آخر تعديل لهذه النسخة">{when(x.loserAt)}</P>
        <P t="كيف أرجعها؟">اضغط «استعادة»؛ ستحل محل النسخة الحالية، وتُحفظ الحالية هنا.</P>
      </div>
    );
  }
  const side = x?.loserSide;
  return (
    <div className="space-y-3" data-testid="trash-reason">
      <P t="ما هو التعارض؟">
        «{e.label}» ({sec}) عُدِّل في مكانين مختلفين قبل أن يتزامنا — وصلت منهما نسختان مختلفتان المحتوى. لا يستطيع البرنامج دمج نسختين لعنصر واحد حقلاً بحقل، فاعتمد النسخة <b>الأحدث تعديلاً</b> وحفظ الأقدم هنا بدل رميها.
      </P>
      <P t="من أين أتت هذه النسخة؟">
        {side === 'local' ? 'كانت على هذا الجهاز (عُدّلت هنا ولم تصل إلى السحابة قبل أن يعدّل جهاز آخر العنصر نفسه).' : side === 'cloud' ? 'جاءت من السحابة، أي عُدّلت من جهاز أو مستخدم آخر ثم رُفعت، لكن هذا الجهاز كان قد عدّل نسخة أحدث منها.' : (e.details || 'نسخة قديمة استُبدلت عند المزامنة.')}
        {side === 'local' && x?.actor ? ` المستخدم المعروف على هذا الجهاز وقتها: ${x.actor}.` : ''}
        {side === 'cloud' ? ' اسم المستخدم الآخر غير مسجّل داخل بيانات العنصر نفسه، لذلك لا يمكن تحديده بدقة.' : ''}
      </P>
      <P t="التوقيتات">آخر تعديل لهذه (الخاسرة): {when(x?.loserAt)}<br />آخر تعديل للنسخة المعتمدة (الرابحة): {when(x?.winnerAt)}<br />وقت اكتشاف التعارض: {when(e.deletedAt)}</P>
      <P t="لماذا خسرت هذه النسخة؟">لأن النسخة المعتمدة أحدث منها زمنياً. القاعدة: الأحدث يفوز دائماً، والأقدم لا تُفقد بل تُحفظ في السلة ({left}).</P>
      {x?.diffs && x.diffs.length > 0 ? (
        <div>
          <div className="text-[11px] font-black text-slate-500 mb-1">ما الذي اختلف؟ ({x.diffTotal} حقل)</div>
          <div className="rounded-lg border border-slate-200 overflow-x-auto"><table className="w-full text-[11px]"><thead className="bg-slate-50 text-slate-600"><tr><th className="text-right px-2 py-1">الحقل</th><th className="text-right px-2 py-1">في هذه النسخة (المحفوظة هنا)</th><th className="text-right px-2 py-1">في المعتمدة</th></tr></thead><tbody>
            {x.diffs.map(df => (<tr key={df.key} className="border-t border-slate-100"><td className="px-2 py-1 font-bold">{FIELD_LABELS[df.key] || df.key}</td><td className="px-2 py-1 text-amber-800">{df.loser}</td><td className="px-2 py-1 text-emerald-800">{df.winner}</td></tr>))}
          </tbody></table></div>
        </div>
      ) : (
        <P t="ما الذي اختلف؟">{x ? 'لم تُسجَّل فروق تفصيلية.' : 'هذا التعارض سُجّل قبل إضافة التفاصيل، لذا لا تتوفر قائمة الفروق؛ استعمل «معاينة» لرؤية محتوى هذه النسخة.'}</P>
      )}
      <P t="ماذا أفعل؟">قارن بين «معاينة» والقيم المعتمدة حالياً. إن كانت هذه النسخة هي الصحيحة اضغط «استعادة» فتحل محل المعتمدة (وتُحفظ المعتمدة هنا). وإن كانت المعتمدة صحيحة فتجاهلها وستُمحى تلقائياً.</P>
    </div>
  );
};

export const TrashPanel: React.FC<TrashPanelProps> = ({ sections, title }) => {
  const { trash, restoreTrashEntry, purgeTrashEntry, emptyTrash } = useApp();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<{ e: TrashEntry; mode: 'preview' | 'reason' } | null>(null);

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
                      <button type="button" data-testid="trash-preview-btn" onClick={() => setView({ e, mode: 'preview' })} className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1 cursor-pointer"><Eye className="w-3.5 h-3.5" />معاينة</button>
                      <button type="button" data-testid="trash-reason-btn" onClick={() => setView({ e, mode: 'reason' })} className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 cursor-pointer"><HelpCircle className="w-3.5 h-3.5" />السبب</button>
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
      {open && view && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-3" dir="rtl" onClick={() => setView(null)}>
          <div className="bg-white border border-slate-300 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden" onClick={ev => ev.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <h3 className="text-sm font-black text-slate-900">{view.mode === 'preview' ? 'معاينة' : 'سبب الوجود في السلة'} — {view.e.label}</h3>
              <button type="button" onClick={() => setView(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 overflow-y-auto">{view.mode === 'preview' ? <PreviewBody e={view.e} /> : <ReasonBody e={view.e} />}</div>
            <div className="px-5 py-3 border-t border-slate-200 flex gap-2 justify-end">
              <button type="button" onClick={() => { handleRestore(view.e.id); setView(null); }} className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">استعادة</button>
              <button type="button" onClick={() => setView(null)} className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 cursor-pointer">إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TrashPanel;
