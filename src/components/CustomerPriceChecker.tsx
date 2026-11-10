import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Search, Camera, RefreshCw, CheckCircle, X, QrCode, AlertTriangle } from 'lucide-react';

import { supabaseUrl as SUPABASE_URL, supabaseAnonKey as SUPABASE_ANON_KEY } from '../supabase';
import { parseCheckerToken, priceForLevel, stockLevelOf, STOCK_COLOR_DEFAULTS, CHECKER_LEVEL_LABELS } from '../utils/checkerLinks';

interface ProductItem {
  id: string;
  name: string;
  barcode: string;
  price: number;
  wholesalePrice?: number;
  superWholesalePrice?: number;
  specialPrice?: number;
  stock?: number;
}

interface StockConfig {
  mode: 'none' | 'count' | 'colors';
  redMax: number;
  yellowMax: number;
  fallbackSuper?: 'wholesale' | 'retail' | 'none';
  fallbackSpecial?: 'wholesale' | 'retail' | 'none';
  /** مستويات الأسعار المفعّلة لدى المتجر (المفرد دائماً مفعّل) */
  levels?: { wholesale: boolean; superWholesale: boolean; special: boolean };
}
const DEFAULT_STOCK_CONFIG: StockConfig = { mode: 'none', ...STOCK_COLOR_DEFAULTS };

