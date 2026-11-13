import { generateInternalBarcode } from '../utils/barcodeGen';
import React, { useMemo, useRef, useState } from 'react';
import { X, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import { readSpreadsheet, SheetData } from '../utils/sheetReader';
import {
  detectLayout, forceOrientation, Detection, FieldKey, FIELD_LABELS,
  parseNumber, parseDateCell, normalizeText,
} from '../utils/smartImport';

interface Props { isOpen: boolean; onClose: () => void; }

type ColMap = Record<number, FieldKey | ''>;
const FIELD_KEYS = Object.keys(FIELD_LABELS) as FieldKey[];

const invert = (m: Partial<Record<FieldKey, number>>): ColMap => {
  const out: ColMap = {};
  (Object.keys(m) as FieldKey[]).forEach(f => { if (m[f] !== undefined) out[m[f] as number] = f; });
  return out;
};

const randomCode = (used: Set<string>): string => {
  const c = generateInternalBarcode(used);
  used.add(c);
  return c;
};

export const ExcelImportModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { products, addBulkProducts, settings, currentUser, setSyncNotice } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [det, setDet] = useState<Detection | null>(null);
  const [colMap, setColMap] = useState<ColMap>({});
  const [cartonPrices, setCartonPrices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [doneCount, setDoneCount] = useState<number | null>(null);

  const expiryOn = settings.enableProductExpiry === true;

  const applyDetection = (d: Detection) => { setDet(d); setColMap(invert(d.mapping)); };

  const reset = () => {
    setFileName(''); setSheets([]); setSheetIdx(0); setDet(null); setColMap({});
    setError(null); setDoneCount(null); setCartonPrices(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null); setDoneCount(null); setLoading(true);
    try {
      const data = await readSpreadsheet(file);
      if (!data.length) throw new Error('الملف فارغ أو لا يحتوي بيانات');
      setFileName(file.name);
      setSheets(data);
      setSheetIdx(0);
      applyDetection(detectLayout(data[0].rows));
    } catch (e: any) {
      setError(e?.message || 'تعذرت قراءة الملف');
      setSheets([]); setDet(null);
    } finally {
      setLoading(false);
    }
  };

  const changeSheet = (i: number) => {
    setSheetIdx(i);
    applyDetection(detectLayout(sheets[i].rows));
  };

  const setOrientation = (o: 'horizontal' | 'vertical') => {
    if (!sheets[sheetIdx]) return;
    applyDetection(forceOrientation(sheets[sheetIdx].rows, o));
  };

  const setColumnField = (col: number, f: FieldKey | '') => {
    setColMap(prev => {
      const next: ColMap = { ...prev };
      if (f) Object.keys(next).forEach(k => { if (next[+k] === f) next[+k] = ''; });
      next[col] = f;
      return next;
    });
  };

  const colOf = useMemo(() => {
    const r: Partial<Record<FieldKey, number>> = {};
    Object.keys(colMap).forEach(k => { const f = colMap[+k]; if (f) r[f] = +k; });
    return r;
  }, [colMap]);

  // بناء المواد من الجدول حسب الربط الحالي
  const built = useMemo(() => {
    if (!det || colOf.name === undefined) return null;
    const rows = det.grid.slice(det.headerRowIndex + 1);
    const used = new Set(products.map(p => (p.code || '').trim().toLowerCase()));
    const names = new Set(products.map(p => normalizeText(p.name)));
    const items: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    let skippedDup = 0, noPrice = 0, emptyRows = 0;
    const track = expiryOn && settings.trackExpiryBatches !== false;
    const cell = (r: string[], f: FieldKey) => (colOf[f] === undefined ? '' : (r[colOf[f] as number] ?? '').trim());

    for (const r of rows) {
      const name = cell(r, 'name');
      if (!name) { emptyRows++; continue; }
      const rawCode = cell(r, 'code').replace(/\s/g, '');
      if (rawCode) {
        if (used.has(rawCode.toLowerCase())) { skippedDup++; continue; }
      } else if (names.has(normalizeText(name))) { skippedDup++; continue; }
      const code = rawCode || randomCode(used);
      used.add(code.toLowerCase());
      names.add(normalizeText(name));

      const ppcRaw = parseNumber(cell(r, 'piecesPerCarton'));
      const ppc = ppcRaw && ppcRaw > 0 ? Math.round(ppcRaw) : 1;
      const div = cartonPrices ? ppc : 1;
      const price = (f: FieldKey) => {
        const n = parseNumber(cell(r, f));
        return n && n > 0 ? Math.round((n / div) * 100) / 100 : 0;
      };
      const cost = price('cost');
      const retail = price('retail');
      const wholesale = price('wholesale');
      const sup = price('superWholesale');
      const spec = price('special');
      if (!retail) noPrice++;
      const stock = Math.max(0, parseNumber(cell(r, 'stock')) ?? 0);
      const minRaw = parseNumber(cell(r, 'minStock'));
      const prod = expiryOn ? parseDateCell(cell(r, 'productionDate')) : '';
      const exp = expiryOn ? parseDateCell(cell(r, 'expiryDate')) : '';

      const item: any = {
        name,
        code,
        category: cell(r, 'category') || 'عام',
        unit: cell(r, 'unit') || 'قطعة',
        costPrice: cost,
        retailPrice: retail,
        wholesalePrice: wholesale || retail,
        stock,
        piecesPerCarton: ppc,
        minStock: minRaw !== null && minRaw >= 0 ? minRaw : 5,
        notes: cell(r, 'notes') || 'استيراد من Excel',
        ownerUid: currentUser?.uid || '',
      };
      if (sup) item.superWholesalePrice = sup;
      if (spec) item.specialPrice = spec;
      if (prod) item.productionDate = prod;
      if (exp) item.expiryDate = exp;
      if (track && stock > 0 && (prod || exp)) {
        item.expiryBatches = [{
          id: 'bt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          qty: stock,
          ...(prod ? { productionDate: prod } : {}),
          ...(exp ? { expiryDate: exp } : {}),
          addedAt: new Date().toISOString(),
        }];
      }
      items.push(item);
    }
    return { items, skippedDup, noPrice, emptyRows };
  }, [det, colOf, products, cartonPrices, expiryOn, settings.trackExpiryBatches, currentUser?.uid]);

  const doImport = async () => {
    if (!built || !built.items.length) return;
    setSaving(true); setError(null);
    try {
      const res = await addBulkProducts(built.items);
      if (res?.success) {
        setDoneCount(res.count);
        setSyncNotice?.(`تم استيراد ${res.count} مادة من الملف بنجاح.`);
      }
    } catch (e: any) {
      setError('تعذر حفظ المواد: ' + (e?.message || 'حاول مرة أخرى'));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const width = det ? Math.max(0, ...det.grid.slice(0, 60).map(r => r.length)) : 0;
  const headerRow = det && det.headerRowIndex >= 0 ? det.grid[det.headerRowIndex] : null;
  const firstData = det ? det.grid[det.headerRowIndex + 1] || [] : [];
  const previewCols = FIELD_KEYS.filter(f => colOf[f] !== undefined && (expiryOn || (f !== 'productionDate' && f !== 'expiryDate')));

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-3" dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> استيراد المواد من ملف Excel
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-4 text-xs text-slate-700">
          {doneCount !== null ? (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <div className="font-bold text-sm text-slate-900">تم استيراد {doneCount} مادة بنجاح</div>
              <div className="flex justify-center gap-2">
                <button onClick={reset} className="px-4 py-2 rounded-xl border border-slate-300 font-semibold">استيراد ملف آخر</button>
                <button onClick={onClose} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold">إغلاق</button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xlsm,.csv,.txt"
                  onChange={e => onFile(e.target.files?.[0])}
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" /> {loading ? 'جارٍ القراءة...' : fileName ? 'اختيار ملف آخر' : 'اختيار ملف Excel أو CSV'}
                </button>
                <div className="text-[11px] text-slate-500">
                  {fileName || 'الصيغ المدعومة: xlsx و csv. يتعرف البرنامج تلقائيًا على اتجاه الجدول (أفقي أو عمودي) وعلى مكان الاسم والسعر والكمية وغيرها، ويمكنك تعديل ذلك قبل الاستيراد.'}
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
                </div>
              )}

              {det && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {sheets.length > 1 && (
                      <select
                        value={sheetIdx}
                        onChange={e => changeSheet(+e.target.value)}
                        className="border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                      >
                        {sheets.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
                      </select>
                    )}
                    <span className="font-bold">اتجاه الجدول:</span>
                    {(['horizontal', 'vertical'] as const).map(o => (
                      <button
                        key={o}
                        onClick={() => setOrientation(o)}
                        className={`px-3 py-1.5 rounded-lg border font-semibold ${det.orientation === o ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 text-slate-600'}`}
                      >
                        {o === 'horizontal' ? 'أفقي (كل مادة في سطر)' : 'عمودي (كل مادة في عمود)'}
                      </button>
                    ))}
                    <span className={`px-2 py-1 rounded-lg font-bold ${det.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' : det.confidence === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {det.headerFound ? (det.confidence === 'high' ? 'تعرّف ممتاز' : 'تعرّف جيد، راجع الأعمدة') : 'لا توجد عناوين: تخمين من المحتوى، راجع الأعمدة'}
                    </span>
                  </div>

                  <div>
                    <div className="font-bold mb-1.5">ربط الأعمدة (عدّل أي عمود إن كان التعرف خاطئًا):</div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {Array.from({ length: Math.min(width, 16) }, (_, c) => (
                        <div key={c} className="min-w-[120px] border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50">
                          <div className="font-bold text-slate-800 truncate" title={headerRow?.[c] || ''}>
                            {headerRow?.[c] || `عمود ${c + 1}`}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate h-4">{firstData[c] || '—'}</div>
                          <select
                            value={colMap[c] || ''}
                            onChange={e => setColumnField(c, e.target.value as FieldKey | '')}
                            className={`w-full border rounded-lg px-1 py-1 bg-white ${colMap[c] ? 'border-emerald-400 text-emerald-800 font-bold' : 'border-slate-300 text-slate-500'}`}
                          >
                            <option value="">تجاهل</option>
                            {FIELD_KEYS.filter(f => expiryOn || (f !== 'productionDate' && f !== 'expiryDate')).map(f => (
                              <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={cartonPrices} onChange={e => setCartonPrices(e.target.checked)} className="w-4 h-4 rounded text-emerald-600" />
                    <span>الأسعار في الملف هي سعر الكرتون (تُقسَّم على عدد القطع بالكرتون). الافتراضي: سعر القطعة.</span>
                  </label>

                  {colOf.name === undefined ? (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
                      حدّد عمود «اسم المادة» ليظهر ملخص الاستيراد.
                    </div>
                  ) : built && (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2"><div className="text-lg font-black text-emerald-700">{built.items.length}</div><div>مادة ستُضاف</div></div>
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-2"><div className="text-lg font-black">{built.skippedDup}</div><div>مكررة (تُتخطى)</div></div>
                        <div className="rounded-xl bg-amber-50 border border-amber-200 p-2"><div className="text-lg font-black text-amber-700">{built.noPrice}</div><div>بلا سعر مفرد</div></div>
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-2"><div className="text-lg font-black">{built.emptyRows}</div><div>أسطر بلا اسم</div></div>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead className="bg-slate-100 text-slate-600">
                            <tr>{previewCols.map(f => <th key={f} className="p-2 text-right whitespace-nowrap">{FIELD_LABELS[f]}</th>)}</tr>
                          </thead>
                          <tbody>
                            {built.items.slice(0, 8).map((it: any, i) => (
                              <tr key={i} className="border-t border-slate-100">
                                {previewCols.map(f => {
                                  const v = ({
                                    name: it.name, code: colOf.code !== undefined ? it.code : '(تلقائي)', category: it.category, unit: it.unit,
                                    cost: it.costPrice, retail: it.retailPrice, wholesale: it.wholesalePrice,
                                    superWholesale: it.superWholesalePrice, special: it.specialPrice, stock: it.stock,
                                    piecesPerCarton: it.piecesPerCarton, minStock: it.minStock, notes: it.notes,
                                    productionDate: it.productionDate, expiryDate: it.expiryDate,
                                  } as Record<FieldKey, any>)[f];
                                  return <td key={f} className="p-2 whitespace-nowrap">{v === undefined || v === '' ? '—' : String(v)}</td>;
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {built.items.length > 8 && <div className="text-[11px] text-slate-500">معاينة أول 8 مواد من {built.items.length}.</div>}
                      <div className="text-[11px] text-slate-500">
                        المواد التي باركودها (أو اسمها عند غياب الباركود) موجود مسبقًا تُتخطى ولا تُعدَّل. المواد بلا باركود يُولَّد لها باركود تلقائي.
                      </div>

                      <button
                        onClick={doImport}
                        disabled={saving || built.items.length === 0}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-40"
                      >
                        {saving ? 'جارٍ الحفظ...' : `استيراد ${built.items.length} مادة`}
                      </button>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
