const { contextBridge, ipcRenderer } = require('electron');

const api = {
  // جلب قائمة الطابعات المثبتة في النظام
  getPrinters: () => ipcRenderer.invoke('get-printers'),

  // أمر الطباعة المباشر السريع
  printDirect: (options) => ipcRenderer.invoke('print-direct', options),

  // التوافق مع أي استدعاء قديم للطباعة الصامتة
  printSilent: (options) => ipcRenderer.invoke('print-silent', options),

  // دوال الرابط وسيرفر الهوت سبوت الأوفلاين
  getHotspotUrl: () => ipcRenderer.invoke('get-hotspot-url'),
  updateLocalCatalog: (data) => ipcRenderer.send('update-local-catalog', data),
};

// إتاحة الجسر البرمجي للواجهة
contextBridge.exposeInMainWorld('electronAPI', api);
contextBridge.exposeInMainWorld('electron', api);
