import { app, BrowserWindow, ipcMain, shell } from 'electron';
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
const allWindows = new Set();

// خريطة أسماء ومسارات كافة التبويبات المتاحة في التطبيق
const TAB_TITLES_MAP = {
  pos: 'نقطة البيع وقائمة جديدة',
  inventory: 'المواد والمخزون',
  invoices: 'سجل القوائم والفواتير',
  shifts: 'الشفتات',
  customers: 'البيع الآجل وحسابات الديون',
  debts: 'حسابات الديون',
  reports: 'الأرباح والتقارير المالية',
  settings: 'الإعدادات والنسخ الاحتياطي',
  'sales-reps': 'مندوبو المبيعات',
  quick_add: 'الإضافة السريعة',
  offers: 'العروض والخصومات'
};

// أيقونة النوافذ (تُنسخ من public إلى dist عند البناء)
const APP_ICON = path.join(__dirname, 'dist', 'icon.png');
const windowIcon = () => (fs.existsSync(APP_ICON) ? APP_ICON : undefined);

let catalogCachePath = '';
function initCachePath() {
  try {
    catalogCachePath = path.join(app.getPath('userData'), 'offline-catalog-cache.json');
    if (fs.existsSync(catalogCachePath)) {
      const saved = fs.readFileSync(catalogCachePath, 'utf-8');
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.products)) {
        localCatalogData = parsed;
      }
    }
  } catch (e) {
    console.warn('Could not initialize local cache:', e);
  }
}

function getLocalHotspotIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '192.168.137.1';
}

