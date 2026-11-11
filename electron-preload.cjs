const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  // نظام التشغيل (لتفعيل ميزات خاصة بويندوز)
  platform: process.platform,

  // صور المواد المحلية (لا تُرفع للسحابة)
  saveProductImage: (payload) => ipcRenderer.invoke('product-image-save', payload),
  getProductImage: (payload) => ipcRenderer.invoke('product-image-get', payload),
  deleteProductImage: (payload) => ipcRenderer.invoke('product-image-delete', payload),
  listProductImages: () => ipcRenderer.invoke('product-image-list'),

  // جلب قائمة الطابعات المثبتة في النظام
  getPrinters: () => ipcRenderer.invoke('get-printers'),

  // أمر الطباعة المباشر السريع
  printDirect: (options) => ipcRenderer.invoke('print-direct', options),

  // التوافق مع أي استدعاء قديم للطباعة الصامتة
  printSilent: (options) => ipcRenderer.invoke('print-silent', options),

  // دوال الرابط وسيرفر الهوت سبوت الأوفلاين
  getHotspotUrl: () => ipcRenderer.invoke('get-hotspot-url'),
  updateLocalCatalog: (data) => ipcRenderer.send('update-local-catalog', data),

  // فتح في نافذة مستقلة جديدة (BrowserWindow)
  openSectionWindow: (options) => ipcRenderer.invoke('open-section-window', options),

  // إنشاء اختصار على سطح المكتب (.lnk)
  createDesktopShortcut: (options) => ipcRenderer.invoke('create-desktop-shortcut', options),

  // استعلام المسار الأولي الممرر عبر الوسائط (--open-route=...)
  getInitialRoute: () => ipcRenderer.invoke('get-initial-route'),

  // بث ومزامنة الذاكرة الفورية بين النوافذ عبر IPC Relay (<1ms)
  broadcastSync: (payload) => {
    try {
      ipcRenderer.send('sync-event', payload);
      ipcRenderer.send('broadcast-sync', payload);
    } catch (e) {
      console.warn('IPC broadcastSync error:', e);
    }
  },

  onSyncEvent: (callback) => {
    const handler = (_event, payload) => {
      try {
        callback(payload);
      } catch (err) {
        console.error('onSyncEvent callback error:', err);
      }
    };
    ipcRenderer.on('sync-event', handler);
    return () => {
      try {
        ipcRenderer.removeListener('sync-event', handler);
      } catch {}
    };
  },

  isElectron: true,
};

// إتاحة الجسر البرمجي للواجهة بشكل آمن ومباشر
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
    contextBridge.exposeInMainWorld('electron', electronAPI);
  } catch (error) {
    console.error('contextBridge exposure failed:', error);
  }
} else {
  window.electronAPI = electronAPI;
  window.electron = electronAPI;
}
