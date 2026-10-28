import React, { useState, useEffect, useRef } from 'react';
import { Search, RefreshCw, AlertCircle, CheckCircle, Wifi, WifiOff, Camera, Store } from 'lucide-react';
import { supabase } from '../supabase';

interface CustomerProduct {
  id: string;
  name: string;
  barcode?: string;
  code?: string;
  retailPrice?: number;
  price?: number;
  stock?: number;
}

export const CustomerPriceChecker: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<CustomerProduct[]>([]);
  const [storeName, setStoreName] = useState<string>('');
  const [scannedProduct, setScannedProduct] = useState<CustomerProduct | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // جلب المواد بدقة من المتجر المحدد أو المتجر الافتراضي
  const fetchProducts = async () => {
    setLoading(true);
    const params = new URLSearchParams(window.location.search);
    const storeParam = params.get('store');

    try {
      let storeRecord: any = null;

      if (storeParam) {
        // البحث بالمعرف المحدد
        const { data } = await supabase
          .from('stores')
          .select('id, products, settings')
          .eq('id', storeParam)
          .maybeSingle();
        storeRecord = data;
      }

      // إذا لم يُحدد في الرابط أو لم يُعثر عليه، جلب أول متجر متاح في الحساب
      if (!storeRecord) {
        const { data } = await supabase
          .from('stores')
          .select('id, products, settings')
          .limit(1)
          .maybeSingle();
        storeRecord = data;
      }

      if (storeRecord && Array.isArray(storeRecord.products) && storeRecord.products.length > 0) {
        setProducts(storeRecord.products);
        if (storeRecord.settings?.storeName) {
          setStoreName(storeRecord.settings.storeName);
        }
        localStorage.setItem('cached_customer_products', JSON.stringify(storeRecord.products));
      } else {
        // استخدام الكاش المحلي
        const cached = localStorage.getItem('cached_customer_products') || localStorage.getItem('cached_pos_products');
        if (cached) setProducts(JSON.parse(cached));
      }
    } catch (err) {
      console.warn('Fetch error:', err);
      const cached = localStorage.getItem('cached_customer_products') || localStorage.getItem('cached_pos_products');
      if (cached) setProducts(JSON.parse(cached));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // تشغيل الكاميرا
  const handleToggleCamera = async () => {
    if (cameraActive) {
      stopCamera();
    } else {
      setCameraError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
        streamRef.current = stream;
        setCameraActive(true);
      } catch (err) {
        setCameraError('يرجى منح إذن استخدام الكاميرا من إعدادات المتصفح.');
        setCameraActive(false);
      }
    }
  };

  // ربط البث فور ظهور عنصر الـ video في الصفحة (حل الشاشة السوداء)
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.onloadedmetadata = () => {
        video.play().catch(e => console.warn('Play error:', e));
      };

      // تشغيل ماسح الباركود
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_a', 'code_39']
        });

        const scanLoop = async () => {
          if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              findAndDisplayProduct(code);
              stopCamera();
              return;
            }
          } catch (e) {}

          if (streamRef.current) {
            animFrameRef.current = requestAnimationFrame(scanLoop);
          }
        };
        animFrameRef.current = requestAnimationFrame(scanLoop);
      }
    }
  }, [cameraActive]);

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const findAndDisplayProduct = (term: string) => {
    const q = term.trim().toLowerCase();
    if (!q) return;

    const found = products.find(
      (p) =>
        (p.barcode && String(p.barcode).trim().toLowerCase() === q) ||
        (p.code && String(p.code).trim().toLowerCase() === q) ||
        (p.name && p.name.trim().toLowerCase().includes(q))
    );

    if (found) {
      setScannedProduct(found);
      setNotFound(false);
    } else {
      setScannedProduct(null);
      setNotFound(true);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    findAndDisplayProduct(searchQuery);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col items-center justify-center font-sans" dir="rtl">
      <div className="w-full max-w-md bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700">
        
        {/* الترويسة واسم المتجر */}
        <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-3">
          <div>
            <h1 className="text-xl font-bold text-amber-400">قارئ أسعار المواد</h1>
            {storeName && (
              <p className="text-xs text-slate-300 flex items-center gap-1 mt-0.5">
                <Store size={12} className="text-amber-400" /> {storeName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <Wifi size={14} /> متصل
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-rose-400">
                <WifiOff size={14} /> أوفلاين
              </span>
            )}
            <button
              onClick={fetchProducts}
              className="p-1 rounded bg-slate-700 hover:bg-slate-600 transition"
              title="تحديث البيانات"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* زر وتشغيل الكاميرا */}
        <div className="mb-6 text-center">
          {!cameraActive ? (
            <button
              type="button"
              onClick={handleToggleCamera}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
            >
              <Camera size={20} />
              فتح الكاميرا لمسح باركود السلعة
            </button>
          ) : (
            <div className="flex flex-col items-center">
              <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border-2 border-amber-400 shadow-inner mb-3">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
                <div className="absolute inset-0 border-2 border-red-500/70 m-8 rounded-lg pointer-events-none animate-pulse"></div>
              </div>
              <button
                type="button"
                onClick={handleToggleCamera}
                className="bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 px-6 rounded-lg transition"
              >
                إغلاق الكاميرا
              </button>
            </div>
          )}

          {cameraError && (
            <p className="text-rose-400 text-xs mt-2 bg-rose-950/40 p-2 rounded-lg border border-rose-800">
              {cameraError}
            </p>
          )}
        </div>

        {/* حقل البحث */}
        <form onSubmit={handleManualSearch} className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="امسح الباركود أو اكتب اسم المادة..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pr-10 pl-4 text-white text-right focus:outline-none focus:border-amber-400"
            />
            <Search className="absolute right-3 top-3.5 text-slate-400" size={18} />
          </div>
        </form>

        {/* عرض النتيجة */}
        {scannedProduct && (
          <div className="bg-slate-950/80 border border-emerald-500/40 rounded-xl p-5 text-center shadow-lg">
            <CheckCircle className="mx-auto text-emerald-400 mb-2" size={40} />
            <h2 className="text-lg font-bold text-white mb-1">{scannedProduct.name}</h2>
            <div className="text-3xl font-black text-amber-400 my-2">
              {(scannedProduct.retailPrice || scannedProduct.price || 0).toLocaleString('en-US')} دينار
            </div>
            {scannedProduct.stock !== undefined && (
              <div className="text-xs text-slate-400 mt-2">
                الحالة بالمخزن: {scannedProduct.stock > 0 ? 'متوفر' : 'غير متوفر'}
              </div>
            )}
          </div>
        )}

        {/* عدم العثور */}
        {notFound && (
          <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-4 text-center">
            <AlertCircle className="mx-auto text-rose-400 mb-2" size={32} />
            <p className="text-rose-200 text-sm">عذراً، هذه المادة غير مسجلة في هذا المتجر.</p>
          </div>
        )}

      </div>
    </div>
  );
};