function parseOpenRoute(argvList = process.argv) {
  const list = Array.isArray(argvList) ? argvList : [];
  for (let i = 0; i < list.length; i++) {
    const arg = list[i];
    if (typeof arg !== 'string') continue;
    // يدعم --open-route=pos و --open-route="pos" و --open-route pos
    if (arg.startsWith('--open-route=')) {
      return arg.slice('--open-route='.length).replace(/^["']|["']$/g, '').trim();
    }
    if (arg === '--open-route' && typeof list[i + 1] === 'string') {
      return list[i + 1].replace(/^["']|["']$/g, '').trim();
    }
  }
  return '';
}

// 1. إنشاء نافذة منفصلة مستقلة (تعمل عند الكليك أيمن أو فتح اختصار مخصص)
function createSectionWindow(route = 'pos', title = '') {
  const cleanRoute = (route || 'pos').replace(/^[#?]/, '').trim();

  const titlesMap = {
    pos: 'نقطة البيع',
    inventory: 'المواد والمخزون',
    invoices: 'سجل القوائم والفواتير',
    shifts: 'الشفتات',
    customers: 'حسابات الزبائن',
    debts: 'البيع الآجل والديون',
    reports: 'التقارير المالية',
    settings: 'الإعدادات العامة',
    'sales-reps': 'المندوبين',
    'offers': 'العروض',
    quick_add: 'إضافة مواد سريعة'
  };

  const windowTitle = title || titlesMap[cleanRoute] || 'نافذة مخصصة';

  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 850,
    minHeight: 550,
    title: `المفكر المحاسبي - ${windowTitle}`,
    icon: windowIcon(),
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

// 2. إنشاء النافذة الرئيسية بكامل الأشرطة والهيدر
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 950,
    minHeight: 600,
    title: 'برنامج المفكر المحاسبي',
    icon: windowIcon(),
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

  if (app.isPackaged) {
    mainWindow.loadFile(indexPath);
  } else {
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      mainWindow.loadURL('http://localhost:5173/');
    }
  }

  return mainWindow;
}

// 3. دالة بدء التطبيق للتمييز بين الاختصار المباشر والتشغيل العادي
function startApp() {
  const openRoute = parseOpenRoute();
  if (openRoute) {
    createSectionWindow(openRoute, '');
  } else {
    createMainWindow();
  }
}

// 4. إنشاء اختصار سطح المكتب (.lnk) عبر Electron Shell الأصلي
function createWindowsShortcut({ route, name, title }) {
  try {
    if (process.platform !== 'win32') {
      return { success: false, error: 'اختصارات سطح المكتب تعمل على ويندوز فقط.' };
    }
    const desktopPath = app.getPath('desktop');
    if (!desktopPath || !fs.existsSync(desktopPath)) {
      return { success: false, error: 'تعذر الوصول إلى مجلد سطح المكتب.' };
    }
    const cleanRoute = (route || 'pos').replace(/^[#?]/, '').replace(/[^a-zA-Z0-9_-]/g, '').trim() || 'pos';
    const rawName = name || title || 'القسم';
    const safeName = rawName.replace(/[\u0000-\u001f/\\?%*:|"<>]/g, '').replace(/\s+/g, ' ').trim() || cleanRoute;
    // PORTABLE_EXECUTABLE_FILE يشير للملف الحقيقي في النسخة المحمولة؛ وإلا الملف التنفيذي الحالي
    const exePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
    const options = {
      target: exePath,
      args: `--open-route=${cleanRoute}`,
      cwd: path.dirname(exePath),
      icon: exePath,
      iconIndex: 0,
      appUserModelId: 'com.listmanger.app',
      description: `المفكر المحاسبي - ${safeName}`,
    };

    // الاسم العربي أولاً، وإن لم يُكتب الملف فعلياً نجرّب اسماً لاتينياً آمناً
    const candidates = [
      `المفكر المحاسبي - ${safeName}.lnk`,
      `Almufakir-${cleanRoute}.lnk`,
    ];
    for (const fileName of candidates) {
      const lnkPath = path.join(desktopPath, fileName);
      let ok = false;
      try {
        ok = shell.writeShortcutLink(lnkPath, 'replace', options);
      } catch (err) {
        console.error('writeShortcutLink failed for', fileName, err);
      }
      if (ok && fs.existsSync(lnkPath)) {
        // نقرأ الاختصار للتأكد أن الوجهة والوسائط محفوظة فعلاً
        let verified = true;
        try {
          const back = shell.readShortcutLink(lnkPath);
          verified = !!back && back.target === exePath && String(back.args || '').includes(`--open-route=${cleanRoute}`);
        } catch {}
        return { success: true, path: lnkPath, fileName, target: exePath, args: options.args, verified };
      }
    }
    return { success: false, error: 'تعذر كتابة ملف الاختصار على سطح المكتب (قد تمنعه صلاحيات المجلد).' };
  } catch (e) {
    console.error('Shortcut creation error:', e);
    return { success: false, error: e && e.message };
  }
}

// IPC Handlers
// ---------- صور المواد: تُحفظ محليًا فقط داخل مجلد بيانات التطبيق (لا تُرفع للسحابة) ----------
const productImagesDir = () => {
  const dir = path.join(app.getPath('userData'), 'product-images');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};
const safeImageId = (id) => String(id || '').replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 80);
const dataUrlToBuffer = (d) => {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(d || ''));
  if (!m) return null;
  const buf = Buffer.from(m[1], 'base64');
  return buf.length > 0 && buf.length < 8 * 1024 * 1024 ? buf : null;
};

ipcMain.handle('product-image-save', (event, { id, full, thumb } = {}) => {
  try {
    const safe = safeImageId(id);
    const f = dataUrlToBuffer(full);
    const t = dataUrlToBuffer(thumb);
    if (!safe || !f || !t) return { success: false, error: 'invalid' };
    const dir = productImagesDir();
    fs.writeFileSync(path.join(dir, safe + '.jpg'), f);
    fs.writeFileSync(path.join(dir, safe + '_t.jpg'), t);
    return { success: true };
  } catch (e) {
    return { success: false, error: e && e.message };
  }
});

ipcMain.handle('product-image-get', (event, { id, thumb } = {}) => {
  try {
    const safe = safeImageId(id);
    if (!safe) return null;
    const file = path.join(productImagesDir(), safe + (thumb ? '_t.jpg' : '.jpg'));
    if (!fs.existsSync(file)) return null;
    return 'data:image/jpeg;base64,' + fs.readFileSync(file).toString('base64');
  } catch (e) {
    return null;
  }
});

ipcMain.handle('product-image-delete', (event, { id } = {}) => {
  try {
    const safe = safeImageId(id);
    if (!safe) return { success: false };
    const dir = productImagesDir();
    for (const n of [safe + '.jpg', safe + '_t.jpg']) {
      const f = path.join(dir, n);
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e && e.message };
  }
});

ipcMain.handle('product-image-list', () => {
  try {
    return fs.readdirSync(productImagesDir()).filter(n => n.endsWith('.jpg') && !n.endsWith('_t.jpg')).map(n => n.slice(0, -4));
  } catch (e) {
    return [];
  }
});

// إرسال القائمة PDF عبر واتساب (ويندوز): حفظ الملف مؤقتاً، نسخه للحافظة كملف، وفتح محادثة واتساب ليلصقه المستخدم (Ctrl+V)
ipcMain.handle('whatsapp-send-pdf', async (event, { base64, fileName, phone } = {}) => {
  try {
    if (!base64) return { success: false, error: 'no data' };
    const dir = path.join(os.tmpdir(), 'mufakkir-share');
    fs.mkdirSync(dir, { recursive: true });
    const safe = String(fileName || 'invoice.pdf').replace(/[\\/:*?"<>|'`$%&;]/g, '_');
    const filePath = path.join(dir, safe.toLowerCase().endsWith('.pdf') ? safe : safe + '.pdf');
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));

    let copied = false;
    if (process.platform === 'win32') {
      copied = await new Promise((resolve) => {
        exec(`powershell -NoProfile -Command "Set-Clipboard -LiteralPath '${filePath.replace(/'/g, "''")}'"`, { windowsHide: true }, (err) => resolve(!err));
      });
    }
    try { shell.showItemInFolder && !copied && shell.showItemInFolder(filePath); } catch (e) {}

    const num = String(phone || '').replace(/[^0-9]/g, '');
    let opened = false;
    try {
      await shell.openExternal(num ? `whatsapp://send?phone=${num}` : 'whatsapp://send');
      opened = true;
    } catch (e) {
      try {
        await shell.openExternal(num ? `https://wa.me/${num}` : 'https://web.whatsapp.com/');
        opened = true;
      } catch (e2) {}
    }
    return { success: true, copied, opened, filePath };
  } catch (e) {
    return { success: false, error: e && e.message };
  }
});

ipcMain.handle('get-printers', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (!win) return [];
  return await win.webContents.getPrintersAsync();
});

ipcMain.handle('create-desktop-shortcut', async (event, payload) => {
  const route = payload?.route || 'pos';
  const name = payload?.name || payload?.title || 'القسم';
  return createWindowsShortcut({ route, name });
});

ipcMain.handle('open-section-window', (event, { route, title }) => {
  createSectionWindow(route || 'pos', title || '');
  return { success: true };
});

ipcMain.handle('get-initial-route', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win?.openRoute || parseOpenRoute() || '';
});

const relaySyncEvent = (event, payload) => {
  for (const win of allWindows) {
    if (win && !win.isDestroyed() && win.webContents !== event.sender) {
      win.webContents.send('sync-event', payload);
    }
  }
};

ipcMain.on('sync-event', relaySyncEvent);
ipcMain.on('broadcast-sync', relaySyncEvent);

// سيرفر فحص الأسعار الأوفلاين
function startLocalServer() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.url === '/api/products') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(localCatalogData));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ListMaker Local Server Active');
  });

  // منفذ مشغول (نسخة أخرى أو برنامج آخر) لا يجب أن يُسقط التطبيق بنافذة خطأ
  server.on('error', (err) => {
    console.warn('[Offline Server] could not start:', err && err.code);
  });

  server.listen(LOCAL_PORT, '0.0.0.0', () => {
    console.log(`[Offline Server] active on http://${getLocalHotspotIP()}:${LOCAL_PORT}`);
  });
}

