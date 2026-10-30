import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Eye,
  Cloud,
  Info,
  Sparkles,
  Barcode,
  RefreshCw
} from 'lucide-react';

export interface ParsedQuickItem {
  id: string;
  rawLine: string;
  lineNumber: number;
  name: string;
  piecesPerBox: number;
  costPiece: number;
  costBox: number;
  isCostCalculated: boolean;
  costCalcReason?: string;
  retailPricePiece: number;
  retailPriceBox: number;
  isRetailCalculated: boolean;
  retailCalcReason?: string;
  stockInput: string;
  totalStockPieces: number;
  stockUnitLabel: string;
  wholesalePricePiece: number;
  wholesalePriceBox: number;
  isWholesaleCalculated: boolean;
  wholesaleCalcReason?: string;
  barcode: string;
  isAutoBarcode: boolean;
  isValid: boolean;
  errors: string[];
}

export const normalizeArabicNumbers = (str: string): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[٠-٩]/g, (w) => arabicNumerals.indexOf(w).toString());
};

export const generateUnique12DigitBarcode = (existingCodes: Set<string>): string => {
  let code = '';
  let attempts = 0;
  do {
    const part1 = Math.floor(100000 + Math.random() * 900000);
    const part2 = Math.floor(100000 + Math.random() * 900000);
    code = `${part1}${part2}`;
    attempts++;
  } while (existingCodes.has(code) && attempts < 100);
  return code;
};

const SAMPLE_TEXT = `بيض, 12, 6000, 72000, 6500, 78000, 1ك
حليب المراعي, 24, 1500, 0, 2000, 0, 5ك, 1800, 0
سكر ليز, 10, 0, 25000, 0, 30000, 50ق
معجون أسنان كولجيت, 12, 1000, 12000, 1500, 18000, 20ق, 0, 0, 629100123456`;

