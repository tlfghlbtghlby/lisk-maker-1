import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import { 
  X, 
  Package, 
  TrendingUp, 
  AlertCircle, 
  Box, 
  Scan, 
  Scale, 
  Loader2, 
  CheckCircle2, 
  Sparkles, 
  Barcode, 
  RefreshCw,
  Camera,
  Layers,
  HelpCircle
} from 'lucide-react';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { lookupProductDetails } from '../utils/productLookup';

export interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  initialCode?: string;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  initialCode,
}) => {
  const { addProduct, updateProduct, products, formatMoney, settings } = useApp();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('عام');
  const [unit, setUnit] = useState('قطعة');
  const [costPrice, setCostPrice] = useState<number | ''>(0);
  const [retailPrice, setRetailPrice] = useState<number | ''>(0);
  const [wholesalePrice, setWholesalePrice] = useState<number | ''>(0);
  const [stock, setStock] = useState<number | ''>(0);
  const [minStock, setMinStock] = useState<number | ''>(5);
  const [piecesPerCarton, setPiecesPerCarton] = useState<number | ''>(1);
  const [isWeighted, setIsWeighted] = useState(false);
  const [notes, setNotes] = useState('');

  // إدخال بالكرتون
  const [stockInCartons, setStockInCartons] = useState<number | ''>('');
  const [stockExtraPieces, setStockExtraPieces] = useState<number | ''>('');

  // حالات البحث التلقائي عن المادة
  const [isSearchingBarcode, setIsSearchingBarcode] = useState(false);
  const [notFoundMessage, setNotFoundMessage] = useState<string | null>(null);
  const [foundSuccessSource, setFoundSuccessSource] = useState<'community' | 'global' | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // قائمة الفئات المتاحة
  const existingCategories = useMemo(() => {
    const cats = new Set<string>();
    cats.add('عام');
    cats.add('مواد غذائية');
    cats.add('منظفات');
    cats.add('مشروبات وعصائر');
    cats.add('حلويات وشوكولاتة');
    cats.add('ألبان وأجبان');
    cats.add('قرطاسية');
    cats.add('كوزمتك وعناية');
    cats.add('إلكترونيات');
    cats.add('بلاستيك ومنزلي');
    products.forEach((p) => {
      if (p.category && p.category.trim()) cats.add(p.category.trim());
    });
    return Array.from(cats);
  }, [products]);

  // توليد باركود تلقائي فريد
  const generateUniqueBarcode = () => {
    const existing = new Set(products.map((p) => p.code));
    let newCode = '';
    let attempts = 0;
    do {
      const part1 = Math.floor(100000 + Math.random() * 900000);
      const part2 = Math.floor(100000 + Math.random() * 900000);
      newCode = `${part1}${part2}`;
      attempts++;
    } while (existing.has(newCode) && attempts < 100);
    setCode(newCode);
  };

  // تهيئة الحقول عند الفتح أو التعديل
  useEffect(() => {
    if (!isOpen) {
      setValidationError(null);
      setNotFoundMessage(null);
      setFoundSuccessSource(null);
      return;
    }

    if (productToEdit) {
      setCode(productToEdit.code || '');
      setName(productToEdit.name || '');
      setCategory(productToEdit.category || 'عام');
      setUnit(productToEdit.unit || 'قطعة');
      setCostPrice(productToEdit.costPrice ?? 0);
      setRetailPrice(productToEdit.retailPrice ?? 0);
      setWholesalePrice(productToEdit.wholesalePrice ?? 0);
      setStock(productToEdit.stock ?? 0);
      setMinStock(productToEdit.minStock ?? 5);
      const ppc = productToEdit.piecesPerCarton || 1;
      setPiecesPerCarton(ppc);
      setIsWeighted(!!productToEdit.isWeighted);
      setNotes(productToEdit.notes || '');

      if (ppc > 1) {
        const total = productToEdit.stock || 0;
        setStockInCartons(Math.floor(total / ppc));
        setStockExtraPieces(total % ppc);
      } else {
        setStockInCartons('');
        setStockExtraPieces('');
      }
    } else {
      const initial = initialCode || '';
      setCode(initial);
      setName('');
      setCategory('عام');
      setUnit('قطعة');
      setCostPrice(0);
      setRetailPrice(0);
      setWholesalePrice(0);
      setStock(0);
      setMinStock(5);
      setPiecesPerCarton(1);
      setIsWeighted(false);
      setNotes('');
      setStockInCartons('');
      setStockExtraPieces('');

      if (!initial) {
        generateUniqueBarcode();
      } else {
        triggerAutoLookup(initial);
      }
    }
  }, [isOpen, productToEdit, initialCode]);

  // مزامنة إدخال الكرتون مع إجمالي الرصيد
  const handleCartonStockChange = (cartonsVal: number | '', extraVal: number | '') => {
    setStockInCartons(cartonsVal);
    setStockExtraPieces(extraVal);
    const ppc = typeof piecesPerCarton === 'number' && piecesPerCarton > 0 ? piecesPerCarton : 1;
    const c = typeof cartonsVal === 'number' ? cartonsVal : 0;
    const e = typeof extraVal === 'number' ? extraVal : 0;
    setStock(c * ppc + e);
  };

  // البحث التلقائي عن المادة بالباركود
  const triggerAutoLookup = async (barcodeVal: string) => {
    const clean = barcodeVal.trim();
    if (!clean || clean.length < 3) return;
    if (productToEdit) return; // لا نغير الاسم تلقائياً أثناء تعديل مادة قائمة إلا بطلب صريح

    setIsSearchingBarcode(true);
    setNotFoundMessage(null);
    setFoundSuccessSource(null);

    try {
      const result = await lookupProductDetails(clean);
      if (result && result.name) {
        setName(result.name);
        if (result.category && result.category !== 'عام') {
          setCategory(result.category);
        }
        setFoundSuccessSource(result.source);
        setTimeout(() => setFoundSuccessSource(null), 5000);
      } else {
        setNotFoundMessage('لم يتم العثور على اسم المادة تلقائياً. يمكنك كتابتها يدوياً.');
        setTimeout(() => setNotFoundMessage(null), 4000);
      }
    } catch (err) {
      console.warn('Auto lookup error:', err);
    } finally {
      setIsSearchingBarcode(false);
    }
  };

  const handleBarcodeBlur = () => {
    if (!name.trim() && code.trim()) {
      triggerAutoLookup(code.trim());
    }
  };

  const handleScanSuccess = (scannedCode: string) => {
    setIsScannerOpen(false);
    setCode(scannedCode);
    triggerAutoLookup(scannedCode);
  };

  const numCost = typeof costPrice === 'number' ? costPrice : 0;
  const numRetail = typeof retailPrice === 'number' ? retailPrice : 0;
  const numWholesale = typeof wholesalePrice === 'number' ? wholesalePrice : 0;
  const numPieces = typeof piecesPerCarton === 'number' && piecesPerCarton > 0 ? piecesPerCarton : 1;
  const numStock = typeof stock === 'number' ? stock : 0;

  const profitPerPiece = numRetail - numCost;
  const profitMarginPercent = numCost > 0 ? ((profitPerPiece / numCost) * 100).toFixed(1) : '0';
  const wholesaleProfitPerPiece = numWholesale - numCost;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError('يرجى إدخال اسم المادة');
      return;
    }

    const finalCode = code.trim() || `${1000 + products.length + 1}`;

    // التحقق من تكرار الباركود لمادة أخرى
    const duplicate = products.find(
      (p) => p.code === finalCode && (!productToEdit || p.id !== productToEdit.id)
    );
    if (duplicate) {
      setValidationError(`هذا الباركود مستخدم بالفعل للمادة: "${duplicate.name}"`);
      return;
    }

    const productData = {
      code: finalCode,
      name: name.trim(),
      category: category.trim() || 'عام',
      unit: unit.trim() || 'قطعة',
      costPrice: numCost,
      retailPrice: numRetail,
      wholesalePrice: numWholesale,
      stock: numStock,
      minStock: typeof minStock === 'number' ? minStock : 5,
      piecesPerCarton: numPieces,
      isWeighted,
      notes: notes.trim(),
    };

    if (productToEdit) {
      updateProduct(productToEdit.id, productData);
    } else {
      addProduct(productData);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto"
        dir="rtl"
      >
        <div 
          className="bg-[#0b1728] border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ترويسة النافذة */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/90 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {productToEdit ? 'تعديل بيانات مادة' : 'إضافة مادة جديدة للمخزن'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {productToEdit ? 'تحديث الأسعار، الباركود أو الكميات المتوفرة' : 'تسجيل المادة في النظام وقاعدة البيانات السحابية'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* تنبيهات البحث التلقائي والتحقق */}
          {foundSuccessSource && (
            <div className="mx-5 mt-3 p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>
                {foundSuccessSource === 'community'
                  ? 'تم العثور على اسم المادة تلقائياً من قاعدة بيانات المتاجر المشتركة!'
                  : 'تم جلب اسم المادة وترجمتها تلقائياً من قواعد البيانات العالمية!'}
              </span>
            </div>
          )}

          {notFoundMessage && (
            <div className="mx-5 mt-3 p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
              <HelpCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{notFoundMessage}</span>
            </div>
          )}

          {validationError && (
            <div className="mx-5 mt-3 p-2.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{validationError}</span>
            </div>
          )}

          {/* جسم النموذج */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* قسم الباركود والاسم */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* حقل الباركود */}
              <div className="sm:col-span-6 space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Barcode className="w-3.5 h-3.5 text-emerald-400" />
                    <span>الباركود / كود المادة</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 transition"
                      title="مسح بالكاميرا"
                    >
                      <Camera className="w-3 h-3" />
                      <span>كاميرا</span>
                    </button>
                    <button
                      type="button"
                      onClick={generateUniqueBarcode}
                      className="text-[10px] text-slate-400 hover:text-slate-200 bg-slate-800 px-2 py-0.5 rounded-md flex items-center gap-1 transition"
                      title="توليد باركود تلقائي"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>توليد</span>
                    </button>
                  </div>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onBlur={handleBarcodeBlur}
                    placeholder="امسح أو اكتب الباركود..."
                    className="w-full bg-[#060b13] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono tracking-wider"
                  />
                  {isSearchingBarcode && (
                    <div className="absolute left-3 top-2.5 text-emerald-400 flex items-center gap-1 text-[11px]">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري البحث...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* حقل اسم المادة */}
              <div className="sm:col-span-6 space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>اسم المادة *</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: شاي الوزة 400 غرام"
                  className="w-full bg-[#060b13] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* التصنيف، الوحدة، وميزة الوزن */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* القسم / التصنيف */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>القسم / التصنيف</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="category-suggestions"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#060b13] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    placeholder="اختر أو اكتب قسماً..."
                  />
                  <datalist id="category-suggestions">
                    {existingCategories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* الوحدة */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Box className="w-3.5 h-3.5 text-purple-400" />
                  <span>الوحدة الأساسية</span>
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full bg-[#060b13] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="قطعة">قطعة</option>
                  <option value="كرتون">كرتون</option>
                  <option value="كغم">كيلوغرام (كغم)</option>
                  <option value="غرام">غرام</option>
                  <option value="علبة">علبة</option>
                  <option value="لتر">لتر</option>
                  <option value="متر">متر</option>
                  <option value="باكيت">باكيت</option>
                  <option value="شدة">شدة</option>
                  <option value="درزن">درزن</option>
                </select>
              </div>

              {/* مادة وزنية */}
              <div className="space-y-1 flex flex-col justify-end">
                <label className="text-xs font-semibold text-slate-300 invisible sm:block">خيارات</label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !isWeighted;
                    setIsWeighted(next);
                    if (next && unit === 'قطعة') setUnit('كغم');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                    isWeighted
                      ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                      : 'bg-[#060b13] border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-amber-400" />
                    <span>مادة وزنية (ميزان)</span>
                  </span>
                  <span className={`w-2.5 h-2.5 rounded-full ${isWeighted ? 'bg-amber-400' : 'bg-slate-600'}`}></span>
                </button>
              </div>
            </div>

            {/* سعة الكرتون (piecesPerCarton) */}
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Box className="w-4 h-4 text-emerald-400" />
                  <span>تعبئة الكرتون (سعة الكرتون بالقطع)</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {numPieces > 1 ? `كل كرتون يحتوي على ${numPieces} ${unit}` : 'يباع بالقطعة المفردة فقط'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">سعة الكرتون (قطعة/كرتون)</label>
                  <input
                    type="number"
                    min="1"
                    value={piecesPerCarton}
                    onChange={(e) => {
                      const v = e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1);
                      setPiecesPerCarton(v);
                    }}
                    className="w-full bg-[#060b13] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {numPieces > 1 && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400">الرصيد بالكراتين</label>
                      <input
                        type="number"
                        min="0"
                        value={stockInCartons}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
                          handleCartonStockChange(val, stockExtraPieces);
                        }}
                        placeholder="عدد الكراتين"
                        className="w-full bg-[#060b13] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400">+ قطع مفردة إضافية</label>
                      <input
                        type="number"
                        min="0"
                        value={stockExtraPieces}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
                          handleCartonStockChange(stockInCartons, val);
                        }}
                        placeholder="قطع إضافية"
                        className="w-full bg-[#060b13] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* بطاقة الأسعار (شراء - مفرد - جملة) */}
            <div className="p-3.5 bg-gradient-to-br from-slate-900/90 to-[#070e1b] border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>تسعير المادة ({settings.currency || 'د.ع'})</span>
                </span>
                <span className="text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                  الربح: {formatMoney(profitPerPiece)} ({profitMarginPercent}%)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* سعر الشراء / التكلفة */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-300 font-medium">سعر الشراء (التكلفة)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#060b13] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-semibold"
                  />
                  {numPieces > 1 && (
                    <div className="text-[10px] text-slate-400">
                      شراء الكرتون: {formatMoney(numCost * numPieces)}
                    </div>
                  )}
                </div>

                {/* سعر البيع المفرد */}
                <div className="space-y-1">
                  <label className="text-xs text-emerald-300 font-medium">سعر البيع المفرد *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={retailPrice}
                    onChange={(e) => setRetailPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#060b13] border border-emerald-500/50 rounded-xl px-3 py-2 text-sm text-emerald-400 focus:outline-none focus:border-emerald-400 font-bold"
                  />
                  {numPieces > 1 && (
                    <div className="text-[10px] text-emerald-400/80">
                      مفرد الكرتون: {formatMoney(numRetail * numPieces)}
                    </div>
                  )}
                </div>

                {/* سعر البيع بالجملة */}
                <div className="space-y-1">
                  <label className="text-xs text-blue-300 font-medium">سعر البيع بالجملة</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#060b13] border border-slate-700 rounded-xl px-3 py-2 text-sm text-blue-300 focus:outline-none focus:border-blue-400 font-semibold"
                  />
                  {numPieces > 1 ? (
                    <div className="text-[10px] text-blue-400/80">
                      جملة الكرتون: {formatMoney(numWholesale * numPieces)}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400">
                      ربح الجملة: {formatMoney(wholesaleProfitPerPiece)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* الرصيد الحالي وحد الطلب الأدنى */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>الرصيد المتوفر في المخزن ({unit})</span>
                  {numPieces > 1 && (
                    <span className="text-[10px] text-slate-400">
                      يعادل: {Math.floor(numStock / numPieces)} كرتون و {numStock % numPieces} {unit}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  step={isWeighted ? '0.001' : '1'}
                  value={stock}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : parseFloat(e.target.value) || 0;
                    setStock(val);
                    if (numPieces > 1 && typeof val === 'number') {
                      setStockInCartons(Math.floor(val / numPieces));
                      setStockExtraPieces(val % numPieces);
                    }
                  }}
                  className="w-full bg-[#060b13] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  حد التنبيه الأدنى (تنبيه قرب النفاد)
                </label>
                <input
                  type="number"
                  min="0"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                  className="w-full bg-[#060b13] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* ملاحظات إضافية */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">ملاحظات إضافية (اختياري)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مكان الرف، المورد، أو أي معلومات..."
                className="w-full bg-[#060b13] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* أزرار الحفظ والإلغاء */}
            <div className="flex items-center gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{productToEdit ? 'حفظ التعديلات' : 'إضافة المادة للمخزن'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-5 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* نافذة ماسح الباركود بالكاميرا */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScanSuccess}
        title="مسح باركود المادة"
      />
    </>
  );
};

export default ProductModal;