ipcMain.on('update-local-catalog', (event, data) => {
  if (data) {
    localCatalogData = {
      storeName: data.storeName || 'المتجر',
      products: Array.isArray(data.products) ? data.products : []
    };
    if (catalogCachePath) {
      try {
        fs.writeFileSync(catalogCachePath, JSON.stringify(localCatalogData), 'utf-8');
      } catch (err) {}
    }
  }
});

ipcMain.handle('get-hotspot-url', () => {
  const ip = getLocalHotspotIP();
  return `http://${ip}:${LOCAL_PORT}`;
});

const handlePrint = async (event, options = {}) => {
  return new Promise(async (resolve) => {
    try {
      const isA4 = options.pageSize === 'A4';
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return resolve(false);

      const printOptions = {
        silent: true,
        printBackground: true,
        deviceName: options.deviceName || '',
        margins: { marginType: 'default' },
        pageSize: isA4 ? 'A4' : { width: 72000, height: options.heightMicrons || 80000 },
      };

      win.webContents.print(printOptions, (success, failureReason) => {
        resolve(success);
      });
    } catch (err) {
      resolve(false);
    }
  });
};

ipcMain.handle('print-silent', handlePrint);
ipcMain.handle('print-direct', handlePrint);

// نسخة واحدة فقط من البرنامج: أي تشغيل ثانٍ (مثل اختصار قسم) يفتح نافذة جديدة داخل النسخة الأولى
// بدل تشغيل عملية جديدة تتعارض على المنفذ وقاعدة البيانات المحلية فتظهر رسالة خطأ.
app.setAppUserModelId('com.listmanger.app');

const gotSingleLock = app.requestSingleInstanceLock();

if (!gotSingleLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const route = parseOpenRoute(argv);
    if (route) {
      createSectionWindow(route, '');
      return;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  });

  app.whenReady().then(() => {
    initCachePath();
    startLocalServer();
    startApp();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
