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

// 1. فتح نافذة مستقلة لأي تبويب يُطلب
function createSectionWindow(route = 'pos', title = '') {
  const cleanRoute = (route || 'pos').replace(/^[#?]/, '').trim();
  const windowTitle = title || TAB_TITLES_MAP[cleanRoute] || 'قسم فرعي';

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

// 2. النافذة الرئيسية العامة
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

// دالة إنشاء الاختصار المعتمدة والمتوافقة 100% مع الأسماء العربية ونظام Windows
function createWindowsShortcut({ route, name, title }) {
  return new Promise((resolve) => {
    try {
      const desktopPath = app.getPath('desktop');
      const cleanRoute = (route || 'pos').replace(/^[#?]/, '').trim();

      const titlesMap = {
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

      const rawName = name || title || titlesMap[cleanRoute] || 'قسم فرعي';
      const safeName = rawName.replace(/[/\\?%*:|"<>]/g, '').trim();
      const fileName = `المفكر - ${safeName}.lnk`;
      const lnkPath = path.join(desktopPath, fileName);

      let targetExe = process.execPath;
      let args = `--open-route=${cleanRoute}`;

      if (!app.isPackaged) {
        targetExe = process.execPath;
        args = `"${path.resolve(__dirname)}" --open-route=${cleanRoute}`;
      }

      if (process.platform === 'win32') {
        // 1. المحاولة الأولى عبر واجهة Electron الرسمية
        try {
          const success = shell.writeShortcutLink(lnkPath, 'replace', {
            target: targetExe,
            args: args,
            cwd: path.dirname(targetExe),
            icon: targetExe,
            iconIndex: 0,
            description: `برنامج المفكر المحاسبي - ${safeName}`
          });

          if (success && fs.existsSync(lnkPath)) {
            console.log(`[Shortcut Created via Shell]: ${lnkPath}`);
            return resolve({ success: true, path: lnkPath, fileName });
          }
        } catch (e) {
          console.warn('writeShortcutLink failed, trying UTF-16 VBScript fallback:', e);
        }

        // 2. المحاولة الثانية: كتابة ملف VBScript مؤقت بترميز UTF-16 LE (يحفظ الحروف العربية بدقة تامة ويمنع تشويه المسار)
        const vbsPath = path.join(app.getPath('temp'), `shortcut_${Date.now()}.vbs`);
        const vbsContent = [
          'Set ws = CreateObject("WScript.Shell")',
          `Set sc = ws.CreateShortcut("${lnkPath.replace(/\\/g, '\\\\')}")`,
          `sc.TargetPath = "${targetExe.replace(/\\/g, '\\\\')}"`,
          `sc.Arguments = "${args.replace(/"/g, '""')}"`,
          `sc.WorkingDirectory = "${path.dirname(targetExe).replace(/\\/g, '\\\\')}"`,
          `sc.IconLocation = "${targetExe.replace(/\\/g, '\\\\')},0"`,
          `sc.Description = "المفكر - ${safeName}"`,
          'sc.Save'
        ].join('\r\n');

        // إضافة علامة Byte Order Mark (BOM) لفرض قراءة الملف بنظام UTF-16LE من قبل الويندوز
        const bom = Buffer.from([0xFF, 0xFE]);
        const textBuffer = Buffer.from(vbsContent, 'utf16le');
        fs.writeFileSync(vbsPath, Buffer.concat([bom, textBuffer]));

        exec(`cscript //nologo "${vbsPath}"`, (err) => {
          try { fs.unlinkSync(vbsPath); } catch (_) {}

          if (err || !fs.existsSync(lnkPath)) {
            console.error('VBScript failed, attempting simple PowerShell command:', err);

            // 3. محاولة أخيرة عبر سطر PowerShell مباشر بملف سكربت مؤقت
            const psPath = path.join(app.getPath('temp'), `shortcut_${Date.now()}.ps1`);
            const psContent = `
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut('${lnkPath}')
$s.TargetPath = '${targetExe}'
$s.Arguments = '${args}'
$s.WorkingDirectory = '${path.dirname(targetExe)}'
$s.Save()
`;
            fs.writeFileSync(psPath, psContent, 'utf8');
            exec(`powershell -ExecutionPolicy Bypass -File "${psPath}"`, (psErr) => {
              try { fs.unlinkSync(psPath); } catch (_) {}
              if (psErr || !fs.existsSync(lnkPath)) {
                return resolve({ success: false, error: psErr ? psErr.message : 'تعذر حفظ الاختصار' });
              }
              resolve({ success: true, path: lnkPath, fileName });
            });
            return;
          }

          resolve({ success: true, path: lnkPath, fileName });
        });
      } else {
        resolve({ success: false, error: 'هذه الميزة مخصصة لنظام Windows فقط' });
      }
    } catch (err) {
      console.error('Shortcut critical error:', err);
      resolve({ success: false, error: err.message });
    }
  });
}

function startApp() {
  const openRoute = parseOpenRoute();
  if (openRoute) {
    createSectionWindow(openRoute, '');
  } else {
    createMainWindow();
  }
}

// IPC Handlers
ipcMain.handle('get-printers', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (!win) return [];
  return await win.webContents.getPrintersAsync();
});

ipcMain.handle('open-section-window', (event, { route, title }) => {
  createSectionWindow(route || 'pos', title || '');
  return { success: true };
});

ipcMain.handle('create-desktop-shortcut', async (event, payload) => {
  return await createWindowsShortcut(payload || {});
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
