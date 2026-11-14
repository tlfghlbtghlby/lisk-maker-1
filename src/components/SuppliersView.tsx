import React, { useMemo, useState } from 'react';
import { Truck, Users, Plus, Search, Phone, Package, Wallet, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Supplier, SupplierTxn } from '../types';
import { owedTo, txnsOf, txnEffect, fmtDate } from '../utils/suppliers';
import { AiScanModal } from './AiScanModal';
import { SupplierFormModal, SupplierPaymentModal, ReceiveGoodsModal } from './SupplierModals';

/** الموردون: استلام البضاعة وتسجيل الدين علينا والتسديد، مع تبويب خاص بمندوبي الشركات */
export function SuppliersView() {
  const { settings, updateSettings, formatMoney, applyStockChanges } = useApp() as any;
  const suppliers: Supplier[] = settings.suppliers || [];
  const txns: SupplierTxn[] = settings.supplierTxns || [];

  const [tab, setTab] = useState<'suppliers' | 'reps'>('suppliers');
  const [q, setQ] = useState('');
  const [onlyDebt, setOnlyDebt] = useState(false);
  const [formFor, setFormFor] = useState<Supplier | 'new' | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [aiScanOpen, setAiScanOpen] = useState(false);
  const [receiveFor, setReceiveFor] = useState<Supplier | 'any' | null>(null);
  const [payFor, setPayFor] = useState<Supplier | null>(null);

  const saveAll = (nextSuppliers: Supplier[], nextTxns: SupplierTxn[]) => updateSettings({ suppliers: nextSuppliers, supplierTxns: nextTxns });

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return suppliers
      .map((s) => ({ s, owed: owedTo(s, txns) }))
      .filter(({ s, owed }) => {
        if (onlyDebt && owed <= 0) return false;
        if (!t) return true;
        return [s.company, s.name, s.phone, ...(s.reps || []).map((r) => r.name)].some((x) => (x || '').toLowerCase().includes(t));
      })
      .sort((a, b) => b.owed - a.owed || a.s.company.localeCompare(b.s.company));
  }, [suppliers, txns, q, onlyDebt]);

  const totalOwed = suppliers.reduce((sum, s) => sum + Math.max(0, owedTo(s, txns)), 0);
  const detail = suppliers.find((s) => s.id === detailId) || null;

  const repRows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const out: { key: string; name: string; phone?: string; company: string; supplier: Supplier; receipts: number; purchased: number; last?: string }[] = [];
    suppliers.forEach((s) => {
      (s.reps || []).forEach((r) => {
        const mine = txns.filter((x) => x.supplierId === s.id && x.type === 'purchase' && (x.repName || '').trim() === r.name.trim());
        out.push({
          key: s.id + r.id, name: r.name, phone: r.phone, company: s.company, supplier: s,
          receipts: mine.length, purchased: mine.reduce((a, x) => a + (Number(x.total) || 0), 0),
          last: mine.map((x) => x.date).sort().pop(),
        });
      });
    });
    return out.filter((r) => !t || [r.name, r.phone, r.company].some((x) => (x || '').toLowerCase().includes(t))).sort((a, b) => a.company.localeCompare(b.company) || a.name.localeCompare(b.name));
  }, [suppliers, txns, q]);

  const deleteSupplier = (s: Supplier) => {
    const n = txnsOf(s.id, txns).length;
    if (!window.confirm(`حذف المورد «${s.company}»${n ? ` مع ${n} حركة مسجلة` : ''}؟ لا يمكن التراجع. (الكميات التي أُضيفت للمخزون سابقاً تبقى كما هي)`)) return;
    saveAll(suppliers.filter((x) => x.id !== s.id), txns.filter((t) => t.supplierId !== s.id));
    setDetailId(null);
  };
  const deleteTxn = (t: SupplierTxn) => {
    const msg = t.type === 'purchase'
      ? 'حذف سجل الاستلام هذا؟ سيُحذف من الدين فقط، أما الكميات التي أُضيفت للمخزون فتبقى (عدّلها من المخزون إن لزم).'
      : 'حذف سند التسديد هذا؟ سيعود المبلغ إلى الدين.';
    if (!window.confirm(msg)) return;
    saveAll(suppliers, txns.filter((x) => x.id !== t.id));
  };

  const card = 'bg-white border border-slate-200 rounded-2xl shadow-xs';

  return (
    <div className="space-y-4 text-slate-900" dir="rtl">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center"><Truck className="w-5 h-5" /></div>
          <div>
            <h2 className="text-base font-extrabold">الموردون ومندوبو الشركات</h2>
            <p className="text-[11px] text-slate-500">استلام البضاعة وتسجيل الدين علينا وتسديده</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAiScanOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-l from-violet-600 to-fuchsia-600 text-white text-xs font-extrabold">✨ استلام من صورة (AI)</button>
          <button onClick={() => setReceiveFor('any')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold"><Package className="w-4 h-4" />استلام بضاعة</button>
          <button onClick={() => setFormFor('new')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold"><Plus className="w-4 h-4" />مورد جديد</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`${card} p-3`}><div className="text-[11px] font-bold text-slate-500">إجمالي الدين علينا للموردين</div><div className="text-lg font-black text-rose-600">{formatMoney(totalOwed)}</div></div>
        <div className={`${card} p-3`}><div className="text-[11px] font-bold text-slate-500">عدد الموردين / المندوبين</div><div className="text-lg font-black">{suppliers.length} / {suppliers.reduce((a, s) => a + (s.reps?.length || 0), 0)}</div></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-slate-300 overflow-hidden text-xs font-bold">
          <button onClick={() => setTab('suppliers')} className={`flex items-center gap-1.5 px-3 py-2 ${tab === 'suppliers' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}><Truck className="w-3.5 h-3.5" />الشركات والديون</button>
          <button onClick={() => setTab('reps')} className={`flex items-center gap-1.5 px-3 py-2 ${tab === 'reps' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}><Users className="w-3.5 h-3.5" />المندوبون</button>
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'suppliers' ? 'بحث باسم الشركة أو المندوب أو الهاتف...' : 'بحث باسم المندوب أو الشركة...'} className="w-full border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-sm bg-white" />
        </div>
        {tab === 'suppliers' && (
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer"><input type="checkbox" checked={onlyDebt} onChange={(e) => setOnlyDebt(e.target.checked)} className="accent-rose-600" />المدينون فقط</label>
        )}
      </div>

      {tab === 'suppliers' ? (
        rows.length === 0 ? (
          <div className={`${card} p-8 text-center text-sm text-slate-500`}>{suppliers.length === 0 ? 'لا يوجد موردون بعد. اضغط «مورد جديد» لإضافة أول شركة.' : 'لا توجد نتائج.'}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {rows.map(({ s, owed }) => (
              <button key={s.id} onClick={() => setDetailId(s.id)} className={`${card} p-3 text-right hover:border-indigo-400 transition`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm truncate">{s.company}</div>
                    <div className="text-[11px] text-slate-500 truncate">{[s.name, s.phone].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                  <div className={`text-sm font-black whitespace-nowrap ${owed > 0 ? 'text-rose-600' : owed < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>{owed < 0 ? `له ${formatMoney(-owed)}` : formatMoney(owed)}</div>
                </div>
                {s.reps?.length > 0 && <div className="mt-2 text-[11px] text-slate-600 truncate">المندوبون: {s.reps.map((r) => r.name).join('، ')}</div>}
              </button>
            ))}
          </div>
        )
      ) : repRows.length === 0 ? (
        <div className={`${card} p-8 text-center text-sm text-slate-500`}>لا يوجد مندوبون مسجلون. أضف المندوبين من نافذة المورد.</div>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600"><tr>
              <th className="text-right px-3 py-2">المندوب</th><th className="text-right px-3 py-2">الشركة</th><th className="text-right px-3 py-2">الهاتف</th>
              <th className="px-3 py-2">عدد الاستلامات</th><th className="px-3 py-2">مجموع المشتريات</th><th className="px-3 py-2">آخر استلام</th><th className="px-3 py-2"></th>
            </tr></thead>
            <tbody>
              {repRows.map((r) => (
                <tr key={r.key} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-bold">{r.name}</td>
                  <td className="px-3 py-2">{r.company}</td>
                  <td className="px-3 py-2 font-mono" dir="ltr">{r.phone ? <a href={`tel:${r.phone}`} className="text-indigo-700 hover:underline inline-flex items-center gap-1"><Phone className="w-3 h-3" />{r.phone}</a> : '—'}</td>
                  <td className="px-3 py-2 text-center">{r.receipts}</td>
                  <td className="px-3 py-2 text-center font-bold">{formatMoney(r.purchased)}</td>
                  <td className="px-3 py-2 text-center">{fmtDate(r.last) || '—'}</td>
                  <td className="px-3 py-2 text-center"><button onClick={() => setDetailId(r.supplier.id)} className="text-indigo-700 font-bold hover:underline">فتح الشركة</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (() => {
        const list = txnsOf(detail.id, txns);
        let run = Number(detail.openingDebt) || 0;
        const withBal = list.map((t) => { run += txnEffect(t); return { t, bal: run }; }).reverse();
        const owed = owedTo(detail, txns);
        return (
          <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetailId(null); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[94vh] overflow-y-auto" dir="rtl">
              <div className="sticky top-0 bg-white z-10 px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-extrabold text-base truncate">{detail.company}</h3>
                  <p className="text-[11px] text-slate-500">{[detail.name, detail.phone, detail.address].filter(Boolean).join(' · ')}</p>
                </div>
                <button onClick={() => setDetailId(null)} className="text-slate-500 hover:bg-slate-100 rounded-lg px-2 py-1 text-sm font-bold">إغلاق</button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2 justify-between rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                  <div className="text-sm font-black text-amber-900">{owed < 0 ? `لنا عنده: ${formatMoney(-owed)}` : `الدين علينا: ${formatMoney(owed)}`}</div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setReceiveFor(detail)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"><Package className="w-3.5 h-3.5" />استلام بضاعة</button>
                    <button onClick={() => setPayFor(detail)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold"><Wallet className="w-3.5 h-3.5" />تسديد</button>
                    <button onClick={() => setFormFor(detail)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold"><Pencil className="w-3.5 h-3.5" />تعديل</button>
                    <button onClick={() => deleteSupplier(detail)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold"><Trash2 className="w-3.5 h-3.5" />حذف</button>
                  </div>
                </div>

                {detail.reps?.length > 0 && (
                  <div className="rounded-xl border border-slate-200 p-3">
                    <div className="text-xs font-extrabold mb-1.5">المندوبون</div>
                    <div className="flex flex-wrap gap-2">
                      {detail.reps.map((r) => (
                        <span key={r.id} className="text-xs bg-slate-100 rounded-full px-3 py-1 font-bold">{r.name}{r.phone ? <a href={`tel:${r.phone}`} className="font-mono text-indigo-700 mr-2" dir="ltr">{r.phone}</a> : null}</span>
                      ))}
                    </div>
                  </div>
                )}
                {detail.notes && <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{detail.notes}</p>}

                <div className="rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600"><tr>
                      <th className="text-right px-3 py-2">التاريخ</th><th className="text-right px-3 py-2">الحركة</th><th className="text-right px-3 py-2">المندوب</th>
                      <th className="px-3 py-2">المبلغ</th><th className="px-3 py-2">المدفوع</th><th className="px-3 py-2">الرصيد بعدها</th><th className="px-3 py-2"></th>
                    </tr></thead>
                    <tbody>
                      {detail.openingDebt ? (
                        <tr className="border-t border-slate-100 text-slate-500"><td className="px-3 py-2">—</td><td className="px-3 py-2" colSpan={4}>دين سابق (رصيد افتتاحي)</td><td className="px-3 py-2 text-center font-bold">{formatMoney(detail.openingDebt)}</td><td></td></tr>
                      ) : null}
                      {withBal.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">لا توجد حركات بعد.</td></tr>}
                      {withBal.map(({ t, bal }) => (
                        <tr key={t.id} className="border-t border-slate-100 align-top">
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(t.date)}</td>
                          <td className="px-3 py-2">
                            {t.type === 'purchase' ? (
                              <details>
                                <summary className="cursor-pointer font-bold text-emerald-800">استلام بضاعة{t.invoiceNo ? ` · قائمة ${t.invoiceNo}` : ''} ({t.items?.length || 0} مادة)</summary>
                                <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600">
                                  {(t.items || []).map((it, i) => <li key={i}>{it.name}: {it.qty} {it.unitLabel} × {formatMoney(it.unitCost)} = {formatMoney(it.total)}{it.expiryDate ? ` · ينتهي ${fmtDate(it.expiryDate)}` : ''}</li>)}
                                </ul>
                                {t.notes && <div className="text-[11px] text-slate-500 mt-1">{t.notes}</div>}
                              </details>
                            ) : (
                              <span className="font-bold text-indigo-800">تسديد{t.receiptNo ? ` · ${t.receiptNo}` : ''}{t.notes ? <span className="font-normal text-slate-500"> · {t.notes}</span> : null}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{t.repName || '—'}</td>
                          <td className="px-3 py-2 text-center font-bold">{formatMoney(t.total)}</td>
                          <td className="px-3 py-2 text-center">{t.type === 'purchase' ? formatMoney(t.paid || 0) : '—'}</td>
                          <td className="px-3 py-2 text-center font-bold">{formatMoney(bal)}</td>
                          <td className="px-3 py-2 text-center"><button onClick={() => deleteTxn(t)} className="text-rose-600 hover:bg-rose-50 rounded p-1" title="حذف الحركة"><Trash2 className="w-3.5 h-3.5" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {formFor && (
        <SupplierFormModal
          supplier={formFor === 'new' ? null : formFor}
          onClose={() => setFormFor(null)}
          onSave={(s) => {
            const exists = suppliers.some((x) => x.id === s.id);
            saveAll(exists ? suppliers.map((x) => (x.id === s.id ? s : x)) : [s, ...suppliers], txns);
            setFormFor(null);
            if (!exists) setDetailId(s.id);
          }}
        />
      )}

      {aiScanOpen && <AiScanModal onClose={() => setAiScanOpen(false)} />}
      {receiveFor && (
        <ReceiveGoodsModal
          supplier={receiveFor === 'any' ? null : receiveFor}
          suppliers={suppliers}
          onClose={() => setReceiveFor(null)}
          onSave={(supId, txn, stock) => {
            saveAll(suppliers, [...txns, txn]);
            if (stock.length) applyStockChanges(stock);
            setReceiveFor(null);
            setDetailId(supId);
          }}
        />
      )}

      {payFor && (
        <SupplierPaymentModal
          supplier={payFor}
          onClose={() => setPayFor(null)}
          onSave={(txn) => { saveAll(suppliers, [...txns, txn]); setPayFor(null); }}
        />
      )}
    </div>
  );
}
