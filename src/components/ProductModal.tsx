import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import { X, Package, TrendingUp, AlertCircle, Box, Scan, Sparkles, Scale, Loader2, CheckCircle2 } from 'lucide-react';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { lookupProductDetails } from '../utils/productLookup';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  initialCode?: string;
}

const COMMON_CATEGORIES = [
  'عام',
  'صحيات وسباكة',
  'مواد غذائية',
  'كهربائيات',
  'مواد إنشائية',
  'أدوات منزلية',
  'منظفات',
  'قرطاسية',
  'قطع غيار',
];

const COMMON_UNITS = [
  'قطعة',
  'كغم',
  'كيلو',
  'غرام',
  'غم',
  'كرتونة',
  'كيس',
  'لتر',
  'متر',
  'صندوق',
  'درزن (12)',
  'لفة',
];

const PRESET_CAPACITIES = [6, 12, 24, 30, 48];

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  initialCode,
}) => {
  const { addProduct, updateProduct, settings, products } = useApp();

  // Basic info
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState(COMMON_CATEGORIES[0]);
  const [unit, setUnit] = useState(COMMON_UNITS[0]);
  const [isWeighted, setIsWeighted] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Auto lookup states
  const [isSearchingBarcode, setIsSearchingBarcode] = useState(false);
  const [notFoundMessage, setNotFoundMessage] = useState(false);
  const [foundSuccessSource, setFoundSuccessSource] = useState<'community' | 'global' | null>(null);

  // Carton capacity
  const [piecesPerCarton, setPiecesPerCarton] = useState<number>(12);

  // Price Mode: 'carton' | 'piece' (or 'kg' | 'gram' when weighted)
  const [priceInputMode, setPriceInputMode] = useState<'carton' | 'piece'>('carton');

  // Prices: Carton level & Piece level (or 1000g kg level & 1g gram level when weighted)
  const [cartonCost, setCartonCost] = useState<number | ''>('');
  const [pieceCost, setPieceCost] = useState<number | ''>('');

  const [cartonRetail, setCartonRetail] = useState<number | ''>('');
  const [pieceRetail, setPieceRetail] = useState<number | ''>('');

  const [cartonWholesale, setCartonWholesale] = useState<number | ''>('');
  const [pieceWholesale, setPieceWholesale] = useState<number | ''>('');

  // Stock: Cartons count & total pieces count (or kg stock & optional item count when weighted)
  const [cartonsStock, setCartonsStock] = useState<number | ''>(5);
  const [totalPiecesStock, setTotalPiecesStock] = useState<number | ''>(60);
  const [itemCountStock, setItemCountStock] = useState<number | ''>('');

  const [minStock, setMinStock] = useState<number | ''>(6);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // دالة الاستعلام التلقائي عن المادة
  const triggerAutoLookup = async (barcodeToSearch: string) => {
    const clean = barcodeToSearch.trim();
    if (!clean) return;

    setIsSearchingBarcode(true);
    setNotFoundMessage(false);
    setFoundSuccessSource(null);

    try {
      const result = await lookupProductDetails(clean);
      if (result && result.name) {
        setName(result.name);
        if (result.category) {
          setCategory(result.category);
        }
        setFoundSuccessSource(result.source);
        setNotFoundMessage(false);
      } else {
        setNotFoundMessage(true);
      }
    } catch (err) {
      console.warn('Auto lookup failed:', err);
      setNotFoundMessage(true);
    } finally {
      setIsSearchingBarcode(false);
    }
  };

  // Initialize or reset form
  useEffect(() => {
    if (!isOpen) {
      setNotFoundMessage(false);
      setFoundSuccessSource(null);
      setIsSearchingBarcode(false);
      return;
    }

    if (productToEdit) {
      setName(productToEdit.name);
      setCode(productToEdit.code);
      setCategory(productToEdit.category || COMMON_CATEGORIES[0]);
      setUnit(productToEdit.unit || COMMON_UNITS[0]);
      const weighted = Boolean(
        productToEdit.isWeighted ||
        productToEdit.unit === 'كغم' ||
        productToEdit.unit === 'كيلو' ||
        productToEdit.unit === 'غرام' ||
        productToEdit.unit === 'غم'
      );
      setIsWeighted(weighted);
      
      const ppc = productToEdit.piecesPerCarton || 12;
      setPiecesPerCarton(ppc);

      if (weighted) {
        const kgCost = productToEdit.costPrice;
        const kgRetail = productToEdit.retailPrice;
        const kgWholesale = productToEdit.wholesalePrice;

        setCartonCost(kgCost);
        setPieceCost(Math.round((kgCost / 1000) * 1000) / 1000);

        setCartonRetail(kgRetail);
        setPieceRetail(Math.round((kgRetail / 1000) * 1000) / 1000);

        setCartonWholesale(kgWholesale);
        setPieceWholesale(Math.round((kgWholesale / 1000) * 1000) / 1000);

        setCartonsStock(productToEdit.stock);
        setTotalPiecesStock(productToEdit.stock);
        setItemCountStock(typeof productToEdit.itemCount === 'number' ? productToEdit.itemCount : '');
      } else {
        setPieceCost(productToEdit.costPrice);
        setCartonCost(productToEdit.costPrice * ppc);

        setPieceRetail(productToEdit.retailPrice);
        setCartonRetail(productToEdit.retailPrice * ppc);

        setPieceWholesale(productToEdit.wholesalePrice);
        setCartonWholesale(productToEdit.wholesalePrice * ppc);

        setTotalPiecesStock(productToEdit.stock);
        setCartonsStock(Math.round((productToEdit.stock / ppc) * 10) / 10);
        setItemCountStock('');
      }

      setMinStock(productToEdit.minStock || 6);
      setNotes(productToEdit.notes || '');
      setNotFoundMessage(false);
      setFoundSuccessSource(null);
    } else {
      const nextCode = initialCode || `${1000 + products.length + 1}`;
      setName('');
      setCode(nextCode);
      setCategory(COMMON_CATEGORIES[0]);
      setUnit(COMMON_UNITS[0]);
      setIsWeighted(false);

      const ppc = 12;
      setPiecesPerCarton(ppc);

      setCartonCost('');
      setPieceCost('');

      setCartonRetail('');
      setPieceRetail('');

      setCartonWholesale('');
      setPieceWholesale('');

      setCartonsStock(5);
      setTotalPiecesStock(60);
      setItemCountStock('');

      setMinStock(6);
      setNotes('');
      setNotFoundMessage(false);
      setFoundSuccessSource(null);

      // الاستعلام التلقائي فوراً إذا تم تمرير باركود بعد المسح
      if (initialCode && initialCode.trim()) {
        triggerAutoLookup(initialCode.trim());
      }
    }
    setErrors({});
  }, [productToEdit, isOpen, products.length, initialCode]);

  if (!isOpen) return null;

  const generateNextBarcode = () => {
    const numericCodes = products
      .map((p) => parseInt(p.code, 10))
      .filter((n) => !isNaN(n) && n > 0);
    const nextNum = numericCodes.length > 0 ? Math.max(...numericCodes) + 1 : 1001;
    setCode(String(nextNum));
    setNotFoundMessage(false);
    setFoundSuccessSource(null);
  };

  const profitPerPiece = (typeof pieceRetail === 'number' && typeof pieceCost === 'number')
    ? pieceRetail - pieceCost
    : 0;
  const profitPercentage = (typeof pieceRetail === 'number' && typeof pieceCost === 'number' && pieceCost > 0)
    ? Math.round(((pieceRetail - pieceCost) / pieceCost) * 100)
    : 0;

  const handleCapacityChange = (newPpc: number) => {
    const validPpc = Math.max(1, newPpc);
    setPiecesPerCarton(validPpc);

    if (typeof cartonCost === 'number') {
      setPieceCost(Math.round((cartonCost / validPpc) * 100) / 100);
    }
    if (typeof cartonRetail === 'number') {
      setPieceRetail(Math.round((cartonRetail / validPpc) * 100) / 100);
    }
    if (typeof cartonWholesale === 'number') {
      setPieceWholesale(Math.round((cartonWholesale / validPpc) * 100) / 100);
    }

    if (typeof cartonsStock === 'number') {
      setTotalPiecesStock(cartonsStock * validPpc);
    }
  };

  const handleCartonCostChange = (valStr: string) => {
    if (valStr === '') {
      setCartonCost('');
      setPieceCost('');
      return;
    }
    const val = parseFloat(valStr) || 0;
    setCartonCost(val);
    if (isWeighted) {
      setPieceCost(Math.round((val / 1000) * 1000) / 1000);
    } else {
      setPieceCost(Math.round((val / piecesPerCarton) * 100) / 100);
    }
  };

  const handlePieceCostChange = (valStr: string) => {
    if (valStr === '') {
      setPieceCost('');
      if (isWeighted) setCartonCost('');
      return;
    }
    const val = parseFloat(valStr) || 0;
    setPieceCost(val);
    if (isWeighted) {
      setCartonCost(Math.round(val * 1000));
    }
  };

  const handleCartonRetailChange = (valStr: string) => {
    if (valStr === '') {
      setCartonRetail('');
      setPieceRetail('');
      return;
    }
    const val = parseFloat(valStr) || 0;
    setCartonRetail(val);
    if (isWeighted) {
      setPieceRetail(Math.round((val / 1000) * 1000) / 1000);
    } else {
      setPieceRetail(Math.round((val / piecesPerCarton) * 100) / 100);
    }
  };

  const handlePieceRetailChange = (valStr: string) => {
    if (valStr === '') {
      setPieceRetail('');
      if (isWeighted) setCartonRetail('');
      return;
    }
    const val = parseFloat(valStr) || 0;
    setPieceRetail(val);
    if (isWeighted) {
      setCartonRetail(Math.round(val * 1000));
    }
  };

  const handleCartonWholesaleChange = (valStr: string) => {
    if (valStr === '') {
      setCartonWholesale('');
      setPieceWholesale('');
      return;
    }
    const val = parseFloat(valStr) || 0;
    setCartonWholesale(val);
    if (isWeighted) {
      setPieceWholesale(Math.round((val / 1000) * 1000) / 1000);
    } else {
      setPieceWholesale(Math.round((val / piecesPerCarton) * 100) / 100);
    }
  };

  const handlePieceWholesaleChange = (valStr: string) => {
    if (valStr === '') {
      setPieceWholesale('');
      if (isWeighted) setCartonWholesale('');
      return;
    }
    const val = parseFloat(valStr) || 0;
    setPieceWholesale(val);
    if (isWeighted) {
      setCartonWholesale(Math.round(val * 1000));
    }
  };

  const handleCartonsStockChange = (valStr: string) => {
    if (valStr === '') {
      setCartonsStock('');
      if (!isWeighted) setTotalPiecesStock('');
      return;
    }
    const cVal = parseFloat(valStr) || 0;
    setCartonsStock(cVal);
    if (isWeighted) {
      setTotalPiecesStock(cVal);
    } else {
      setTotalPiecesStock(Math.round(cVal * piecesPerCarton));
    }
  };

  const handleTotalPiecesStockChange = (valStr: string) => {
    if (valStr === '') {
      setTotalPiecesStock('');
      setCartonsStock('');
      return;
    }
    const pVal = parseInt(valStr) || 0;
    setTotalPiecesStock(pVal);
    setCartonsStock(Math.round((pVal / piecesPerCarton) * 10) / 10);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) newErrors.name = 'اسم المادة مطلوب';

    const effectiveCost = isWeighted 
      ? (typeof cartonCost === 'number' ? cartonCost : (typeof pieceCost === 'number' ? pieceCost * 1000 : ''))
      : pieceCost;
    const effectiveRetail = isWeighted
      ? (typeof cartonRetail === 'number' ? cartonRetail : (typeof pieceRetail === 'number' ? pieceRetail * 1000 : ''))
      : pieceRetail;

    if (effectiveCost === '' || Number(effectiveCost) < 0) newErrors.costPrice = 'سعر الشراء / التكلفة مطلوب';
    if (effectiveRetail === '' || Number(effectiveRetail) < 0) newErrors.retailPrice = 'سعر بيع المفرد مطلوب';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const finalPieceCost = Number(effectiveCost);
    const finalPieceRetail = Number(effectiveRetail);
    
    let finalPieceWholesale = finalPieceRetail;
    if (isWeighted) {
      if (typeof cartonWholesale === 'number' && cartonWholesale > 0) {
        finalPieceWholesale = cartonWholesale;
      } else if (typeof pieceWholesale === 'number' && pieceWholesale > 0) {
        finalPieceWholesale = pieceWholesale * 1000;
      }
    } else {
      finalPieceWholesale = pieceWholesale === '' ? finalPieceRetail : Number(pieceWholesale);
    }

    const finalStock = isWeighted
      ? (cartonsStock === '' ? 0 : Number(cartonsStock))
      : (totalPiecesStock === '' ? 0 : Number(totalPiecesStock));

    const finalItemCount = isWeighted && typeof itemCountStock === 'number' ? itemCountStock : undefined;

    const payload = {
      name: name.trim(),
      code: code.trim() || `${Date.now()}`,
      category: category.trim(),
      unit: unit.trim(),
      costPrice: finalPieceCost,
      retailPrice: finalPieceRetail,
      wholesalePrice: finalPieceWholesale,
      stock: finalStock,
      piecesPerCarton: isWeighted ? 1 : piecesPerCarton,
      minStock: minStock === '' ? 6 : Number(minStock),
      isWeighted: isWeighted || unit === 'كغم' || unit === 'كيلو' || unit === 'غرام' || unit === 'غم',
      itemCount: finalItemCount,
      notes: notes.trim(),
    };

    if (productToEdit) {
      updateProduct(productToEdit.id, payload);
    } else {
      addProduct(payload);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-2xl w-full my-auto overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                {productToEdit ? 'تعديل بيانات وأسعار المادة' : 'إدخال مادة جديدة إلى المخزن'}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                تحويل حسابي تلقائي ومتبادل بين سعر القطعة وسعر الكرتون
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          
          {/* تنبيهات الاستعلام التلقائي */}
          {notFoundMessage && !isSearchingBarcode && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>لم يتم إيجاد المادة، يرجى إدخال الاسم والأسعار يدوياً.</span>
            </div>
          )}

          {isSearchingBarcode && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-pulse">
              <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
              <span>جاري استكشاف بيانات المادة من قواعد البيانات المليونية والترجمة...</span>
            </div>
          )}

          {foundSuccessSource && !isSearchingBarcode && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {foundSuccessSource === 'community'
                  ? 'تم استيراد اسم وتصنيف المادة من قاعدة بيانات المتاجر المشتركة بنجاح'
                  : 'تم استكشاف المادة من قواعد البيانات العالمية وترجمتها إلى العربية بنجاح'}
              </span>
            </div>
          )}

          {/* Row 1: Code/Barcode + Name */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            
            {/* Code / Barcode (4 cols) */}
            <div className="sm:col-span-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  الرمز أو الباركود
                </label>
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="text-[10px] text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                  title="فتح كاميرا الهاتف أو الجهاز لمسح باركود المادة تلقائياً"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <Scan className="w-3 h-3 text-emerald-700" />
                  <span>مسح بالكاميرا</span>
                </button>
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    const newCode = e.target.value;
                    setCode(newCode);
                    setNotFoundMessage(false);
                    setFoundSuccessSource(null);
                  }}
                  onBlur={() => {
                    if (!productToEdit && code.trim() && !name.trim()) {
                      triggerAutoLookup(code.trim());
                    }
                  }}
                  placeholder="1001"
                  className="w-full pr-8 pl-16 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="absolute right-2 text-slate-400 hover:text-emerald-600 p-1 cursor-pointer transition"
                  title="مسح بالكاميرا"
                >
                  <Scan className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={generateNextBarcode}
                  className="absolute left-1.5 text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-1 rounded-lg cursor-pointer transition"
                  title="توليد رقم تسلسلي تلقائي"
                >
                  توليد
                </button>
              </div>
            </div>

            {/* Product Name (8 cols) */}
            <div className="sm:col-span-8">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم المادة / الصنف <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: شفرة حلاقة، زيت، مسامير، سائل غسيل..."
                className={`w-full px-3 py-2 text-xs font-bold border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white ${
                  errors.name ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                }`}
              />
              {errors.name && (
                <span className="text-[10px] text-rose-500 mt-0.5 block">{errors.name}</span>
              )}
            </div>

          </div>

          {/* Row 2: Category and Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                التصنيف / الفئة
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="حدد أو اكتب الفئة"
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="text-xs bg-slate-100 border border-slate-300 rounded-xl px-2 text-slate-700 cursor-pointer"
                >
                  {COMMON_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Base Unit */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الوحدة الأساسية
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="قطعة، كرتونة..."
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="text-xs bg-slate-100 border border-slate-300 rounded-xl px-2 text-slate-700 cursor-pointer"
                >
                  {COMMON_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ميزة البيع بالوزن (ميزان - سعر الكيلو 1000g) */}
          <div className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 shadow-2xs ${
            isWeighted 
              ? 'bg-amber-100/80 border-amber-400 ring-2 ring-amber-300' 
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                isWeighted ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black text-slate-900 block">
                  مادة تباع بالوزن (ميزان - سعر الكيلو الواحد 1000g)
                </span>
                <span className="text-[11px] text-slate-600 leading-tight block">
                  عند تفعيل هذا الخيار، يكون السعر المحدد هو سعر الكيلو الواحد، ويتم تحديد الوزن المباع (مثلاً: 0.350 كغم) بسهولة في القائمة.
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={isWeighted}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsWeighted(checked);
                  if (checked) {
                    if (unit === 'قطعة') setUnit('كغم');
                    setPriceInputMode('carton');
                    if (typeof cartonCost === 'number' && cartonCost > 0) {
                      setPieceCost(Math.round((cartonCost / 1000) * 1000) / 1000);
                    } else if (typeof pieceCost === 'number' && pieceCost > 0) {
                      setCartonCost(Math.round(pieceCost * 1000));
                    }

                    if (typeof cartonRetail === 'number' && cartonRetail > 0) {
                      setPieceRetail(Math.round((cartonRetail / 1000) * 1000) / 1000);
                    } else if (typeof pieceRetail === 'number' && pieceRetail > 0) {
                      setCartonRetail(Math.round(pieceRetail * 1000));
                    }

                    if (typeof cartonWholesale === 'number' && cartonWholesale > 0) {
                      setPieceWholesale(Math.round((cartonWholesale / 1000) * 1000) / 1000);
                    } else if (typeof pieceWholesale === 'number' && pieceWholesale > 0) {
                      setCartonWholesale(Math.round(pieceWholesale * 1000));
                    }
                  } else {
                    if (unit === 'كغم' || unit === 'غرام' || unit === 'غم') setUnit('قطعة');
                    if (typeof cartonCost === 'number' && piecesPerCarton > 0) {
                      setPieceCost(Math.round((cartonCost / piecesPerCarton) * 100) / 100);
                    }
                    if (typeof cartonRetail === 'number' && piecesPerCarton > 0) {
                      setPieceRetail(Math.round((cartonRetail / piecesPerCarton) * 100) / 100);
                    }
                    if (typeof cartonWholesale === 'number' && piecesPerCarton > 0) {
                      setPieceWholesale(Math.round((cartonWholesale / piecesPerCarton) * 100) / 100);
                    }
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          {/* Section 1: Carton Capacity Box */}
          {!isWeighted ? (
            <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                  <Box className="w-4 h-4 text-amber-700" />
                  <span>سعة الكرتون (كم قطعة يحتوي الكارتون الواحد؟)</span>
                </span>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300/80 px-2 py-0.5 rounded-lg">
                  النسبة: 1 كرتون = {piecesPerCarton} قطعة
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {PRESET_CAPACITIES.map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => handleCapacityChange(cap)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                      piecesPerCarton === cap
                        ? 'bg-amber-700 text-white border-amber-700 shadow-2xs'
                        : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
                    }`}
                  >
                    {cap} ق
                  </button>
                ))}

                <div className="flex items-center gap-1.5 mr-auto">
                  <input
                    type="number"
                    min="1"
                    value={piecesPerCarton}
                    onChange={(e) => handleCapacityChange(parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1 text-xs font-bold text-center border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-amber-900">قطعة</span>
                </div>
              </div>

              <p className="text-[10px] text-amber-800/80 leading-relaxed">
                * يتم استخدام هذه السعة للتحويل الحسابي الفوري بين سعر الكرتون وسعر القطعة، وكذلك لخصم المخزون بدقة.
              </p>
            </div>
          ) : null}

          {/* Section 2: Pricing Structure */}
          <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-3.5 space-y-3">
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div>
                <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>
                    {isWeighted
                      ? 'هيكل الأسعار (سعر الكيلو 1000g وسعر الغرام 1g)'
                      : 'هيكل الأسعار (تحويل تلقائي بين سعر القطعة وسعر الكرتون)'}
                  </span>
                </span>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {isWeighted
                    ? 'يُحسب سعر الغرام تلقائياً عند إدخال سعر الكيلو، أو العكس (1 كغم = 1000 غرام).'
                    : 'يُحسب سعر القطعة تلقائياً عند إدخال سعر الكرتون، ويمكنك تعديل سعر القطعة بحرية دون تغيير سعر الكرتون.'}
                </p>
              </div>

              <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-xs font-bold shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setPriceInputMode('carton')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                    priceInputMode === 'carton'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {isWeighted ? <Scale className="w-3.5 h-3.5" /> : <Box className="w-3.5 h-3.5" />}
                  <span>{isWeighted ? 'بالكيلو (1000g)' : 'بالكرتون'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPriceInputMode('piece')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                    priceInputMode === 'piece'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <span>{isWeighted ? 'بالغرام (1g)' : 'بالقطعة'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              {/* Cost Price */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition">
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                    <span>1. سعر التكلفة / الشراء</span>
                    <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    رأس المال
                  </span>
                </div>

                <div className="space-y-2 flex-1 flex flex-col justify-center">
                  <div className="bg-slate-50/90 p-2 rounded-xl border border-slate-200">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 truncate">
                      {isWeighted ? 'سعر الكيلو (1000g):' : 'سعر الكرتون الكامل:'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={cartonCost}
                        onChange={(e) => handleCartonCostChange(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-10 pr-2.5 py-2 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono bg-white"
                      />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                        {settings.currency || 'دينار'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-200">
                    <label className="block text-[11px] font-bold text-emerald-950 mb-1 truncate">
                      {isWeighted ? 'سعر الغرام (1g):' : `تكلفة القطعة (${piecesPerCarton} ق):`}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={pieceCost}
                        onChange={(e) => handlePieceCostChange(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-10 pr-2.5 py-2 text-xs font-bold border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono bg-white text-emerald-950"
                      />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-600 font-bold">
                        {settings.currency || 'دينار'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Retail Price */}
              <div className="bg-white p-3 rounded-2xl border-2 border-emerald-200 shadow-2xs flex flex-col justify-between hover:border-emerald-300 transition">
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-emerald-100">
                  <span className="text-xs font-black text-emerald-900 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>2. سعر بيع المفرد</span>
                    <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                    تجزئة
                  </span>
                </div>

                <div className="space-y-2 flex-1 flex flex-col justify-center">
                  <div className="bg-slate-50/90 p-2 rounded-xl border border-slate-200">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 truncate">
                      {isWeighted ? 'سعر بيع الكيلو (1000g):' : 'سعر بيع الكرتون:'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={cartonRetail}
                        onChange={(e) => handleCartonRetailChange(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-10 pr-2.5 py-2 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono bg-white"
                      />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                        {settings.currency || 'دينار'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-blue-50/70 p-2 rounded-xl border border-blue-200">
                    <label className="block text-[11px] font-bold text-blue-950 mb-1 truncate">
                      {isWeighted ? 'سعر بيع الغرام (1g):' : `سعر بيع القطعة (${piecesPerCarton} ق):`}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={pieceRetail}
                        onChange={(e) => handlePieceRetailChange(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-10 pr-2.5 py-2 text-xs font-bold border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono bg-white text-blue-950"
                      />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-600 font-bold">
                        {settings.currency || 'دينار'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Wholesale Price */}
              <div className="bg-white p-3 rounded-2xl border border-amber-200 shadow-2xs flex flex-col justify-between hover:border-amber-300 transition">
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-amber-100">
                  <span className="text-xs font-black text-amber-950 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>3. سعر بيع الجملة</span>
                  </span>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                    اختياري
                  </span>
                </div>

                <div className="space-y-2 flex-1 flex flex-col justify-center">
                  <div className="bg-slate-50/90 p-2 rounded-xl border border-slate-200">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 truncate">
                      {isWeighted ? 'بيع كيلو جملة (1000g):' : 'بيع كرتون (جملة):'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={cartonWholesale}
                        onChange={(e) => handleCartonWholesaleChange(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-10 pr-2.5 py-2 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono bg-white"
                      />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                        {settings.currency || 'دينار'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-purple-50/70 p-2 rounded-xl border border-purple-200">
                    <label className="block text-[11px] font-bold text-purple-950 mb-1 truncate">
                      {isWeighted ? 'بيع غرام جملة (1g):' : `بيع قطعة (جملة ${piecesPerCarton} ق):`}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={pieceWholesale}
                        onChange={(e) => handlePieceWholesaleChange(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-10 pr-2.5 py-2 text-xs font-bold border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono bg-white text-purple-950"
                      />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-purple-600 font-bold">
                        {settings.currency || 'دينار'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Profit & Margin Indicator */}
            {isWeighted ? (
              typeof cartonCost === 'number' && typeof cartonRetail === 'number' && cartonCost > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between text-xs flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-emerald-950 font-bold">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>مؤشر ربح الكيلو (1000g):</span>
                    <span className="font-mono text-emerald-800 font-black">
                      {(cartonRetail - cartonCost) >= 0 ? `+${(cartonRetail - cartonCost).toLocaleString()}` : (cartonRetail - cartonCost).toLocaleString()} {settings.currency || 'دينار'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md font-mono font-black text-xs ${
                      ((cartonRetail - cartonCost) / cartonCost) * 100 >= 20 ? 'bg-emerald-600 text-white' : 'bg-emerald-200 text-emerald-900'
                    }`}>
                      نسبة الربح: {Math.round(((cartonRetail - cartonCost) / cartonCost) * 100)}%
                    </span>
                    <span className="text-[11px] text-emerald-800 font-bold font-mono">
                      (ربح الغرام الواحد: {Math.round(((cartonRetail - cartonCost) / 1000) * 100) / 100} {settings.currency || 'دينار'})
                    </span>
                  </div>
                </div>
              )
            ) : (
              typeof pieceCost === 'number' && typeof pieceRetail === 'number' && pieceCost > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between text-xs flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-emerald-950 font-bold">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>مؤشر ربح القطعة:</span>
                    <span className="font-mono text-emerald-800 font-black">
                      {profitPerPiece >= 0 ? `+${profitPerPiece.toLocaleString()}` : profitPerPiece.toLocaleString()} {settings.currency || 'دينار'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md font-mono font-black text-xs ${
                      profitPercentage >= 20 ? 'bg-emerald-600 text-white' : profitPercentage >= 0 ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-100 text-rose-800'
                    }`}>
                      نسبة الربح: {profitPercentage}%
                    </span>
                    <span className="text-[11px] text-emerald-800 font-bold">
                      (ربح الكرتون: {((profitPerPiece) * piecesPerCarton).toLocaleString()} {settings.currency || 'دينار'})
                    </span>
                  </div>
                </div>
              )
            )}

          </div>

          {/* Section 3: Initial Stock Converter Box */}
          <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                <Box className="w-4 h-4 text-emerald-700" />
                <span>
                  {isWeighted
                    ? 'رصيد المخزن الأولي (الرصيد بالوزن والعدد)'
                    : 'رصيد المخزن الأولي (تحويل متبادل بين الكراتين والقطع)'}
                </span>
              </span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300/80 px-2 py-0.5 rounded-lg">
                {isWeighted
                  ? 'ينقص رصيد الوزن تلقائياً عند البيع بالكيلو أو الغرام'
                  : 'ينقص الرصيد تلقائياً عند بيع الكراتين أو القطع'}
              </span>
            </div>

            {isWeighted ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200 flex flex-col justify-between">
                  <label className="block text-[11px] font-bold text-slate-800 mb-1 truncate">
                    الرصيد بالكيلو (كغم): <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={cartonsStock}
                      onChange={(e) => handleCartonsStockChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-10 pr-2.5 py-2 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono bg-white"
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-700 font-bold">
                      كغم
                    </span>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-emerald-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 truncate">
                      الرصيد بالعدد (قطع / أكياس):
                    </label>
                    <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded">
                      اختياري
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={itemCountStock}
                      onChange={(e) => setItemCountStock(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)}
                      placeholder="مثال: 50 كيس أو قطعة (اختياري)"
                      className="w-full pl-12 pr-2.5 py-2 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono bg-white text-slate-800"
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold">
                      عدد
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="bg-white p-2 rounded-xl border border-emerald-200 flex flex-col justify-between">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 truncate">
                    الرصيد بالكراتين:
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={cartonsStock}
                      onChange={(e) => handleCartonsStockChange(e.target.value)}
                      placeholder="5"
                      className="w-full pl-10 pr-2.5 py-2 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono bg-white"
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                      كارتون
                    </span>
                  </div>
                </div>

                <div className="bg-white p-2 rounded-xl border border-emerald-200 flex flex-col justify-between">
                  <label className="block text-[11px] font-bold text-emerald-950 mb-1 truncate">
                    الرصيد بالقطع (تلقائي):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={totalPiecesStock}
                      onChange={(e) => handleTotalPiecesStockChange(e.target.value)}
                      placeholder="60"
                      className="w-full pl-10 pr-2.5 py-2 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono bg-white text-emerald-950"
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                      قطعة
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Package className="w-3.5 h-3.5" />
              <span>{productToEdit ? 'حفظ تعديل المادة' : 'إضافة المادة للمخزن'}</span>
            </button>
          </div>

        </form>

      </div>

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(scanned) => {
          setCode(scanned);
          setIsScannerOpen(false);
          if (!productToEdit && scanned.trim()) {
            triggerAutoLookup(scanned.trim());
          }
        }}
        title="مسح باركود الصنف بالكاميرا"
      />
    </div>
  );
};

export default ProductModal;
