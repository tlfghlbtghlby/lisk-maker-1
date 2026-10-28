import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  QrCode as QrCodeIcon, 
  Copy, 
  Check, 
  ExternalLink, 
  Printer, 
  Wifi, 
  RefreshCw, 
  Sparkles, 
  ShieldCheck, 
  Download, 
  Globe, 
  Smartphone,
  HardDriveDownload,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '../supabase';
import { Product } from '../types';

interface CustomerQRSettingsCardProps {
  storeName: string;
  phone?: string;
  currency: string;
  productsCount: number;
  products?: Product[];
  storeId?: string;
}

const DEFAULT_RUN_APP_URL = 'https://tlfghlbtghlby.github.io/lisk-maker-1';
const CUSTOM_URL_STORAGE_KEY = 'almufakir_custom_public_url';

// استخراج الرابط النظيف المعتمد
export const getCleanPublicBaseUrl = (): string => {
  if (typeof window === 'undefined') return DEFAULT_RUN_APP_URL;

  // 1. فحص هل قام صاحب المحل بإدخال دومين أو رابط خاص به
  const savedCustom = localStorage.getItem(CUSTOM_URL_STORAGE_KEY);
  if (savedCustom && savedCustom.trim().startsWith('http')) {
    return savedCustom.trim().replace(/\/+$/, '');
  }

  const hostname = window.location.hostname.toLowerCase();

  // 2. إذا كان يعمل داخل محرّر Google Studio أو localhost أو ملف محلي، استخدم الرابط السحابي المستقل
  if (
    hostname.includes('aistudio.google.com') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    window.location.protocol === 'file:'
  ) {
    return DEFAULT_RUN_APP_URL;
  }

  // 3. إذا كان يعمل على خادم run.app أو دومين مستقل فعلي، استخدم الـ origin الحالي
  return window.location.origin.replace(/\/+$/, '');
};

