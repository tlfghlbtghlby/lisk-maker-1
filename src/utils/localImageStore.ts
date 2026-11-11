// تخزين صور محلي على هذا الجهاز فقط (IndexedDB). لا يدخل في بيانات المتجر ولا يُرفع للسحابة أبدًا.
import { useEffect, useState } from 'react';

const DB_NAME = 'local_assets';
const STORE = 'images';
const HEADER_KEY = 'invoice_header';

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await openDb();
    return await new Promise<string | null>((resolve) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => resolve(typeof r.result === 'string' ? r.result : null);
      r.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbSet(key: string, value: string | null): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    if (value) tx.objectStore(STORE).put(value, key);
    else tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

let headerCache: string | null | undefined;
const listeners = new Set<() => void>();

export async function loadLocalHeaderImage(): Promise<string | null> {
  if (headerCache === undefined) headerCache = await idbGet(HEADER_KEY);
  return headerCache ?? null;
}

export async function saveLocalHeaderImage(dataUrl: string | null): Promise<void> {
  await idbSet(HEADER_KEY, dataUrl);
  headerCache = dataUrl;
  listeners.forEach(l => l());
}

/** صورة رأس القائمة المحفوظة محليًا على هذا الجهاز */
export function useLocalHeaderImage(): string | null {
  const [img, setImg] = useState<string | null>(headerCache ?? null);
  useEffect(() => {
    let alive = true;
    const refresh = () => { loadLocalHeaderImage().then(v => { if (alive) setImg(v); }); };
    listeners.add(refresh);
    refresh();
    return () => { alive = false; listeners.delete(refresh); };
  }, []);
  return img;
}

// ---------- وصول عام لمفاتيح التخزين المحلي (صور المواد على الهاتف والمتصفح) ----------
export async function idbGetRaw(key: string): Promise<string | null> {
  return idbGet(key);
}
export async function idbSetRaw(key: string, value: string | null): Promise<void> {
  await idbSet(key, value);
}
export async function idbListKeys(): Promise<string[]> {
  try {
    const db = await openDb();
    return await new Promise<string[]>((resolve) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys();
      r.onsuccess = () => resolve((r.result as IDBValidKey[]).map(String));
      r.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}
