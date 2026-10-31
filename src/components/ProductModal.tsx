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
  HelpCircle,
  Globe2,
  Store,
  Lock
} from 'lucide-react';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { lookupProductDetails, LookupPreference } from '../utils/productLookup';

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
  const { addProduct, updateProduct, products, formatMoney, settings, hasPermission } = useApp();

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

  // فحص صلاحية إظهار أسعار التكلفة
  const canViewCost = hasPermission('canViewCostPrice');

  // حالات البحث التلقائي ومصدر الاستعلام المفضل
  const [lookupPreference, setLookupPreference] = useState<LookupPreference>(() => {
    return (localStorage.getItem('lookup_preference') as LookupPreference) || 'global';
  });
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

  // البحث التلقائي عن المادة بالباركود
  const triggerAutoLookup = async (barcodeVal: string, pref: LookupPreference = lookupPreference) => {
    const clean = barcodeVal.trim();
    if (!clean || clean.length < 3) return;
    if (productToEdit) return;

    setIsSearchingBarcode(true);
    setNotFoundMessage(null);
    setFoundSuccessSource(null);

    try {
      const result = await lookupProductDetails(clean, pref);
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

      if (!initial) {
        generateUniqueBarcode();
      } else {
        triggerAutoLookup(initial);
      }
    }
  }, [isOpen, productToEdit, initialCode]);

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

  // معالجات المزامنة اللحظية بين أسعار الكرتون والقطع
  const handleCartonCostChange = (val: string) => {
    if (val === '') {
      setCostPrice('');
      return;
    }
    const c = parseFloat(val) || 0;
    setCostPrice(numPieces > 1 ? parseFloat((c / numPieces).toFixed(2)) : c);
  };

  const handleCartonRetailChange = (val: string) => {
    if (val === '') {
      setRetailPrice('');
      return;
    }
    const r = parseFloat(val) || 0;
    setRetailPrice(numPieces > 1 ? parseFloat((r / numPieces).toFixed(2)) : r);
  };

  const handleCartonWholesaleChange = (val: string) => {
    if (val === '') {
      setWholesalePrice('');
      return;
    }
    const w = parseFloat(val) || 0;
    setWholesalePrice(numPieces > 1 ? parseFloat((w / numPieces).toFixed(2)) : w);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError('يرجى إدخال اسم المادة');
      return;
    }

    const finalCode = code.trim() || `${1000 + products.length + 1}`;

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
        className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto"
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
                  ? 'تم العثور على اسم وتصنيف المادة من قاعدة بيانات المتاجر المشتركة!'
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

          {/* أزرار اختيار مصدر الاستعلام التلقائي المفضّل */}
          {!productToEdit && (
            <div className="mx-5 mt-3 p-2 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>مصدر البحث التلقائي المفضل:</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setLookupPreference('global');
                    localStorage.setItem('lookup_preference', 'global');
                    if (code.trim()) triggerAutoLookup(code, 'global');
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer ${
                    lookupPreference === 'global'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title="البحث في القواعد المليونية المفتوحة أولاً وترجمة النتيجة"
                >
                  <Globe2 className="w-3 h-3" />
                  <span>العالمية أولاً</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLookupPreference('community');
                    localStorage.setItem('lookup_preference', 'community');
                    if (code.trim()) triggerAutoLookup(code, 'community');
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer ${
                    lookupPreference === 'community'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title="البحث في وثائق المتاجر المشتركة في Supabase أولاً"
                >
                  <Store className="w-3 h-3" />
                  <span>المتاجر الأخرى أولاً</span>
                </button>
              </div>
            </div>
          )}

          {/* جسم النموذج */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* قسم الباركود والاسم */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
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
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 transition cursor-pointer"
                      title="مسح بالكاميرا"
                    >
                      <Camera className="w-3 h-3" />
                      <span>كاميرا</span>
                    </button>
                    <button
                      type="button"
                      onClick={generateUniqueBarcode}
                      className="text-[10px] text-slate-400 hover:text-slate-200 bg-slate-800 px-2 py-0.5 rounded-md flex items-center gap-1 transition cursor-pointer"
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

              <div className="space-y-1 flex flex-col justify-end">
                <label className="text-xs font-semibold text-slate-300 invisible sm:block">خيارات</label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !isWeighted;
                    setIsWeighted(next);
                    if (next && unit === 'قطعة') setUnit('كغم');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
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

            {/* سعة الكرتون */}
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Box className="w-4 h-4 text-emerald-400" />
                  <span>تعبئة الكرتون (سعة الكرتون بالقطع)</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {numPieces > 1 ? `كل كرتون يحتوي على ${numPieces} ${unit}` : 'يباع بالقطعة المفردة فقط'}
                </span>
              </div>

              <div className="max-w-xs space-y-1">
                <label className="text-[11px] text-slate-400">سعة الكرتون (قطعة/كرتون)</label>
                <input
                  type="number"
                  min="1"
                  value={piecesPerCarton}
                  onChange={(e) => {
                    const v = e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1);
                    setPiecesPerCarton(v);
                  }}
                  className="w-full bg-[#060b13] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>
            </div>

            {/* بطاقات التسعير */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold px-1 text-slate-200">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>تسعير المادة ({settings.currency || 'د.ع'})</span>
                </span>
                {canViewCost && (
                  <span className="text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                    الربح: {formatMoney(profitPerPiece)} ({profitMarginPercent}%)
                  </span>
                )}
              </div>

              <div className={`grid grid-cols-1 ${canViewCost ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
                {/* 1. بطاقة سعر التكلفة / الشراء (تظهر فقط عند توفر الصلاحية) */}
                {canViewCost && (
                  <div className="bg-[#070e1b] border border-slate-800 rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
                      <span className="text-xs font-bold text-slate-200">1. سعر التكلفة / الشراء</span>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded-md">
                        رأس المال
                      </span>
                    </div>

                    {numPieces > 1 && (
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300 block text-right">
                          سعر الكرتون الكامل:
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={costPrice === '' ? '' : parseFloat((numCost * numPieces).toFixed(2))}
                            onChange={(e) => handleCartonCostChange(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-[#060b13] border border-slate-700 rounded-lg py-1.5 pr-3 pl-12 text-sm text-white font-mono font-semibold focus:outline-none focus:border-emerald-500 text-left"
                          />
                          <span className="absolute left-2.5 top-2 text-[10px] text-slate-400 font-bold">
                            {settings.currency || 'دينار'}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-2.5 space-y-1">
                      <label className="text-[11px] font-semibold text-emerald-400 block text-right">
                        {numPieces > 1 ? `تكلفة القطعة (${numPieces} ق):` : 'سعر الشراء للقطعة:'}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={costPrice}
                          onChange={(e) => setCostPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-full bg-[#060b13] border border-emerald-500/40 rounded-lg py-1.5 pr-3 pl-12 text-sm text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-400 text-left"
                        />
                        <span className="absolute left-2.5 top-2 text-[10px] text-emerald-500/80 font-bold">
                          {settings.currency || 'دينار'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. بطاقة سعر بيع المفرد */}
                <div className="bg-[#070e1b] border border-emerald-500/40 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-emerald-500/20">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span>2. سعر بيع المفرد *</span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                      تجزئة
                    </span>
                  </div>

                  {numPieces > 1 && (
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 block text-right">
                        سعر بيع الكرتون:
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={retailPrice === '' ? '' : parseFloat((numRetail * numPieces).toFixed(2))}
                          onChange={(e) => handleCartonRetailChange(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-[#060b13] border border-slate-700 rounded-lg py-1.5 pr-3 pl-12 text-sm text-white font-mono font-semibold focus:outline-none focus:border-emerald-500 text-left"
                        />
                        <span className="absolute left-2.5 top-2 text-[10px] text-slate-400 font-bold">
                          {settings.currency || 'دينار'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="bg-blue-950/20 border border-blue-500/30 rounded-xl p-2.5 space-y-1">
                    <label className="text-[11px] font-semibold text-blue-400 block text-right">
                      {numPieces > 1 ? `سعر بيع القطعة (${numPieces} ق):` : 'سعر بيع المفرد للقطعة:'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={retailPrice}
                        onChange={(e) => setRetailPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full bg-[#060b13] border border-blue-500/50 rounded-lg py-1.5 pr-3 pl-12 text-sm text-blue-400 font-mono font-bold focus:outline-none focus:border-blue-400 text-left"
                      />
                      <span className="absolute left-2.5 top-2 text-[10px] text-blue-400 font-bold">
                        {settings.currency || 'دينار'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. بطاقة سعر بيع الجملة */}
                <div className="bg-[#070e1b] border border-amber-500/30 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-amber-500/20">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                      <span>3. سعر بيع الجملة</span>
                    </span>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-md">
                      اختياري
                    </span>
                  </div>

                  {numPieces > 1 && (
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 block text-right">
                        بيع كرتون (جملة):
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={wholesalePrice === '' ? '' : parseFloat((numWholesale * numPieces).toFixed(2))}
                          onChange={(e) => handleCartonWholesaleChange(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-[#060b13] border border-slate-700 rounded-lg py-1.5 pr-3 pl-12 text-sm text-white font-mono font-semibold focus:outline-none focus:border-amber-500 text-left"
                        />
                        <span className="absolute left-2.5 top-2 text-[10px] text-slate-400 font-bold">
                          {settings.currency || 'دينار'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-2.5 space-y-1">
                    <label className="text-[11px] font-semibold text-purple-300 block text-right">
                      {numPieces > 1 ? `بيع قطعة (جملة ${numPieces} ق):` : 'سعر بيع الجملة للقطعة:'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={wholesalePrice}
                        onChange={(e) => setWholesalePrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full bg-[#060b13] border border-purple-500/40 rounded-lg py-1.5 pr-3 pl-12 text-sm text-purple-300 font-mono font-bold focus:outline-none focus:border-purple-400 text-left"
                      />
                      <span className="absolute left-2.5 top-2 text-[10px] text-purple-400 font-bold">
                        {settings.currency || 'دينار'}
                      </span>
                    </div>
                  </div>
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