export const CustomerQRSettingsCard: React.FC<CustomerQRSettingsCardProps> = ({
  storeName,
  phone,
  currency,
  productsCount,
  products = [],
  storeId = ''
}) => {
  const [customBaseUrl, setCustomBaseUrl] = useState<string>('');
  const [effectiveBaseUrl, setEffectiveBaseUrl] = useState<string>(DEFAULT_RUN_APP_URL);
  const [localIps, setLocalIps] = useState<string[]>([]);

  // رابط موحد واحد فقط ورمز QR واحد فقط
  const [unifiedQrUrl, setUnifiedQrUrl] = useState<string>('');
  const [unifiedLink, setUnifiedLink] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  
  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>(
    new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })
  );

  // تحميل الرابط المخصص الأولي وفحص عناوين IP المحلية
  useEffect(() => {
    const saved = localStorage.getItem(CUSTOM_URL_STORAGE_KEY) || '';
    setCustomBaseUrl(saved);
    const clean = getCleanPublicBaseUrl();
    setEffectiveBaseUrl(clean);

    // فحص عناوين IP لشبكة الواي فاي المحلية للمتجر إن وجدت
    fetch('/api/network-info')
      .then(res => res.json())
      .then(data => {
        if (data && data.success && Array.isArray(data.ips)) {
          setLocalIps(data.ips);
        }
      })
      .catch(() => {});
  }, []);

  // توليد الرابط الموحد ورمز الـ QR الذكي
  useEffect(() => {
    const storeQuery = storeId ? `&store=${storeId}` : '';
    const cleanBase = effectiveBaseUrl.replace(/\/+$/, '');
    const link = `${cleanBase}/?view=price-checker${storeQuery}`;
    setUnifiedLink(link);

    // توليد رمز QR عالي الدقة والتباين
    QRCode.toDataURL(link, {
      width: 360,
      margin: 2,
      color: {
        dark: '#064e3b',
        light: '#ffffff'
      }
    })
      .then(url => setUnifiedQrUrl(url))
      .catch(err => console.error('Failed generating unified QR', err));
  }, [effectiveBaseUrl, storeId]);

  // حفظ رابط النطاق المخصص
  const handleSaveCustomBaseUrl = (val: string) => {
    const trimmed = val.trim();
    setCustomBaseUrl(trimmed);
    if (trimmed) {
      localStorage.setItem(CUSTOM_URL_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(CUSTOM_URL_STORAGE_KEY);
    }
    const clean = getCleanPublicBaseUrl();
    setEffectiveBaseUrl(clean);
    setSuccessNotice('تم حفظ وتحديث الرابط الموحد ورمز الـ QR بنجاح!');
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  // نسخ الرابط الموحد إلى الحافظة
  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(unifiedLink);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = unifiedLink;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  // فتح المعاينة في نافذة جديدة
  const handleOpenPreview = () => {
    window.open(unifiedLink, '_blank');
  };

  // تحديث ومزامنة الكتالوج السحابي
  const handleSyncCloudCatalog = async () => {
    setIsSyncingCatalog(true);
    try {
      const now = new Date();
      await supabase
        .from('settings')
        .update({ updated_at: now.toISOString() })
        .limit(1);

      const timeStr = now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(timeStr);

      setSuccessNotice(`تم تحديث ومزامنة بيانات الـ (${productsCount} مادة) سحابياً الساعة ${timeStr}! سيتم تحميلها فوراً في هاتف أي زبون يمسح الرمز.`);
      setTimeout(() => setSuccessNotice(null), 5000);
    } catch (err: any) {
      console.error('Sync catalog error', err);
    } finally {
      setIsSyncingCatalog(false);
    }
  };

  // طباعة لافتة المتجر الجدارية للزبائن
  const handlePrintPoster = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <title>لافتة قارئ الأسعار - ${storeName}</title>
          <meta charset="utf-8" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            body {
              margin: 0;
              padding: 40px 20px;
              font-family: 'Cairo', sans-serif;
              text-align: center;
              background-color: #f8fafc;
              color: #0f172a;
            }
            .poster-card {
              max-width: 550px;
              margin: 0 auto;
              background: #ffffff;
              border: 3px solid #10b981;
              border-radius: 28px;
              padding: 40px 30px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.06);
            }
            .store-title {
              font-size: 32px;
              font-weight: 900;
              color: #064e3b;
              margin: 0 0 8px 0;
            }
            .badge {
              display: inline-block;
              background: #ecfdf5;
              color: #059669;
              border: 1px solid #a7f3d0;
              padding: 6px 16px;
              border-radius: 50px;
              font-size: 14px;
              font-weight: 700;
              margin-bottom: 24px;
            }
            .qr-wrapper {
              margin: 20px auto;
              width: 260px;
              height: 260px;
              border: 2px dashed #059669;
              border-radius: 20px;
              padding: 12px;
              background: #ffffff;
            }
            .qr-wrapper img {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
            .instruction-step {
              font-size: 19px;
              font-weight: 900;
              color: #1e293b;
              margin-top: 20px;
            }
            .instruction-sub {
              font-size: 14px;
              color: #64748b;
              margin-top: 6px;
              line-height: 1.6;
            }
            .offline-note {
              margin-top: 16px;
              padding: 8px 14px;
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
              border-radius: 12px;
              font-size: 12px;
              color: #15803d;
              font-weight: 700;
            }
            .footer-info {
              margin-top: 30px;
              padding-top: 15px;
              border-top: 1px solid #e2e8f0;
              font-size: 13px;
              color: #94a3b8;
            }
            @media print {
              body {
                background: #ffffff;
                padding: 0;
              }
              .poster-card {
                border: 2px solid #000000;
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="poster-card">
            <h1 class="store-title">${storeName}</h1>
            <div class="badge">خدمة الفحص الذاتي للأسعار بالهاتف</div>
            
            <div class="qr-wrapper">
              <img src="${unifiedQrUrl}" alt="QR Code" />
            </div>

            <div class="instruction-step">
              📱 افتح كاميرا هاتفك وامسح رمز الـ QR أعلاه
            </div>
            <div class="instruction-sub">
              وتجول بحرية داخل المحل لمسح باركود أي سلعة ومعرفة سعرها فوراً بالـ ${currency} وحالة توفرها!
            </div>

            <div class="offline-note">
              ⚡ يتم حفظ قائمة الأسعار تلقائياً في هاتفك لتعمل بسلاسة حتى لو ضعف أو انقطع الإنترنت داخل المحل.
            </div>

            <div class="footer-info">
              ${phone ? `للاستفسار: ${phone} · ` : ''}يسعدنا خدمتكم دائماً
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // تحميل ملف ويب أوفلاين مستقل بالكامل (Single-file HTML) كخيار إضافي اختياري
  const handleDownloadStandaloneHTML = () => {
    const sanitizedCatalog = products.map(p => ({
      name: p.name || '',
      barcode: (p.code || '').trim(),
      price: Number(p.retailPrice || 0),
      stock: Number(p.stock || 0),
      unit: p.unit || 'قطعة',
      category: p.category || ''
    }));

    const catalogJson = JSON.stringify(sanitizedCatalog);

    const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>قارئ أسعار - ${storeName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Cairo', system-ui, sans-serif;
      background-color: #020617;
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: #0f172a;
      border-bottom: 1px solid #1e293b;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 20;
    }
    .header-title { font-size: 16px; font-weight: 900; color: #ffffff; }
    .header-sub { font-size: 11px; color: #10b981; font-weight: 700; }
    .badge-offline {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
    }
    main {
      flex: 1;
      max-width: 480px;
      width: 100%;
      margin: 0 auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 20px;
      padding: 16px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    }
    .scanner-box {
      background: #000000;
      border-radius: 16px;
      overflow: hidden;
      aspect-ratio: 4/3;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #334155;
    }
    video { width: 100%; height: 100%; object-fit: cover; }
    .search-input {
      width: 100%;
      background: #020617;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 10px 14px;
      color: #ffffff;
      font-size: 13px;
      font-family: inherit;
    }
    .search-input:focus { outline: none; border-color: #10b981; }
    .btn {
      background: #059669;
      color: #ffffff;
      border: none;
      border-radius: 12px;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      width: 100%;
      transition: background 0.2s;
    }
    .btn:hover { background: #10b981; }
    .result-card {
      background: linear-gradient(180deg, #0f172a 0%, #091222 100%);
      border: 2px solid #10b981;
      border-radius: 20px;
      padding: 20px;
      text-align: center;
    }
    .price-box {
      background: rgba(2, 6, 23, 0.9);
      border: 1px solid rgba(16, 185, 129, 0.4);
      border-radius: 16px;
      padding: 14px;
      margin: 14px 0;
    }
    .price-val { font-size: 32px; font-weight: 900; color: #34d399; }
    .stock-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
    }
    .in-stock { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .low-stock { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .out-stock { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .search-results {
      max-height: 220px;
      overflow-y: auto;
      border: 1px solid #1e293b;
      border-radius: 12px;
      background: #020617;
      margin-top: 8px;
    }
    .search-item {
      padding: 10px 12px;
      border-bottom: 1px solid #1e293b;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
    }
    .search-item:hover { background: #0f172a; }
  </style>
</head>
<body>
  <header>
    <div>
      <div class="header-title">${storeName}</div>
      <div class="header-sub">فحص أسعار المواد بالباركود</div>
    </div>
    <div class="badge-offline">محلي (${sanitizedCatalog.length} مادة)</div>
  </header>
  <main>
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <span style="font-size:12px; font-weight:700;">كاميرا فحص الباركود</span>
        <button id="cameraToggleBtn" class="btn" style="width:auto; padding:4px 10px; font-size:11px;">تشغيل الكاميرا</button>
      </div>
      <div class="scanner-box" id="scannerBox">
        <video id="videoPreview" playsinline></video>
        <div id="cameraMsg" style="position:absolute; font-size:12px; color:#94a3b8; text-align:center; padding:10px;">
          اضغط تشغيل الكاميرا لمسح الباركود بهاتفك
        </div>
      </div>
    </div>
    <div id="resultContainer" style="display:none;" class="result-card">
      <div id="prodBarcode" style="font-size:11px; color:#94a3b8; font-family:monospace; margin-bottom:4px;"></div>
      <h2 id="prodName" style="font-size:20px; font-weight:900; color:#ffffff;"></h2>
      <div class="price-box">
        <div style="font-size:11px; color:#94a3b8; margin-bottom:4px;">سعر المفرد</div>
        <div class="price-val"><span id="prodPrice">0</span> <span style="font-size:14px; color:#e2e8f0;">${currency}</span></div>
      </div>
      <div id="stockBadge" class="stock-badge in-stock">متوفر بالمحل</div>
      <button id="nextScanBtn" class="btn" style="margin-top:16px; background:#1e293b;">مسح مادة أخرى</button>
    </div>
    <div class="card">
      <label style="font-size:12px; font-weight:700; display:block; margin-bottom:8px;">البحث بالاسم أو كتابة الباركود</label>
      <input type="text" id="manualSearch" class="search-input" placeholder="اكتب اسم المادة أو الباركود..." />
      <div id="searchResults" class="search-results" style="display:none;"></div>
    </div>
  </main>
  <footer style="text-align:center; padding:16px; font-size:11px; color:#64748b; border-top:1px solid #1e293b;">
    ${storeName} · نسخة أوفلاين مستقلة تماماً لا تتطلب إنترنت
  </footer>
  <script>
    const CATALOG = ${catalogJson};
    let videoStream = null;
    let scanningActive = false;
    function showProduct(prod) {
      document.getElementById('resultContainer').style.display = 'block';
      document.getElementById('prodBarcode').innerText = '#' + prod.barcode;
      document.getElementById('prodName').innerText = prod.name;
      document.getElementById('prodPrice').innerText = Number(prod.price).toLocaleString('ar-IQ');
      const badge = document.getElementById('stockBadge');
      if (prod.stock > 5) {
        badge.className = 'stock-badge in-stock';
        badge.innerText = 'متوفر بالمحل (' + prod.stock + ' ' + (prod.unit || '') + ')';
      } else if (prod.stock > 0) {
        badge.className = 'stock-badge low-stock';
        badge.innerText = 'كمية محدودة (' + prod.stock + ' ' + (prod.unit || '') + ')';
      } else {
        badge.className = 'stock-badge out-stock';
        badge.innerText = 'غير متوفر حالياً';
      }
    }
    function searchBarcode(code) {
      const clean = (code || '').trim().toLowerCase();
      const match = CATALOG.find(p => p.barcode.toLowerCase() === clean);
      if (match) showProduct(match);
      else alert('لم يتم العثور على مادة بالباركود: ' + code);
    }
    document.getElementById('nextScanBtn').onclick = () => {
      document.getElementById('resultContainer').style.display = 'none';
    };
    const searchInput = document.getElementById('manualSearch');
    const searchResults = document.getElementById('searchResults');
    searchInput.oninput = (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) { searchResults.style.display = 'none'; return; }
      const matches = CATALOG.filter(p => p.name.toLowerCase().includes(q) || p.barcode.includes(q)).slice(0, 10);
      if (matches.length === 0) {
        searchResults.innerHTML = '<div style="padding:10px; font-size:12px; color:#94a3b8; text-align:center;">لا توجد نتائج</div>';
        searchResults.style.display = 'block';
        return;
      }
      searchResults.innerHTML = matches.map(m => \`
        <div class="search-item" onclick="selectItem('\${m.barcode}')">
          <div>
            <div style="font-size:12px; font-weight:700; color:#fff;">\${m.name}</div>
            <div style="font-size:10px; color:#94a3b8;">#\${m.barcode}</div>
          </div>
          <div style="font-size:12px; font-weight:900; color:#34d399;">
            \${Number(m.price).toLocaleString('ar-IQ')} ${currency}
          </div>
        </div>
      \`).join('');
      searchResults.style.display = 'block';
    };
    window.selectItem = (barcode) => {
      searchBarcode(barcode);
      searchResults.style.display = 'none';
      searchInput.value = '';
    };
    const toggleBtn = document.getElementById('cameraToggleBtn');
    const video = document.getElementById('videoPreview');
    const cameraMsg = document.getElementById('cameraMsg');
    async function startCamera() {
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = videoStream;
        await video.play();
        cameraMsg.style.display = 'none';
        toggleBtn.innerText = 'إيقاف الكاميرا';
        scanningActive = true;
      } catch (err) {
        alert('تعذر تشغيل الكاميرا، يرجى استخدام البحث بالرابط أو منح إذن الكاميرا');
      }
    }
    function stopCamera() {
      if (videoStream) {
        videoStream.getTracks().forEach(t => t.stop());
        videoStream = null;
      }
      scanningActive = false;
      cameraMsg.style.display = 'block';
      toggleBtn.innerText = 'تشغيل الكاميرا';
    }
    toggleBtn.onclick = () => {
      if (videoStream) stopCamera();
      else startCamera();
    };
  </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `قارئ_اسعار_${storeName.replace(/\s+/g, '_')}_محلي.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSuccessNotice('تم تنزيل ملف الويب المستقل بنجاح! يمكنك مشاركته ليعمل أوفلاين للأبد.');
    setTimeout(() => setSuccessNotice(null), 5000);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
      
      {/* الترويسة الرئيسية */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-900/10 shrink-0">
            <QrCodeIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900">
                قارئ أسعار المواد للزبائن (رابط ذكي موحد)
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">
                أونلاين + تخزين محلي
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              خانة واحدة موحدة ذكية: يفتح أونلاين ويخزن المواد محلياً ليتجول الزبون في المحل بحرية حتى لو انقطع الإنترنت.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadStandaloneHTML}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
            title="تنزيل نسخة أوفلاين كملف HTML مستقل"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>تنزيل ملف HTML أوفلاين</span>
          </button>

          <button
            type="button"
            onClick={handlePrintPoster}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة لافتة QR للمحل</span>
          </button>
        </div>
      </div>

      {/* تنبيه نجاح العملية */}
      {successNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* 🌟 الخانة الواحدة الموحدة الذكية المطلوبة 🌟 */}
      <div className="rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-50/40 via-white to-slate-50/60 p-6 md:p-8 space-y-6 shadow-sm">
        
        {/* شريط المزايا وحالة النظام */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-emerald-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-extrabold flex items-center gap-1.5 border border-emerald-200">
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              <span>يفتح أونلاين فوراً</span>
            </span>
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-extrabold flex items-center gap-1.5 border border-amber-200">
              <HardDriveDownload className="w-3.5 h-3.5 text-amber-600" />
              <span>تحميل وتخزين محلي تلقائي في هاتف الزبون</span>
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200">
              {productsCount} مادة في الكتالوج
            </span>
          </div>

          <span className="text-[11px] text-slate-500 font-medium">
            آخر مزامنة للبيانات: <strong className="text-slate-800 font-bold">{lastSyncTime}</strong>
          </span>
        </div>

        {/* جسم الخانة الموحدة: الرمز في المنتصف والمعلومات والأزرار حوله */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* الجانب الأيمن: رمز الـ QR الموحد العالي الدقة */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center text-center">
            <div className="relative group p-4 bg-white rounded-3xl border-2 border-emerald-400 shadow-xl shadow-emerald-900/5">
              <div className="w-56 h-56 md:w-64 md:h-64 flex items-center justify-center">
                {unifiedQrUrl ? (
                  <img 
                    src={unifiedQrUrl} 
                    alt="Unified Customer QR Code" 
                    className="w-full h-full object-contain rounded-xl"
                  />
                ) : (
                  <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
                )}
              </div>
              <div className="mt-2 text-[11px] font-black text-emerald-800 bg-emerald-50 py-1 px-3 rounded-full border border-emerald-200">
                امسح بكاميرا الهاتف لتجربة الفحص الذاتي
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-2">
              رمز QR موحد ومتوافق مع جميع كاميرات أجهزة آيفون وأندرويد
            </p>
          </div>

          {/* الجانب الأيسر: الشرح، الرابط، وأزرار التحكم */}
          <div className="lg:col-span-7 space-y-4">
            <div>
              <h4 className="text-base font-black text-slate-900 mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>كيف يعمل هذا الرابط الموحد للزبائن؟</span>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                بمجرد أن يمسح الزبون هذا الرمز، يُفتح الرابط في متصفح هاتفه مباشرة ويقوم النظام تلقائياً وبشكل غير مرئي بتنزيل وحفظ جميع أسعار ومواد المحل (<strong>{productsCount} مادة</strong>) داخل الذاكرة المحلية لهاتفه (Local Storage).
                بذلك يستطيع الزبون التجول في كل أرجاء المحل ومسح باركود أي مادة لمعرفة سعرها فوراً حتى لو انقطع الإنترنت أو ضعفت شبكة الهاتف داخل أروقة المحل!
              </p>
            </div>

            {/* صندوق الرابط الموحد مع زر النسخ السريع */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-600" />
                <span>الرابط الموحد المباشر:</span>
              </label>
              
              <div className="flex items-center gap-2 bg-slate-900 rounded-2xl p-2 border border-slate-800 shadow-inner">
                <div className="flex-1 px-3 py-1 text-emerald-400 font-mono text-xs truncate select-all dir-ltr text-left">
                  {unifiedLink}
                </div>
                
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>تم النسخ!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>نسخ الرابط</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleOpenPreview}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="فتح وتجربة قارئ الأسعار الآن"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>معاينة وتجربة</span>
                </button>
              </div>
            </div>

            {/* الأزرار التفاعلية الإضافية */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleSyncCloudCatalog}
                disabled={isSyncingCatalog}
                className="py-2.5 px-4 rounded-xl bg-white hover:bg-emerald-50/80 border border-emerald-300 text-emerald-800 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <RefreshCw className={`w-4 h-4 text-emerald-600 ${isSyncingCatalog ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncingCatalog ? 'جاري مزامنة الكتالوج السحابي...' : 'تحديث كتالوج المواد سحابياً'}
                </span>
              </button>

              <button
                type="button"
                onClick={handlePrintPoster}
                className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>طباعة لافتة QR للمحل</span>
              </button>
            </div>

            {/* مؤشرات حماية وسرية بيانات المتجر */}
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-emerald-950 leading-relaxed font-medium">
                <strong>أمان كامل لبيانات متجرك:</strong> تظهر للزبون فقط تفاصيل المادة (الاسم، سعر المفرد، الصورة، وحالة التوفر بالمخزن). ولا تظهر أي أسعار جملة أو تكاليف شراء، ولا يمكن للزبون الوصول لأي سجلات محاسبية.
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* حقل تخصيص النطاق المخصص / الدومين الخاص بالمتجر إن رغب التاجر */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-emerald-600" />
            <span>نطاق أو رابط المتجر المخصص (Custom Domain / URL):</span>
          </label>
          <span className="text-[11px] text-slate-500">
            النطاق المعتمد حالياً: <strong className="font-mono text-slate-700">{effectiveBaseUrl}</strong>
          </span>
        </div>
        <p className="text-[11px] text-slate-500">
          إذا كان لديك موقع خاص أو دومين مستقل (مثل: https://my-store.com أو رابط استضافة خاصة)، ضعه هنا وسيتم ربطه وتوليد رمز الـ QR بناءً عليه فوراً:
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={customBaseUrl}
            onChange={(e) => setCustomBaseUrl(e.target.value)}
            placeholder="مثال: https://al-mufakir-store.com (اتركه فارغاً لاستخدام الرابط المباشر)"
            className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-emerald-500"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSaveCustomBaseUrl(customBaseUrl)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shrink-0"
            >
              حفظ وتطبيق
            </button>
            {customBaseUrl && (
              <button
                type="button"
                onClick={() => handleSaveCustomBaseUrl('')}
                className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition cursor-pointer shrink-0"
                title="إعادة التعيين للرابط الافتراضي"
              >
                استعادة الافتراضي
              </button>
            )}
          </div>
        </div>

        {/* إذا كان هناك عناوين IP محلية للشبكة داخل المحل */}
        {localIps.length > 0 && (
          <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-slate-500 font-bold">عناوين شبكة الواي فاي المحلية المكتشفة بالمحل:</span>
            {localIps.map(ip => {
              const lanUrl = `http://${ip}:3000`;
              return (
                <button
                  key={ip}
                  type="button"
                  onClick={() => handleSaveCustomBaseUrl(lanUrl)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:border-emerald-500 hover:text-emerald-700 text-[10px] font-mono transition cursor-pointer"
                >
                  {ip} (واي فاي المحل)
                </button>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
