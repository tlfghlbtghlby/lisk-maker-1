import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Search, Camera, RefreshCw, AlertCircle, CheckCircle, Store, X } from 'lucide-react';

const SUPABASE_URL = "https://obodoxxzolgcwvzkkoua.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0aNPlD59KqYsmVr8r_tMEw_wpgmlj2o";

interface ProductItem {
  id: string;
  name: string;
  barcode: string;
  price: number;
}

export const CustomerPriceChecker: React.FC<{ storeId: string | null }> = ({ storeId }) => {
  const [storeName, setStoreName] = useState<string>('جاري التحميل...');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [scannedProduct, setScannedProduct] = useState<ProductItem | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    async function loadCatalog() {
      if (!storeId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      // استخراج المعرف الصافي وتجهيز معرف المتجر
      const cleanStore = storeId.trim().replace(/^store_/, '');
      const docId = `store_${cleanStore}`;

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
          if (rows && rows.length > 0) {
            const data = rows[0].data || {};
            const itemMap = new Map<string, ProductItem>();

            // 1. تحديد اسم المتجر من الإعدادات أو المستخدم
            let name = data.settings?.storeName || data.storeName || cleanStore;
            setStoreName(name);

            // 2. استخراج المواد إذا كانت موجودة في قائمة المنتجات المباشرة
            if (Array.isArray(data.products)) {
              data.products.forEach((p: any) => {
                const code = String(p.barcode || p.code || p.id || '').trim();
                const pName = String(p.name || p.productName || 'مادة').trim();
                const price = Number(p.price ?? p.retailPrice ?? p.unitPrice ?? 0);
                if (code) {
                  itemMap.set(code.toLowerCase(), { id: String(p.id || code), name: pName, barcode: code, price });
                }
                if (pName) {
                  itemMap.set(pName.toLowerCase(), { id: String(p.id || pName), name: pName, barcode: code, price });
                }
              });
            }

            // 3. استخراج المواد المسجلة داخل الفواتير (تطابق بنية بياناتك في الصورة)
            if (Array.isArray(data.invoices)) {
              data.invoices.forEach((inv: any) => {
                if (Array.isArray(inv.items)) {
                  inv.items.forEach((item: any) => {
                    const code = String(item.code || item.barcode || item.productId || '').trim();
                    const pName = String(item.productName || item.name || '').trim();
                    const price = Number(item.unitPrice ?? item.price ?? item.retailPrice ?? 0);

                    if (code && !itemMap.has(code.toLowerCase())) {
                      itemMap.set(code.toLowerCase(), { id: String(item.productId || code), name: pName || 'مادة', barcode: code, price });
                    }
                    if (pName && !itemMap.has(pName.toLowerCase())) {
                      itemMap.set(pName.toLowerCase(), { id: String(item.productId || pName), name: pName, barcode: code, price });
                    }
                  });
                }
              });
            }

            // تحويل الخريطة إلى مصفوفة فريدة
            const uniqueList: ProductItem[] = [];
            const seenIds = new Set<string>();
            itemMap.forEach((val) => {
              const uniqueKey = `${val.name}_${val.barcode}`;
              if (!seenIds.has(uniqueKey)) {
                seenIds.add(uniqueKey);
                uniqueList.push(val);
              }
            });

            setProducts(uniqueList);
          }
        }
      } catch (err) {
        console.error('خطأ في الاتصال:', err);
      } finally {
        setLoading(false);
      }
    }

    loadCatalog();
  }, [storeId]);

  // البحث بالباركود أو اسم المادة
  const handleCheckCode = (inputVal: string) => {
    const query = inputVal.trim().toLowerCase();
    if (!query) {
      setScannedProduct(null);
      setNotFound(false);
      return;
    }

    const match = products.find(
      (p) => p.barcode?.toLowerCase() === query || 
             p.name?.toLowerCase().includes(query) ||
             (p.barcode && query.length >= 3 && p.barcode.includes(query))
    );

    if (match) {
      setScannedProduct(match);
      setNotFound(false);
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          osc.frequency.value = 900;
          osc.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.12);
        }
      } catch (e) {}
    } else {
      setScannedProduct(null);
      setNotFound(true);
    }
  };

  const startCamera = async () => {
    try {
      const html5QrCode = new Html5Qrcode('barcode-reader');
      scannerRef.current = html5QrCode;
      setScannerActive(true);

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          setSearchTerm(decodedText);
          handleCheckCode(decodedText);
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

  if (!storeId) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <AlertCircle className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">رابط فحص الأسعار غير مكتمل</h2>
        <p className="text-sm text-slate-400">يرجى التأكد من مسح رمز QR الصحيح الخاص بالمتجر.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070d18] text-white flex flex-col items-center justify-center p-4 selection:bg-amber-500" dir="rtl">
      <div className="max-w-md w-full bg-[#0b1728] border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
        
        {/* شريط معلومات المحل والاتصال */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${loading ? 'bg-amber-400 animate-spin' : 'bg-emerald-500 animate-pulse'}`}></span>
            <span className="text-xs font-bold text-emerald-400">
              {loading ? 'جاري سحب الأسعار...' : `متصل (${products.length} مادة)`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
            <Store className="w-3.5 h-3.5" />
            <span>{storeName}</span>
          </div>
        </div>

        <h1 className="text-xl font-black text-center text-amber-400 mb-6">
          قارئ أسعار المواد
        </h1>

        {/* زر الكاميرا */}
        <button
          onClick={scannerActive ? stopCamera : startCamera}
          className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-amber-500/20 mb-4"
        >
          <Camera className="w-5 h-5" />
          <span>{scannerActive ? 'إيقاف تشغيل الكاميرا' : 'فتح الكاميرا لمسح باركود السلعة'}</span>
        </button>

        <div id="barcode-reader" className={`${scannerActive ? 'block' : 'hidden'} w-full rounded-2xl overflow-hidden border border-slate-700 bg-black mb-4`}></div>

        {/* البحث اليدوي */}
        <div className="relative mb-5">
          <input
            type="text"
            placeholder="اكتب حرفاً من اسم السلعة أو الباركود..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              handleCheckCode(e.target.value);
            }}
            className="w-full bg-[#070d18] border border-amber-500/40 rounded-2xl px-4 py-3.5 text-sm pl-10 pr-10 focus:outline-none focus:border-amber-400 text-white font-medium"
          />
          <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setScannedProduct(null);
                setNotFound(false);
              }}
              className="absolute left-3.5 top-3.5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* كارت عرض السلعة المكتشفة */}
        {scannedProduct && (
          <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-2xl p-5 text-center shadow-lg">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <div className="text-xs text-slate-400 mb-1">اسم المادة</div>
            <h2 className="text-lg font-bold text-white mb-3">{scannedProduct.name}</h2>
            <div className="text-xs text-slate-400 mb-1">السعر المعتمد</div>
            <div className="text-3xl font-black text-amber-400">
              {scannedProduct.price.toLocaleString()} <span className="text-sm font-normal text-slate-300">د.ع</span>
            </div>
          </div>
        )}

        {/* في حال عدم العثور */}
        {notFound && (
          <div className="bg-rose-950/30 border border-rose-500/30 rounded-2xl p-4 text-center text-rose-300 text-xs">
            عذراً، هذه المادة غير مسجلة في هذا المتجر.
          </div>
        )}
      </div>
    </div>
  );
};