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

// دالة لاكتشاف عنوان IP نقطة اتصال الهوت سبوت أو الشبكة المحلية
function getLocalHotspotIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// تشغيل خادم الويب المحلي المستقل أوفلاين
function startLocalServer() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // 1. مسار جلب قائمة المواد بالكامل بصيغة JSON لهاتف الزبون
    if (req.url === '/api/products') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(localCatalogData));
      return;
    }

    // 2. مسار عرض واجهة فحص الأسعار الأوفلاين السريعة للزبون
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>قارئ الأسعار الأوفلاين</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/html5-qrcode"></script>
</head>
<body class="bg-[#070d18] text-white min-h-screen p-4 flex flex-col items-center font-sans">
  <div class="w-full max-w-md text-center py-3 border-b border-slate-800">
    <span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40">🟢 اتصال محلي مباشر بدون إنترنت</span>
    <h1 id="sName" class="text-xl font-bold mt-2 text-amber-400">جاري تحميل المتجر...</h1>
  </div>

  <div class="w-full max-w-md my-4 space-y-3">
    <input type="text" id="q" placeholder="اكتب اسم المادة أو رقم الباركود..." class="w-full p-3.5 bg-[#0b1728] border border-slate-700 rounded-xl text-center focus:border-amber-400 focus:outline-none text-white text-sm">
    
    <button id="camBtn" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition">
      📷 تشغيل الكاميرا لمسح الباركود
    </button>
    <div id="reader" class="hidden rounded-xl overflow-hidden border border-slate-700"></div>

    <div id="card" class="hidden bg-[#0b1728] border border-slate-700 p-5 rounded-2xl text-center space-y-2 mt-4 shadow-xl">
      <h2 id="pName" class="text-lg font-bold text-white"></h2>
      <div id="pPrice" class="text-3xl font-black text-emerald-400"></div>
      <span id="pCode" class="text-xs text-slate-500 block font-mono"></span>
    </div>

    <div id="list" class="space-y-2 max-h-80 overflow-y-auto"></div>
  </div>

  <script>
    let prods = [];
    fetch('/api/products')
      .then(r => r.json())
      .then(d => {
        prods = d.products || [];
        document.getElementById('sName').textContent = d.storeName || 'المتجر';
      })
      .catch(err => {
        document.getElementById('sName').textContent = 'تعذر الاتصال بالكمبيوتر';
      });

    const q = document.getElementById('q');
    const list = document.getElementById('list');
    const card = document.getElementById('card');

    function showItem(p) {
      document.getElementById('pName').textContent = p.name;
      document.getElementById('pPrice').textContent = Number(p.retailPrice).toLocaleString('en-US') + ' ' + (p.currency || 'د.ع');
      document.getElementById('pCode').textContent = 'باركود: ' + p.code;
      card.classList.remove('hidden');
    }

    q.oninput = () => {
      const val = q.value.trim().toLowerCase();
      list.innerHTML = '';
      if (!val) { card.classList.add('hidden'); return; }
      const match = prods.find(x => String(x.code).toLowerCase() === val);
      if (match) showItem(match);

      prods.filter(x => x.name.toLowerCase().includes(val) || String(x.code).includes(val)).slice(0, 10).forEach(p => {
        const el = document.createElement('div');
        el.className = 'p-3 bg-[#0b1728] border border-slate-800 rounded-xl flex justify-between cursor-pointer hover:border-slate-600 transition';
        el.innerHTML = '<span class="text-xs font-bold text-white">' + p.name + '</span><span class="text-xs text-emerald-400 font-black">' + Number(p.retailPrice).toLocaleString('en-US') + '</span>';
        el.onclick = () => showItem(p);
        list.appendChild(el);
      });
    };

    let qrScanner = null;
    document.getElementById('camBtn').onclick = () => {
      const rd = document.getElementById('reader');
      if (rd.classList.contains('hidden')) {
        rd.classList.remove('hidden');
        qrScanner = new Html5Qrcode("reader");
        qrScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 200 }, (decodedText) => {
          q.value = decodedText;
          q.dispatchEvent(new Event('input'));
        });
      } else {
        if (qrScanner) qrScanner.stop();
        rd.classList.add('hidden');
      }
    };
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

// 1. استدعاء قائمة الطابعات
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  return await mainWindow.webContents.getPrintersAsync();
});

// 2. تحديث قائمة المواد المخزنة محلياً للسيرفر الأوفلاين
ipcMain.on('update-local-catalog', (event, data) => {
  localCatalogData = data || { storeName: 'المتجر', products: [] };
});

// 3. جلب رابط الهوت سبوت المحلي لتوليد الـ QR
ipcMain.handle('get-hotspot-url', () => {
  const ip = getLocalHotspotIP();
  return `http://${ip}:${LOCAL_PORT}`;
});

// 4. دالة الطباعة الصامتة الذكية
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
