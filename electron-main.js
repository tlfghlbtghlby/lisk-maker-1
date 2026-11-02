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
  shifts: 'الشفتات والورديات',
  customers: 'البيع الآجل وحسابات الديون',
  debts: 'حسابات الديون',
  reports: 'الأرباح والتقارير المالية',
  settings: 'الإعدادات والنسخ الاحتياطي',
  'sales-reps': 'مندوبو المبيعات',
  quick_add: 'الإضافة السريعة',
  offers: 'العروض الترويجية'
};

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
  for (const arg of argvList) {
    if (typeof arg === 'string' && arg.startsWith('--open-route=')) {
      return arg.replace('--open-route=', '').trim();
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

// 2. إنشاء النافذة الرئيسية بكامل الأشرطة والهيدر
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

// 4. إنشاء اختصار سطح المكتب اليدوي (عند طلب الكليك أيمن) عبر Electron Shell الأصلي بنسبة 100%
function createWindowsShortcut({ route, name, title }) {
  try {
    const desktopPath = app.getPath('desktop');
    const cleanRoute = (route || 'pos').replace(/^[#?]/, '').trim();
    const rawName = name || title || 'القسم';
    const safeName = rawName.replace(/[/\\?%*:|"<>]/g, '').trim();
    const fileName = `المفكر المحاسبي - ${safeName}.lnk`;
    const lnkPath = path.join(desktopPath, fileName);
    const exePath = process.execPath;
    const args = `--open-route=${cleanRoute}`;

    if (process.platform === 'win32') {
      const success = shell.writeShortcutLink(lnkPath, 'replace', {
        target: exePath,
        args: args,
        cwd: path.dirname(exePath),
        icon: exePath,
        iconIndex: 0,
        description: `المفكر المحاسبي - ${safeName}`
      });
      return { success, path: lnkPath, fileName };
    }
    return { success: true, path: lnkPath, fileName };
  } catch (e) {
    console.error('Shortcut creation error:', e);
    return { success: false, error: e.message };
  }
}

// IPC Handlers
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

app.whenReady().then(() => {
  initCachePath();
  startLocalServer();
  startApp();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
