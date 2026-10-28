import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Search, Camera, RefreshCw, CheckCircle, X, QrCode } from 'lucide-react';

const SUPABASE_URL = "https://obodoxxzolgcwvzkkoua.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0aNPlD59KqYsmVr8r_tMEw_wpgmlj2o";

interface ProductItem {
  id: string;
  name: string;
  barcode: string;
  price: number;
}

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
  const rawTargetToken = initialStoreId || currentHashToken;
  const resolvedStoreId = decodeStoreToken(rawTargetToken);

  const [storeName, setStoreName] = useState<string>('جاري التحميل...');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState<boolean>(!!resolvedStoreId);
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
      
      // فحص الذاكرة المؤقتة أولاً لسرعة الظهور اللحظي
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
        `store_user_${cleanStore}`
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
        const itemMap = new Map<string, ProductItem>();
        const name = foundData.settings?.storeName || foundData.storeName || cleanStore;
        setStoreName(name);

        // 1. استخراج المواد المباشرة
        if (Array.isArray(foundData.products)) {
          foundData.products.forEach((p: any) => {
            const code = String(p.barcode || p.code || p.id || '').trim();
            const pName = String(p.name || p.productName || 'مادة').trim();
            const price = Number(p.price ?? p.retailPrice ?? p.unitPrice ?? 0);
            if (code || pName) {
              const key = code || pName;
              itemMap.set(key, { id: String(p.id || key), name: pName, barcode: code, price });
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

  const filteredProducts = searchTerm.trim() && !scannedProduct
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
          p.barcode.toLowerCase().includes(searchTerm.trim().toLowerCase())
      )
    : [];

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
              <div className="text-xs text-slate-400 mb-1">السعر المعتمد</div>
              <div className="text-3xl font-black text-amber-400">
                {scannedProduct.price.toLocaleString()} <span className="text-sm font-normal text-slate-300">دينار</span>
              </div>
            </div>
          )}

          {/* القائمة المنسدلة عند البحث بالاسم */}
          {!scannedProduct && filteredProducts.length > 0 && (
            <div className="divide-y divide-slate-800/80 max-h-72 overflow-y-auto rounded-xl border border-slate-800/60 bg-[#070d18]">
              {filteredProducts.map((item) => (
                <div 
                  key={item.id + item.barcode} 
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
                  <div className="text-sm font-black text-emerald-400 whitespace-nowrap">
                    {item.price.toLocaleString()} دينار
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
