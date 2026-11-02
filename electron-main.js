import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import os from 'os';
import fs from 'fs';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let localCatalogData = { storeName: 'المتجر', products: [] };
const LOCAL_PORT = 3456;

// ملف الحفظ الاحتياطي المحلي للمواد على القرص لضمان عدم ضياعها
let catalogCachePath = '';
function initCachePath() {
  try {
    catalogCachePath = path.join(app.getPath('userData'), 'offline-catalog-cache.json');
    if (fs.existsSync(catalogCachePath)) {
      const saved = fs.readFileSync(catalogCachePath, 'utf-8');
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.products)) {
        localCatalogData = parsed;
        console.log('[Offline Server] Loaded cached products from disk:', localCatalogData.products.length);
      }
    }
  } catch (e) {
    console.warn('Could not initialize local cache:', e);
  }
}

// 1. استخراج عنوان IP المحلي الخاص بشبكة الهوت سبوت أو الشبكة المحلية للكمبيوتر
function getLocalHotspotIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
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

    // مسار تزويد الهاتف بالبيانات المحلية كاملة بصيغة JSON
    if (req.url === '/api/products') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(localCatalogData));
      return;
    }

    // مسار عرض صفحة فحص الأسعار الأوفلاين
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
          محلي (جاري المزامنة...)
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

      <!-- بطاقة عرض المادة المحددة -->
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

const allWindows = new Set();

function parseOpenRoute(argvList = process.argv) {
  for (const arg of argvList) {
    if (typeof arg === 'string' && arg.startsWith('--open-route=')) {
      return arg.replace('--open-route=', '').trim();
    }
  }
  return '';
}

// 1. دالة إنشاء النافذة المنفصلة (تُفتح فقط عند الكليك أيمن أو من اختصار مخصص)
function createSectionWindow(route = 'pos', title = '') {
  const cleanRoute = (route || 'pos').replace(/^[#?]/, '').trim();

  const titlesMap = {
    pos: 'نقطة البيع',
    inventory: 'المواد والمخزون',
    invoices: 'سجل القوائم والفواتير',
    shifts: 'الشفتات والورديات',
    customers: 'حسابات الزبائن',
    debts: 'البيع الآجل والديون',
    reports: 'التقارير المالية',
    settings: 'الإعدادات العامة',
    'sales-reps': 'المندوبين',
    quick_add: 'إضافة مواد سريعة'
  };

  const windowTitle = title || titlesMap[cleanRoute] || 'نافذة مخصصة';

  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 850,
    minHeight: 550,
    title: `المفكر المحاسبي - ${windowTitle}`,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron-preload.cjs'),
    },
  });

  win.openRoute = cleanRoute;
  win.isStandalone = true;
  allWindows.add(win);

  win.on('closed', () => {
    allWindows.delete(win);
  });

  const indexPath = path.join(__dirname, 'dist/index.html');
  const targetHash = `${cleanRoute}?standalone=true`;

  if (app.isPackaged) {
    win.loadFile(indexPath, { hash: targetHash, query: { standalone: 'true', 'open-route': cleanRoute } });
  } else {
    if (fs.existsSync(indexPath)) {
      win.loadFile(indexPath, { hash: targetHash, query: { standalone: 'true', 'open-route': cleanRoute } });
    } else {
      win.loadURL(`http://localhost:5173/#${targetHash}`);
    }
  }

  return win;
}

// 2. دالة إنشاء النافذة الرئيسية الكاملة (تفتح عند تشغيل البرنامج العادي مع كافة الأشرطة)
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 950,
    minHeight: 600,
    title: 'برنامج المفكر المحاسبي',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron-preload.cjs'),
    },
  });

  mainWindow.openRoute = 'main';
  mainWindow.isStandalone = false;
  allWindows.add(mainWindow);

  mainWindow.on('closed', () => {
    allWindows.delete(mainWindow);
    mainWindow = null;
  });

  const indexPath = path.join(__dirname, 'dist/index.html');
  
  // تفتح بدون وسم standalone لتعرض الهيدر وشريط التبويبات بالكامل
  if (app.isPackaged) {
    winLoadMain(mainWindow, indexPath);
  } else {
    if (fs.existsSync(indexPath)) {
      winLoadMain(mainWindow, indexPath);
    } else {
      mainWindow.loadURL('http://localhost:5173/');
    }
  }

  return mainWindow;
}

function winLoadMain(win, indexPath) {
  win.loadFile(indexPath);
}

// 3. ضبط بدء التشغيل (يفرق بين النقر على الاختصار أو فتح البرنامج العادي)
function startApp() {
  const openRoute = parseOpenRoute();
  
  if (openRoute) {
    // إذا فُتح التطبيق عبر اختصار لسطح المكتب يحمل --open-route=...
    createSectionWindow(openRoute, '');
  } else {
    // تشغيل عادي للبرنامج الرئيسي مع كامل الأشرطة والهيدر
    createMainWindow();
  }
}

