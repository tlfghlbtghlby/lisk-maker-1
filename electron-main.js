import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

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

// 2. دالة الطباعة الصامتة الذكية
const handlePrint = async (event, options = {}) => {
  return new Promise(async (resolve) => {
    try {
      const isA4 = options.pageSize === 'A4';
      
      // إذا تم إرسال محتوى الفاتورة كـ HTML، ننشئ نافذة خلفية لحساب الطول والطباعة
      if (options.html) {
        let printWin = new BrowserWindow({
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        });

        await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(options.html)}`);

        // حساب الارتفاع الفعلي للمحتوى بدقة لمنع قطع الفاتورة أو إخراج ورق فارغ
        const contentHeightPx = await printWin.webContents.executeJavaScript('document.body.scrollHeight');
        // تحويل البكسل (96 DPI) إلى ميكرون مع إضافة هامش أمان بسيط (5mm)
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
        // طباعة مباشرة من النافذة الحالية إذا لم يُمرر HTML
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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
