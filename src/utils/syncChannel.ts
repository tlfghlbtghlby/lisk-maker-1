// قناة بث ومزامنة محلية فائقة السرعة على مستوى الذاكرة (RAM) بين النوافذ المنفصلة والنافذة الرئيسية
// تضمن انعكاس أي حركة (فاتورة جديدة، تعديل مادة، خصم كمية، بدء شفت) في أقل من ملي ثانية وبدون ريفريش وبدون إنترنت

export type SyncEventType =
  | 'INVOICE_CREATED'
  | 'INVOICE_DELETED'
  | 'PRODUCT_SAVED'
  | 'PRODUCT_DELETED'
  | 'STOCK_ADJUSTED'
  | 'PRODUCTS_BATCH_UPDATED'
  | 'CUSTOMERS_UPDATED'
  | 'SHIFT_UPDATED'
  | 'SETTINGS_UPDATED';

export interface SyncMessage<T = any> {
  senderId: string;
  type: SyncEventType;
  data: T;
  storeUid?: string;
  timestamp: number;
}

// معرّف عشوائي فريد لكل نافذة مفتوحة لمنع تكرار معالجة الحدث داخل نفس النافذة المرسلة
export const CURRENT_WINDOW_ID = 
  typeof window !== 'undefined'
    ? 'win_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now()
    : 'server';

const CHANNEL_NAME = 'mufakir_pos_inmemory_sync_channel';

let channel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch (err) {
    console.warn('BroadcastChannel initialization error:', err);
  }
}

/**
 * بث حدث مزامنة فوري لكافة النوافذ المنفصلة والنافذة الرئيسية عبر الذاكرة (BroadcastChannel + Electron IPC Relay)
 */
export function broadcastSync<T = any>(type: SyncEventType, data: T, storeUid?: string): void {
  const message: SyncMessage<T> = {
    senderId: CURRENT_WINDOW_ID,
    type,
    data,
    storeUid,
    timestamp: Date.now(),
  };

  // 1. البث عبر BroadcastChannel على مستوى الرام بين نوافذ المستعرض / Electron
  if (channel) {
    try {
      channel.postMessage(message);
    } catch (e) {
      console.warn('BroadcastChannel postMessage error:', e);
    }
  }

  // 2. البث عبر Electron IPC Relay لكافة نوافذ BrowserWindow المفتوحة
  if (typeof window !== 'undefined') {
    const electron = (window as any).electronAPI || (window as any).electron;
    if (electron && typeof electron.broadcastSync === 'function') {
      try {
        electron.broadcastSync(message);
      } catch (e) {
        console.warn('Electron broadcastSync error:', e);
      }
    }
  }
}

/**
 * الاستماع للأحداث القادمة من النوافذ الأخرى وتطبيقها فوراً في الـ State
 */
export function subscribeSync(
  callback: (message: SyncMessage) => void
): () => void {
  const cleanups: Array<() => void> = [];

  const handleMessage = (msg: SyncMessage) => {
    // تجاهل الرسائل الصادرة من نفس النافذة لمنع التكرار والحلقات المغلقة
    if (!msg || msg.senderId === CURRENT_WINDOW_ID) {
      return;
    }
    try {
      callback(msg);
    } catch (e) {
      console.error('Error handling sync message:', e);
    }
  };

  // 1. الاستماع لقناة الذاكرة المحلية (BroadcastChannel)
  if (channel) {
    const onMessage = (event: MessageEvent<SyncMessage>) => {
      if (event.data) {
        handleMessage(event.data);
      }
    };
    channel.addEventListener('message', onMessage);
    cleanups.push(() => {
      channel?.removeEventListener('message', onMessage);
    });
  }

  // 2. الاستماع لقناة Electron IPC Relay
  if (typeof window !== 'undefined') {
    const electron = (window as any).electronAPI || (window as any).electron;
    if (electron && typeof electron.onSyncEvent === 'function') {
      try {
        const cleanupIpc = electron.onSyncEvent((payload: SyncMessage) => {
          handleMessage(payload);
        });
        if (typeof cleanupIpc === 'function') {
          cleanups.push(cleanupIpc);
        }
      } catch (e) {
        console.warn('Error subscribing to Electron onSyncEvent:', e);
      }
    }
  }

  return () => {
    cleanups.forEach((cleanup) => {
      try {
        cleanup();
      } catch {}
    });
  };
}

// دوال توافقية مع أي استدعاءات إضافية
export const broadcastSyncEvent = (
  type: SyncEventType, 
  data: any, 
  _senderSessionId?: string, 
  storeUid?: string
) => {
  broadcastSync(type, data, storeUid);
};

export const subscribeToSyncEvents = (
  _sessionId: string, 
  onEvent: (payload: any) => void
) => {
  return subscribeSync((msg) => {
    onEvent({
      type: msg.type,
      senderSessionId: msg.senderId,
      storeUid: msg.storeUid,
      timestamp: msg.timestamp,
      data: msg.data
    });
  });
};