const STOCK_BADGE: Record<'gray' | 'red' | 'yellow' | 'green', { label: string; cls: string; dot: string }> = {
  gray: { label: 'غير متوفر', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/40', dot: 'bg-slate-400' },
  red: { label: 'كمية قليلة', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/40', dot: 'bg-rose-500' },
  yellow: { label: 'كمية متوسطة', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40', dot: 'bg-amber-400' },
  green: { label: 'متوفر', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', dot: 'bg-emerald-500' },
};

// دالة فك التشفير الآمنة لـ base64 مع دعم النصوص العربية واليونيكود
const decodeStoreToken = (raw: string | null | undefined): string => {
  if (!raw) return '';
  const token = raw.trim().replace(/^#/, '');
  if (!token) return '';
  try {
    if (token.startsWith('store_') || token.startsWith('user_')) {
      return token;
    }
    return decodeURIComponent(escape(atob(token))) || token;
  } catch {
    try {
      return atob(token) || token;
    } catch {
      return token;
    }
  }
};

export const CustomerPriceChecker: React.FC<{ storeId?: string | null }> = ({ storeId: initialStoreId }) => {
  // تتبع الهاش المتغير في شريط العنوان
  const [currentHashToken, setCurrentHashToken] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.location.hash.replace(/^#/, '').trim();
  });

  useEffect(() => {
    const handleHashChange = () => {
      const h = window.location.hash.replace(/^#/, '').trim();
      setCurrentHashToken(h);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // استخلاص معرف المتجر النهائي مع فك التشفير إن وجد
  const levelSource = (() => {
    if (currentHashToken) return currentHashToken;
    try {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('k') || sp.get('store') || '';
    } catch { return ''; }
  })();
  const priceLevel = parseCheckerToken(levelSource).level;
  const rawTargetToken = initialStoreId || parseCheckerToken(currentHashToken).token;
  const resolvedStoreId = decodeStoreToken(rawTargetToken);
  const [stockCfg, setStockCfg] = useState<StockConfig>(() => {
    try {
      const raw = localStorage.getItem(`cache_checker_cfg_${decodeStoreToken(initialStoreId || parseCheckerToken(window.location.hash).token)}`);
      if (raw) return { ...DEFAULT_STOCK_CONFIG, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_STOCK_CONFIG;
  });

  const [storeName, setStoreName] = useState<string>('جاري التحميل...');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState<boolean>(!!resolvedStoreId);
  const [isDisabledByAdmin, setIsDisabledByAdmin] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [scannedProduct, setScannedProduct] = useState<ProductItem | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // جلب بيانات المتجر من Supabase عند وجود معرف صالح
  useEffect(() => {
    let isCancelled = false;

    async function loadCatalog() {
      if (!resolvedStoreId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const cleanStore = resolvedStoreId.trim().replace(/^store_/, '');

      // فحص القيود المحلية والكاش أولاً لسرعة الظهور
      try {
        const cachedDisabled = localStorage.getItem(`cache_checker_disabled_${resolvedStoreId}`);
        if (cachedDisabled === 'true') {
          setIsDisabledByAdmin(true);
        }
        const localSettingsRaw = localStorage.getItem('cached_pos_settings');
        if (localSettingsRaw) {
          const ls = JSON.parse(localSettingsRaw);
          if (ls.enableCustomerPriceChecker === false) {
            setIsDisabledByAdmin(true);
          }
        }
        const localSessionRaw = localStorage.getItem('active_client_session');
        if (localSessionRaw) {
          const lu = JSON.parse(localSessionRaw);
          if (lu.enableCustomerPriceChecker === false) {
            setIsDisabledByAdmin(true);
          }
        }
      } catch {}
      
      // فحص الذاكرة المؤقتة للمواد
      try {
        const cachedCatalog = localStorage.getItem(`cache_catalog_${resolvedStoreId}`);
        const cachedName = localStorage.getItem(`cache_name_${resolvedStoreId}`);
        if (cachedCatalog) {
          const parsed = JSON.parse(cachedCatalog);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProducts(parsed);
            if (cachedName) setStoreName(cachedName);
          }
        }
      } catch {}

      const candidateDocIds = Array.from(new Set([
        `store_${cleanStore}`,
        resolvedStoreId.trim(),
        cleanStore,
        `store_user_${cleanStore}`,
        `user_${cleanStore}`,
        `user_${cleanStore.replace(/^user_/, '')}`
      ].filter(Boolean)));

      let foundData: any = null;

      for (const docId of candidateDocIds) {
        if (isCancelled) break;
        try {
          const response = await fetch(
            `${SUPABASE_URL}/rest/v1/documents?id=eq.${encodeURIComponent(docId)}&select=id,data`,
            {
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
            }
          );

          if (response.ok) {
            const rows = await response.json();
            if (rows && rows.length > 0 && rows[0]?.data) {
              foundData = rows[0].data;
              break;
            }
          }
        } catch (err) {
          console.warn('Error fetching store document candidate:', docId, err);
        }
      }

      if (isCancelled) return;

      if (foundData) {
        const name = foundData.settings?.storeName || foundData.storeName || cleanStore;
        setStoreName(name);

        // التحقق الدقيق من قيد تعطيل ميزة قارئ الأسعار من قبل الإدارة
        const isCheckerEnabled = 
          foundData.enableCustomerPriceChecker !== false &&
          foundData.settings?.enableCustomerPriceChecker !== false &&
          foundData.user?.enableCustomerPriceChecker !== false;

        if (!isCheckerEnabled) {
          setIsDisabledByAdmin(true);
          try {
            localStorage.setItem(`cache_checker_disabled_${resolvedStoreId}`, 'true');
          } catch {}
          setLoading(false);
          return;
        } else {
          setIsDisabledByAdmin(false);
          try {
            localStorage.removeItem(`cache_checker_disabled_${resolvedStoreId}`);
          } catch {}
        }

        const st = foundData.settings || {};
        const cfg: StockConfig = {
          mode: st.checkerStockMode === 'count' || st.checkerStockMode === 'colors' ? st.checkerStockMode : 'none',
          redMax: Number(st.checkerRedMax) > 0 ? Number(st.checkerRedMax) : STOCK_COLOR_DEFAULTS.redMax,
          yellowMax: Number(st.checkerYellowMax) > 0 ? Number(st.checkerYellowMax) : STOCK_COLOR_DEFAULTS.yellowMax,
        };
        if (cfg.yellowMax <= cfg.redMax) cfg.yellowMax = cfg.redMax + 1;
        cfg.fallbackSuper = st.checkerFallbackSuper;
        cfg.fallbackSpecial = st.checkerFallbackSpecial;
        const adminOn = (k: string) =>
          st[k] !== false && (foundData as any)[k] !== false && (foundData as any).user?.[k] !== false;
        const wsOn = adminOn('enableWholesalePrice');
        const spOn = adminOn('enableSpecialPrice');
        cfg.levels = {
          wholesale: !!st.enableWholesale && wsOn,
          superWholesale: !!st.enableWholesale && wsOn && st.showSuperWholesale !== false,
          special: !!st.enableWholesale && spOn && st.showSpecialPrice !== false,
        };
        setStockCfg(cfg);
        try { localStorage.setItem(`cache_checker_cfg_${resolvedStoreId}`, JSON.stringify(cfg)); } catch {}

        const itemMap = new Map<string, ProductItem>();

        // 1. استخراج المواد المباشرة
        if (Array.isArray(foundData.products)) {
          foundData.products.forEach((p: any) => {
            const code = String(p.barcode || p.code || p.id || '').trim();
            const pName = String(p.name || p.productName || 'مادة').trim();
            const price = Number(p.price ?? p.retailPrice ?? p.unitPrice ?? 0);
            if (code || pName) {
              const key = code || pName;
              itemMap.set(key, {
                id: String(p.id || key),
                name: pName,
                barcode: code,
                price,
                wholesalePrice: Number(p.wholesalePrice) || undefined,
                superWholesalePrice: Number(p.superWholesalePrice) || undefined,
                specialPrice: Number(p.specialPrice) || undefined,
                stock: typeof p.stock === 'number' ? p.stock : undefined,
              });
            }
          });
        }

        // 2. استخراج المواد من الفواتير لضمان شمولية الأصناف
        if (Array.isArray(foundData.invoices)) {
          foundData.invoices.forEach((inv: any) => {
            if (Array.isArray(inv.items)) {
              inv.items.forEach((item: any) => {
                const code = String(item.code || item.barcode || item.productId || '').trim();
                const pName = String(item.productName || item.name || '').trim();
                const price = Number(item.unitPrice ?? item.price ?? item.retailPrice ?? 0);
                const key = code || pName;
                if (key && !itemMap.has(key)) {
                  itemMap.set(key, { id: String(item.productId || key), name: pName || 'مادة', barcode: code, price });
                }
              });
            }
          });
        }

        const uniqueList = Array.from(itemMap.values());
        setProducts(uniqueList);

        try {
          localStorage.setItem(`cache_catalog_${resolvedStoreId}`, JSON.stringify(uniqueList));
          localStorage.setItem(`cache_name_${resolvedStoreId}`, name);
        } catch {}
      } else {
        // إذا لم يتم العثور على وثيقة سحابية وكان هناك كاش
        const cachedName = localStorage.getItem(`cache_name_${resolvedStoreId}`);
        if (!cachedName) {
          setStoreName(cleanStore || 'المتجر التجاري');
        }
      }

      setLoading(false);
    }

    loadCatalog();

    return () => {
      isCancelled = true;
    };
  }, [resolvedStoreId]);

  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        osc.frequency.value = 950;
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch (e) {}
  };

  const handleInputChange = (val: string) => {
    setSearchTerm(val);
    const query = val.trim().toLowerCase();

    if (!query) {
      setScannedProduct(null);
      setNotFound(false);
      return;
    }

    const exactBarcodeMatch = products.find((p) => p.barcode?.toLowerCase() === query);
    if (exactBarcodeMatch) {
      setScannedProduct(exactBarcodeMatch);
      setNotFound(false);
      playBeep();
      return;
    }

    const isBarcodeLike = /^\d{5,}$/.test(query);
    if (isBarcodeLike) {
      setScannedProduct(null);
      setNotFound(true);
    } else {
      setScannedProduct(null);
      setNotFound(false);
    }
  };

  const startCamera = async () => {
    try {
      const html5QrCode = new Html5Qrcode('barcode-reader');
      scannerRef.current = html5QrCode;
      setScannerActive(true);

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 180 } },
        (decodedText) => {
          if (!decodedText) return;
          const text = decodedText.trim();

          // إذا تم مسح رمز QR خاص بمتجر أثناء التواجد في شاشة الطلب أو الفحص
          if (text.includes('#')) {
            const token = text.split('#')[1].trim();
            window.location.hash = token;
            setCurrentHashToken(token);
            stopCamera();
            return;
          } else if (text.includes('ckeckprice') || text.includes('store=')) {
            try {
              const url = new URL(text);
              const storeParam = url.searchParams.get('store') || url.hash.replace(/^#/, '');
              if (storeParam) {
                window.location.hash = storeParam;
                setCurrentHashToken(storeParam);
                stopCamera();
                return;
              }
            } catch {}
          }

          // البحث العادي بالباركود لمادة في المتجر الحالي
          setSearchTerm(text);
          handleInputChange(text);
          stopCamera();
        },
        () => {}
      );
    } catch (err) {
      setScannerActive(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {}
      scannerRef.current = null;
    }
    setScannerActive(false);
  };

  const levelDisabled = priceLevel !== 'retail' && !!stockCfg.levels && !stockCfg.levels[priceLevel];

  const priceOf = (p: ProductItem): number | null =>
    priceLevel === 'retail'
      ? p.price
      : priceForLevel(
          { retailPrice: p.price, wholesalePrice: p.wholesalePrice, superWholesalePrice: p.superWholesalePrice, specialPrice: p.specialPrice },
          priceLevel,
          { super: stockCfg.fallbackSuper, special: stockCfg.fallbackSpecial }
        );
  const priceText = (p: ProductItem): string => {
    const v = priceOf(p);
    return v === null ? 'السعر غير متاح' : `${v.toLocaleString()} دينار`;
  };

  const renderStock = (p: ProductItem, big = false) => {
    if (stockCfg.mode === 'none' || typeof p.stock !== 'number') return null;
    const stock = p.stock;
    if (stockCfg.mode === 'count') {
      return (
        <span className={`inline-flex items-center gap-1 rounded-full border border-slate-600/60 bg-slate-700/30 text-slate-200 font-bold ${big ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-[11px]'}`}>
          المتوفر: {Math.round(stock * 1000) / 1000}
        </span>
      );
    }
    const lv = stockLevelOf(stock, stockCfg.redMax, stockCfg.yellowMax);
    const b = STOCK_BADGE[lv];
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border font-bold ${b.cls} ${big ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-[11px]'}`}>
        <span className={`w-2.5 h-2.5 rounded-full ${b.dot}`} />
        {b.label}
      </span>
    );
  };

  const filteredProducts = searchTerm.trim() && !scannedProduct
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
          p.barcode.toLowerCase().includes(searchTerm.trim().toLowerCase())
      )
    : [];

  // =========================================================================
  // حالة تعطيل ميزة قارئ الأسعار من قبل إدارة النظام لهذا المتجر
  // =========================================================================
  if (isDisabledByAdmin) {
    return (
      <div className="min-h-screen bg-[#060b13] text-white flex flex-col items-center justify-center p-6 text-center select-none" dir="rtl">
        <div className="w-full max-w-sm bg-[#0b1424] border border-rose-900/50 rounded-3xl p-8 shadow-2xl space-y-6">
          
          <div className="relative mx-auto w-24 h-24 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shadow-lg shadow-rose-500/10">
            <AlertTriangle className="w-12 h-12 text-rose-400" />
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-bold border-2 border-[#0b1424]">
              ✕
            </span>
          </div>

          <div className="space-y-2.5">
            <h2 className="text-xl font-black text-white">
              {storeName && storeName !== 'جاري التحميل...' ? storeName : 'فاحص أسعار المواد'}
            </h2>
            <div className="inline-block px-3 py-1 rounded-full bg-rose-950/80 border border-rose-500/30 text-rose-300 text-xs font-bold">
              تنبيه من إدارة النظام
            </div>
            <p className="text-sm text-slate-200 font-bold leading-relaxed pt-2">
              تم تعطيل ميزة قارئ الأسعار لهذا المتجر من قبل إدارة النظام.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              يرجى التوجه إلى كاشير المحل أو مراجعة إدارة المتجر للاستفسار عن أسعار المواد.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <span className="text-[11px] text-slate-500 font-medium">
              برنامج المفكر المحاسبي • نظام إدارة التراخيص
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (levelDisabled) {
    return (
      <div className="min-h-screen bg-[#060b13] text-white flex flex-col items-center justify-center p-6 text-center select-none" dir="rtl">
        <div className="w-full max-w-sm bg-[#0b1424] border border-slate-700 rounded-3xl p-8 shadow-2xl space-y-3">
          <h2 className="text-xl font-black">{storeName && storeName !== 'جاري التحميل...' ? storeName : 'فاحص أسعار المواد'}</h2>
          <div className="inline-block px-3 py-1 rounded-full bg-slate-800 border border-slate-600 text-slate-200 text-xs font-bold">غير مفعّل</div>
          <p className="text-sm text-slate-300 leading-relaxed">رابط سعر {CHECKER_LEVEL_LABELS[priceLevel]} غير مفعّل لدى هذا المتجر.</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // حالة الرابط المجرد (عدم وجود أي معرّف متجر في الهاش أو الرابط)
  // لا تعرض حالة تحميل ولا (0 مادة) بل تعرض الرسالة الأنيقة المحددة
  // =========================================================================
  if (!resolvedStoreId) {
    return (
      <div className="min-h-screen bg-[#060b13] text-white flex flex-col items-center justify-center p-6 text-center select-none" dir="rtl">
        <div className="w-full max-w-sm bg-[#0b1424] border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          
          <div className="relative mx-auto w-24 h-24 rounded-3xl bg-gradient-to-tr from-emerald-500/20 via-cyan-500/20 to-amber-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Camera className="w-12 h-12 text-emerald-400" />
            <div className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-md">
              <QrCode size={14} className="stroke-[2.5]" />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-black text-white leading-snug">
              يرجى مسح رمز QR الخاص بالمتجر لعرض قائمة الأسعار
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
              وجّه كاميرا هاتفك نحو رمز الاستجابة السريعة (QR) الخاص بمتجرك للاطلاع على أسعار المواد وفحص الباركود مباشرة
            </p>
          </div>

          {/* زر تشغيل ماسح الكاميرا لمسح كود المتجر مباشرة */}
          <div className="pt-2 space-y-3">
            <button
              type="button"
              onClick={scannerActive ? stopCamera : startCamera}
              className={`w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                scannerActive 
                  ? 'bg-rose-600 hover:bg-rose-500 text-white' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-98'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>{scannerActive ? 'إيقاف تشغيل الكاميرا' : 'فتح الكاميرا لمسح الرمز الآن'}</span>
            </button>

            <div id="barcode-reader" className={`${scannerActive ? 'block' : 'hidden'} w-full rounded-2xl overflow-hidden border border-emerald-500/40 bg-black`} />
          </div>

        </div>
      </div>
    );
  }

  // =========================================================================
  // حالة وجود متجر محدد (تم فك التشفير بنجاح وجلب المواد)
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#060b13] text-white p-4 font-sans flex flex-col items-center selection:bg-emerald-500" dir="rtl">
      <div className="w-full max-w-md space-y-4">
        
        {/* الترويسة العصرية */}
        <div className="flex items-center justify-between pt-2 pb-1">
          <div>
            <h1 className="text-xl font-black text-slate-100 tracking-tight">{storeName}</h1>
            <p className="text-xs text-emerald-400 font-medium">فحص أسعار المواد بالباركود</p>
          </div>
          <div className="px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
            محلي ({products.length} مادة)
          </div>
        </div>

        {/* الكاميرا */}
        <div className="bg-[#0b1424] border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-slate-200">كاميرا فحص الباركود</span>
            <button
              onClick={scannerActive ? stopCamera : startCamera}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
                scannerActive ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{scannerActive ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'}</span>
            </button>
          </div>

          <div id="barcode-reader" className={`${scannerActive ? 'block' : 'hidden'} w-full rounded-xl overflow-hidden border border-slate-700 bg-black mb-1`}></div>

          {!scannerActive && (
            <div 
              onClick={startCamera}
              className="w-full h-44 rounded-xl border border-slate-800/80 bg-[#070d18] flex items-center justify-center text-slate-500 text-xs cursor-pointer hover:border-slate-700 transition"
            >
              اضغط تشغيل الكاميرا لمسح الباركود بهاتفك
            </div>
          )}
        </div>

        {/* مربع البحث والنتائج */}
        <div className="bg-[#0b1424] border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
          <div className="text-xs font-bold text-slate-300">البحث بالاسم أو كتابة الباركود</div>
          
          <div className="relative">
            <input
              type="text"
              placeholder="اكتب هنا..."
              value={searchTerm}
              onChange={(e) => handleInputChange(e.target.value)}
              className="w-full bg-[#060b13] border border-emerald-500/40 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-400 font-medium font-mono"
            />
            {searchTerm ? (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setScannedProduct(null);
                  setNotFound(false);
                }}
                className="absolute left-3 top-2.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            )}
          </div>

          {/* بطاقة النتيجة الكبيرة عند مطابقة الباركود */}
          {scannedProduct && (
            <div className="bg-[#06241b] border border-emerald-500/60 rounded-2xl p-6 text-center shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
              <div className="text-xs text-slate-400 mb-1">اسم المادة</div>
              <h2 className="text-xl font-bold text-white mb-4">{scannedProduct.name}</h2>
              <div className="text-xs text-slate-400 mb-1">
                {priceLevel === 'retail' ? 'السعر المعتمد' : `السعر المعتمد (${CHECKER_LEVEL_LABELS[priceLevel]})`}
              </div>
              <div className="text-3xl font-black text-amber-400">
                {priceOf(scannedProduct) === null ? <span className="text-xl">السعر غير متاح</span> : <>{priceOf(scannedProduct)!.toLocaleString()} <span className="text-sm font-normal text-slate-300">دينار</span></>}
              </div>
              {renderStock(scannedProduct, true) && <div className="mt-4">{renderStock(scannedProduct, true)}</div>}
            </div>
          )}

          {/* القائمة المنسدلة عند البحث بالاسم */}
          {!scannedProduct && filteredProducts.length > 0 && (
            <div className="divide-y divide-slate-800/80 max-h-72 overflow-y-auto rounded-xl border border-slate-800/60 bg-[#070d18]">
              {filteredProducts.map((item, idx) => (
                <div 
                  key={`${item.id}_${item.barcode}_${idx}`} 
                  onClick={() => {
                    setScannedProduct(item);
                    playBeep();
                  }}
                  className="p-3 flex items-center justify-between hover:bg-slate-800/50 cursor-pointer transition"
                >
                  <div>
                    <div className="text-sm font-bold text-slate-100">{item.name}</div>
                    {item.barcode && (
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">#{item.barcode}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-sm font-black text-emerald-400 whitespace-nowrap">
                      {priceText(item)}
                    </div>
                    {renderStock(item)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {notFound && (
            <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-3.5 text-center text-xs text-rose-300">
              عذراً، هذه المادة غير مسجلة في هذا المتجر.
            </div>
          )}

          {loading && products.length === 0 && (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500 py-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span>جاري تحميل بيانات المواد...</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
