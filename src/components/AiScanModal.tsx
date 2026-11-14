import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Camera, Image as ImageIcon, Sparkles, Trash2, Check, AlertTriangle, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Product, SupplierTxn, SupplierTxnItem } from '../types';
import { scanImageFile, matchProduct, MatchLevel, MatchCandidate, ScanItem, scoreNames } from '../utils/aiScan';
import { generateInternalBarcode } from '../utils/barcodeGen';
import { addBatch } from '../utils/expiry';
import { newId, todayIso, nextReceiptNo } from '../utils/suppliers';

type RowUnit = 'piece' | 'dozen' | 'carton' | 'kg';

interface Row {
  key: string;
  src: ScanItem;
  include: boolean;
  choice: string; // معرّف مادة موجودة أو 'new'
  confirmed: boolean;
  level: MatchLevel;
  candidates: MatchCandidate[];
  qty: string;
  unit: RowUnit;
  cost: string;
  expiry: string;
  newName: string;
  newBarcode: string;
  newRetail: string;
  newPerCarton: string;
  newPerDozen: string;
}

const MAX_IMAGES = 6;
const input = 'w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white text-slate-900 focus:outline-none focus:border-emerald-500';
const lbl = 'block text-[11px] font-bold text-slate-600 mb-0.5';

const isWeightedProduct = (p?: Product) => Boolean(p && (p.isWeighted || p.unit === 'كغم' || p.unit === 'كيلو'));

