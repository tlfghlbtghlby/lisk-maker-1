import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Plus, Trash2, X, Minus, FileStack } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import { barcodeSheet, buildSheetHtml, printLabels, printSheet, useBarcodeSheet } from '../utils/barcodeSheet';

/** قائمة كليك يمين على مادة في المخزن: طباعة باركود / إضافة لورقة الباركودات المجمّعة */
export function ProductBarcodeMenu({ x, y, product, onClose }: { x: number; y: number; product: Product; onClose: () => void }) {
  const { settings } = useApp() as any;
  const sheet = useBarcodeSheet();
  const [askCount, setAskCount] = useState(false);
  const [count, setCount] = useState<number>(Math.max(1, Number(settings?.barcodePrintCount) || 1));
  const code = product.code || '';
  const size = { w: Number(settings?.barcodeLabelW) || 50, h: Number(settings?.barcodeLabelH) || 30 };
  const mode: 'ask' | 'one' | 'fixed' = settings?.barcodePrintMode || 'ask';

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const inSheet = sheet.items.find((i) => i.productId === product.id);
  const left = Math.min(x, window.innerWidth - 250);
  const top = Math.min(y, window.innerHeight - 190);

  const doPrint = (n: number) => { printLabels(product.name, code, n, size); onClose(); };
  const onPrintClick = () => {
    if (!code) return;
    if (mode === 'one') doPrint(1);
    else if (mode === 'fixed') doPrint(Math.max(1, Number(settings?.barcodePrintCount) || 1));
    else setAskCount(true);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999]" onMouseDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} data-testid="barcode-menu-overlay">
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute w-60 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-1.5 text-xs"
        style={{ left, top }}
        dir="rtl"
        data-testid="barcode-menu"
      >
        <div className="px-2.5 py-1.5 font-black text-slate-800 dark:text-slate-100 truncate border-b border-slate-100 dark:border-slate-800 mb-1">{product.name}</div>
        {!code ? (
          <div className="px-2.5 py-2 text-amber-700 font-bold">هذه المادة بلا باركود</div>
        ) : askCount ? (
          <div className="p-2 space-y-2">
            <div className="font-bold text-slate-700 dark:text-slate-300">عدد الملصقات:</div>
            <div className="flex items-center gap-1.5">
              <button className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 font-black" onClick={() => setCount((c) => Math.max(1, c - 1))}><Minus className="w-4 h-4 mx-auto" /></button>
              <input autoFocus type="number" min={1} max={999} value={count} data-testid="barcode-count" onChange={(e) => setCount(Math.max(1, Math.min(999, Number(e.target.value) || 1)))} onKeyDown={(e) => { if (e.key === 'Enter') doPrint(count); }} className="flex-1 h-8 text-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-black" />
              <button className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 font-black" onClick={() => setCount((c) => Math.min(999, c + 1))}><Plus className="w-4 h-4 mx-auto" /></button>
            </div>
            <button data-testid="barcode-print-go" onClick={() => doPrint(count)} className="w-full py-2 rounded-lg bg-emerald-600 text-white font-black flex items-center justify-center gap-1.5"><Printer className="w-4 h-4" /> طباعة</button>
          </div>
        ) : (
          <>
            <button data-testid="barcode-print" onClick={onPrintClick} className="w-full text-right px-2.5 py-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-800 flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
              <Printer className="w-4 h-4 text-emerald-600" /> طباعة باركود
              <span className="mr-auto text-[10px] font-normal text-slate-400">{mode === 'ask' ? 'تحديد العدد' : mode === 'one' ? 'ملصق واحد' : `${Number(settings?.barcodePrintCount) || 1} ملصق`}</span>
            </button>
            <button data-testid="barcode-add-sheet" onClick={() => { barcodeSheet.add({ productId: product.id, name: product.name, code }); onClose(); }} className="w-full text-right px-2.5 py-2 rounded-lg hover:bg-amber-50 dark:hover:bg-slate-800 flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
              <FileStack className="w-4 h-4 text-amber-600" /> إضافة إلى ورقة الباركودات
              {inSheet && <span className="mr-auto text-[10px] font-black text-amber-600">×{inSheet.qty}</span>}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** نافذة ورقة الباركودات المجمّعة: محتواها + التحكم بالحجم + معاينة مطابقة للطباعة */
export function BarcodeSheetModal({ onClose }: { onClose: () => void }) {
  const sheet = useBarcodeSheet();
  const html = useMemo(() => buildSheetHtml(sheet.items, sheet.layout), [sheet]);
  const total = sheet.items.reduce((a, b) => a + b.qty, 0);
  const L = sheet.layout;
  return createPortal(
    <div className="fixed inset-0 z-[9998] bg-black/60 flex items-center justify-center p-3" dir="rtl" data-testid="barcode-sheet-modal">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="font-black text-slate-900 dark:text-white flex items-center gap-2"><FileStack className="w-5 h-5 text-amber-600" /> ورقة الباركودات المجمّعة <span className="text-xs font-bold text-slate-500">({sheet.items.length} مادة · {total} ملصق)</span></div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 min-h-0 grid md:grid-cols-[330px_1fr] gap-0 overflow-hidden">
          <div className="border-l border-slate-200 dark:border-slate-700 overflow-y-auto p-3 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1"><span className="font-bold text-slate-600 dark:text-slate-300">الأعمدة</span>
                <select data-testid="sheet-cols" value={L.cols} onChange={(e) => barcodeSheet.setLayout({ cols: Number(e.target.value) })} className="w-full h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
                  {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                </select></label>
              <label className="space-y-1"><span className="font-bold text-slate-600 dark:text-slate-300">ارتفاع الباركود (مم)</span>
                <input data-testid="sheet-height" type="number" min={8} max={30} value={L.barHeightMm} onChange={(e) => barcodeSheet.setLayout({ barHeightMm: Math.max(8, Math.min(30, Number(e.target.value) || 14)) })} className="w-full h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" /></label>
              <label className="space-y-1"><span className="font-bold text-slate-600 dark:text-slate-300">حجم اسم المادة (pt)</span>
                <input type="number" min={6} max={16} value={L.nameFontPt} onChange={(e) => barcodeSheet.setLayout({ nameFontPt: Math.max(6, Math.min(16, Number(e.target.value) || 9)) })} className="w-full h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" /></label>
              <label className="flex items-end gap-2 pb-1.5 cursor-pointer"><input type="checkbox" checked={L.showName} onChange={(e) => barcodeSheet.setLayout({ showName: e.target.checked })} /> <span className="font-bold text-slate-600 dark:text-slate-300">إظهار اسم المادة</span></label>
            </div>
            <div className="space-y-1.5" data-testid="sheet-items">
              {sheet.items.length === 0 && <div className="text-center text-slate-400 py-6">الورقة فارغة. انقر بزر الفأرة الأيمن على أي مادة في المخزن واختر «إضافة إلى ورقة الباركودات».</div>}
              {sheet.items.map((it) => (
                <div key={it.productId} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex-1 min-w-0"><div className="font-bold truncate text-slate-800 dark:text-slate-100">{it.name}</div><div className="font-mono text-[10px] text-slate-500">{it.code}</div></div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => barcodeSheet.setQty(it.productId, it.qty - 1)} className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800"><Minus className="w-3 h-3 mx-auto" /></button>
                    <input type="number" min={1} max={999} value={it.qty} onChange={(e) => barcodeSheet.setQty(it.productId, Number(e.target.value))} className="w-11 h-6 text-center rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-bold" />
                    <button onClick={() => barcodeSheet.setQty(it.productId, it.qty + 1)} className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800"><Plus className="w-3 h-3 mx-auto" /></button>
                  </div>
                  <button onClick={() => barcodeSheet.remove(it.productId)} className="p-1 text-rose-600 hover:bg-rose-50 rounded"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-auto bg-slate-100 dark:bg-slate-950 p-4">
            <div className="mx-auto bg-white shadow-lg" style={{ width: '210mm', maxWidth: '100%', minHeight: '120mm', padding: '6mm', boxSizing: 'border-box' }} data-testid="sheet-preview" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-700">
          <button disabled={!sheet.items.length} onClick={() => { if (window.confirm('تفريغ الورقة بالكامل؟')) barcodeSheet.clear(); }} className="px-3 py-2 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 disabled:opacity-40">تفريغ الورقة</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">إغلاق</button>
            <button data-testid="sheet-print" disabled={!sheet.items.length} onClick={() => printSheet(sheet.items, sheet.layout)} className="px-5 py-2 rounded-lg text-xs font-black bg-emerald-600 text-white flex items-center gap-1.5 disabled:opacity-40"><Printer className="w-4 h-4" /> طباعة الورقة (A4)</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** زر «ورقة الباركودات» في أعلى المخزن مع عدّاد */
export function BarcodeSheetButton({ onClick }: { onClick: () => void }) {
  const sheet = useBarcodeSheet();
  const total = sheet.items.reduce((a, b) => a + b.qty, 0);
  return (
    <button data-testid="open-barcode-sheet" onClick={onClick} className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 flex items-center gap-1.5 cursor-pointer" title="الباركودات المجمّعة لطباعتها في ورقة واحدة">
      <FileStack className="w-4 h-4" /> ورقة الباركودات
      {total > 0 && <span className="px-1.5 rounded-full bg-amber-600 text-white text-[10px] font-black">{total}</span>}
    </button>
  );
}
