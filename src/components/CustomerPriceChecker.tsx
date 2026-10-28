import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, RefreshCw, AlertCircle, CheckCircle, Wifi, WifiOff, Camera, Store, X } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
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

  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'reader-barcode-box';

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

  // جلب المواد بدقة وحفظها محلياً
  const fetchProducts = async () => {
    setLoading(true);
    const params = new URLSearchParams(window.location.search);
    const storeParam = params.get('store');

    try {
      let storeRecord: any = null;

      if (storeParam) {
        const { data: byId } = await supabase
          .from('stores')
          .select('id, products, settings')
          .eq('id', storeParam)
          .maybeSingle();

        if (byId) {
          storeRecord = byId;
        } else {
          const decoded = decodeURIComponent(storeParam).trim();
          const { data: all } = await supabase.from('stores').select('id, products, settings');
          if (all && all.length > 0) {
            storeRecord = all.find(
              (s: any) =>
                s.id === storeParam ||
                s.settings?.storeName?.trim() === decoded ||
                s.settings?.storeName?.trim() === storeParam
            );
          }
        }
      }

      if (!storeRecord) {
        const { data: fallback } = await supabase.from('stores').select('id, products, settings').limit(1).maybeSingle();
        storeRecord = fallback;
      }

      if (storeRecord && Array.isArray(storeRecord.products) && storeRecord.products.length > 0) {
        setProducts(storeRecord.products);
        if (storeRecord.settings?.storeName) {
          setStoreName(storeRecord.settings.storeName);
        }
        localStorage.setItem('cached_customer_products', JSON.stringify(storeRecord.products));
      } else {
        const cached = localStorage.getItem('cached_customer_products') || localStorage.getItem('cached_pos_products');
        if (cached) setProducts(JSON.parse(cached));
      }
    } catch {
      const cached = localStorage.getItem('cached_customer_products') || localStorage.getItem('cached_pos_products');
      if (cached) setProducts(JSON.parse(cached));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // تشغيل ماسح الباركود الرسمي مع دعم كامل للباركودات الخطية والمائلة
  const startCamera = async () => {
    setCameraError(null);
    setCameraActive(true);

    setTimeout(async () => {
      try {
        if (!qrScannerRef.current) {
          qrScannerRef.current = new Html5Qrcode(scannerContainerId, {
            formatsToSupport: [
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.QR_CODE
            ],
            verbose: false
          });
        }

        const config = {
          fps: 25,
          qrbox: { width: 320, height: 180 },
          aspectRatio: 1.777778,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: false // إيقاف الواجهة الضعيفة والاعتماد على المحرك الداخلي
          }
        };

        await qrScannerRef.current.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            findAndDisplayProduct(decodedText);
            stopCamera();
          },
          () => {}
        );
      } catch (err: any) {
        setCameraError('يرجى منح الإذن للكاميرا في المتصفح لمسح الباركود.');
        setCameraActive(false);
      }
    }, 150);
  };

  const stopCamera = async () => {
    if (qrScannerRef.current) {
      try {
        if (qrScannerRef.current.isScanning) {
          await qrScannerRef.current.stop();
        }
        qrScannerRef.current.clear();
      } catch (e) {}
      qrScannerRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // فحص السلعة بالباركود أو الاسم
  const findAndDisplayProduct = (term: string) => {
    const q = term.trim().toLowerCase();
    if (!q) return;

    const found = products.find(
      (p) =>
        (p.barcode && String(p.barcode).trim().toLowerCase() === q) ||
        (p.code && String(p.code).trim().toLowerCase() === q) ||
        (p.name && p.name.trim().toLowerCase() === q)
    );

    if (found) {
      setScannedProduct(found);
      setNotFound(false);
    } else {
      setScannedProduct(null);
      setNotFound(true);
    }
  };

  // قائمة البحث الحي اللحظي (تتقلص وتتصفى مع كتابة كل حرف)
  const liveSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => {
        const nameMatch = p.name && p.name.toLowerCase().includes(q);
        const codeMatch = p.code && String(p.code).toLowerCase().includes(q);
        const barcodeMatch = p.barcode && String(p.barcode).toLowerCase().includes(q);
        return nameMatch || codeMatch || barcodeMatch;
      })
      .slice(0, 10);
  }, [searchQuery, products]);

  const handleSelectProduct = (prod: CustomerProduct) => {
    setScannedProduct(prod);
    setNotFound(false);
    setSearchQuery('');
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

        {/* الكاميرا ومسح الباركود */}
        <div className="mb-6 text-center">
          {!cameraActive ? (
            <button
              type="button"
              onClick={startCamera}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
            >
              <Camera size={20} />
              فتح الكاميرا لمسح باركود السلعة
            </button>
          ) : (
            <div className="flex flex-col items-center">
              <div className="relative w-full overflow-hidden rounded-xl border-2 border-amber-400 bg-black shadow-inner mb-3">
                <div id={scannerContainerId} className="w-full min-h-[250px]"></div>
              </div>
              <button
                type="button"
                onClick={stopCamera}
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

        {/* حقل البحث الحي */}
        <div className="relative mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setNotFound(false);
              }}
              placeholder="اكتب حرفاً من اسم السلعة أو الباركود..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pr-10 pl-10 text-white text-right focus:outline-none focus:border-amber-400 shadow-inner"
            />
            <Search className="absolute right-3 top-3.5 text-slate-400" size={18} />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-3.5 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* قائمة الاقتراحات الحية المتطابقة فورياً */}
          {liveSuggestions.length > 0 && (
            <div className="absolute z-30 w-full mt-1.5 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-800 max-h-64 overflow-y-auto">
              {liveSuggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectProduct(item)}
                  className="w-full p-3 text-right hover:bg-slate-800/80 transition flex items-center justify-between group"
                >
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-amber-400 transition">{item.name}</p>
                    {item.barcode && <span className="text-[11px] text-slate-400 font-mono">{item.barcode}</span>}
                  </div>
                  <div className="text-left font-black text-amber-400 text-sm">
                    {(item.retailPrice || item.price || 0).toLocaleString('en-US')} د.ع
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* عرض السلعة المحددة */}
        {scannedProduct && (
          <div className="bg-slate-950/80 border border-emerald-500/40 rounded-xl p-5 text-center shadow-lg">
            <CheckCircle className="mx-auto text-emerald-400 mb-2" size={40} />
            <h2 className="text-lg font-bold text-white mb-1">{scannedProduct.name}</h2>
            <div className="text-3xl font-black text-amber-400 my-2">
              {(scannedProduct.retailPrice || scannedProduct.price || 0).toLocaleString('en-US')} دينار
            </div>
            {scannedProduct.stock !== undefined && (
              <div className="text-xs text-slate-400 mt-2">
                الحالة بالمخزن: {scannedProduct.stock > 0 ? `متوفر (${scannedProduct.stock})` : 'غير متوفر'}
              </div>
            )}
          </div>
        )}

        {/* رسالة عدم العثور */}
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