import React, { useState, useEffect, useMemo } from 'react';
import { isAndroidApp } from '../utils/androidOnly';
import { shiftDate, daysUntil, reconcileBatches, addBatch, ShelfUnit } from '../utils/expiry';
import { generateInternalBarcode } from '../utils/barcodeGen';
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
  Lock,
  ImagePlus
} from 'lucide-react';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { lookupProductDetails, LookupPreference } from '../utils/productLookup';
import { allCodes, productsByCode } from '../utils/productCodes';
import { catalogLookup, catalogSearch, catalogPrices, CatalogHit, CatalogOffer } from '../utils/productCatalog';
import { ProductImageModal } from './ProductImageModal';
import { saveProductImage, removeProductImage, useProductImage, imagesSupported } from '../utils/productImages';
import { ProductImageField } from './ProductImageField';

export interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  initialCode?: string;
}

/** يعرض الصفر كحقل فارغ */
const nz = (n: number) => (n ? String(n) : '');

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  initialCode,
}) => {
  const { addProduct, updateProduct, products, formatMoney, settings, updateSettings, hasPermission, priceTypeOn, currentUser } = useApp() as any;

  const [code, setCode] = useState('');
  const [extraCodes, setExtraCodes] = useState<string[]>([]);
  const [extraInput, setExtraInput] = useState('');
  const [allowDupCode, setAllowDupCode] = useState(false);
  const [catPick, setCatPick] = useState<string | null>(null);
  useEffect(() => { setAllowDupCode(false); }, [code, extraCodes]);
  // الصورة: للمادة الموجودة تُفتح نافذة الصور، وللمادة الجديدة تُختار الصورة وتُحفظ مع المادة
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const pendingInputRef = React.useRef<HTMLInputElement>(null);
  const existingThumb = useProductImage(productToEdit?.id, 'thumb');
  useEffect(() => {
    if (!pendingImage) { setPendingPreview(null); return; }
    const u = URL.createObjectURL(pendingImage);
    setPendingPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [pendingImage]);
  useEffect(() => { if (!isOpen) setPendingImage(null); }, [isOpen]);
  const [name, setName] = useState('');
  // الكتالوج المشترك: اقتراحات الاسم + العروض المقترحة
  const [nameHits, setNameHits] = useState<CatalogHit[]>([]);
  const [nameFocus, setNameFocus] = useState(false);
  const suppressNameSearch = React.useRef(false);
  const skipLookupFor = React.useRef('');
  const [suggestedOffers, setSuggestedOffers] = useState<CatalogOffer[]>([]);
  const [pickedOffers, setPickedOffers] = useState<number[]>([]);
  const [offersOpen, setOffersOpen] = useState(false);
  const [offersRetail, setOffersRetail] = useState(0);
  const [category, setCategory] = useState('عام');
  const [unit, setUnit] = useState('قطعة');
  
  // حالات الإدخال النصية المستقلة لمنع فرض الكسور والفواصل أثناء الكتابة
  const [cartonCostInput, setCartonCostInput] = useState<string>('0');
  const [pieceCostInput, setPieceCostInput] = useState<string>('0');

  const [cartonRetailInput, setCartonRetailInput] = useState<string>('0');
  const [pieceRetailInput, setPieceRetailInput] = useState<string>('0');

  const [cartonWholesaleInput, setCartonWholesaleInput] = useState<string>('0');
  const [pieceWholesaleInput, setPieceWholesaleInput] = useState<string>('0');
  const [superWholesaleInput, setSuperWholesaleInput] = useState<string>('');
  const [cartonSuperInput, setCartonSuperInput] = useState<string>('');
  const [cartonSpecialInput, setCartonSpecialInput] = useState<string>('');
  const [specialPriceInput, setSpecialPriceInput] = useState<string>('');

  const [stock, setStock] = useState<number | ''>(0);
  const [minStock, setMinStock] = useState<number | ''>(5);
  const [piecesPerCarton, setPiecesPerCarton] = useState<number | ''>(1);
  const [scanUnit, setScanUnit] = useState<'piece' | 'dozen' | 'carton'>('piece');
  const [clickUnit, setClickUnit] = useState<'piece' | 'dozen' | 'carton'>('piece');
  const [scanAsPieces, setScanAsPieces] = useState(false);
  const [clickGrams, setClickGrams] = useState<number>(1000);
  const [scanGrams, setScanGrams] = useState<number>(1000);
  const [clickAsPieces, setClickAsPieces] = useState(false);
  const [dozenOn, setDozenOn] = useState(false);
  const [dozenLabel, setDozenLabel] = useState('درزن');
  const [piecesPerDozen, setPiecesPerDozen] = useState<number | ''>(12);
  const [isWeighted, setIsWeighted] = useState(false);
  const [notes, setNotes] = useState('');
  const [stockNote, setStockNote] = useState('');
  const [productionDate, setProductionDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [shelfAmount, setShelfAmount] = useState<string>('');
  const [shelfUnit, setShelfUnit] = useState<ShelfUnit>('month');
  const [showBatches, setShowBatches] = useState(false);
  const [priceCurrency, setPriceCurrency] = useState<'IQD' | 'USD'>('IQD');

  // فحص صلاحية إظهار أسعار التكلفة
  const canViewCost = hasPermission('canViewCostPrice');

  // حالات البحث التلقائي ومصدر الاستعلام المفضل
  const [lookupPreference, setLookupPreference] = useState<LookupPreference>(() => {
    return (localStorage.getItem('lookup_preference') as LookupPreference) || 'global';
  });
  const [isSearchingBarcode, setIsSearchingBarcode] = useState(false);
  const [notFoundMessage, setNotFoundMessage] = useState<string | null>(null);
  const [foundSuccessSource, setFoundSuccessSource] = useState<'community' | 'global' | 'web' | null>(null);
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
    (settings.productCategories || []).forEach((c) => { if (c && c.trim()) cats.add(c.trim()); });
    products.forEach((p) => {
      if (p.category && p.category.trim()) cats.add(p.category.trim());
    });
    return Array.from(cats);
  }, [products, settings.productCategories]);

  const BUILTIN_CATS = ['عام','مواد غذائية','منظفات','مشروبات وعصائر','حلويات وشوكولاتة','ألبان وأجبان','قرطاسية','كوزمتك وعناية','إلكترونيات','بلاستيك ومنزلي'];
  const savedCats = settings.productCategories || [];

  const saveNewCategory = (raw?: string) => {
    const c = (raw ?? category).trim();
    if (!c) return;
    if (!existingCategories.includes(c)) {
      updateSettings({ productCategories: [...savedCats, c] });
    }
    setCategory(c);
  };
  const removeSavedCategory = (c: string) => {
    updateSettings({ productCategories: savedCats.filter((x) => x !== c) });
  };
  const canAddCategory = category.trim() !== '' && !existingCategories.includes(category.trim());

  // توليد باركود تلقائي فريد
  const generateUniqueBarcode = () => {
    const newCode = generateInternalBarcode(new Set(products.map((p) => p.code)));
    setCode(newCode);
  };

  const defaultCarton = Math.max(1, Math.round(Number((settings as any).defaultCartonSize) || 24));

  // تعبئة كل الحقول من مادة الكتالوج المشترك (الاسم، الباركود، التعبئة، التكلفة، البيع، العروض) — قابلة للتعديل
  const applyCatalog = (hit: CatalogHit) => {
    const ppc = hit.pieces_per_carton && hit.pieces_per_carton > 1 ? hit.pieces_per_carton : defaultCarton;
    suppressNameSearch.current = true;
    // الباركود التجاري الصحيح فقط يُنسخ؛ مواد المتاجر بلا باركود أو برمز داخلي لا تغيّر باركود المادة
    const stdBarcode = /^\d{6,15}$/.test(String(hit.barcode || '').trim());
    if (stdBarcode) skipLookupFor.current = hit.barcode;
    setPriceCurrency('IQD');
    if (stdBarcode) setCode(hit.barcode);
    setName(hit.name);
    if (hit.category && hit.category !== 'عام') setCategory(hit.category);
    if (hit.unit) setUnit(hit.unit);
    setPiecesPerCarton(ppc);
    const r2 = (n: number) => String(parseFloat(n.toFixed(2)));
    if (hit.cost_price && hit.cost_price > 0) { setPieceCostInput(String(hit.cost_price)); setCartonCostInput(r2(hit.cost_price * ppc)); }
    if (hit.retail_price && hit.retail_price > 0) { setPieceRetailInput(String(hit.retail_price)); setCartonRetailInput(r2(hit.retail_price * ppc)); }
    setOffersRetail(hit.retail_price || 0);
    setSuggestedOffers(hit.offers || []);
    setPickedOffers([]);
    setNameHits([]);
  };

  // زر «تحديث السعر»: يجلب سعر هذه المادة من الكتالوج المشترك (أعلى أو أقل سعر حسب الإعدادات) ويضعه في الحقول — لا يُحفظ إلا بزر الحفظ
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceMsg, setPriceMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const updatePriceFromCatalog = async () => {
    setPriceBusy(true); setPriceMsg(null);
    try {
      if (priceCurrency === 'USD') { setPriceMsg({ ok: false, text: 'هذه المادة مسعّرة بالدولار؛ أسعار الكتالوج بالدينار. بدّل العملة للدينار أولاً.' }); return; }
      const mode: 'max' | 'min' = (settings as any)?.catalogPriceMode === 'min' ? 'min' : 'max';
      const c = code.trim();
      let retail: number | null = null, cost: number | null = null, stores = 0;
      if (/^\d{6,15}$/.test(c)) {
        const p = await catalogPrices(c);
        if (p) {
          retail = mode === 'min' ? (p.retail_min ?? p.retail_max) : p.retail_max;
          cost = mode === 'min' ? (p.cost_min ?? p.cost_max) : p.cost_max;
          stores = p.stores;
        }
      }
      if (retail == null && cost == null && name.trim().length >= 2) {
        const norm = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase();
        const hits = await catalogSearch(name.trim(), 8);
        const exact = hits.find((h) => norm(h.name) === norm(name) && (h.retail_price || h.cost_price));
        if (exact) { retail = exact.retail_price || null; cost = exact.cost_price || null; stores = exact.stores_count || 0; }
      }
      if ((retail == null || retail <= 0) && (cost == null || cost <= 0)) { setPriceMsg({ ok: false, text: 'لا يوجد لهذه المادة سعر في الكتالوج المشترك.' }); return; }
      const ppc = typeof piecesPerCarton === 'number' && piecesPerCarton > 0 ? piecesPerCarton : 1;
      const r2 = (n: number) => String(parseFloat(n.toFixed(2)));
      const oldRetail = parseFloat(pieceRetailInput) || 0;
      const parts: string[] = [];
      if (retail && retail > 0) { setPieceRetailInput(String(retail)); setCartonRetailInput(r2(retail * ppc)); parts.push(`البيع: ${oldRetail} ← ${retail}`); }
      if (canViewCost && cost && cost > 0) { setPieceCostInput(String(cost)); setCartonCostInput(r2(cost * ppc)); parts.push(`التكلفة ← ${cost}`); }
      setPriceMsg({ ok: true, text: `من الكتالوج (${mode === 'min' ? 'أقل' : 'أعلى'} سعر${stores ? ` · ${stores} متجر` : ''}) — ${parts.join(' · ')}. اضغط «حفظ» لتثبيته.` });
    } catch {
      setPriceMsg({ ok: false, text: 'تعذر الاتصال بالكتالوج.' });
    } finally {
      setPriceBusy(false);
    }
  };

  // بحث جزئي بالاسم أثناء الكتابة (مادة جديدة فقط)
  useEffect(() => {
    if (!isOpen || productToEdit) { setNameHits([]); return; }
    if (suppressNameSearch.current) { suppressNameSearch.current = false; return; }
    const q = name.trim();
    if (q.length < 2) { setNameHits([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await catalogSearch(q, 8);
      if (!cancelled) setNameHits(r);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [name, isOpen, productToEdit]);

  // البحث التلقائي عن المادة بالباركود
  const triggerAutoLookup = async (barcodeVal: string, pref: LookupPreference = lookupPreference) => {
    const clean = barcodeVal.trim();
    if (!clean || clean.length < 3) return;
    if (productToEdit) return;
    // الباركود جاء من اختيار اسم في الكتالوج: الحقول مملوءة، فلا نعيد البحث
    if (skipLookupFor.current === clean) { skipLookupFor.current = ''; return; }

    setIsSearchingBarcode(true);
    setNotFoundMessage(null);
    setFoundSuccessSource(null);

    try {
      // أولاً: الكتالوج المشترك بين المتاجر (يجلب الاسم الأطول عند اختلاف الأسماء لنفس الباركود)
      const hit = await catalogLookup(clean);
      if (hit) {
        applyCatalog(hit);
        setFoundSuccessSource('community');
        setTimeout(() => setFoundSuccessSource(null), 5000);
        return;
      }
      const result = await lookupProductDetails(clean, pref, (currentUser as any)?.uid || 'offline_store');
      if (result && result.name) {
        setName(result.name);
        if (result.category && result.category !== 'عام') {
          setCategory(result.category);
        }
        if (result.piecesPerCarton && result.piecesPerCarton > 1) setPiecesPerCarton(result.piecesPerCarton);
        setFoundSuccessSource(result.source);
        if (result.translated === false) { setNotFoundMessage('تعذرت ترجمة الاسم للعربية، فبقي بلغته الأصلية. عدّله يدوياً.'); setTimeout(() => setNotFoundMessage(null), 6000); }
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
      setExtraCodes(productToEdit.extraCodes || []);
      setExtraInput(''); setAllowDupCode(false); setCatPick(null);
      setName(productToEdit.name || '');
      setCategory(productToEdit.category || 'عام');
      setUnit(productToEdit.unit || 'قطعة');
      
      const ppc = productToEdit.piecesPerCarton || 1;
      setPiecesPerCarton(ppc);
      setDozenOn((productToEdit.piecesPerDozen || 0) > 1);
      setDozenLabel((productToEdit.dozenLabel || '').trim() || 'درزن');
      setScanUnit(productToEdit.scanUnit || 'piece');
      setClickUnit(productToEdit.clickUnit || productToEdit.scanUnit || 'piece');
      setScanAsPieces(productToEdit.scanAsPieces === true);
      setClickGrams(productToEdit.clickWeightGrams || 1000);
      setScanGrams(productToEdit.scanWeightGrams || 1000);
      setClickAsPieces(productToEdit.clickAsPieces === true);
      setPiecesPerDozen((productToEdit.piecesPerDozen || 0) > 1 ? productToEdit.piecesPerDozen! : 12);

      const isUsd = productToEdit.priceCurrency === 'USD' && !!productToEdit.usdPrices;
      setPriceCurrency(isUsd ? 'USD' : 'IQD');
      const u = productToEdit.usdPrices;
      const rd = (n: number) => (isUsd ? parseFloat(n.toFixed(2)) : Math.round(n));

      const cost = isUsd ? u!.cost : (productToEdit.costPrice ?? 0);
      setPieceCostInput(nz(cost));
      setCartonCostInput(nz(rd(cost * ppc)));

      const retail = isUsd ? u!.retail : (productToEdit.retailPrice ?? 0);
      setPieceRetailInput(nz(retail));
      setCartonRetailInput(nz(rd(retail * ppc)));

      const wholesale = isUsd ? u!.wholesale : (productToEdit.wholesalePrice ?? 0);
      setPieceWholesaleInput(nz(wholesale));
      setCartonWholesaleInput(nz(rd(wholesale * ppc)));
      const sup = isUsd ? (u!.superWholesale || 0) : (productToEdit.superWholesalePrice || 0);
      const spc = isUsd ? (u!.special || 0) : (productToEdit.specialPrice || 0);
      setSuperWholesaleInput(sup ? String(sup) : '');
      setSpecialPriceInput(spc ? String(spc) : '');
      setCartonSuperInput(sup ? String(rd(sup * ppc)) : '');
      setCartonSpecialInput(spc ? String(rd(spc * ppc)) : '');

      setStock(productToEdit.stock ? productToEdit.stock : '');
      setMinStock(productToEdit.minStock ?? 5);
      setIsWeighted(!!productToEdit.isWeighted);
      setNotes(productToEdit.notes || '');
      setProductionDate(productToEdit.productionDate || '');
      setExpiryDate(productToEdit.expiryDate || '');
      setShelfAmount('');
    } else {
      setPriceCurrency('IQD');
      setProductionDate('');
      setExpiryDate('');
      setShelfAmount('');
      const initial = initialCode || '';
      setCode(initial);
      setExtraCodes([]); setExtraInput(''); setAllowDupCode(false); setCatPick(null);
      setName('');
      setCategory('عام');
      setUnit('قطعة');
      
      setPiecesPerCarton(defaultCarton);
      setSuggestedOffers([]);
      setPickedOffers([]);
      setNameHits([]);
      setDozenOn(false);
      setScanUnit('piece');
      setPiecesPerDozen(12);
      setCartonCostInput('');
      setPieceCostInput('');
      setCartonRetailInput('');
      setPieceRetailInput('');
      setCartonWholesaleInput('');
      setPieceWholesaleInput('');
      setSuperWholesaleInput('');
      setSpecialPriceInput('');
      setCartonSuperInput('');
      setCartonSpecialInput('');

      setStock('');
      setMinStock(5);
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

  const numPieces = typeof piecesPerCarton === 'number' && piecesPerCarton > 0 ? piecesPerCarton : 1;
  const numCost = parseFloat(pieceCostInput) || 0;
  const numRetail = parseFloat(pieceRetailInput) || 0;
  const numWholesale = parseFloat(pieceWholesaleInput) || 0;
  const numSuperWholesale = parseFloat(superWholesaleInput) || 0;
  const numSpecialPrice = parseFloat(specialPriceInput) || 0;
  const numStock = typeof stock === 'number' ? stock : 0;

  const profitPerPiece = numRetail - numCost;
  const profitMarginPercent = numCost > 0 ? ((profitPerPiece / numCost) * 100).toFixed(1) : '0';

  // معالجات المزامنة النصية المرنة بدون فرض فواصل أو أرقام
  const handleCartonCostChange = (val: string) => {
    setCartonCostInput(val);
    if (val.trim() === '' || val === '0') {
      setPieceCostInput(val);
      return;
    }
    const c = parseFloat(val);
    if (!isNaN(c)) {
      setPieceCostInput(numPieces > 1 ? String(parseFloat((c / numPieces).toFixed(2))) : String(c));
    }
  };

  const handlePieceCostChange = (val: string) => {
    setPieceCostInput(val);
    if (val.trim() === '' || val === '0') {
      setCartonCostInput(val);
      return;
    }
    const p = parseFloat(val);
    if (!isNaN(p)) {
      setCartonCostInput(String(parseFloat((p * numPieces).toFixed(2))));
    }
  };

  const handleCartonRetailChange = (val: string) => {
    setCartonRetailInput(val);
    if (val.trim() === '' || val === '0') {
      setPieceRetailInput(val);
      return;
    }
    const r = parseFloat(val);
    if (!isNaN(r)) {
      setPieceRetailInput(numPieces > 1 ? String(parseFloat((r / numPieces).toFixed(2))) : String(r));
    }
  };

  const handlePieceRetailChange = (val: string) => {
    setPieceRetailInput(val);
    if (val.trim() === '' || val === '0') {
      setCartonRetailInput(val);
      return;
    }
    const p = parseFloat(val);
    if (!isNaN(p)) {
      setCartonRetailInput(String(parseFloat((p * numPieces).toFixed(2))));
    }
  };

  const handleCartonWholesaleChange = (val: string) => {
    setCartonWholesaleInput(val);
    if (val.trim() === '' || val === '0') {
      setPieceWholesaleInput(val);
      return;
    }
    const w = parseFloat(val);
    if (!isNaN(w)) {
      setPieceWholesaleInput(numPieces > 1 ? String(parseFloat((w / numPieces).toFixed(2))) : String(w));
    }
  };

  const handlePieceWholesaleChange = (val: string) => {
    setPieceWholesaleInput(val);
    if (val.trim() === '' || val === '0') {
      setCartonWholesaleInput(val);
      return;
    }
    const p = parseFloat(val);
    if (!isNaN(p)) {
      setCartonWholesaleInput(String(parseFloat((p * numPieces).toFixed(2))));
    }
  };

  const makeTierHandlers = (
    setPiece: (v: string) => void,
    setCarton: (v: string) => void
  ) => ({
    onCarton: (val: string) => {
      setCarton(val);
      const w = parseFloat(val);
      if (val.trim() === '' || isNaN(w)) { setPiece(''); return; }
      setPiece(numPieces > 1 ? String(parseFloat((w / numPieces).toFixed(2))) : String(w));
    },
    onPiece: (val: string) => {
      setPiece(val);
      const p = parseFloat(val);
      if (val.trim() === '' || isNaN(p)) { setCarton(''); return; }
      setCarton(String(parseFloat((p * numPieces).toFixed(2))));
    },
  });
  const superHandlers = makeTierHandlers(setSuperWholesaleInput, setCartonSuperInput);
  const specialHandlers = makeTierHandlers(setSpecialPriceInput, setCartonSpecialInput);

  const handlePiecesPerCartonUpdate = (newPieces: number | '') => {
    setPiecesPerCarton(newPieces);
    const validPieces = typeof newPieces === 'number' && newPieces > 0 ? newPieces : 1;
    if (pieceCostInput && pieceCostInput !== '0') {
      const p = parseFloat(pieceCostInput) || 0;
      setCartonCostInput(String(parseFloat((p * validPieces).toFixed(2))));
    }
    if (pieceRetailInput && pieceRetailInput !== '0') {
      const p = parseFloat(pieceRetailInput) || 0;
      setCartonRetailInput(String(parseFloat((p * validPieces).toFixed(2))));
    }
    if (pieceWholesaleInput && pieceWholesaleInput !== '0') {
      const p = parseFloat(pieceWholesaleInput) || 0;
      setCartonWholesaleInput(String(parseFloat((p * validPieces).toFixed(2))));
    }
    if (superWholesaleInput) {
      setCartonSuperInput(String(parseFloat(((parseFloat(superWholesaleInput) || 0) * validPieces).toFixed(2))));
    }
    if (specialPriceInput) {
      setCartonSpecialInput(String(parseFloat(((parseFloat(specialPriceInput) || 0) * validPieces).toFixed(2))));
    }
  };

  const trackBatches = settings.enableProductExpiry === true && settings.trackExpiryBatches !== false;
  // الدفعات الحالية بعد خصم ما بيع من المخزون (الأقدم أولاً)
  const currentBatches = useMemo(
    () => (trackBatches && productToEdit ? reconcileBatches(productToEdit.expiryBatches, productToEdit.stock || 0) : []),
    [trackBatches, productToEdit]
  );
  const differingQty = currentBatches.length > 1 ? currentBatches.slice(0, -1).reduce((sum, b) => sum + b.qty, 0) : 0;
  const buildBatches = () => {
    const oldStock = productToEdit?.stock || 0;
    const delta = numStock - oldStock;
    let batches = reconcileBatches(productToEdit?.expiryBatches, oldStock);
    if (productionDate || expiryDate) {
      if (delta > 0) {
        batches = addBatch(batches, delta, productionDate, expiryDate);
      } else if (batches.length) {
        const last = batches[batches.length - 1];
        if ((last.productionDate || '') !== productionDate || (last.expiryDate || '') !== expiryDate) {
          batches = batches.map(b => b === last ? { ...b, productionDate: productionDate || undefined, expiryDate: expiryDate || undefined } : b);
        }
      } else if (numStock > 0) {
        batches = addBatch(batches, numStock, productionDate, expiryDate);
      }
    }
    return reconcileBatches(batches, numStock);
  };

  const shelfNum = parseFloat(shelfAmount) || 0;
  // يحسب التاريخ الناقص من الآخر ومدة الصلاحية
  const applyShelfLife = (prod: string, exp: string, amount: number, unit: ShelfUnit) => {
    if (!(amount > 0)) return;
    if (prod && !exp) setExpiryDate(shiftDate(prod, amount, unit, 1));
    else if (exp && !prod) setProductionDate(shiftDate(exp, amount, unit, -1));
    else if (prod && exp) setExpiryDate(shiftDate(prod, amount, unit, 1));
  };
  const expiryDaysLeft = daysUntil(expiryDate);

  const usdRate = settings.usdRate && settings.usdRate > 0 ? settings.usdRate : 1500;
  const showCurrencyChoice = settings.enableUsdPricing === true || priceCurrency === 'USD';
  const curLabel = priceCurrency === 'USD' ? '$' : (settings.currency || 'دينار');
  // تحويل كل حقول الأسعار عند تبديل العملة (دينار ⇄ دولار) حتى لا تتغير قيمتها الفعلية
  const switchCurrency = (to: 'IQD' | 'USD') => {
    if (to === priceCurrency) return;
    const conv = (v: string) => {
      const n = parseFloat(v);
      if (!v || isNaN(n)) return v;
      return to === 'USD' ? String(parseFloat((n / usdRate).toFixed(2))) : String(Math.round(n * usdRate));
    };
    setPieceCostInput(conv); setCartonCostInput(conv);
    setPieceRetailInput(conv); setCartonRetailInput(conv);
    setPieceWholesaleInput(conv); setCartonWholesaleInput(conv);
    setSuperWholesaleInput(conv); setCartonSuperInput(conv);
    setSpecialPriceInput(conv); setCartonSpecialInput(conv);
    setPriceCurrency(to);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError('يرجى إدخال اسم المادة');
      return;
    }

    const finalCode = code.trim() || `${1000 + products.length + 1}`;

    const finalExtras = allCodes({ code: finalCode, extraCodes: [...extraCodes, extraInput] }).slice(1);
    const dupNames = Array.from(new Set(
      allCodes({ code: finalCode, extraCodes }).flatMap((c) => productsByCode(products as Product[], c).filter((p) => !productToEdit || p.id !== productToEdit.id).map((p) => p.name))
    ));
    if (dupNames.length && !allowDupCode) {
      setValidationError(`توجد مادة أخرى بنفس الباركود: "${dupNames.join('"، "')}". إن كان مقصوداً (باركود واحد لعدة مواد) اضغط «حفظ» مرة أخرى، وعند المسح سيُطلب اختيار المادة.`);
      setAllowDupCode(true);
      return;
    }

    const catFinal = category.trim();
    if (catFinal && !BUILTIN_CATS.includes(catFinal) && !savedCats.includes(catFinal)) {
      updateSettings({ productCategories: [...savedCats, catFinal] });
    }

    const productData = {
      code: finalCode,
      extraCodes: finalExtras.length ? finalExtras : undefined,
      name: name.trim(),
      category: category.trim() || 'عام',
      unit: unit.trim() || 'قطعة',
      ...(priceCurrency === 'USD'
        ? {
            costPrice: Math.round(numCost * usdRate),
            retailPrice: Math.round(numRetail * usdRate),
            wholesalePrice: Math.round(numWholesale * usdRate),
            superWholesalePrice: Math.round(numSuperWholesale * usdRate),
            specialPrice: Math.round(numSpecialPrice * usdRate),
            priceCurrency: 'USD' as const,
            usdPrices: {
              cost: numCost,
              retail: numRetail,
              wholesale: numWholesale,
              ...(numSuperWholesale ? { superWholesale: numSuperWholesale } : {}),
              ...(numSpecialPrice ? { special: numSpecialPrice } : {}),
            },
          }
        : {
            costPrice: numCost,
            retailPrice: numRetail,
            wholesalePrice: numWholesale,
            superWholesalePrice: numSuperWholesale,
            specialPrice: numSpecialPrice,
            priceCurrency: 'IQD' as const,
            usdPrices: undefined,
          }),
      stock: numStock,
      minStock: typeof minStock === 'number' ? minStock : 5,
      piecesPerCarton: numPieces,
      scanUnit: (!isWeighted && ((scanUnit === 'dozen' && dozenOn) || (scanUnit === 'carton' && numPieces > 1))) ? scanUnit : 'piece',
      clickUnit: (!isWeighted && ((clickUnit === 'dozen' && dozenOn) || (clickUnit === 'carton' && numPieces > 1))) ? clickUnit : 'piece',
      clickWeightGrams: isWeighted && clickGrams > 0 && clickGrams !== 1000 ? clickGrams : undefined,
      scanWeightGrams: isWeighted && scanGrams > 0 && scanGrams !== 1000 ? scanGrams : undefined,
      scanAsPieces: scanAsPieces && scanUnit !== 'piece' ? true : undefined,
      clickAsPieces: clickAsPieces && clickUnit !== 'piece' ? true : undefined,
      dozenLabel: dozenOn && !isWeighted && dozenLabel.trim() && dozenLabel.trim() !== 'درزن' ? dozenLabel.trim() : undefined,
      piecesPerDozen: dozenOn && !isWeighted && typeof piecesPerDozen === 'number' && piecesPerDozen > 1 ? piecesPerDozen : 0,
      isWeighted,
      notes: notes.trim(),
      ...(settings.enableProductExpiry === true ? { productionDate: productionDate || undefined, expiryDate: expiryDate || undefined } : {}),
      ...(trackBatches ? { expiryBatches: buildBatches() } : {}),
      stockNote: stockNote.trim(),
    };

    if (productToEdit) {
      updateProduct(productToEdit.id, productData);
    } else {
      const created = addProduct(productData);
      if (created?.id && pickedOffers.length) {
        const nowIso = new Date().toISOString();
        const promos = pickedOffers.map((i) => suggestedOffers[i]).filter(Boolean).map((o, k) => ({
          id: `promo_${Date.now()}_${k}`,
          kind: 'qty_discount' as const,
          productId: created.id,
          productName: created.name,
          active: true,
          discountType: o.discountType || 'amount',
          discountScope: o.discountScope || 'total',
          discountRepeat: o.discountRepeat !== false,
          discountValue: o.discountValue,
          buyQty: o.buyQty,
          createdAt: nowIso,
          updatedAt: nowIso,
        }));
        updateSettings({ promotions: [...((settings as any).promotions || []), ...promos] } as any);
      }
      if (pendingImage && created?.id) {
        saveProductImage(created.id, pendingImage).catch(() => {});
      }
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto"
        dir="rtl"
      >
        <div 
          className="bg-white dark:bg-[#0b1728] border border-slate-300 dark:border-slate-700/80 rounded-2xl w-full max-w-[1180px] shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ترويسة النافذة */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {productToEdit ? 'تعديل بيانات مادة' : 'إضافة مادة جديدة للمخزن'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {productToEdit ? 'تحديث الأسعار، الباركود أو الكميات المتوفرة' : 'تسجيل المادة في النظام وقاعدة البيانات السحابية'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            </div>
          </div>

          {imagesSupported() && (
            <ProductImageField
              preview={productToEdit ? existingThumb : pendingPreview}
              onFile={async (file) => {
                if (productToEdit) await saveProductImage(productToEdit.id, file);
                else setPendingImage(file);
              }}
              onClear={() => {
                if (productToEdit) removeProductImage(productToEdit.id).catch(() => {});
                else setPendingImage(null);
              }}
              onOpenPreview={productToEdit ? () => setImageModalOpen(true) : undefined}
            />
          )}

          {/* تنبيهات البحث التلقائي والتحقق */}
          {foundSuccessSource && (
            <div className="mx-5 mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                {foundSuccessSource === 'community'
                  ? 'تم العثور على اسم وتصنيف المادة من قاعدة بيانات المتاجر المشتركة!'
                  : foundSuccessSource === 'web'
                    ? 'لم تُوجد في القواعد المعتادة، فبحثنا عنها في جوجل وترجمنا اسمها للعربية. راجع الاسم قبل الحفظ.'
                    : 'تم جلب اسم المادة وترجمتها تلقائياً من قواعد البيانات العالمية!'}
              </span>
            </div>
          )}

          {notFoundMessage && (
            <div className="mx-5 mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
              <HelpCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{notFoundMessage}</span>
            </div>
          )}

          {validationError && (
            <div className="mx-5 mt-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{validationError}</span>
            </div>
          )}

          {/* أزرار اختيار مصدر الاستعلام التلقائي المفضّل */}
          {!productToEdit && (
            <div className="mx-5 mt-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
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
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
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
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
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
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3 max-h-[calc(100vh-130px)] overflow-y-auto custom-scrollbar">
            {/* قسم الباركود والاسم */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6 space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Barcode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>الباركود / كود المادة</span>
                  </span>
                  <div className="flex items-center gap-1">
                    {isAndroidApp() && (
                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 transition cursor-pointer"
                      title="مسح بالكاميرا"
                    >
                      <Camera className="w-3 h-3" />
                      <span>كاميرا</span>
                    </button>
                    )}
                    <button
                      type="button"
                      onClick={generateUniqueBarcode}
                      className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md flex items-center gap-1 transition cursor-pointer"
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
                    className="w-full bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono tracking-wider"
                  />
                  {isSearchingBarcode && (
                    <div className="absolute left-3 top-2.5 text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[11px]">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري البحث...</span>
                    </div>
                  )}
                </div>
                {(() => {
                  const dups = Array.from(new Set(allCodes({ code, extraCodes }).flatMap((c) => productsByCode(products as Product[], c).filter((p) => !productToEdit || p.id !== productToEdit.id).map((p) => p.name))));
                  return dups.length ? (
                    <div data-testid="dup-barcode-notice" className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg px-2 py-1">
                      💡 توجد مادة أخرى بنفس الباركود: {dups.join('، ')} — عند المسح سيُطلب منك الاختيار بين المواد.
                    </div>
                  ) : null;
                })()}
                <div className="flex flex-wrap items-center gap-1.5 pt-1" data-testid="extra-codes">
                  {extraCodes.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-[11px] font-mono">
                      {c}
                      <button type="button" onClick={() => setExtraCodes(extraCodes.filter((x) => x !== c))} className="text-rose-500 font-bold cursor-pointer">×</button>
                    </span>
                  ))}
                  <input
                    type="text"
                    data-testid="extra-code-input"
                    value={extraInput}
                    onChange={(e) => setExtraInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const t = extraInput.trim();
                        if (t) { setExtraCodes(allCodes({ code, extraCodes: [...extraCodes, t] }).slice(1)); setExtraInput(''); }
                      }
                    }}
                    placeholder="+ باركود إضافي (أي عدد) ثم Enter أو زر إضافة"
                    className="flex-1 min-w-[180px] bg-white dark:bg-[#060b13] border border-dashed border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button type="button" data-testid="extra-code-add"
                    onClick={() => { const t = extraInput.trim(); if (t) { setExtraCodes(allCodes({ code, extraCodes: [...extraCodes, t] }).slice(1)); setExtraInput(''); } }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 text-white cursor-pointer">+ إضافة</button>
                </div>
              </div>

              <div className="sm:col-span-6 space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>اسم المادة *</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    data-testid="product-name-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={() => setNameFocus(true)}
                    onBlur={() => setTimeout(() => setNameFocus(false), 150)}
                    placeholder="مثال: شاي الوزة 400 غرام"
                    autoComplete="off"
                    className="w-full bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                  {!productToEdit && nameFocus && nameHits.length > 0 && (
                    <div data-testid="name-hits" className="absolute z-30 right-0 left-0 top-full mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-[#0b1728] shadow-xl">
                      <div className="px-3 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40">من قاعدة المتاجر المشتركة — اختر لملء كل الحقول تلقائياً</div>
                      {(() => {
                        const groups = new Map<string, CatalogHit[]>();
                        nameHits.forEach((h) => {
                          const k = (h.name || '').trim().replace(/\s+/g, ' ').toLowerCase();
                          groups.set(k, [...(groups.get(k) || []), h]);
                        });
                        return Array.from(groups.entries()).map(([k, hits]) => {
                          const h = hits[0];
                          if (hits.length === 1) {
                            const exists = (/^\d{6,15}$/.test(String(h.barcode || '')) && products.some((p: any) => allCodes(p).includes(h.barcode)));
                            return (
                              <button type="button" key={k} disabled={exists}
                                onMouseDown={(e) => { e.preventDefault(); applyCatalog(h); }}
                                className="w-full text-right px-3 py-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer">
                                <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{h.name}</span>
                                <span className="text-[10px] font-mono text-slate-500 shrink-0">{exists ? 'مضافة عندك' : (/^\d{6,15}$/.test(String(h.barcode || '')) ? h.barcode : 'بدون باركود')}</span>
                              </button>
                            );
                          }
                          return (
                            <div key={k} className="border-t border-slate-100 dark:border-slate-800" data-testid="name-hit-multi">
                              <button type="button"
                                onMouseDown={(e) => { e.preventDefault(); setCatPick(catPick === k ? null : k); }}
                                className="w-full text-right px-3 py-2 flex items-center justify-between gap-2 hover:bg-emerald-50 dark:hover:bg-slate-800 cursor-pointer">
                                <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{h.name}</span>
                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 shrink-0">{hits.length} باركودات ▾</span>
                              </button>
                              {catPick === k && (
                                <button type="button" data-testid="catalog-add-all"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    const free = hits.filter((x) => !(/^\d{6,15}$/.test(String(x.barcode || '')) && products.some((p: any) => allCodes(p).includes(x.barcode))));
                                    if (!free.length) return;
                                    applyCatalog(free[0]);
                                    setExtraCodes(free.slice(1).map((x) => x.barcode).filter((c) => /^\d{6,15}$/.test(String(c || ''))));
                                    setCatPick(null);
                                  }}
                                  className="w-full text-right pr-6 pl-3 py-1.5 text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 cursor-pointer">
                                  ✚ إضافة كل الباركودات ({hits.length}) لهذه المادة
                                </button>
                              )}
                              {catPick === k && hits.map((x) => {
                                const exists = (/^\d{6,15}$/.test(String(x.barcode || '')) && products.some((p: any) => allCodes(p).includes(x.barcode)));
                                return (
                                  <button type="button" key={x.barcode} disabled={exists}
                                    onMouseDown={(e) => { e.preventDefault(); applyCatalog(x); setCatPick(null); }}
                                    className="w-full text-right pr-6 pl-3 py-1.5 flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/60 hover:bg-emerald-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer">
                                    <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{x.barcode}</span>
                                    <span className="text-[10px] text-slate-500">{exists ? 'مضافة عندك' : (x.retail_price ? `${x.retail_price} · ` : '') + (x.stores_count ? `${x.stores_count} متجر` : '')}</span>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* التصنيف، الوحدة، وميزة الوزن */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>القسم / التصنيف</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="category-suggestions"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    placeholder="اختر أو اكتب قسماً..."
                  />
                  <datalist id="category-suggestions">
                    {existingCategories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                {canAddCategory && (
                  <button
                    type="button"
                    onClick={() => saveNewCategory()}
                    className="w-full text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    ＋ حفظ «{category.trim()}» كقسم جديد
                  </button>
                )}
                {savedCats.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {savedCats.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1 text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full ps-2 pe-1 py-0.5">
                        <button type="button" onClick={() => setCategory(c)} className="hover:text-emerald-600">{c}</button>
                        <button type="button" title="حذف القسم من القائمة" onClick={() => removeSavedCategory(c)} className="w-4 h-4 rounded-full hover:bg-red-500 hover:text-white leading-none">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Box className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>الوحدة الأساسية</span>
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
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
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 invisible sm:block">خيارات</label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !isWeighted;
                    setIsWeighted(next);
                    if (next && unit === 'قطعة') setUnit('كغم');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    isWeighted
                      ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500/50 text-amber-700 dark:text-amber-300'
                      : 'bg-white dark:bg-[#060b13] border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>مادة وزنية (ميزان)</span>
                  </span>
                  <span className={`w-2.5 h-2.5 rounded-full ${isWeighted ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Box className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>تعبئة الكرتون (قطعة/كرتون)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={piecesPerCarton}
                  onChange={(e) => {
                    const v = e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1);
                    handlePiecesPerCartonUpdate(v);
                  }}
                  className="w-full bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-bold"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {numPieces > 1 ? `كل كرتون = ${numPieces} ${unit}` : 'يباع بالقطعة فقط'}
                </p>
                {!productToEdit && suggestedOffers.length > 0 && (
                  <button
                    type="button"
                    data-testid="suggest-offers"
                    onClick={() => setOffersOpen(true)}
                    className="w-full mt-1 px-3 py-1.5 rounded-lg bg-gradient-to-l from-fuchsia-600 to-pink-500 text-white text-[11px] font-black cursor-pointer"
                  >
                    🏷️ عروض وخصومات مقترحة ({suggestedOffers.length}){pickedOffers.length ? ` — اخترت ${pickedOffers.length}` : ''}
                  </button>
                )}
              </div>
            </div>

            {/* فئة وسطية اختيارية: الدرزن */}
            {!isWeighted && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#070e1b] px-3 py-2.5 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                  <input type="checkbox" checked={dozenOn} onChange={(e) => setDozenOn(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                  <span>تفعيل فئة وسطية ثالثة (قطعة ← {dozenLabel.trim() || 'درزن'} ← كرتون)</span>
                </label>
                {dozenOn && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">اسم الفئة:</span>
                    <input
                      type="text"
                      list="dozen-label-options"
                      value={dozenLabel}
                      onChange={(e) => setDozenLabel(e.target.value)}
                      maxLength={20}
                      placeholder="درزن"
                      className="w-24 bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                    <datalist id="dozen-label-options">
                      {['درزن', 'علبة', 'باكيت', 'شد', 'ربطة', 'طبقة', 'حزمة', 'نصف كرتون'].map((x) => <option key={x} value={x} />)}
                    </datalist>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">عدد القطع في {dozenLabel.trim() || 'الدرزن'}:</span>
                    <input
                      type="number"
                      min="2"
                      value={piecesPerDozen}
                      onChange={(e) => setPiecesPerDozen(e.target.value === '' ? '' : Math.max(2, parseInt(e.target.value) || 2))}
                      className="w-24 bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">الافتراضي 12 ويمكن تغييره. أزل العلامة لإبقاء فئتين فقط (قطعة وكرتون).</span>
                  </div>
                )}
              </div>
            )}

            {/* وحدة البيع الافتراضية عند مسح الباركود وعند الضغط (منفصلتان) */}
            {!isWeighted && (numPieces > 1 || dozenOn) && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#070e1b] px-3 py-2.5 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">عند الضغط على المادة تُضاف بوحدة:</span>
                <select
                  value={clickUnit === 'dozen' && !dozenOn ? 'piece' : clickUnit === 'carton' && numPieces <= 1 ? 'piece' : clickUnit}
                  onChange={(e) => setClickUnit(e.target.value as 'piece' | 'dozen' | 'carton')}
                  className="bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="piece">قطعة</option>
                  {dozenOn && <option value="dozen">{dozenLabel.trim() || 'درزن'}</option>}
                  {numPieces > 1 && <option value="carton">كرتون</option>}
                </select>
                {clickUnit !== 'piece' && (
                  <select
                    data-testid="click-as"
                    value={clickAsPieces ? 'pieces' : 'unit'}
                    onChange={(e) => setClickAsPieces(e.target.value === 'pieces')}
                    className="bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="unit">كوحدة واحدة ({clickUnit === 'carton' ? 'كرتون' : (dozenLabel.trim() || 'درزن')})</option>
                    <option value="pieces">كعدد قطع ({clickUnit === 'carton' ? numPieces : (piecesPerDozen || 12)} قطعة)</option>
                  </select>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">عند مسح الباركود تُضاف بوحدة:</span>
                <select
                  value={scanUnit === 'dozen' && !dozenOn ? 'piece' : scanUnit === 'carton' && numPieces <= 1 ? 'piece' : scanUnit}
                  onChange={(e) => setScanUnit(e.target.value as 'piece' | 'dozen' | 'carton')}
                  className="bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="piece">قطعة</option>
                  {dozenOn && <option value="dozen">{dozenLabel.trim() || 'درزن'}</option>}
                  {numPieces > 1 && <option value="carton">كرتون</option>}
                </select>
                {scanUnit !== 'piece' && (
                  <select
                    data-testid="scan-as"
                    value={scanAsPieces ? 'pieces' : 'unit'}
                    onChange={(e) => setScanAsPieces(e.target.value === 'pieces')}
                    className="bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="unit">كوحدة واحدة ({scanUnit === 'carton' ? 'كرتون' : (dozenLabel.trim() || 'درزن')})</option>
                    <option value="pieces">كعدد قطع ({scanUnit === 'carton' ? numPieces : (piecesPerDozen || 12)} قطعة)</option>
                  </select>
                )}
                <span className="text-[11px] text-slate-500 dark:text-slate-400">تُضاف بها المادة أول مرة، ويمكنك تغيير الوحدة لاحقاً من أزرار السطر.</span>
              </div>
              </div>
            )}

            {isWeighted && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#070e1b] px-3 py-2.5 space-y-2" data-testid="weighted-defaults">
                <div className="flex items-center gap-1.5 flex-wrap" data-testid="weighted-click">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 w-48">عند الضغط على المادة يُضاف:</span>
                  {[100, 250, 500, 1000].map((g) => (
                    <button key={g} type="button" onClick={() => setClickGrams(g)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${clickGrams === g ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-[#060b13] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'}`}>
                      {g === 1000 ? 'كيلو' : g === 500 ? 'نصف كيلو' : g + ' غرام'}
                    </button>
                  ))}
                  <input type="number" inputMode="numeric" min={0} step="any" value={clickGrams} onChange={(e) => setClickGrams(Math.max(0, Number(e.target.value) || 0))}
                    className="w-20 bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-emerald-500" />
                  <span className="text-[11px] text-slate-500">غرام</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap" data-testid="weighted-scan">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 w-48">عند مسح الباركود يُضاف:</span>
                  {[100, 250, 500, 1000].map((g) => (
                    <button key={g} type="button" onClick={() => setScanGrams(g)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${scanGrams === g ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-[#060b13] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'}`}>
                      {g === 1000 ? 'كيلو' : g === 500 ? 'نصف كيلو' : g + ' غرام'}
                    </button>
                  ))}
                  <input type="number" inputMode="numeric" min={0} step="any" value={scanGrams} onChange={(e) => setScanGrams(Math.max(0, Number(e.target.value) || 0))}
                    className="w-20 bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-center focus:outline-none focus:border-emerald-500" />
                  <span className="text-[11px] text-slate-500">غرام</span>
                </div>
              </div>
            )}

            {/* بطاقات التسعير */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold px-1 text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>تسعير المادة ({priceCurrency === 'USD' ? 'دولار $' : (settings.currency || 'د.ع')})</span>
                  {showCurrencyChoice && (
                    <span className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg mr-2">
                      {(['IQD', 'USD'] as const).map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => switchCurrency(c)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${priceCurrency === c ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                        >
                          {c === 'IQD' ? 'دينار' : 'دولار $'}
                        </button>
                      ))}
                    </span>
                  )}
                </span>
                {canViewCost && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                    الربح: {priceCurrency === 'USD' ? `$${profitPerPiece.toFixed(2)}` : formatMoney(profitPerPiece)} ({profitMarginPercent}%)
                  </span>
                )}
              </div>

              {priceCurrency === 'USD' && (
                <div className="text-[11px] px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 font-semibold">
                  السعر محفوظ بالدولار ويُباع بالدينار بسعر التصريف (1 $ = {usdRate} {settings.currency || 'دينار'}).
                  {numRetail > 0 && <span> سعر المفرد بالدينار: {formatMoney(Math.round(numRetail * usdRate))}</span>}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" data-testid="update-price-btn" disabled={priceBusy} onClick={updatePriceFromCatalog} className="px-3 py-1.5 rounded-lg text-[11px] font-black bg-sky-600 hover:bg-sky-500 text-white cursor-pointer disabled:opacity-60">
                  {priceBusy ? '...' : '🔄 تحديث السعر من الكتالوج'}
                </button>
                {priceMsg && <span data-testid="update-price-msg" className={`text-[11px] font-bold ${priceMsg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>{priceMsg.text}</span>}
              </div>

              <div className={`grid grid-cols-1 sm:grid-cols-2 ${canViewCost ? 'xl:grid-cols-5' : 'xl:grid-cols-4'} gap-2.5`}>
                {/* 1. بطاقة سعر التكلفة / الشراء */}
                {canViewCost && (
                  <div className="bg-slate-50 dark:bg-[#070e1b] border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800/80">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">1. سعر التكلفة / الشراء</span>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/70 px-2 py-0.5 rounded-md">
                        رأس المال
                      </span>
                    </div>

                    {numPieces > 1 && (
                      <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block text-right">
                          سعر الكرتون الكامل:
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={cartonCostInput}
                            onChange={(e) => handleCartonCostChange(e.target.value)}
                            placeholder="0"
                            className="w-full bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-lg py-1.5 pr-3 pl-12 text-sm text-slate-900 dark:text-white font-mono font-semibold focus:outline-none focus:border-emerald-500 text-left"
                          />
                          <span className="absolute left-2.5 top-2 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                            {curLabel}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-2.5 space-y-1">
                      <label className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block text-right">
                        {numPieces > 1 ? `تكلفة القطعة (${numPieces} ق):` : 'سعر الشراء للقطعة:'}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={pieceCostInput}
                          onChange={(e) => handlePieceCostChange(e.target.value)}
                          placeholder="0"
                          className="w-full bg-white dark:bg-[#060b13] border border-emerald-500/40 rounded-lg py-1.5 pr-3 pl-12 text-sm text-emerald-600 dark:text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-400 text-left"
                        />
                        <span className="absolute left-2.5 top-2 text-[10px] text-emerald-500/80 font-bold">
                          {curLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. بطاقة سعر بيع المفرد */}
                <div className="bg-slate-50 dark:bg-[#070e1b] border border-emerald-500/40 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-emerald-500/20">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span>2. سعر بيع المفرد *</span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                      تجزئة
                    </span>
                  </div>

                  {numPieces > 1 && (
                    <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block text-right">
                        سعر بيع الكرتون:
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={cartonRetailInput}
                          onChange={(e) => handleCartonRetailChange(e.target.value)}
                          placeholder="0"
                          className="w-full bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-lg py-1.5 pr-3 pl-12 text-sm text-slate-900 dark:text-white font-mono font-semibold focus:outline-none focus:border-emerald-500 text-left"
                        />
                        <span className="absolute left-2.5 top-2 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                          {curLabel}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-500/30 rounded-xl p-2.5 space-y-1">
                    <label className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 block text-right">
                      {numPieces > 1 ? `سعر بيع القطعة (${numPieces} ق):` : 'سعر بيع المفرد للقطعة:'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        value={pieceRetailInput}
                        onChange={(e) => handlePieceRetailChange(e.target.value)}
                        placeholder="0"
                        className="w-full bg-white dark:bg-[#060b13] border border-blue-500/50 rounded-lg py-1.5 pr-3 pl-12 text-sm text-blue-600 dark:text-blue-400 font-mono font-bold focus:outline-none focus:border-blue-400 text-left"
                      />
                      <span className="absolute left-2.5 top-2 text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                        {curLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. بطاقة سعر بيع الجملة */}
                {priceTypeOn('wholesale') && (
                <div className="bg-slate-50 dark:bg-[#070e1b] border border-amber-500/30 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-amber-500/20">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                      <span>3. سعر بيع الجملة</span>
                    </span>
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-md">
                      اختياري
                    </span>
                  </div>

                  {numPieces > 1 && (
                    <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block text-right">
                        بيع كرتون (جملة):
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={cartonWholesaleInput}
                          onChange={(e) => handleCartonWholesaleChange(e.target.value)}
                          placeholder="0"
                          className="w-full bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-lg py-1.5 pr-3 pl-12 text-sm text-slate-900 dark:text-white font-mono font-semibold focus:outline-none focus:border-amber-500 text-left"
                        />
                        <span className="absolute left-2.5 top-2 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                          {curLabel}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-500/30 rounded-xl p-2.5 space-y-1">
                    <label className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 block text-right">
                      {numPieces > 1 ? `بيع قطعة (جملة ${numPieces} ق):` : 'سعر بيع الجملة للقطعة:'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={pieceWholesaleInput}
                        onChange={(e) => handlePieceWholesaleChange(e.target.value)}
                        placeholder="0"
                        className="w-full bg-white dark:bg-[#060b13] border border-purple-500/40 rounded-lg py-1.5 pr-3 pl-12 text-sm text-purple-700 dark:text-purple-300 font-mono font-bold focus:outline-none focus:border-purple-400 text-left"
                      />
                      <span className="absolute left-2.5 top-2 text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                        {curLabel}
                      </span>
                    </div>
                  </div>
                </div>
                )}

                {priceTypeOn('superWholesale') && settings.showSuperWholesale !== false && (
                <div className="bg-slate-50 dark:bg-[#070e1b] border border-orange-500/30 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-orange-500/20">
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                      <span>4. سعر جملة الجملة</span>
                    </span>
                    <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 border border-orange-500/30 px-2 py-0.5 rounded-md">
                      اختياري
                    </span>
                  </div>

                  {numPieces > 1 && (
                    <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block text-right">
                        بيع كرتون (جملة الجملة)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={cartonSuperInput}
                          onChange={(e) => superHandlers.onCarton(e.target.value)}
                          placeholder="غير محدد"
                          className="w-full bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-lg py-1.5 pr-3 pl-12 text-sm text-slate-900 dark:text-white font-mono font-semibold focus:outline-none focus:border-orange-500 text-left"
                        />
                        <span className="absolute left-2.5 top-2 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                          {curLabel}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-500/30 rounded-xl p-2.5 space-y-1">
                    <label className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 block text-right">
                      {numPieces > 1 ? `بيع قطعة (جملة الجملة ${numPieces} ق):` : 'سعر جملة الجملة للقطعة:'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={superWholesaleInput}
                        onChange={(e) => superHandlers.onPiece(e.target.value)}
                        placeholder="غير محدد"
                        className="w-full bg-white dark:bg-[#060b13] border border-orange-500/40 rounded-lg py-1.5 pr-3 pl-12 text-sm text-orange-700 dark:text-orange-300 font-mono font-bold focus:outline-none focus:border-orange-400 text-left"
                      />
                      <span className="absolute left-2.5 top-2 text-[10px] text-orange-600 dark:text-orange-400 font-bold">
                        {curLabel}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 text-right">إن تُرك فارغاً يُباع بسعر الجملة.</p>
                  </div>
                </div>
                )}

                {priceTypeOn('special') && settings.showSpecialPrice !== false && (
                <div className="bg-slate-50 dark:bg-[#070e1b] border border-violet-500/30 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-violet-500/20">
                    <span className="text-xs font-bold text-violet-600 dark:text-violet-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                      <span>5. السعر الخاص</span>
                    </span>
                    <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/60 border border-violet-500/30 px-2 py-0.5 rounded-md">
                      اختياري
                    </span>
                  </div>

                  {numPieces > 1 && (
                    <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block text-right">
                        بيع كرتون (السعر الخاص)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={cartonSpecialInput}
                          onChange={(e) => specialHandlers.onCarton(e.target.value)}
                          placeholder="غير محدد"
                          className="w-full bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-lg py-1.5 pr-3 pl-12 text-sm text-slate-900 dark:text-white font-mono font-semibold focus:outline-none focus:border-violet-500 text-left"
                        />
                        <span className="absolute left-2.5 top-2 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                          {curLabel}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-500/30 rounded-xl p-2.5 space-y-1">
                    <label className="text-[11px] font-semibold text-violet-700 dark:text-violet-300 block text-right">
                      {numPieces > 1 ? `بيع قطعة (السعر الخاص ${numPieces} ق):` : 'السعر الخاص للقطعة:'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={specialPriceInput}
                        onChange={(e) => specialHandlers.onPiece(e.target.value)}
                        placeholder="غير محدد"
                        className="w-full bg-white dark:bg-[#060b13] border border-violet-500/40 rounded-lg py-1.5 pr-3 pl-12 text-sm text-violet-700 dark:text-violet-300 font-mono font-bold focus:outline-none focus:border-violet-400 text-left"
                      />
                      <span className="absolute left-2.5 top-2 text-[10px] text-violet-600 dark:text-violet-400 font-bold">
                        {curLabel}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 text-right">إن تُرك فارغاً يُباع بسعر المفرد.</p>
                  </div>
                </div>
                )}

              </div>
            </div>

            {/* الرصيد الحالي وحد الطلب الأدنى */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>الرصيد المتوفر في المخزن ({unit})</span>
                  {numPieces > 1 && (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      يعادل: {Math.floor(numStock / numPieces)} كرتون و {numStock % numPieces} {unit}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  step={isWeighted ? '0.001' : '1'}
                  value={stock}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : (isNaN(parseFloat(e.target.value)) ? '' : parseFloat(e.target.value));
                    setStock(val);
                  }}
                  className="w-full bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ملاحظة هذه الإضافة (تظهر في تاريخ حركة المادة)
                </label>
                <input
                  type="text"
                  value={stockNote}
                  onChange={(e) => setStockNote(e.target.value)}
                  placeholder="مثال: اشتريت من محلات الجملة / من المندوب..."
                  className="w-full bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  حد التنبيه الأدنى (تنبيه قرب النفاد)
                </label>
                <input
                  type="number"
                  min="0"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                  className="w-full bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            {settings.enableProductExpiry === true && (
              <div className="space-y-2 sm:col-span-2 lg:col-span-3 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20">
                <div className="text-xs font-bold text-amber-800 dark:text-amber-300">تاريخ الإنتاج وانتهاء الصلاحية (اختياري)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">تاريخ الإنتاج</label>
                    <input
                      type="date"
                      value={productionDate}
                      onChange={(e) => {
                        const v = e.target.value;
                        setProductionDate(v);
                        if (v && !expiryDate) applyShelfLife(v, '', shelfNum, shelfUnit);
                      }}
                      className="w-full bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">تاريخ انتهاء الصلاحية</label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => {
                        const v = e.target.value;
                        setExpiryDate(v);
                        if (v && !productionDate) applyShelfLife('', v, shelfNum, shelfUnit);
                      }}
                      className="w-full bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">مدة الصلاحية</label>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={shelfAmount}
                        onChange={(e) => setShelfAmount(e.target.value)}
                        placeholder="مثلاً 12"
                        className="w-24 bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                      <select
                        value={shelfUnit}
                        onChange={(e) => setShelfUnit(e.target.value as ShelfUnit)}
                        className="bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-xl px-2 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="day">يوم</option>
                        <option value="month">شهر</option>
                        <option value="year">سنة</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyShelfLife(productionDate, expiryDate, shelfNum, shelfUnit)}
                    disabled={!(shelfNum > 0) || (!productionDate && !expiryDate)}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40"
                  >
                    احسب التاريخ الناقص
                  </button>
                  {(productionDate || expiryDate) && (
                    <button
                      type="button"
                      onClick={() => { setProductionDate(''); setExpiryDate(''); }}
                      className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    >
                      مسح التواريخ
                    </button>
                  )}
                </div>
                {trackBatches && differingQty > 0 && (
                  <div className="rounded-xl border border-orange-300 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 p-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-orange-800 dark:text-orange-300">
                        {differingQty} {unit || 'قطعة'} صلاحيتها تختلف
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowBatches(v => !v)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        {showBatches ? 'إخفاء' : 'إظهار'}
                      </button>
                    </div>
                    {showBatches && (
                      <div className="space-y-1">
                        {currentBatches.map(b => {
                          const left = daysUntil(b.expiryDate);
                          return (
                            <div key={b.id} className="flex flex-wrap items-center justify-between gap-1 bg-white dark:bg-[#060b13] border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-700 dark:text-slate-200">
                              <span className="font-bold">{b.qty} {unit || 'قطعة'}</span>
                              <span>إنتاج: {b.productionDate || '—'}</span>
                              <span>انتهاء: {b.expiryDate || '—'}</span>
                              {left !== null && (
                                <span className={`font-bold ${left < 0 ? 'text-red-600' : left <= 30 ? 'text-orange-600' : 'text-emerald-600'}`}>
                                  {left < 0 ? `منتهية منذ ${-left} يومًا` : `متبقي ${left} يومًا`}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  أدخل أحد التاريخين مع مدة الصلاحية ويُملأ الآخر تلقائيًا، أو اتركهما فارغين.
                  {expiryDaysLeft !== null && (
                    <span className={`font-bold mr-1 ${expiryDaysLeft < 0 ? 'text-red-600' : expiryDaysLeft <= 30 ? 'text-orange-600' : 'text-emerald-600'}`}>
                      {expiryDaysLeft < 0 ? `منتهية منذ ${-expiryDaysLeft} يومًا` : `متبقي ${expiryDaysLeft} يومًا`}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">ملاحظات إضافية (اختياري)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مكان الرف، المورد، أو أي معلومات..."
                className="w-full bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            </div>

            {/* أزرار الحفظ والإلغاء */}
            <div className="flex items-center gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
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
                className="px-5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>

      {imageModalOpen && productToEdit && (
        <ProductImageModal product={productToEdit} onClose={() => setImageModalOpen(false)} />
      )}
      {offersOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-3" dir="rtl" data-testid="offers-panel">
          <div className="bg-white dark:bg-[#0b1728] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-xl p-5 space-y-3 max-h-[90vh] overflow-y-auto overscroll-contain">
            <h4 className="font-black text-base text-slate-900 dark:text-white">🏷️ عروض وخصومات مقترحة لـ «{name}»</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">عروض تطبّقها متاجر أخرى على هذه المادة. اضغط على ما يعجبك (يمكن اختيار أكثر من عرض)، وتُضاف عند حفظ المادة.</p>
            <div className="grid grid-cols-2 gap-2">
              {suggestedOffers.map((o, i) => {
                const on = pickedOffers.includes(i);
                const total = offersRetail > 0 && o.discountType !== 'percent' ? o.buyQty * offersRetail - (o.discountScope === 'per_piece' ? o.discountValue * o.buyQty : o.discountValue) : null;
                return (
                  <button
                    type="button"
                    key={i}
                    data-testid={`offer-card-${i}`}
                    onClick={() => setPickedOffers((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))}
                    className={`p-3 rounded-xl border-2 text-right cursor-pointer transition ${on ? 'border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/30' : 'border-slate-200 dark:border-slate-700 hover:border-fuchsia-300'}`}
                  >
                    <div className="text-sm font-black text-slate-900 dark:text-white">{o.buyQty} قطع{total !== null ? ` بـ ${formatMoney(total)}` : ''}</div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      {o.discountType === 'percent' ? `خصم ${o.discountValue}%` : `خصم ${formatMoney(o.discountValue)}${o.discountScope === 'per_piece' ? ' لكل قطعة' : ''}`}{o.discountRepeat !== false ? ' لكل مجموعة' : ''}
                    </div>
                    {!!o.stores && <div className="text-[10px] text-slate-400 mt-0.5">تطبّقه {o.stores} متجر</div>}
                    {on && <div className="text-[10px] font-black text-fuchsia-700 mt-1">✓ مختار</div>}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" data-testid="offers-cancel" onClick={() => { setPickedOffers([]); setOffersOpen(false); }} className="px-4 py-2 rounded-lg bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer">إلغاء</button>
              <button type="button" data-testid="offers-ok" onClick={() => setOffersOpen(false)} className="px-4 py-2 rounded-lg bg-fuchsia-600 text-white text-xs font-black cursor-pointer">اعتماد المحدد</button>
            </div>
          </div>
        </div>
      )}
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
