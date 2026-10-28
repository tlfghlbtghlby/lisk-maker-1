import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Search, Camera, RefreshCw, AlertCircle, X } from 'lucide-react';

const SUPABASE_URL = "https://obodoxxzolgcwvzkkoua.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0aNPlD59KqYsmVr8r_tMEw_wpgmlj2o";

interface ProductItem {
  id: string;
  name: string;
  barcode: string;
  price: number;
}

export const CustomerPriceChecker: React.FC<{ storeId: string | null }> = ({ storeId }) => {
  const [storeName, setStoreName] = useState<string>('المتجر');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    async function loadCatalog() {
      if (!storeId) {
        setLoading(false);
        return;
      }

      setLoading(true);
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

            // استخراج اسم المتجر
            const name = data.settings?.storeName || data.storeName || cleanStore;
            setStoreName(name);

            // 1. استخراج المواد من المنتجات المباشرة
            if (Array.isArray(data.products)) {
              data.products.forEach((p: any) => {
                const code = String(p.barcode || p.code || p.id || '').trim();
                const pName = String(p.name || p.productName || 'مادة').trim();
                const price = Number(p.price ?? p.retailPrice ?? p.unitPrice ?? 0);
                if (code || pName) {
                  const key = code || pName;
                  itemMap.set(key, { id: String(p.id || key), name: pName, barcode: code, price });
                }
              });
            }

            // 2. استخراج المواد من الفواتير
            if (Array.isArray(data.invoices)) {
              data.invoices.forEach((inv: any) => {
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
            localStorage.setItem(`cache_catalog_${storeId}`, JSON.stringify(uniqueList));
            localStorage.setItem(`cache_name_${storeId}`, name);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadCatalog();
  }, [storeId]);

  // تشغيل الكاميرا لمسح الباركود
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

  // فلترة المواد لحظياً بناءً على ما يكتبه المستخدم في حقل البحث
  const filteredProducts = searchTerm.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
          p.barcode.toLowerCase().includes(searchTerm.trim().toLowerCase())
      )
    : [];

  if (!storeId) {
    return (
      <div className="min-h-screen bg-[#070d18] text-white flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <AlertCircle className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">رابط فحص الأسعار غير مكتمل</h2>
        <p className="text-sm text-slate-400">يرجى مسح رمز QR الصحيح الخاص بالمتجر.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060b13] text-white p-4 font-sans flex flex-col items-center" dir="rtl">
      <div className="w-full max-w-md space-y-4">
        
        {/* رأس الصفحة: اسم المتجر وعدد المواد المتاحة */}
        <div className="flex items-center justify-between pt-2 pb-1">
          <div>
            <h1 className="text-xl font-black text-slate-100">{storeName}</h1>
            <p className="text-xs text-emerald-400 font-medium">فحص أسعار المواد بالباركود</p>
          </div>
          <div className="px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
            محلي ({products.length} مادة)
          </div>
        </div>

        {/* صندوق الكاميرا */}
        <div className="bg-[#0b1424] border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-slate-200">كاميرا فحص الباركود</span>
            <button
              onClick={scannerActive ? stopCamera : startCamera}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{scannerActive ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'}</span>
            </button>
          </div>

          <div
            id="barcode-reader"
            className={`${scannerActive ? 'block' : 'hidden'} w-full rounded-xl overflow-hidden border border-slate-700 bg-black mb-1`}
          ></div>

          {!scannerActive && (
            <div 
              onClick={startCamera}
              className="w-full h-44 rounded-xl border border-slate-800 bg-[#070d18] flex items-center justify-center text-slate-500 text-xs cursor-pointer hover:border-slate-700 transition"
            >
              اضغط تشغيل الكاميرا لمسح الباركود بهاتفك
            </div>
          )}
        </div>

        {/* صندوق البحث وقائمة المواد المشابهة للصورة الأولى */}
        <div className="bg-[#0b1424] border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
          <div className="text-xs font-bold text-slate-300">البحث بالاسم أو كتابة الباركود</div>
          
          <div className="relative">
            <input
              type="text"
              placeholder="اكتب هنا..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#060b13] border border-emerald-500/40 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-400 font-medium"
            />
            {searchTerm ? (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-2.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            )}
          </div>

          {/* قائمة المواد الناتجة مثل الصورة الأولى */}
          {searchTerm.trim() !== '' && (
            <div className="divide-y divide-slate-800/80 max-h-72 overflow-y-auto rounded-xl border border-slate-800/60 bg-[#070d18]">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((item) => (
                  <div key={item.id + item.barcode} className="p-3 flex items-center justify-between hover:bg-slate-800/40 transition">
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
                ))
              ) : (
                <div className="p-4 text-center text-xs text-rose-400">
                  عذراً، هذه المادة غير مسجلة في هذا المتجر.
                </div>
              )}
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
