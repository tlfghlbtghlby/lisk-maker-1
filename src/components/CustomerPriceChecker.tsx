import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Search, Camera, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

const SUPABASE_URL = "https://obodoxxzolgcwvzkkoua.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0aNPlD59KqYsmVr8r_tMEw_wpgmlj2o";

interface ProductItem {
  id: string;
  name: string;
  barcode: string;
  price: number;
}

export const CustomerPriceChecker: React.FC<{ storeId: string | null }> = ({ storeId }) => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [scannedProduct, setScannedProduct] = useState<ProductItem | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // 1. استرجاع قائمة أسعار المتجر من جدول documents وحفظها للعمل دون اتصال
  useEffect(() => {
    async function loadProducts() {
      if (!storeId) {
        setLoading(false);
        return;
      }

      // القراءة من الكاش المحلي أولاً للعمل بسرعة وبدون إنترنت
      const cached = localStorage.getItem(`cache_catalog_${storeId}`);
      if (cached) {
        try {
          setProducts(JSON.parse(cached));
        } catch (e) {}
      }

      try {
        const docId = storeId.startsWith('store_') ? storeId : `store_${storeId}`;

        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/documents?collection=eq.stores&id=eq.${encodeURIComponent(docId)}&select=data`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          }
        );

        if (response.ok) {
          const rows = await response.json();
          if (rows && rows.length > 0 && rows[0].data?.products) {
            const rawProducts = rows[0].data.products;

            const formatted: ProductItem[] = rawProducts.map((p: any) => ({
              id: String(p.id || ''),
              name: String(p.name || 'مادة بدون اسم'),
              barcode: String(p.barcode || p.code || ''),
              price: Number(p.price || p.retailPrice || 0),
            }));

            setProducts(formatted);
            localStorage.setItem(`cache_catalog_${storeId}`, JSON.stringify(formatted));
          }
        }
      } catch (err) {
        console.log('يعمل التطبيق في وضع عدم الاتصال بالإنترنت');
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, [storeId]);

  // 2. فحص الباركود ومطابقة السعر
  const handleCheckCode = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) {
      setScannedProduct(null);
      setNotFound(false);
      return;
    }

    const found = products.find((p) => p.barcode?.trim() === trimmed);
    if (found) {
      setScannedProduct(found);
      setNotFound(false);
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const osc = ctx.createOscillator();
          osc.frequency.value = 850;
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

  // 3. تشغيل كاميرا الهاتف لمسح الباركود
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
      console.error('تعذر تشغيل الكاميرا:', err);
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
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <AlertCircle className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">رابط فحص الأسعار غير مكتمل</h2>
        <p className="text-sm text-slate-400">يرجى التأكد من مسح رمز QR الصحيح الخاص بالمتجر.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col" dir="rtl">
      {/* الشريط العلوي */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-amber-400">🔍 مدقق الأسعار الذاتي</h1>
          <p className="text-xs text-slate-400">وجّه الكاميرا نحو باركود المادة لمعرفة سعرها فوراً</p>
        </div>
        <div className="text-xs bg-slate-800 px-2.5 py-1 rounded-full text-slate-300 border border-slate-700">
          المواد: {products.length}
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col gap-4">
        {/* حقل الإدخال وزر الكاميرا */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="اكتب رقم الباركود هنا..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                handleCheckCode(e.target.value);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm pr-10 focus:outline-none focus:border-amber-500 font-mono"
            />
            <Search className="w-5 h-5 text-slate-400 absolute right-3 top-3" />
          </div>

          <button
            onClick={scannerActive ? stopCamera : startCamera}
            className={`px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-1.5 transition cursor-pointer ${
              scannerActive ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>{scannerActive ? 'إيقاف' : 'الكاميرا'}</span>
          </button>
        </div>

        {/* شاشة الكاميرا */}
        <div id="barcode-reader" className={`${scannerActive ? 'block' : 'hidden'} w-full rounded-2xl overflow-hidden border border-slate-800 bg-black`}></div>

        {/* مؤشر التحميل */}
        {loading && products.length === 0 && (
          <div className="text-center py-6 text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
            <span>جاري تجهيز قائمة أسعار المحل...</span>
          </div>
        )}

        {/* بطاقة عرض تفاصيل المادة الممسوحة */}
        {scannedProduct && (
          <div className="bg-emerald-950/50 border border-emerald-500/50 rounded-2xl p-6 text-center shadow-lg">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
            <div className="text-sm text-slate-400 mb-1">اسم المادة</div>
            <h2 className="text-xl font-bold text-white mb-4">{scannedProduct.name}</h2>
            <div className="text-xs text-slate-400 mb-1">السعر الحالي</div>
            <div className="text-3xl font-black text-amber-400">
              {scannedProduct.price.toLocaleString()} <span className="text-sm font-normal text-slate-300">د.ع</span>
            </div>
          </div>
        )}

        {notFound && (
          <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl p-5 text-center text-rose-300 text-sm">
            المادة غير متوفرة أو لم يتم العثور على الباركود المطلوب
          </div>
        )}

        {!scannedProduct && !notFound && !scannerActive && !loading && (
          <div className="text-center py-12 text-slate-500 text-xs flex flex-col items-center">
            <Camera className="w-12 h-12 stroke-[1.2] mb-3 text-slate-600" />
            <span>اضغط على زر الكاميرا لمسح باركود المنتج بواسطة كاميرا الهاتف</span>
          </div>
        )}
      </main>
    </div>
  );
};