export function AiScanModal({ onClose }: { onClose: () => void }) {
  const { products, settings, updateSettings, applyStockChanges, currentUser, formatMoney } = useApp() as any;
  const prods: Product[] = products;
  const showDates = settings.enableProductExpiry === true;
  const trackBatches = showDates && settings.trackExpiryBatches !== false;

  const [step, setStep] = useState<'pick' | 'reading' | 'review' | 'confirm' | 'done'>('pick');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [progress, setProgress] = useState('');
  const [readErrors, setReadErrors] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [invoiceTotal, setInvoiceTotal] = useState<number | undefined>();
  const [margin, setMargin] = useState('20');
  const [updateCost, setUpdateCost] = useState(true);
  const [dest, setDest] = useState<'stock' | 'supplier'>('stock');
  const [supplierId, setSupplierId] = useState('');
  const [paid, setPaid] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [searchRow, setSearchRow] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [doneMsg, setDoneMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const suppliers = settings.suppliers || [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && step !== 'reading') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, step]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const imgs = Array.from(list).filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return;
    setFiles((prev) => [...prev, ...imgs].slice(0, MAX_IMAGES));
  };

  const productOf = (id: string) => prods.find((p) => p.id === id);

  // ---------- القراءة ----------
  const startReading = async () => {
    if (!files.length) return;
    setStep('reading');
    setReadErrors([]);
    const storeId = currentUser?.uid || 'offline_store';
    const all: ScanItem[] = [];
    const errs: string[] = [];
    let total: number | undefined;
    for (let i = 0; i < files.length; i++) {
      setProgress(`جارٍ قراءة الصورة ${i + 1} من ${files.length}...`);
      try {
        const r = await scanImageFile(files[i], storeId, (m) => setProgress(`الصورة ${i + 1} من ${files.length}: ${m}`));
        all.push(...r.items);
        if (r.invoiceTotal && files.length === 1) total = r.invoiceTotal;
      } catch (e: any) {
        errs.push(`الصورة ${i + 1}: ${e?.message || 'تعذرت القراءة'}`);
        if (/الحد اليومي|غير مفعّلة/.test(e?.message || '')) break;
      }
    }
    setReadErrors(errs);
    if (!all.length) { setStep('pick'); if (!errs.length) setReadErrors(['لم يتم العثور على مواد مقروءة في الصور. جرّب صورة أوضح.']); return; }
    setInvoiceTotal(total);
    setRows(all.map((it, i) => buildRow(it, i)));
    setStep('review');
  };

  const buildRow = (it: ScanItem, i: number): Row => {
    const m = matchProduct(it, prods);
    const choice = m.level === 'exact' || m.level === 'strong' ? m.best!.id : m.level === 'possible' ? m.candidates[0].product.id : 'new';
    const p = prods.find((x) => x.id === choice);
    let unit: RowUnit = it.unit === 'dozen' ? 'dozen' : it.unit === 'carton' ? 'carton' : it.unit === 'kg' ? 'kg' : 'piece';
    if (p) {
      if (isWeightedProduct(p)) unit = 'kg';
      else if (unit === 'kg') unit = 'piece';
      if (unit === 'carton' && (p.piecesPerCarton || 1) <= 1) unit = 'piece';
      if (unit === 'dozen' && (p.piecesPerDozen || 0) <= 1) unit = 'piece';
    }
    const unitCost = it.unitPrice ?? (it.lineTotal && it.quantity ? Math.round(it.lineTotal / it.quantity) : undefined);
    const mult = p ? unitMult(p, unit) : 1;
    const cost = unitCost !== undefined ? String(unitCost) : p && p.costPrice ? String(Math.round(p.costPrice * mult * 1000) / 1000) : '';
    return {
      key: `r${i}_${Math.random().toString(36).slice(2, 6)}`,
      src: it,
      include: true,
      choice,
      confirmed: m.level === 'exact' || m.level === 'strong',
      level: m.level,
      candidates: m.candidates,
      qty: String(it.quantity),
      unit,
      cost,
      expiry: it.expiryDate || '',
      newName: it.name,
      newBarcode: it.barcode || '',
      newRetail: '',
      newPerCarton: '',
      newPerDozen: it.unit === 'dozen' ? '12' : '12',
    };
  };

  const unitMult = (p: Product, unit: RowUnit) =>
    unit === 'carton' ? Math.max(1, p.piecesPerCarton || 1) : unit === 'dozen' ? Math.max(1, p.piecesPerDozen || 1) : 1;

  const patch = (key: string, u: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...u } : r)));

  const setChoice = (r: Row, choice: string) => {
    const p = choice === 'new' ? undefined : productOf(choice);
    let unit = r.unit;
    if (p) {
      if (isWeightedProduct(p)) unit = 'kg';
      else if (unit === 'kg') unit = 'piece';
      if (unit === 'carton' && (p.piecesPerCarton || 1) <= 1) unit = 'piece';
      if (unit === 'dozen' && (p.piecesPerDozen || 0) <= 1) unit = 'piece';
    }
    patch(r.key, { choice, unit, confirmed: choice === 'new' ? true : false });
  };

  // ---------- التحقق والحساب ----------
  const rowPieces = (r: Row): { pieces: number; mult: number } | null => {
    const q = parseFloat(r.qty);
    if (!(q > 0)) return null;
    if (r.choice === 'new') {
      const mult = r.unit === 'carton' ? parseInt(r.newPerCarton) || 0 : r.unit === 'dozen' ? parseInt(r.newPerDozen) || 0 : 1;
      if (mult < 1) return null;
      return { pieces: Math.round(q * mult * 1000) / 1000, mult };
    }
    const p = productOf(r.choice);
    if (!p) return null;
    const mult = isWeightedProduct(p) ? 1 : unitMult(p, r.unit);
    return { pieces: Math.round(q * mult * 1000) / 1000, mult };
  };

  const takenCodes = useMemo(() => new Set(prods.map((p) => String(p.code || '').trim())), [prods]);

  const rowError = (r: Row): string | null => {
    if (!r.include) return null;
    const q = parseFloat(r.qty);
    if (!(q > 0)) return 'أدخل كمية أكبر من صفر.';
    if (r.unit !== 'kg' && q !== Math.floor(q)) return 'الكمية يجب أن تكون عدداً صحيحاً.';
    if (r.choice !== 'new') {
      const p = productOf(r.choice);
      if (!p) return 'اختر المادة.';
      if (!r.confirmed) return 'أكّد المطابقة أو اختر مادة أخرى.';
      if (r.unit === 'carton' && (p.piecesPerCarton || 1) <= 1) return 'هذه المادة ليس لها تعبئة كرتون. غيّر الوحدة.';
      if (r.unit === 'dozen' && (p.piecesPerDozen || 0) <= 1) return 'هذه المادة ليس لها درزن. غيّر الوحدة.';
      return null;
    }
    if (!r.newName.trim()) return 'اكتب اسم المادة الجديدة.';
    if (r.unit === 'carton' && !(parseInt(r.newPerCarton) >= 2)) return 'اكتب عدد القطع في الكرتون (2 فأكثر).';
    if (r.unit === 'dozen' && !(parseInt(r.newPerDozen) >= 2)) return 'اكتب عدد القطع في الدرزن.';
    const bc = r.newBarcode.trim();
    if (bc && takenCodes.has(bc)) return 'هذا الباركود مستخدم لمادة موجودة. اختر تلك المادة أو غيّر الباركود.';
    const info = rowPieces(r);
    const costUnit = parseFloat(r.cost) || 0;
    const retail = parseFloat(r.newRetail) || (info && costUnit > 0 ? computeRetail(costUnit / info.mult) : 0);
    if (!(retail > 0)) return 'اكتب سعر البيع (أو سعر الشراء ليُحسب بالهامش).';
    return null;
  };

  const computeRetail = (pieceCost: number) => {
    const m = Math.max(0, parseFloat(margin) || 0);
    return Math.ceil((pieceCost * (1 + m / 100)) / 50) * 50;
  };

  const included = rows.filter((r) => r.include);
  const errors = included.map((r) => ({ r, e: rowError(r) }));
  const hasErrors = errors.some((x) => x.e);
  const newCount = included.filter((r) => r.choice === 'new').length;
  const sumCost = included.reduce((s, r) => s + (parseFloat(r.qty) || 0) * (parseFloat(r.cost) || 0), 0);
  const totalMismatch = invoiceTotal && sumCost > 0 && Math.abs(sumCost - invoiceTotal) / invoiceTotal > 0.02;

  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    included.forEach((r) => {
      const k = r.choice === 'new' ? 'n:' + r.newName.trim().toLowerCase() : r.choice;
      seen.set(k, (seen.get(k) || 0) + 1);
    });
    return new Set(Array.from(seen.entries()).filter(([, n]) => n > 1).map(([k]) => k));
  }, [included]);

  const confirmAllSuggestions = () => setRows((prev) => prev.map((r) => (r.choice !== 'new' ? { ...r, confirmed: true } : r)));

  // ---------- الحفظ ----------
  const goConfirm = () => {
    if (hasErrors || included.length === 0) return;
    if (dest === 'supplier' && !supplierId) { alert('اختر المورد أو اختر «المخزون فقط».'); return; }
    setStep('confirm');
  };

  const save = () => {
    if (hasErrors || included.length === 0) return;
    if (dest === 'supplier' && !supplierId) { alert('اختر المورد أو اختر «المخزون فقط».'); return; }
    const note = dest === 'supplier'
      ? `استلام من ${(suppliers.find((s: any) => s.id === supplierId) || {}).company || 'مورد'} (قراءة صورة بالذكاء الاصطناعي)`
      : 'إضافة بالذكاء الاصطناعي (قراءة صورة)';
    const used = new Set<string>(takenCodes);
    const created: Product[] = [];
    const changes: { id: string; delta: number; note: string; expiryDate?: string; costPrice?: number }[] = [];
    const txnItems: SupplierTxnItem[] = [];
    const nowIso = new Date().toISOString();
    const unitLabel = (u: RowUnit) => (u === 'carton' ? 'كرتون' : u === 'dozen' ? 'درزن' : u === 'kg' ? 'كغم' : 'قطعة');

    for (const r of included) {
      const info = rowPieces(r)!;
      const qty = parseFloat(r.qty);
      const unitCost = parseFloat(r.cost) || 0;
      const pieceCost = unitCost > 0 ? Math.round((unitCost / info.mult) * 1000) / 1000 : 0;
      let productId = r.choice;
      let name = '';
      if (r.choice === 'new') {
        const id = newId('prod');
        productId = id;
        name = r.newName.trim();
        const retail = parseFloat(r.newRetail) || computeRetail(pieceCost);
        const code = r.newBarcode.trim() || generateInternalBarcode(used);
        used.add(code);
        const weighted = r.unit === 'kg';
        created.push({
          id,
          code,
          name,
          category: 'عام',
          unit: weighted ? 'كغم' : 'قطعة',
          costPrice: pieceCost,
          retailPrice: retail,
          wholesalePrice: retail,
          stock: info.pieces,
          minStock: 5,
          piecesPerCarton: Math.max(1, parseInt(r.newPerCarton) || 1),
          ...(r.unit === 'dozen' ? { piecesPerDozen: parseInt(r.newPerDozen) } : {}),
          isWeighted: weighted,
          ...(showDates && r.expiry ? { expiryDate: r.expiry } : {}),
          ...(trackBatches && r.expiry ? { expiryBatches: addBatch([], info.pieces, '', r.expiry) } : {}),
          createdAt: nowIso,
          updatedAt: nowIso,
        } as Product);
      } else {
        const p = productOf(r.choice)!;
        name = p.name;
        changes.push({
          id: p.id,
          delta: info.pieces,
          note,
          ...(showDates && r.expiry ? { expiryDate: r.expiry } : {}),
          ...(updateCost && pieceCost > 0 ? { costPrice: pieceCost } : {}),
        });
      }
      txnItems.push({
        productId,
        name,
        pieces: info.pieces,
        qty,
        unitLabel: unitLabel(r.unit),
        unitCost,
        total: Math.round(qty * unitCost),
        ...(r.expiry ? { expiryDate: r.expiry } : {}),
      });
    }

    applyStockChanges(changes, created);

    if (dest === 'supplier') {
      const total = txnItems.reduce((s, i) => s + i.total, 0);
      const paidN = Math.min(total, Math.max(0, parseFloat(paid) || 0));
      const txns: SupplierTxn[] = settings.supplierTxns || [];
      const txn: SupplierTxn = {
        id: newId('stx'), supplierId, type: 'purchase', date: todayIso(), total,
        paid: paidN || undefined, invoiceNo: invoiceNo.trim() || undefined,
        receiptNo: nextReceiptNo(txns), notes: 'مُدخَل بقراءة صورة', items: txnItems, createdAt: nowIso,
      };
      updateSettings({ supplierTxns: [...txns, txn] });
    }
    setDoneMsg(`تمت إضافة ${included.length} مادة إلى المخزون (${created.length} مادة جديدة، ${changes.length} مادة موجودة زادت كميتها).`);
    setStep('done');
  };

  const searchResults = useMemo(() => {
    const t = searchQ.trim();
    if (!t) return [] as Product[];
    return prods
      .map((p) => ({ p, s: Math.max(scoreNames(t, p.name), String(p.code || '') === t ? 1 : 0, p.name.toLowerCase().includes(t.toLowerCase()) ? 0.6 : 0) }))
      .filter((x) => x.s >= 0.3)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map((x) => x.p);
  }, [searchQ, prods]);

  // ---------- الواجهة ----------
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && step !== 'reading') onClose(); }}>
      <div className="bg-white text-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[96vh] flex flex-col" dir="rtl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white flex items-center justify-center"><Sparkles className="w-5 h-5" /></div>
            <div>
              <h3 className="font-extrabold text-sm">إضافة المواد من صورة (ذكاء اصطناعي)</h3>
              <p className="text-[11px] text-slate-500">صوّر القائمة أو البضاعة، راجع النتيجة، ثم أضفها للمخزون</p>
            </div>
          </div>
          <button onClick={onClose} disabled={step === 'reading'} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3 grow">
          {step === 'pick' && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${dragOver ? 'border-violet-500 bg-violet-50' : 'border-slate-300 bg-slate-50'}`}
              >
                <p className="text-sm font-bold text-slate-700">اسحب الصور هنا أو اختر من الأسفل</p>
                <p className="text-[11px] text-slate-500 mt-1">يصلح لقوائم الموردين (مطبوعة أو بخط اليد) ولصور البضاعة. حتى {MAX_IMAGES} صور. الصورة الواضحة والمضاءة تعطي نتيجة أدق.</p>
                <div className="flex justify-center gap-2 mt-3 flex-wrap">
                  <button type="button" onClick={() => camRef.current?.click()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-extrabold"><Camera className="w-4 h-4" />التقاط بالكاميرا</button>
                  <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-xs font-extrabold"><ImageIcon className="w-4 h-4" />اختيار من الملفات</button>
                </div>
                <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
              </div>

              {previews.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {previews.map((u, i) => (
                    <div key={u} className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200">
                      <img src={u} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}

              {readErrors.map((e, i) => <p key={i} className="text-xs font-bold text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{e}</p>)}

              <p className="text-[11px] text-slate-500 leading-relaxed">تُرسل الصورة إلى خدمة Gemini من Google لقراءتها عبر خادم المتجر. لا تصوّر معلومات شخصية. النتيجة اقتراح فقط، ولن يُضاف شيء قبل مراجعتك وموافقتك.</p>

              <button type="button" onClick={startReading} disabled={!files.length} className="w-full py-3 rounded-xl bg-gradient-to-l from-violet-600 to-fuchsia-600 text-white text-sm font-extrabold disabled:opacity-40">
                قراءة {files.length ? `${files.length} صورة` : 'الصور'}
              </button>
            </>
          )}

          {step === 'reading' && (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
              <p className="text-sm font-bold text-slate-700">{progress}</p>
              <p className="text-[11px] text-slate-500">قد تستغرق كل صورة بضع ثوانٍ</p>
            </div>
          )}

          {step === 'review' && (
            <>
              {readErrors.map((e, i) => <p key={i} className="text-xs font-bold text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{e}</p>)}
              <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                <span className="px-2.5 py-1 rounded-full bg-slate-100">مقروءة: {rows.length}</span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">مطابقة: {rows.filter((r) => r.choice !== 'new' && r.confirmed).length}</span>
                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">تحتاج تأكيداً: {rows.filter((r) => r.choice !== 'new' && !r.confirmed && r.include).length}</span>
                <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800">غير موجودة (ستُضاف كجديدة): {rows.filter((r) => r.choice === 'new').length}</span>
                {rows.some((r) => r.choice !== 'new' && !r.confirmed) && (
                  <button type="button" onClick={confirmAllSuggestions} className="px-3 py-1 rounded-full bg-emerald-600 text-white">اعتماد كل المقترحات</button>
                )}
              </div>

              {previews.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {previews.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="h-16 rounded-lg border border-slate-200" /></a>)}
                </div>
              )}

              <div className="space-y-2">
                {rows.map((r) => {
                  const p = r.choice === 'new' ? undefined : productOf(r.choice);
                  const err = errors.find((x) => x.r.key === r.key)?.e || null;
                  const dupKey = r.choice === 'new' ? 'n:' + r.newName.trim().toLowerCase() : r.choice;
                  const lowConf = r.src.confidence < 0.7;
                  const weighted = r.choice !== 'new' ? isWeightedProduct(p) : r.unit === 'kg';
                  const info = rowPieces(r);
                  const options = [...r.candidates.map((c) => c.product)];
                  if (p && !options.some((o) => o.id === p.id)) options.unshift(p);
                  return (
                    <div key={r.key} className={`rounded-xl border p-3 space-y-2 ${!r.include ? 'opacity-50 border-slate-200' : err ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`}>
                      <div className="flex items-start gap-2">
                        <input type="checkbox" checked={r.include} onChange={(e) => patch(r.key, { include: e.target.checked })} className="mt-1 w-4 h-4 accent-violet-600" />
                        <div className="min-w-0 grow">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-extrabold text-sm">{r.src.name}</span>
                            {lowConf && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />قراءة غير مؤكدة</span>}
                            {r.choice === 'new'
                              ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">غير موجودة: ستُضاف كمادة جديدة</span>
                              : r.confirmed
                                ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-0.5"><Check className="w-3 h-3" />مطابقة</span>
                                : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">اقتراح: يحتاج تأكيدك</span>}
                            {duplicates.has(dupKey) && r.include && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">تكرار لنفس المادة</span>}
                          </div>
                        </div>
                        <button type="button" onClick={() => setRows(rows.filter((x) => x.key !== r.key))} className="p-1 text-rose-600 hover:bg-rose-50 rounded shrink-0" title="حذف السطر"><Trash2 className="w-4 h-4" /></button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                        <div className="sm:col-span-5">
                          <label className={lbl}>المادة في المخزون</label>
                          <div className="flex gap-1">
                            <select value={r.choice} onChange={(e) => setChoice(r, e.target.value)} className={input}>
                              {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                              <option value="new">＋ مادة جديدة</option>
                            </select>
                            <button type="button" onClick={() => { setSearchRow(searchRow === r.key ? null : r.key); setSearchQ(''); }} className="px-2 rounded-lg border border-slate-300 hover:bg-slate-100 shrink-0" title="بحث عن مادة أخرى"><Search className="w-4 h-4" /></button>
                          </div>
                          {searchRow === r.key && (
                            <div className="mt-1 relative">
                              <input autoFocus value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="ابحث بالاسم أو الباركود..." className={input} />
                              {searchResults.length > 0 && (
                                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-auto">
                                  {searchResults.map((sp) => (
                                    <button key={sp.id} type="button" onClick={() => { setChoice(r, sp.id); patch(r.key, { choice: sp.id, confirmed: true }); setSearchRow(null); }} className="w-full text-right px-3 py-2 text-sm hover:bg-slate-100 border-b border-slate-100">{sp.name}</button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {r.choice !== 'new' && !r.confirmed && (
                            <button type="button" onClick={() => patch(r.key, { confirmed: true })} className="mt-1 text-[11px] font-extrabold text-emerald-700 hover:underline">✓ نعم، هذه هي المادة</button>
                          )}
                        </div>
                        <div className="sm:col-span-2">
                          <label className={lbl}>الكمية</label>
                          <input type="number" min="0" step={weighted ? '0.001' : '1'} value={r.qty} onChange={(e) => patch(r.key, { qty: e.target.value })} className={`${input} text-center font-mono font-bold`} />
                        </div>
                        <div className="sm:col-span-2">
                          <label className={lbl}>الوحدة</label>
                          <select value={r.unit} onChange={(e) => patch(r.key, { unit: e.target.value as RowUnit })} className={input} disabled={r.choice !== 'new' && isWeightedProduct(p)}>
                            {weighted ? <option value="kg">كغم</option> : (
                              <>
                                <option value="piece">قطعة</option>
                                <option value="dozen">درزن</option>
                                <option value="carton">كرتون</option>
                                {r.choice === 'new' && <option value="kg">كغم (وزني)</option>}
                              </>
                            )}
                          </select>
                        </div>
                        <div className="sm:col-span-3">
                          <label className={lbl}>سعر الشراء للوحدة</label>
                          <input type="number" min="0" value={r.cost} onChange={(e) => patch(r.key, { cost: e.target.value })} placeholder="اختياري" className={`${input} text-center font-mono`} />
                        </div>
                      </div>

                      {r.choice === 'new' && (
                        <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 rounded-lg bg-rose-50/60 border border-rose-200 p-2">
                          <div className="col-span-2 sm:col-span-5"><label className={lbl}>اسم المادة الجديدة</label><input value={r.newName} onChange={(e) => patch(r.key, { newName: e.target.value })} className={input} /></div>
                          <div className="col-span-2 sm:col-span-3"><label className={lbl}>الباركود (اختياري)</label><input value={r.newBarcode} onChange={(e) => patch(r.key, { newBarcode: e.target.value })} placeholder="يُولَّد تلقائياً" className={`${input} font-mono`} /></div>
                          <div className="col-span-1 sm:col-span-2"><label className={lbl}>سعر بيع القطعة</label><input type="number" min="0" value={r.newRetail} onChange={(e) => patch(r.key, { newRetail: e.target.value })} placeholder={info && parseFloat(r.cost) > 0 ? String(computeRetail(parseFloat(r.cost) / info.mult)) : ''} className={`${input} font-mono text-center`} /></div>
                          {r.unit === 'carton' && <div className="col-span-1 sm:col-span-2"><label className={lbl}>قطع في الكرتون</label><input type="number" min="2" value={r.newPerCarton} onChange={(e) => patch(r.key, { newPerCarton: e.target.value })} className={`${input} text-center font-mono`} /></div>}
                          {r.unit === 'dozen' && <div className="col-span-1 sm:col-span-2"><label className={lbl}>قطع في الدرزن</label><input type="number" min="2" value={r.newPerDozen} onChange={(e) => patch(r.key, { newPerDozen: e.target.value })} className={`${input} text-center font-mono`} /></div>}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                        {info && <span>يُضاف للمخزون: <b>{info.pieces}</b> {weighted ? 'كغم' : 'قطعة'}</span>}
                        {parseFloat(r.cost) > 0 && parseFloat(r.qty) > 0 && <span>الإجمالي: <b>{formatMoney((parseFloat(r.qty) || 0) * (parseFloat(r.cost) || 0))}</b></span>}
                        {showDates && (
                          <label className="flex items-center gap-1">تاريخ الانتهاء <input type="date" value={r.expiry} onChange={(e) => patch(r.key, { expiry: e.target.value })} className="border border-slate-300 rounded px-1.5 py-0.5 text-[11px]" /></label>
                        )}
                      </div>
                      {err && r.include && <p className="text-[11px] font-bold text-amber-800">{err}</p>}
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                {newCount > 0 && (
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span>هامش الربح لحساب سعر بيع المواد الجديدة التي لم تُحدّد أسعارها:</span>
                    <input type="number" min="0" value={margin} onChange={(e) => setMargin(e.target.value)} className="w-16 border border-slate-300 rounded px-2 py-1 text-center" /> %
                  </div>
                )}
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer"><input type="checkbox" checked={updateCost} onChange={(e) => setUpdateCost(e.target.checked)} className="w-4 h-4 accent-violet-600" />تحديث سعر تكلفة المواد الموجودة بسعر الشراء المقروء</label>
                <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={dest === 'stock'} onChange={() => setDest('stock')} className="accent-violet-600" />المخزون فقط</label>
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={dest === 'supplier'} onChange={() => setDest('supplier')} className="accent-violet-600" />تسجيلها كاستلام من مورد (دين علينا)</label>
                </div>
                {dest === 'supplier' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div><label className={lbl}>المورد</label><select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={input}><option value="">— اختر —</option>{suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.company}</option>)}</select></div>
                    <div><label className={lbl}>المدفوع الآن</label><input type="number" min="0" value={paid} onChange={(e) => setPaid(e.target.value)} className={`${input} text-center`} /></div>
                    <div><label className={lbl}>رقم قائمة المورد</label><input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className={input} /></div>
                    {suppliers.length === 0 && <p className="sm:col-span-3 text-[11px] text-amber-700 font-bold">لا يوجد موردون. أضف مورداً من تبويب «الموردون» أولاً.</p>}
                  </div>
                )}
                {totalMismatch && (
                  <p className="text-xs font-bold text-amber-800 bg-amber-100 rounded-lg px-3 py-2 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" />مجموع الأسطر ({formatMoney(sumCost)}) يختلف عن إجمالي القائمة المقروء ({formatMoney(invoiceTotal || 0)}). قد تكون هناك مادة ناقصة أو رقم مقروء خطأ، راجع الأسطر.</p>
                )}
              </div>
            </>
          )}

          {step === 'confirm' && (
            <>
              <div className="rounded-xl bg-amber-50 border border-amber-300 p-3 text-xs font-bold text-amber-900 leading-relaxed">
                قائمة التأكيد قبل الإضافة: راجع كل مادة بدقة (الاسم والكمية والتعبئة) لأن القراءة بالذكاء الاصطناعي قد تخطئ. تعبئة الكرتون قابلة للتعديل للمواد الجديدة فقط، أما المواد الموجودة فتبقى تعبئتها كما هي ولا تتغير.
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-[11px] text-slate-600">
                    <tr>
                      <th className="px-2 py-2 text-right">#</th>
                      <th className="px-2 py-2 text-right">المادة</th>
                      <th className="px-2 py-2">الحالة</th>
                      <th className="px-2 py-2">العدد</th>
                      <th className="px-2 py-2">تعبئة الكرتون</th>
                      <th className="px-2 py-2">يُضاف (قطعة)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {included.map((r, i) => {
                      const isNew = r.choice === 'new';
                      const p = isNew ? undefined : productOf(r.choice);
                      const info = rowPieces(r);
                      const weighted = isNew ? r.unit === 'kg' : isWeightedProduct(p);
                      const unitLbl = r.unit === 'carton' ? 'كرتون' : r.unit === 'dozen' ? 'درزن' : weighted ? 'كغم' : 'قطعة';
                      return (
                        <tr key={r.key} className="border-t border-slate-100">
                          <td className="px-2 py-2 text-slate-500">{i + 1}</td>
                          <td className="px-2 py-2 font-bold">{isNew ? r.newName.trim() : p?.name}</td>
                          <td className="px-2 py-2 text-center">
                            {isNew
                              ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">جديدة</span>
                              : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">موجودة</span>}
                          </td>
                          <td className="px-2 py-2 text-center font-mono font-bold whitespace-nowrap">{r.qty} {unitLbl}</td>
                          <td className="px-2 py-2 text-center">
                            {weighted ? <span className="text-slate-400">—</span> : isNew ? (
                              <input type="number" min="1" value={r.newPerCarton} onChange={(e) => patch(r.key, { newPerCarton: e.target.value })} placeholder="بدون" className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-center font-mono text-sm" />
                            ) : (
                              <span className="font-mono text-slate-600" title="لا تتغير للمواد الموجودة">{(p?.piecesPerCarton || 1) > 1 ? p?.piecesPerCarton : 'بدون'} 🔒</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center font-mono font-extrabold text-emerald-700">{info ? info.pieces : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {errors.some((x) => x.e) && <p className="text-xs font-bold text-rose-600">{errors.find((x) => x.e)?.e}</p>}
            </>
          )}

          {step === 'done' && (
            <div className="py-14 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center"><Check className="w-8 h-8" /></div>
              <p className="text-sm font-extrabold">{doneMsg}</p>
              <button onClick={onClose} className="px-6 py-2 rounded-xl bg-emerald-600 text-white text-sm font-extrabold">تم</button>
            </div>
          )}
        </div>

        {step === 'review' && (
          <div className="px-4 py-3 border-t border-slate-200 flex gap-2 shrink-0">
            <button onClick={goConfirm} disabled={hasErrors || included.length === 0} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold disabled:opacity-40">
              {hasErrors ? `أكمل الأسطر المطلوبة (${errors.filter((x) => x.e).length})` : `متابعة للتأكيد (${included.length} مادة)`}
            </button>
            <button onClick={() => { setStep('pick'); setRows([]); }} className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-700">صور أخرى</button>
          </div>
        )}
        {step === 'confirm' && (
          <div className="px-4 py-3 border-t border-slate-200 flex gap-2 shrink-0">
            <button onClick={save} disabled={hasErrors} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold disabled:opacity-40">
              أؤكد، أضف {included.length} مادة للمخزون
            </button>
            <button onClick={() => setStep('review')} className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-700">رجوع للتعديل</button>
          </div>
        )}
      </div>
    </div>
  );
}
