import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { db } from '../firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { sanitizeForFirestore } from '../context/AppContext';
import { Product } from '../types';
import { 
  Zap, 
  HelpCircle, 
  Eye, 
  Save, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  FileSpreadsheet,
  Trash2,
  Sparkles
} from 'lucide-react';

interface ParsedItem {
  id: string;
  name: string;
  piecesPerBox: number;
  costPiece: number;
  costBox: number;
  retailPricePiece: number;
  retailPriceBox: number;
  stock: number;
  rawStock: string;
  wholesalePricePiece: number;
  wholesalePriceBox: number;
  barcode: string;
  autoBarcode: boolean;
  isValid: boolean;
  error?: string;
}

export const QuickAddProducts: React.FC = () => {
  const { products, setSyncNotice, formatMoney, currentUser } = useApp();
  
  const [inputText, setInputText] = useState<string>('');
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [isPreviewed, setIsPreviewed] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const exampleText = `بيض, 12, 6000, 72000, 6500, 78000, 1ك
حليب نيدو, 6, 24000, 0, 27000, 0, 5ك, 25500, 0
زيت طعام, 12, 3000, 36000, 3500, 42000, 24ق, 3250, 39000, 890123456789`;

  const generateUniqueBarcode = (existingCodes: Set<string>): string => {
    let code = '';
    do {
      const rand = Math.floor(100000000000 + Math.random() * 900000000000);
      code = rand.toString();
    } while (existingCodes.has(code));
    existingCodes.add(code);
    return code;
  };

  const parseLine = (line: string, index: number, usedCodes: Set<string>): ParsedItem | null => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      return null;
    }

    const parts = trimmed.split(/[,،]/).map(p => p.trim());
    if (parts.length === 0 || !parts[0]) {
      return null;
    }

    const name = parts[0];
    const piecesPerBox = Math.max(1, parseInt(parts[1]) || 1);

    let costPiece = parseFloat(parts[2]) || 0;
    let costBox = parseFloat(parts[3]) || 0;

    let retailPricePiece = parseFloat(parts[4]) || 0;
    let retailPriceBox = parseFloat(parts[5]) || 0;

    const rawStock = parts[6] || '0';

    let wholesalePricePiece = parseFloat(parts[7]) || 0;
    let wholesalePriceBox = parseFloat(parts[8]) || 0;

    let barcode = (parts[9] || '').trim();
    let autoBarcode = false;

    if (costBox === 0 && costPiece > 0) {
      costBox = costPiece * piecesPerBox;
    } else if (costPiece === 0 && costBox > 0) {
      costPiece = Math.round(costBox / piecesPerBox);
    }

    if (retailPriceBox === 0 && retailPricePiece > 0) {
      retailPriceBox = retailPricePiece * piecesPerBox;
    } else if (retailPricePiece === 0 && retailPriceBox > 0) {
      retailPricePiece = Math.round(retailPriceBox / piecesPerBox);
    }

    if (wholesalePriceBox === 0 && wholesalePricePiece > 0) {
      wholesalePriceBox = wholesalePricePiece * piecesPerBox;
    } else if (wholesalePricePiece === 0 && wholesalePriceBox > 0) {
      wholesalePricePiece = Math.round(wholesalePriceBox / piecesPerBox);
    }

    let stock = 0;
    const cleanStock = rawStock.trim();
    if (cleanStock.endsWith('ك') || cleanStock.endsWith('K') || cleanStock.endsWith('k') || cleanStock.includes('كرتون')) {
      const numCartons = parseFloat(cleanStock.replace(/[^0-9.]/g, '')) || 0;
      stock = Math.round(numCartons * piecesPerBox);
    } else if (cleanStock.endsWith('ق') || cleanStock.endsWith('P') || cleanStock.endsWith('p') || cleanStock.includes('قطعة')) {
      const numPieces = parseFloat(cleanStock.replace(/[^0-9.]/g, '')) || 0;
      stock = Math.round(numPieces);
    } else {
      const numPieces = parseFloat(cleanStock.replace(/[^0-9.]/g, '')) || 0;
      stock = Math.round(numPieces);
    }

    if (!barcode) {
      barcode = generateUniqueBarcode(usedCodes);
      autoBarcode = true;
    } else {
      usedCodes.add(barcode);
    }

    const id = `prod_q_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`;

    return {
      id,
      name,
      piecesPerBox,
      costPiece,
      costBox,
      retailPricePiece,
      retailPriceBox,
      stock,
      rawStock,
      wholesalePricePiece,
      wholesalePriceBox,
      barcode,
      autoBarcode,
      isValid: Boolean(name && retailPricePiece > 0),
      error: !name ? 'اسم المادة مطلوب' : retailPricePiece <= 0 ? 'سعر البيع مطلوب' : undefined
    };
  };

  const handlePreview = () => {
    setParseError(null);
    setSuccessCount(null);

    const lines = inputText.split('\n');
    const existingCodes = new Set(products.map(p => p.code));
    const items: ParsedItem[] = [];

    lines.forEach((line, idx) => {
      const parsed = parseLine(line, idx, existingCodes);
      if (parsed) {
        items.push(parsed);
      }
    });

    if (items.length === 0) {
      setParseError('لم يتم العثور على أسطر صالحة. يرجى إدخال مادة واحدة على الأقل بالصيغة المحددة.');
      setIsPreviewed(false);
      setParsedItems([]);
      return;
    }

    setParsedItems(items);
    setIsPreviewed(true);
  };

  const handleRemoveParsedItem = (index: number) => {
    setParsedItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveToFirestore = async () => {
    if (parsedItems.length === 0) return;

    setIsSaving(true);
    setProgress(0);
    setSuccessCount(null);

    const now = new Date().toISOString();
    const currentUid = currentUser?.uid || '';
    const total = parsedItems.length;
    const batchSize = 400;

    try {
      for (let i = 0; i < total; i += batchSize) {
        const chunk = parsedItems.slice(i, i + batchSize);
        const batch = writeBatch(db);

        chunk.forEach(item => {
          const newProduct: Product = {
            id: item.id,
            code: item.barcode,
            name: item.name,
            category: 'عام',
            unit: 'قطعة',
            costPrice: item.costPiece,
            retailPrice: item.retailPricePiece,
            wholesalePrice: item.wholesalePricePiece || item.retailPricePiece,
            stock: item.stock,
            piecesPerCarton: item.piecesPerBox,
            minStock: 5,
            ownerUid: currentUid,
            createdAt: now,
            updatedAt: now,
          };

          const docRef = doc(db, 'items', item.id);
          batch.set(docRef, sanitizeForFirestore(newProduct), { merge: true });
        });

        await batch.commit();
        const currentDone = Math.min(i + batchSize, total);
        setProgress(Math.round((currentDone / total) * 100));
      }

      setSuccessCount(total);
      setInputText('');
      setParsedItems([]);
      setIsPreviewed(false);
      if (setSyncNotice) {
        setSyncNotice(`تمت إضافة ${total} مادة جديدة بنجاح إلى المخزن والسحاب!`);
      }
    } catch (err: any) {
      console.error('Error saving quick products to Firestore:', err);
      alert('حدث خطأ أثناء الحفظ في السحاب: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-l from-emerald-50/50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">إضافة مواد سريعة (إدخال الأسطر الذكي)</h2>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                حساب تلقائي + توليد باركود
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              أدخل مادة واحدة أو عدة أسطر مفصولة بفواصل، وسيتولى النظام حساب أسعار الكرتون والمفرد والرصيد تلقائياً
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setInputText(exampleText)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-100/70 hover:bg-emerald-200/70 rounded-lg transition border border-emerald-300/80 cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>تعبئة بنموذج تجريبي</span>
        </button>
      </div>

      <div className="p-6 space-y-5">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
            <span>ترتيب الحقول في كل سطر (مفصولة بفارزة ,):</span>
          </div>

          <div className="p-2.5 bg-white border border-slate-200 rounded-lg font-mono text-[11px] text-slate-700 overflow-x-auto leading-relaxed">
            اسم المادة, عدد القطع في الكرتون, سعر تكلفة القطعة, سعر تكلفة الكرتون, سعر بيع القطعة مفرد, سعر بيع الكرتون مفرد, رصيد المخزن (ق/ك), [سعر القطعة جملة], [سعر الكرتون جملة], [الباركود]
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-600">
            <div className="flex items-start gap-1.5 bg-white p-2 rounded-lg border border-slate-200/80">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0"></span>
              <span><strong>المخزن:</strong> اكتب <strong>50ق</strong> للقطع المباشرة، أو <strong>10ك</strong> ليضرب تلقائياً في سعة الكرتون، أو رقماً مجرداً للقطع.</span>
            </div>
            <div className="flex items-start gap-1.5 bg-white p-2 rounded-lg border border-slate-200/80">
              <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0"></span>
              <span><strong>حساب الأسعار:</strong> ضع <strong>0</strong> أو اترك الحقل فارغاً، ليحسب النظام تلقائياً سعر الكرتون من القطعة أو العكس.</span>
            </div>
            <div className="flex items-start gap-1.5 bg-white p-2 rounded-lg border border-slate-200/80">
              <span className="w-2 h-2 rounded-full bg-purple-500 mt-1 shrink-0"></span>
              <span><strong>الباركود:</strong> إذا تُرِك فارغاً، يُولّد النظام تلقائياً باركود تجاري عشوائي فريد (12 رقماً) لكل مادة.</span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              <span>مربع إدخال الأسطر (يمكنك لصق 10 أو 20 مادة دفعة واحدة):</span>
            </label>
            <span className="text-[11px] text-slate-400 font-mono">
              {inputText.split('\n').filter(l => l.trim()).length} أسطر مدخلة
            </span>
          </div>

          <textarea
            rows={7}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              setIsPreviewed(false);
            }}
            placeholder={`بيض, 12, 6000, 72000, 6500, 78000, 1ك\nحليب نيدو, 6, 24000, 0, 27000, 0, 5ك\nزيت طعام, 12, 3000, 36000, 3500, 42000, 24ق, 3250, 39000, 890123456789`}
            className="w-full p-3.5 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50 leading-relaxed"
            dir="rtl"
          />
        </div>

        {parseError && (
          <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {successCount !== null && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between shadow-2xs animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>تم بنجاح حفظ وإضافة <strong>{successCount}</strong> مادة جديدة إلى قاعدة بيانات Firestore السحابية والمخزن!</span>
            </div>
            <span className="text-[11px] bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded font-mono">
              جاهزة للبيع فوراً
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={!inputText.trim() || isSaving}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>معاينة وتدقيق المواد ({inputText.split('\n').filter(l => l.trim()).length})</span>
            </button>

            {inputText && (
              <button
                type="button"
                onClick={() => {
                  setInputText('');
                  setParsedItems([]);
                  setIsPreviewed(false);
                  setParseError(null);
                }}
                className="px-3.5 py-2.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                مسح المربع
              </button>
            )}
          </div>
        </div>

        {isPreviewed && parsedItems.length > 0 && (
          <div className="space-y-4 pt-3 border-t border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>جدول المعاينة المحسوبة ({parsedItems.length} مواد جاهزة للحفظ)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  تأكد من الحسابات التلقائية أدناه قبل الضغط على حفظ في المخزن
                </p>
              </div>

              <button
                type="button"
                disabled={isSaving || parsedItems.some(i => !i.isValid)}
                onClick={handleSaveToFirestore}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الرفع إلى Firestore ({progress}%)...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>تأكيد الحفظ وإضافة كافة المواد إلى المخزن السحابي ({parsedItems.length})</span>
                  </>
                )}
              </button>
            </div>

            {isSaving && (
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">اسم المادة</th>
                    <th className="py-2.5 px-3 text-center">سعة الكرتون</th>
                    <th className="py-2.5 px-3">تكلفة القطعة</th>
                    <th className="py-2.5 px-3">تكلفة الكرتون</th>
                    <th className="py-2.5 px-3 text-emerald-900">بيع مفرد (قطعة)</th>
                    <th className="py-2.5 px-3 text-emerald-900">بيع مفرد (كرتون)</th>
                    <th className="py-2.5 px-3 text-amber-900">بيع جملة (قطعة)</th>
                    <th className="py-2.5 px-3 text-amber-900">بيع جملة (كرتون)</th>
                    <th className="py-2.5 px-3 text-center">المخزن المحسوب</th>
                    <th className="py-2.5 px-3 font-mono">الباركود</th>
                    <th className="py-2.5 px-2 text-center">إلغاء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {parsedItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{item.name}</td>
                      <td className="py-2.5 px-3 text-center font-mono">{item.piecesPerBox} قطعة</td>
                      
                      <td className="py-2.5 px-3 font-mono text-slate-700">{formatMoney(item.costPiece)}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{formatMoney(item.costBox)}</td>

                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">{formatMoney(item.retailPricePiece)}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">{formatMoney(item.retailPriceBox)}</td>

                      <td className="py-2.5 px-3 font-mono text-amber-800">
                        {item.wholesalePricePiece > 0 ? formatMoney(item.wholesalePricePiece) : '-'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-amber-800">
                        {item.wholesalePriceBox > 0 ? formatMoney(item.wholesalePriceBox) : '-'}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full font-mono font-bold text-xs bg-slate-100 text-slate-800 border border-slate-200">
                          {item.stock} قطعة
                        </span>
                        {item.rawStock && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            (مدخل: {item.rawStock})
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        <div className="flex items-center gap-1">
                          <span>{item.barcode}</span>
                          {item.autoBarcode && (
                            <span className="text-[9px] bg-purple-100 text-purple-800 px-1 py-0.2 rounded font-bold">
                              تلقائي
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveParsedItem(idx)}
                          className="p-1 text-slate-300 hover:text-rose-600 transition rounded"
                          title="حذف هذا السطر من المعاينة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={isSaving || parsedItems.some(i => !i.isValid)}
                onClick={handleSaveToFirestore}
                className="px-7 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الرفع إلى Firestore ({progress}%)...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>تأكيد الحفظ وإضافة كافة المواد إلى المخزن السحابي ({parsedItems.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
