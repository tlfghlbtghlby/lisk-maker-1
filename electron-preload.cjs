const { contextBridge, ipcRenderer } = require('electron');

const api = {
  // جلب قائمة الطابعات المثبتة في النظام لاختيارها من شاشة الإعدادات
  getPrinters: () => ipcRenderer.invoke('get-printers'),

  // أمر الطباعة المباشر مع دعم اسم الطابعة المحدد لسرعة لحظية
  printDirect: (options) => ipcRenderer.invoke('print-direct', options),

  // التوافق مع أي استدعاء قديم للطباعة الصامتة
  printSilent: (options) => ipcRenderer.invoke('print-silent', options),
};

// إتاحة الجسر تحت الاسمين ليعمل مع أي استدعاء في الواجهة
contextBridge.exposeInMainWorld('electronAPI', api);
contextBridge.exposeInMainWorld('electron', api);
