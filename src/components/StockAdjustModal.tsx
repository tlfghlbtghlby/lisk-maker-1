import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';

const REASONS_SUB = ['تالف', 'منتهي الصلاحية', 'جرد / تصحيح', 'هدية / عينة', 'إرجاع للمورد'];
const REASONS_ADD = ['استلام بضاعة', 'جرد / تصحيح', 'إرجاع من زبون'];

/** إضافة أو إنقاص كمية مخصصة من مادة، مع ملاحظة وتاريخ إنتاج/انتهاء للإضافة */
export function StockAdjustModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { applyStockChanges, settings } = useApp() as any;
  const isWeight = Boolean(product.isWeighted || product.unit === 'كغم' || product.unit === 'كيلو' || product.unit === 'غرام' || product.unit === 'غم');
  const ppc = Math.max(1, product.piecesPerCarton || 1);
  const dz = (product.piecesPerDozen || 0) > 1 ? Math.floor(product.piecesPerDozen!) : 0;

  const [mode, setMode] = useState<'add' | 'sub'>('add');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<'piece' | 'dozen' | 'carton'>('piece');
  const [note, setNote] = useState('');
  const [prodDate, setProdDate] = useState('');
  const [expDate, setExpDate] = useState('');
  const [error, setError] = useState('');

  const showDates = settings.enableProductExpiry === true && mode === 'add';
  const mult = isWeight ? 1 : unit === 'carton' ? ppc : unit === 'dozen' ? dz : 1;
  const n = parseFloat(qty) || 0;
  const pieces = Math.round(n * mult * 1000) / 1000;
  const delta = mode === 'add' ? pieces : -pieces;
  const newStock = Math.max(0, Math.round((product.stock + delta) * 1000) / 1000);
  const unitWord = isWeight ? 'كغم' : 'قطعة';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!(pieces > 0)) return setError('أدخل كمية أكبر من صفر.');
    if (!isWeight && pieces !== Math.floor(pieces)) return setError('الكمية يجب أن تكون عدداً صحيحاً.');
    if (mode === 'sub' && pieces > product.stock) return setError(`الكمية المطلوب إنقاصها أكبر من الرصيد (${product.stock}).`);
    if (showDates && prodDate && expDate && expDate < prodDate) return setError('تاريخ الانتهاء قبل تاريخ الإنتاج.');
    applyStockChanges([{
      id: product.id,
      delta,
      note: note.trim() || (mode === 'add' ? 'إضافة مخصصة' : 'إنقاص مخصص'),
      productionDate: showDates ? prodDate : undefined,
      expiryDate: showDates ? expDate : undefined,
    }]);
    onClose();
  };

  const input = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 focus:outline-none focus:border-emerald-500';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={submit} className="bg-white text-slate-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto" dir="rtl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="min-w-0">
            <h3 className="font-extrabold text-sm truncate">تعديل كمية: {product.name}</h3>
            <p className="text-[11px] text-slate-500">الرصيد الحالي: {product.stock} {unitWord}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode('add')} className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold border ${mode === 'add' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300'}`}><Plus className="w-4 h-4" />إضافة</button>
            <button type="button" onClick={() => setMode('sub')} className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold border ${mode === 'sub' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-300'}`}><Minus className="w-4 h-4" />إنقاص</button>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-700 mb-1">الكمية</label>
              <input autoFocus type="number" min="0" step={isWeight ? '0.001' : '1'} inputMode="decimal" value={qty} onChange={(e) => { setQty(e.target.value); setError(''); }} placeholder="0" className={`${input} font-mono font-bold text-center`} />
            </div>
            {!isWeight && (ppc > 1 || dz > 1) && (
              <div className="w-36">
                <label className="block text-xs font-bold text-slate-700 mb-1">الوحدة</label>
                <select value={unit} onChange={(e) => setUnit(e.target.value as any)} className={input}>
                  <option value="piece">قطعة</option>
                  {dz > 1 && <option value="dozen">درزن ({dz})</option>}
                  {ppc > 1 && <option value="carton">كرتون ({ppc})</option>}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظة</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === 'add' ? 'مثال: استلام من شركة ...' : 'مثال: تالف'} className={input} />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {(mode === 'add' ? REASONS_ADD : REASONS_SUB).map((r) => (
                <button key={r} type="button" onClick={() => setNote(r)} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700">{r}</button>
              ))}
            </div>
          </div>

          {showDates && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الإنتاج</label>
                <input type="date" value={prodDate} onChange={(e) => setProdDate(e.target.value)} className={input} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الانتهاء</label>
                <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} className={input} />
              </div>
            </div>
          )}

          <div className={`rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-between ${mode === 'add' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
            <span>{mode === 'add' ? '+' : '−'} {pieces || 0} {unitWord}</span>
            <span>الرصيد بعد التعديل: {newStock} {unitWord}</span>
          </div>

          {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-slate-200">
          <button type="submit" className={`flex-1 py-2.5 rounded-xl text-sm font-extrabold text-white ${mode === 'add' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'}`}>
            {mode === 'add' ? 'تأكيد الإضافة' : 'تأكيد الإنقاص'}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700">إلغاء</button>
        </div>
      </form>
    </div>
  );
}
