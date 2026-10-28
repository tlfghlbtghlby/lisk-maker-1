import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient'; // تأكد من مسار اتصال supabase في مشروعك
import { Html5Qrcode } from 'html5-qrcode';
import { Search, Camera, RefreshCw, AlertCircle, CheckCircle, Volume2 } from 'lucide-react';

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

  // 1. جلب بيانات أسعار هذا المحل وتخزينها للعمل أوفلاين
  useEffect(() => {
    async function fetchProducts() {
      if (!storeId) {
        setLoading(false);
        return;
      }

      // محاولة استرجاع الأسعار من كاش المتصفح أولاً (Offline First)
      const cached = localStorage.getItem(`cache_catalog_${storeId}`);
      if (cached) {
        try {
          setProducts(JSON.parse(cached));
        } catch (e) {}
      }

      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, barcode, price')
          .eq('store_id', storeId);

        if (!error && data) {
          setProducts(data);
          localStorage.setItem(`cache_catalog_${storeId}`, JSON.stringify(data));
        }
      } catch (err) {
        console.log('وضع عدم الاتصال بالإنترنت فعال');
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [storeId]);

  // 2. البحث عن المادة ومطابقة الباركود
  const handleCheckCode = (code: string) => {
    if (!code.trim()) {
      setScannedProduct(null);
      setNotFound(false);
      return;
    }

    const found = products.find(p => p.barcode?.trim() === code.trim());
    if (found) {
      setScannedProduct(found);
      setNotFound(false);
      // تشغيل نغمة تنبيه خفيفة (Beep) عند القراءة
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.frequency.value = 800;
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
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
        <h2 className="text-xl font-bold mb-2">رابط مدقق الأسعار غير مكتمل</h2>
        <p className="text-sm text-slate-400">يرجى التأكد من مسح رمز QR الصحيح الخاص بالمحل.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col" dir="rtl">
      {/* شريط علوي خفيف للزبون */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-amber-400">🔍 مدقق الأسعار الذاتي</h1>
          <p className="text-xs text-slate-400">مرر باركود المادة لمعرفة سعرها فوراً</p>
        </div>
        <div className="text-xs bg-slate-800 px-2.5 py-1 rounded-full text-slate-300 border border-slate-700">
          المواد: {products.length}
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col gap-4">
        {/* أزرار البحث والمسح */}
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
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm pr-10 focus:outline-none focus:border-amber-500"
            />
            <Search className="w-5 h-5 text-slate-400 absolute right-3 top-3" />
          </div>

          <button
            onClick={scannerActive ? stopCamera : startCamera}
            className={`px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-1.5 transition ${
              scannerActive ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>{scannerActive ? 'إيقاف' : 'الكاميرا'}</span>
          </button>
        </div>

        {/* حاوية الكاميرا */}
        <div id="barcode-reader" className={`${scannerActive ? 'block' : 'hidden'} w-full rounded-2xl overflow-hidden border border-slate-800 bg-black`}></div>

        {/* نتيجة فحص المادة */}
        {scannedProduct && (
          <div className="bg-emerald-950/50 border border-emerald-500/50 rounded-2xl p-6 text-center animate-fade-in shadow-lg">
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

        {!scannedProduct && !notFound && !scannerActive && (
          <div className="text-center py-12 text-slate-500 text-xs flex flex-col items-center">
            <Camera className="w-12 h-12 stroke-[1.2] mb-3 text-slate-600" />
            <span>اضغط على زر الكاميرا لمسح باركود المنتج بواسطة كاميرا الهاتف</span>
          </div>
        )}
      </main>
    </div>
  );
};