export const QuickAddItemsSection: React.FC = () => {
  const { products, addBulkProducts, formatMoney, setSyncNotice, currentUser } = useApp();

  const [rawText, setRawText] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedQuickItem[]>([]);
  const [hasPreviewed, setHasPreviewed] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadSuccessCount, setUploadSuccessCount] = useState<number | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const existingCodesSet = useMemo(() => {
    return new Set(products.map((p) => p.code.trim().toLowerCase()));
  }, [products]);

  const parseLines = (text: string): ParsedQuickItem[] => {
    const lines = text.split('\n');
    const existing = new Set(existingCodesSet);
    const result: ParsedQuickItem[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const rawParts = trimmed.split(/[,،]/).map((p) => p.trim());
      const errors: string[] = [];
      const name = rawParts[0] || '';
      if (!name) {
        errors.push('اسم المادة مطلوب');
      }

      const rawPiecesStr = normalizeArabicNumbers(rawParts[1] || '');
      let piecesPerBox = parseInt(rawPiecesStr, 10);
      if (isNaN(piecesPerBox) || piecesPerBox <= 0) {
        piecesPerBox = 1;
      }

      const rawCostPieceStr = normalizeArabicNumbers(rawParts[2] || '');
      const rawCostBoxStr = normalizeArabicNumbers(rawParts[3] || '');
      let costPiece = parseFloat(rawCostPieceStr) || 0;
      let costBox = parseFloat(rawCostBoxStr) || 0;
      let isCostCalculated = false;
      let costCalcReason = '';

      if (costBox === 0 && costPiece > 0) {
        costBox = Math.round(costPiece * piecesPerBox);
        isCostCalculated = true;
        costCalcReason = `حُسب الكرتون: ${costPiece} × ${piecesPerBox}`;
      } else if (costPiece === 0 && costBox > 0) {
        costPiece = Math.round(costBox / piecesPerBox);
        isCostCalculated = true;
        costCalcReason = `حُسبت القطعة: ${costBox} ÷ ${piecesPerBox}`;
      }

      const rawRetailPieceStr = normalizeArabicNumbers(rawParts[4] || '');
      const rawRetailBoxStr = normalizeArabicNumbers(rawParts[5] || '');
      let retailPricePiece = parseFloat(rawRetailPieceStr) || 0;
      let retailPriceBox = parseFloat(rawRetailBoxStr) || 0;
      let isRetailCalculated = false;
      let retailCalcReason = '';

      if (retailPriceBox === 0 && retailPricePiece > 0) {
        retailPriceBox = Math.round(retailPricePiece * piecesPerBox);
        isRetailCalculated = true;
        retailCalcReason = `حُسب الكرتون بالمفرد: ${retailPricePiece} × ${piecesPerBox}`;
      } else if (retailPricePiece === 0 && retailPriceBox > 0) {
        retailPricePiece = Math.round(retailPriceBox / piecesPerBox);
        isRetailCalculated = true;
        retailCalcReason = `حُسبت القطعة بالمفرد: ${retailPriceBox} ÷ ${piecesPerBox}`;
      }

      const rawStockStr = normalizeArabicNumbers(rawParts[6] || '');
      let stockInput = rawParts[6] || '0';
      let totalStockPieces = 0;
      let stockUnitLabel = '';

      if (rawStockStr) {
        const isCarton = /[كk]|كرتون/i.test(rawStockStr);
        const numMatch = rawStockStr.replace(/[^\d.]/g, '');
        const numVal = parseFloat(numMatch) || 0;

        if (isCarton) {
          totalStockPieces = Math.round(numVal * piecesPerBox);
          stockUnitLabel = `${numVal} كرتون (${totalStockPieces} قطعة)`;
        } else {
          totalStockPieces = Math.round(numVal);
          stockUnitLabel = `${totalStockPieces} قطعة`;
        }
      } else {
        totalStockPieces = 0;
        stockUnitLabel = '0 قطعة';
      }

      const rawWholesalePieceStr = normalizeArabicNumbers(rawParts[7] || '');
      const rawWholesaleBoxStr = normalizeArabicNumbers(rawParts[8] || '');
      const hasWholesalePieceInput = rawParts[7] !== undefined && rawParts[7].trim() !== '';
      const hasWholesaleBoxInput = rawParts[8] !== undefined && rawParts[8].trim() !== '';

      let wholesalePricePiece = parseFloat(rawWholesalePieceStr) || 0;
      let wholesalePriceBox = parseFloat(rawWholesaleBoxStr) || 0;
      let isWholesaleCalculated = false;
      let wholesaleCalcReason = '';

      if (hasWholesalePieceInput || hasWholesaleBoxInput) {
        if (wholesalePriceBox === 0 && wholesalePricePiece > 0) {
          wholesalePriceBox = Math.round(wholesalePricePiece * piecesPerBox);
          isWholesaleCalculated = true;
          wholesaleCalcReason = `حُسب الكرتون بالجملة: ${wholesalePricePiece} × ${piecesPerBox}`;
        } else if (wholesalePricePiece === 0 && wholesalePriceBox > 0) {
          wholesalePricePiece = Math.round(wholesalePriceBox / piecesPerBox);
          isWholesaleCalculated = true;
          wholesaleCalcReason = `حُسبت القطعة بالجملة: ${wholesalePriceBox} ÷ ${piecesPerBox}`;
        }
      }

      const rawBarcode = (rawParts[9] || '').trim();
      let barcode = rawBarcode;
      let isAutoBarcode = false;

      if (!barcode) {
        isAutoBarcode = true;
        barcode = generateUnique12DigitBarcode(existing);
        existing.add(barcode.toLowerCase());
      } else {
        existing.add(barcode.toLowerCase());
      }

      result.push({
        id: `parsed_${index}_${Math.random().toString(36).substring(2, 6)}`,
        rawLine: line,
        lineNumber: index + 1,
        name,
        piecesPerBox,
        costPiece,
        costBox,
        isCostCalculated,
        costCalcReason,
        retailPricePiece,
        retailPriceBox,
        isRetailCalculated,
        retailCalcReason,
        stockInput,
        totalStockPieces,
        stockUnitLabel,
        wholesalePricePiece,
        wholesalePriceBox,
        isWholesaleCalculated,
        wholesaleCalcReason,
        barcode,
        isAutoBarcode,
        isValid: errors.length === 0,
        errors,
      });
    });

    return result;
  };

  const handlePreview = () => {
    setInlineError(null);
    if (!rawText.trim()) {
      setInlineError('يرجى كتابة أو لصق أسطر المواد أولاً في المربع أدناه');
      return;
    }
    const parsed = parseLines(rawText);
    if (parsed.length === 0) {
      setInlineError('لم يتم العثور على أي أسطر صالحة للمعالجة');
      return;
    }
    setParsedItems(parsed);
    setHasPreviewed(true);
    setUploadSuccessCount(null);
  };

  const handleRemoveParsedItem = (id: string) => {
    setParsedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveToFirestore = async () => {
    setInlineError(null);
    const validItems = parsedItems.filter((item) => item.isValid);
    if (validItems.length === 0) {
      setInlineError('لا توجد مواد صالحة للحفظ. يرجى التأكد من اسم المادة في كل سطر.');
      return;
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: validItems.length });

    const currentUid = currentUser?.uid || '';

    const itemsToSave: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = validItems.map((item) => ({
      name: item.name.trim(),
      code: item.barcode.trim(),
      category: 'عام',
      unit: 'قطعة',
      costPrice: item.costPiece,
      retailPrice: item.retailPricePiece,
      wholesalePrice: item.wholesalePricePiece || item.retailPricePiece,
      stock: item.totalStockPieces,
      piecesPerCarton: item.piecesPerBox,
      minStock: Math.max(5, Math.round(item.piecesPerBox / 2)),
      notes: `إضافة سريعة (${item.stockInput})`,
      ownerUid: currentUid,
    }));

    try {
      const result = await addBulkProducts(itemsToSave, (current, total) => {
        setUploadProgress({ current, total });
      });

      if (result && result.success) {
        setUploadSuccessCount(result.count);
        setRawText('');
        setParsedItems([]);
        setHasPreviewed(false);
        if (setSyncNotice) {
          setSyncNotice(`تم بنجاح حفظ وإضافة ${result.count} مادة إلى المخزن والمزامنة السحابية!`);
        }
      }
    } catch (err: any) {
      console.error('Error during bulk save:', err);
      setInlineError('حدث خطأ أثناء حفظ المواد: ' + (err?.message || 'يرجى المحاولة مرة أخرى'));
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const validCount = parsedItems.filter((i) => i.isValid).length;
  const totalPiecesSum = parsedItems.filter((i) => i.isValid).reduce((sum, i) => sum + i.totalStockPieces, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-6 p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center font-black shadow-sm shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900">إضافة مواد سريعة إلى المخزن</h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                <Cloud className="w-3 h-3" />
                <span>مزامنة سحابية لحظية</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ألصق عدة أسطر مفصولة بفواصل لحفظها دفعة واحدة مع الحساب الذكي التلقائي وتوليد الباركود
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRawText(SAMPLE_TEXT)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="تحميل أسطر نموذجية للتجربة"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>تجربة نموذج جاهز</span>
          </button>
          {rawText && (
            <button
              type="button"
              onClick={() => {
                setRawText('');
                setParsedItems([]);
                setHasPreviewed(false);
                setUploadSuccessCount(null);
              }}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>مسح</span>
            </button>
          )}
        </div>
      </div>

      {uploadSuccessCount !== null && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 flex items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-sm">
                تم بنجاح حفظ وإضافة {uploadSuccessCount} مادة إلى المخزن السحابي!
              </div>
              <div className="text-xs text-emerald-700 mt-0.5">
                البيانات محفوظة محلياً في الذاكرة الدائمة وتزامنت مع قاعدة بيانات Firestore السحابية فوراً.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUploadSuccessCount(null)}
            className="text-xs font-bold px-3 py-1 bg-white hover:bg-emerald-100 border border-emerald-200 rounded-lg text-emerald-800 transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {inlineError && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 flex items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-bold">{inlineError}</span>
          </div>
          <button
            type="button"
            onClick={() => setInlineError(null)}
            className="text-slate-400 hover:text-slate-600 px-1 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      <div className="bg-gradient-to-r from-amber-50/70 via-slate-50 to-blue-50/70 border border-amber-200/70 rounded-xl p-4 text-xs space-y-2.5">
        <div className="flex items-center gap-2 font-black text-slate-800">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>ترتيب الحقول في كل سطر (مفصولة بفارزة ,):</span>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-mono font-bold text-slate-700">
          <span className="bg-white px-2 py-0.5 rounded border border-slate-200">1. اسم المادة</span>
          <span className="text-slate-400">,</span>
          <span className="bg-white px-2 py-0.5 rounded border border-slate-200">2. عدد القطع بالكرتون</span>
          <span className="text-slate-400">,</span>
          <span className="bg-white px-2 py-0.5 rounded border border-slate-200">3. تكلفة القطعة</span>
          <span className="text-slate-400">,</span>
          <span className="bg-white px-2 py-0.5 rounded border border-slate-200">4. تكلفة الكرتون</span>
          <span className="text-slate-400">,</span>
          <span className="bg-white px-2 py-0.5 rounded border border-slate-200">5. بيع المفرد للقطعة</span>
          <span className="text-slate-400">,</span>
          <span className="bg-white px-2 py-0.5 rounded border border-slate-200">6. بيع المفرد للكرتون</span>
          <span className="text-slate-400">,</span>
          <span className="bg-white px-2 py-0.5 rounded border border-slate-200">7. رصيد المخزن (ق / ك)</span>
          <span className="text-slate-400">,</span>
          <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-500">8. بيع الجملة للقطعة (اختياري)</span>
          <span className="text-slate-400">,</span>
          <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-500">9. بيع الجملة للكرتون (اختياري)</span>
          <span className="text-slate-400">,</span>
          <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-500">10. الباركود (اختياري)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-[11px] text-slate-600">
          <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
            <strong className="text-slate-900 block mb-0.5">🔹 الحساب التلقائي للأسعار:</strong>
            عند إدخال 0 أو ترك أحد الأسعار فارغاً، يُحسب تلقائياً بضرب أو قسمة سعة الكرتون.
          </div>
          <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
            <strong className="text-slate-900 block mb-0.5">🔹 رصيد المخزن (ق / ك):</strong>
            اكتب <code className="text-blue-700 font-bold">1ك</code> للكراتين (يُضرب بالسعة)، أو <code className="text-emerald-700 font-bold">50ق</code> للقطع مباشرة.
          </div>
          <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
            <strong className="text-slate-900 block mb-0.5">🔹 توليد الباركود:</strong>
            إذا تُرِك الباركود فارغاً، يتم توليد باركود فريد عشوائي مكون من 12 رقماً فوراً.
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <label htmlFor="quick-add-textarea" className="flex items-center gap-1.5">
            <span>ألصق أو اكتب المواد هنا (كل مادة في سطر منفصل):</span>
          </label>
          <span className="text-slate-400 font-normal">
            {rawText.trim() ? `${rawText.trim().split('\n').filter(Boolean).length} سطر مدخل` : 'المربع فارغ'}
          </span>
        </div>

        <textarea
          id="quick-add-textarea"
          rows={6}
          dir="rtl"
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            setHasPreviewed(false);
            setInlineError(null);
          }}
          placeholder={`بيض, 12, 6000, 72000, 6500, 78000, 1ك
حليب المراعي, 24, 1500, 0, 2000, 0, 5ك, 1800, 0
سكر ليز, 10, 0, 25000, 0, 30000, 50ق`}
          className="w-full p-3.5 text-xs sm:text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-slate-50/50 leading-relaxed"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-[11px] text-slate-500">
            اضغط على زر "معاينة المواد" للتحقق من دقة الحسابات والباركود قبل رفعها إلى السحابة.
          </div>

          <button
            type="button"
            onClick={handlePreview}
            disabled={!rawText.trim() || isUploading}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs ${
              !rawText.trim() || isUploading
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>معاينة المواد والتحقق ({rawText.trim() ? rawText.trim().split('\n').filter(Boolean).length : 0})</span>
          </button>
        </div>
      </div>

      {isUploading && uploadProgress && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-blue-900">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              <span>جاري حفظ المواد ورفعها إلى السحابة ({uploadProgress.current} من {uploadProgress.total})...</span>
            </span>
            <span>{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
          </div>
          <div className="w-full h-2.5 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-200 rounded-full"
              style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {hasPreviewed && parsedItems.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-3 pt-3 bg-slate-50/50">
          <div className="px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <h3 className="font-black text-sm text-slate-900">جدول معاينة المواد المحسوبة ذكياً</h3>
              <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                {validCount} مادة جاهزة
              </span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                إجمالي {totalPiecesSum} قطعة
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveToFirestore}
                disabled={validCount === 0 || isUploading}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs transition flex items-center gap-2 cursor-pointer ${
                  validCount === 0 || isUploading
                    ? 'bg-slate-400 cursor-not-allowed opacity-80'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                }`}
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>جاري الحفظ ({uploadProgress ? `${uploadProgress.current}/${uploadProgress.total}` : '...'})</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4" />
                    <span>حفظ وإضافة للمخزن السحابي ({validCount} مادة)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-right text-xs bg-white">
              <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">اسم المادة</th>
                  <th className="py-2.5 px-3 text-center">سعة الكرتون</th>
                  <th className="py-2.5 px-3">سعر التكلفة</th>
                  <th className="py-2.5 px-3">بيع المفرد</th>
                  <th className="py-2.5 px-3">بيع الجملة</th>
                  <th className="py-2.5 px-3">الرصيد المخزني</th>
                  <th className="py-2.5 px-3">الباركود</th>
                  <th className="py-2.5 px-3 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedItems.map((item, idx) => (
                  <tr
                    key={`${item.id}_${idx}`}
                    className={`hover:bg-slate-50/80 transition ${
                      !item.isValid ? 'bg-rose-50/50' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-400 font-bold">{idx + 1}</td>
                    
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      <div>{item.name}</div>
                      {!item.isValid && (
                        <div className="text-[10px] text-rose-600 font-normal">
                          {item.errors.join('، ')}
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-center font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-bold">
                        {item.piecesPerBox} ق/ك
                      </span>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-800">
                        {formatMoney(item.costPiece)} <span className="text-[10px] text-slate-400">/قطعة</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {formatMoney(item.costBox)} /كرتون
                        {item.isCostCalculated && (
                          <span className="text-amber-600 font-bold mr-1">✦ تلقائي</span>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-bold text-emerald-700">
                        {formatMoney(item.retailPricePiece)} <span className="text-[10px] text-slate-400">/قطعة</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {formatMoney(item.retailPriceBox)} /كرتون
                        {item.isRetailCalculated && (
                          <span className="text-amber-600 font-bold mr-1">✦ تلقائي</span>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      {item.wholesalePricePiece > 0 || item.wholesalePriceBox > 0 ? (
                        <>
                          <div className="font-bold text-blue-700">
                            {formatMoney(item.wholesalePricePiece)} <span className="text-[10px] text-slate-400">/قطعة</span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {formatMoney(item.wholesalePriceBox)} /كرتون
                            {item.isWholesaleCalculated && (
                              <span className="text-amber-600 font-bold mr-1">✦ تلقائي</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-400 text-[11px]">- غير محدد -</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-black text-slate-900">
                        {item.stockUnitLabel}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        المدخل: {item.stockInput}
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-mono text-xs font-bold text-slate-800 flex items-center gap-1">
                        <Barcode className="w-3 h-3 text-slate-400" />
                        <span>{item.barcode}</span>
                      </div>
                      {item.isAutoBarcode && (
                        <div className="text-[10px] text-emerald-600 font-bold">
                          توليد عشوائي 12 رقم
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveParsedItem(item.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
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

          <div className="p-4 bg-slate-100/80 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              جاهز لحفظ <strong>{validCount}</strong> مادة ورفعها مباشرة إلى Firestore.
            </div>

            <button
              type="button"
              onClick={handleSaveToFirestore}
              disabled={validCount === 0 || isUploading}
              className={`px-6 py-2.5 rounded-xl text-xs font-black text-white shadow-sm transition flex items-center justify-center gap-2 cursor-pointer ${
                validCount === 0 || isUploading
                  ? 'bg-slate-400 cursor-not-allowed opacity-80'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
              }`}
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>جاري الحفظ وإضافة المواد إلى المخزن...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4" />
                  <span>حفظ وإضافة للمخزن السحابي فوراً</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
