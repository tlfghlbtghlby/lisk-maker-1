// أرشيف الفواتير القديمة المحلي (IndexedDB) — لا يُزامَن مع السحابة، ويُضمَّن في كل نسخة احتياطية تليجرام.
const DB_NAME = 'mufakir_invoice_archive';
const STORE = 'invoices';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

export async function archivePutMany(list: any[]): Promise<void> {
  const db = await open();
  const tx = db.transaction(STORE, 'readwrite');
  const st = tx.objectStore(STORE);
  list.forEach((x) => st.put(x));
  await done(tx);
  db.close();
}

export async function archiveGetAll(): Promise<any[]> {
  const db = await open();
  const out = await new Promise<any[]>((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return out;
}

export async function archiveCount(): Promise<number> {
  try {
    const db = await open();
    const n = await new Promise<number>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return n;
  } catch {
    return 0;
  }
}

/** هل كل المعرفات موجودة فعلاً في الأرشيف؟ (تحقق قبل إزالتها من المزامنة) */
export async function archiveHasAll(ids: string[]): Promise<boolean> {
  const db = await open();
  const st = db.transaction(STORE, 'readonly').objectStore(STORE);
  const results = await Promise.all(
    ids.map((id) => new Promise<boolean>((resolve) => {
      const r = st.getKey(id);
      r.onsuccess = () => resolve(r.result !== undefined);
      r.onerror = () => resolve(false);
    }))
  );
  db.close();
  return results.every(Boolean);
}
