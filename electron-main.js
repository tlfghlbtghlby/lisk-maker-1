import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let localCatalogData = { storeName: 'المتجر', products: [] };
const LOCAL_PORT = 3456;

// 1. استخراج عنوان IP المحلي الخاص بشبكة الهوت سبوت أو الشبكة المحلية للكمبيوتر
function getLocalHotspotIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // تفضيل عناوين IPv4 الحقيقية غير الداخلية
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '192.168.137.1'; // الـ IP الافتراضي لخاصية Mobile Hotspot في ويندوز
}

// 2. تشغيل سيرفر الويب المحلي الأوفلاين للزبائن
function startLocalServer() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    // مسار تزويد الهاتف بالبيانات المحلية كاملة JSON
    if (req.url === '/api/products') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(localCatalogData));
      return;
    }

    // مسار عرض صفحة فحص الأسعار المطابقة تماماً لنسخة الأونلاين
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>فحص أسعار المواد بالباركود</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/html5-qrcode"></script>
  <style>
    body { background-color: #060913; font-family: system-ui, -apple-system, sans-serif; }
    .card-box { background-color: #0b1325; border: 1px solid #162238; }
    .scan-guide {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 220px;
      height: 150px;
      border: 3px solid rgba(255, 255, 255, 0.85);
      border-radius: 14px;
      pointer-events: none;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
    }
    #reader video {
      object-fit: cover !important;
      border-radius: 12px;
      width: 100% !important;
      height: 100% !important;
    }
  </style>
</head>
<body class="text-slate-100 min-h-screen p-4 flex flex-col items-center">
  <div class="w-full max-w-md flex flex-col gap-4">
    
    <!-- الترويسة وعدد المواد وحالة الاتصال -->
    <div class="flex items-start justify-between pt-2 pb-1">
      <div>
        <span id="badgeCount" class="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          محلي (جاري التحميل...)
        </span>
      </div>
      <div class="text-left">
        <h1 id="sName" class="text-lg font-bold text-white tracking-wide">المتجر</h1>
        <p class="text-[11px] text-emerald-500 font-medium">فحص أسعار المواد بالباركود</p>
      </div>
    </div>

    <!-- بطاقة كاميرا فحص الباركود -->
    <div class="card-box rounded-2xl p-4 shadow-xl">
      <div class="flex items-center justify-between mb-3">
        <button id="camToggle" class="px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">
          <span id="camIcon">📷</span>
          <span id="camText">تشغيل الكاميرا</span>
        </button>
        <span class="text-xs font-bold text-slate-300">كاميرا فحص الباركود</span>
      </div>

      <!-- مساحة الكاميرا ومحدد المسح -->
      <div class="relative w-full h-56 bg-[#040711] rounded-xl overflow-hidden flex items-center justify-center border border-slate-800/80">
        <div id="camPlaceholder" class="text-xs text-slate-500 text-center px-4">
          اضغط تشغيل الكاميرا لمسح الباركود بهاتفك
        </div>
        <div id="reader" class="w-full h-full hidden"></div>
        <div id="scanBox" class="scan-guide hidden"></div>
      </div>
    </div>

    <!-- حقل البحث الحي وقائمة الاقتراحات الفورية -->
    <div class="card-box rounded-2xl p-4 shadow-xl space-y-3">
      <div class="text-xs font-bold text-slate-300">البحث بالاسم أو كتابة الباركود</div>
      
      <div class="relative">
        <input 
          type="text" 
          id="q" 
          placeholder="ابحث بالاسم أو الباركود..."
          class="w-full bg-[#060b17] border border-slate-800 rounded-xl py-3 pr-4 pl-10 text-right text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
        >
        <button id="clearBtn" class="hidden absolute left-3 top-3 text-slate-400 hover:text-white text-sm font-bold w-5 h-5 flex items-center justify-center cursor-pointer">
          ✕
        </button>
      </div>

      <!-- بطاقة عرض المادة المحددة بنمط الأونلاين -->
      <div id="singleCard" class="hidden bg-[#070e1e] border border-emerald-500/30 rounded-xl p-3.5 flex items-center justify-between shadow-lg">
        <div class="text-emerald-400 font-black text-lg" id="cardPrice">
          0 دينار
        </div>
        <div class="text-right">
          <div class="text-sm font-bold text-white" id="cardName">اسم المادة</div>
          <div class="text-[11px] text-slate-500 font-mono mt-0.5" id="cardCode">#000000</div>
        </div>
      </div>

      <!-- قائمة البحث الحي أثناء الكتابة -->
      <div id="liveList" class="space-y-1 max-h-60 overflow-y-auto divide-y divide-slate-800/40"></div>
    </div>

  </div>

  <script>
    let prods = [];
    const sName = document.getElementById('sName');
    const badgeCount = document.getElementById('badgeCount');
    const q = document.getElementById('q');
    const clearBtn = document.getElementById('clearBtn');
    const liveList = document.getElementById('liveList');
    const singleCard = document.getElementById('singleCard');
    const cardName = document.getElementById('cardName');
    const cardPrice = document.getElementById('cardPrice');
    const cardCode = document.getElementById('cardCode');

    // 1. جلب الكتالوج من سيرفر Electron
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        prods = data.products || [];
        sName.textContent = data.storeName || 'المتجر';
        badgeCount.textContent = 'محلي (' + prods.length + ' مادة)';
      })
      .catch(() => {
        sName.textContent = 'المتجر (محلي)';
        badgeCount.textContent = 'غير متصل';
      });

    // 2. دالة عرض تفاصيل المادة في البطاقة العلوية
    function showProductCard(p) {
      cardName.textContent = p.name;
      const formattedPrice = Number(p.retailPrice || p.price || 0).toLocaleString('en-US');
      cardPrice.textContent = formattedPrice + ' ' + (p.currency || 'دينار');
      cardCode.textContent = '#' + (p.code || p.barcode || '');
      singleCard.classList.remove('hidden');
    }

    // 3. محرك البحث الحي اللحظي أثناء كتابة الحروف
    q.addEventListener('input', () => {
      const term = q.value.trim().toLowerCase();
      liveList.innerHTML = '';

      if (!term) {
        clearBtn.classList.add('hidden');
        singleCard.classList.add('hidden');
        return;
      }

      clearBtn.classList.remove('hidden');

      // مطابقة تامة بالباركود أو الاسم
      const exactMatch = prods.find(p => 
        String(p.code || '').toLowerCase() === term || 
        String(p.barcode || '').toLowerCase() === term ||
        String(p.name || '').toLowerCase() === term
      );

      if (exactMatch) {
        showProductCard(exactMatch);
      } else {
        singleCard.classList.add('hidden');
      }

      // البحث الحي في كل المواد وعرض أقرب 10 نتائج
      const matches = prods.filter(p => {
        const nameMatch = p.name && p.name.toLowerCase().includes(term);
        const codeMatch = p.code && String(p.code).toLowerCase().includes(term);
        const barcodeMatch = p.barcode && String(p.barcode).toLowerCase().includes(term);
        return nameMatch || codeMatch || barcodeMatch;
      }).slice(0, 10);

      matches.forEach(item => {
        const row = document.createElement('div');
        row.className = 'py-2.5 px-2 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 rounded-lg transition active:scale-[0.98]';
        const priceVal = Number(item.retailPrice || item.price || 0).toLocaleString('en-US');
        
        row.innerHTML = \`
          <span class="text-xs font-black text-emerald-400">\${priceVal} \${item.currency || 'د.ع'}</span>
          <div class="text-right">
            <div class="text-xs font-bold text-white">\${item.name}</div>
            <div class="text-[10px] text-slate-500 font-mono">#\${item.code || item.barcode || ''}</div>
          </div>
        \`;

        row.onclick = () => {
          showProductCard(item);
          q.value = item.name;
          liveList.innerHTML = '';
        };

        liveList.appendChild(row);
      });
    });

    // زر تفريغ حقل البحث
    clearBtn.onclick = () => {
      q.value = '';
      liveList.innerHTML = '';
      singleCard.classList.add('hidden');
      clearBtn.classList.add('hidden');
      q.focus();
    };

    // 4. تشغيل وإيقاف الكاميرا لقراءة الباركود
    let qrEngine = null;
    let isRunning = false;
    const camToggle = document.getElementById('camToggle');
    const camIcon = document.getElementById('camIcon');
    const camText = document.getElementById('camText');
    const camPlaceholder = document.getElementById('camPlaceholder');
    const reader = document.getElementById('reader');
    const scanBox = document.getElementById('scanBox');

    camToggle.onclick = async () => {
      if (!isRunning) {
        try {
          camPlaceholder.classList.add('hidden');
          reader.classList.remove('hidden');
          scanBox.classList.remove('hidden');

          qrEngine = new Html5Qrcode('reader');
          await qrEngine.start(
            { facingMode: 'environment' },
            { 
              fps: 25, 
              qrbox: { width: 250, height: 160 },
              aspectRatio: 1.777778 
            },
            (decodedText) => {
              q.value = decodedText;
              q.dispatchEvent(new Event('input'));
              // إيقاف الكاميرا تلقائياً بعد نجاح القراءة لتوفير البطارية
              stopCamera();
            },
            () => {}
          );

          isRunning = true;
          camToggle.classList.replace('bg-emerald-600', 'bg-rose-600');
          camToggle.classList.replace('hover:bg-emerald-500', 'hover:bg-rose-500');
          camText.textContent = 'إيقاف الكاميرا';
          camIcon.textContent = '🛑';
        } catch (err) {
          alert('يرجى السماح بصلاحية الكاميرا من المتصفح.');
          stopCamera();
        }
      } else {
        stopCamera();
      }
    };

    function stopCamera() {
      if (qrEngine) {
        qrEngine.stop().then(() => {
          qrEngine.clear();
          qrEngine = null;
        }).catch(() => {});
      }
      reader.classList.add('hidden');
      scanBox.classList.add('hidden');
      camPlaceholder.classList.remove('hidden');
      
      isRunning = false;
      camToggle.classList.replace('bg-rose-600', 'bg-emerald-600');
      camToggle.classList.replace('hover:bg-rose-500', 'hover:bg-emerald-500');
      camText.textContent = 'تشغيل الكاميرا';
      camIcon.textContent = '📷';
    }
  </script>
</body>
</html>`);
  });

  server.listen(LOCAL_PORT, '0.0.0.0', () => {
    console.log(`[Offline Server] Price Checker active on http://${getLocalHotspotIP()}:${LOCAL_PORT}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron-preload.cjs'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
}

// 3. معالجة دوال IPC بين الواجهة وElectron
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  return await mainWindow.webContents.getPrintersAsync();
});

ipcMain.on('update-local-catalog', (event, data) => {
  localCatalogData = data || { storeName: 'المتجر', products: [] };
});

ipcMain.handle('get-hotspot-url', () => {
  const ip = getLocalHotspotIP();
  return `http://${ip}:${LOCAL_PORT}`;
});

// معالجة الطباعة المباشرة والصامتة
const handlePrint = async (event, options = {}) => {
  return new Promise(async (resolve) => {
    try {
      const isA4 = options.pageSize === 'A4';
      
      if (options.html) {
        let printWin = new BrowserWindow({
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        });

        await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(options.html)}`);

        const contentHeightPx = await printWin.webContents.executeJavaScript('document.body.scrollHeight');
        const computedHeightMicrons = Math.ceil((contentHeightPx / 96) * 25400) + 5000;

        const printOptions = {
          silent: true,
          printBackground: true,
          deviceName: options.deviceName || '',
          margins: { marginType: 'none' },
          pageSize: isA4 ? 'A4' : { 
            width: 72000, 
            height: computedHeightMicrons 
          },
        };

        printWin.webContents.print(printOptions, (success, failureReason) => {
          if (!success) console.warn('فشل أمر الطباعة:', failureReason);
          printWin.destroy();
          resolve(success);
        });
      } else {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return resolve(false);

        const printOptions = {
          silent: true,
          printBackground: true,
          deviceName: options.deviceName || '',
          margins: { marginType: 'default' },
          pageSize: isA4 ? 'A4' : { 
            width: 72000, 
            height: options.heightMicrons || 80000 
          },
        };

        win.webContents.print(printOptions, (success, failureReason) => {
          if (!success) console.warn('فشل أمر الطباعة:', failureReason);
          resolve(success);
        });
      }
    } catch (err) {
      console.error('خطأ أثناء معالجة الطباعة:', err);
      resolve(false);
    }
  });
};

ipcMain.handle('print-silent', handlePrint);
ipcMain.handle('print-direct', handlePrint);

app.whenReady().then(() => {
  startLocalServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});