// إنشاء اختصار سطح المكتب الحقيقي لويندوز (.lnk) عبر VBScript السريع والمستقر
function createWindowsShortcut({ route, name }) {
  return new Promise((resolve) => {
    try {
      const desktopPath = app.getPath('desktop');
      const cleanRoute = (route || 'pos').replace(/^[#?]/, '').trim();
      const safeName = (name || 'القسم').replace(/[/\\?%*:|"<>]/g, '').trim();
      const fileName = `المفكر المحاسبي - ${safeName}.lnk`;
      const lnkPath = path.join(desktopPath, fileName);
      const exePath = process.execPath;
      const args = `--open-route=${cleanRoute}`;
      const workingDir = path.dirname(exePath);

      if (process.platform === 'win32') {
        // إنشاء ملف VBS مؤقت لإنشاء اختصار WScript.Shell بدون مشاكل صلاحيات
        const tempVbsPath = path.join(app.getPath('temp'), `create_pos_shortcut_${Date.now()}.vbs`);

        // محتوى السكريبت المنفذ لإنشاء ملف .lnk رسمي
        const vbsContent = [
          'Set ws = WScript.CreateObject("WScript.Shell")',
          `Set sc = ws.CreateShortcut("${lnkPath.replace(/\\/g, '\\\\')}")`,
          `sc.TargetPath = "${exePath.replace(/\\/g, '\\\\')}"`,
          `sc.Arguments = "${args}"`,
          `sc.WorkingDirectory = "${workingDir.replace(/\\/g, '\\\\')}"`,
          `sc.IconLocation = "${exePath.replace(/\\/g, '\\\\')},0"`,
          `sc.Description = "المفكر المحاسبي - ${safeName}"`,
          'sc.Save'
        ].join('\r\n');

        // كتابة الملف المؤقت وترميزه
        fs.writeFileSync(tempVbsPath, vbsContent, 'utf8');

        // تشغيل السكريبت وحذفه فوراً بعد الانتهاء
        exec(`cscript //nologo "${tempVbsPath}"`, { windowsHide: true }, (err) => {
          try {
            if (fs.existsSync(tempVbsPath)) fs.unlinkSync(tempVbsPath);
          } catch (_) {}

          if (err) {
            console.error('[Shortcut Error]:', err);
            resolve({ success: false, error: err.message });
          } else {
            console.log(`[Shortcut Created Successfully]: ${lnkPath}`);
            resolve({ success: true, path: lnkPath });
          }
        });
      } else {
        resolve({ success: true });
      }
    } catch (e) {
      console.error('[Shortcut Exception]:', e);
      resolve({ success: false, error: e.message });
    }
  });
}

// 3. معالجة دوال IPC بين الواجهة وElectron
ipcMain.handle('get-printers', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (!win) return [];
  return await win.webContents.getPrintersAsync();
});

// فتح قسم في نافذة BrowserWindow مستقلة
ipcMain.handle('open-section-window', (event, { route, title }) => {
  createSectionWindow(route || 'pos', title || '');
  return { success: true };
});

// استقبال طلب إنشاء الاختصار مع دعم name و title معاً
ipcMain.handle('create-desktop-shortcut', async (event, payload) => {
  const route = payload?.route || 'pos';
  const name = payload?.name || payload?.title || 'القسم';
  return await createWindowsShortcut({ route, name });
});

// استعلام المسار الأولي الممرر للنافذة
ipcMain.handle('get-initial-route', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win?.openRoute || parseOpenRoute() || '';
});

// IPC Relay: تمرير الأحداث بين جميع النوافذ عبر الذاكرة بأقل من ملي ثانية وبدون إنترنت
const relaySyncEvent = (event, payload) => {
  for (const win of allWindows) {
    if (win && !win.isDestroyed() && win.webContents !== event.sender) {
      win.webContents.send('sync-event', payload);
    }
  }
};

ipcMain.on('sync-event', relaySyncEvent);
ipcMain.on('broadcast-sync', relaySyncEvent);

// استقبال كتالوج المواد واسم المتجر وحفظه تلقائياً
ipcMain.on('update-local-catalog', (event, data) => {
  if (data) {
    localCatalogData = {
      storeName: data.storeName || 'المتجر',
      products: Array.isArray(data.products) ? data.products : []
    };
    console.log('[Offline Server] Live Catalog updated! Total products:', localCatalogData.products.length);

    // حفظ في القرص
    if (catalogCachePath) {
      try {
        fs.writeFileSync(catalogCachePath, JSON.stringify(localCatalogData), 'utf-8');
      } catch (err) {
        console.error('Failed to save catalog to cache:', err);
      }
    }
  }
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
  initCachePath();
  startLocalServer();
  startApp(); // استدعاء startApp بدلاً من createWindow
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
