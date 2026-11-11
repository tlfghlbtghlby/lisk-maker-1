// صور المواد: محلية فقط على جهاز ويندوز (تطبيق سطح المكتب)، ولا تُرفع إلى السحابة إطلاقًا.
import { useEffect, useState } from 'react';

const api = (): any => (window as any).electronAPI || (window as any).electron;

export const imagesSupported = (): boolean => {
  const a = api();
  return !!(a && a.platform === 'win32' && a.saveProductImage && a.getProductImage);
};

let ids = new Set<string>();
let loaded = false;
const cache = new Map<string, string>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

async function ensureLoaded() {
  if (loaded || !imagesSupported()) return;
  loaded = true;
  try {
    const list: string[] = await api().listProductImages();
    ids = new Set(list || []);
    notify();
  } catch {
    loaded = false;
  }
}

/** مجموعة معرفات المواد التي لها صورة محلية (تتحدث تلقائيًا) */
export function useProductImageIds(): Set<string> {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force(x => x + 1);
    listeners.add(l);
    ensureLoaded();
    return () => { listeners.delete(l); };
  }, []);
  return ids;
}

/** صورة مادة (مصغرة أو كاملة) كـ data URL */
export function useProductImage(id: string | undefined, kind: 'thumb' | 'full'): string | null {
  const key = `${kind}:${id}`;
  const [src, setSrc] = useState<string | null>(cache.get(key) || null);
  const has = !!id && ids.has(id);
  useEffect(() => {
    let alive = true;
    if (!id || !imagesSupported() || !has) { setSrc(null); return; }
    const hit = cache.get(key);
    if (hit) { setSrc(hit); return; }
    api().getProductImage({ id, thumb: kind === 'thumb' }).then((d: string | null) => {
      if (!alive) return;
      if (d) cache.set(key, d);
      setSrc(d || null);
    });
    return () => { alive = false; };
  }, [id, kind, has, key]);
  return src;
}

function loadBitmap(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('تعذر قراءة الصورة. اختر ملف صورة صحيحًا (JPG أو PNG أو WEBP).')); };
    img.src = url;
  });
}

function renderJpeg(img: HTMLImageElement, maxSide: number, quality: number): string {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/jpeg', quality);
}

export async function saveProductImage(id: string, file: File): Promise<void> {
  if (!imagesSupported()) throw new Error('حفظ الصور متاح فقط في تطبيق ويندوز.');
  if (!file.type.startsWith('image/')) throw new Error('الملف المختار ليس صورة.');
  const img = await loadBitmap(file);
  const full = renderJpeg(img, 1280, 0.85);
  const thumb = renderJpeg(img, 160, 0.8);
  const res = await api().saveProductImage({ id, full, thumb });
  if (!res?.success) throw new Error('تعذر حفظ الصورة على هذا الجهاز.');
  cache.set(`full:${id}`, full);
  cache.set(`thumb:${id}`, thumb);
  ids = new Set(ids).add(id);
  notify();
}

export async function removeProductImage(id: string): Promise<void> {
  if (!imagesSupported()) return;
  await api().deleteProductImage({ id });
  cache.delete(`full:${id}`);
  cache.delete(`thumb:${id}`);
  const next = new Set(ids);
  next.delete(id);
  ids = next;
  notify();
}

// ---------- دعم النسخ الاحتياطي واستعادة الصور ----------
export async function listProductImageIds(): Promise<string[]> {
  if (!imagesSupported()) return [];
  await ensureLoaded();
  return Array.from(ids);
}

export async function readFullProductImage(id: string): Promise<string | null> {
  if (!imagesSupported()) return null;
  return (await api().getProductImage({ id, thumb: false })) || null;
}

/** حفظ صورة من data URL (تُنشأ المصغرة تلقائيًا) دون رفعها لأي سحابة */
export async function saveProductImageFromDataUrl(id: string, dataUrl: string): Promise<void> {
  if (!imagesSupported()) throw new Error('حفظ الصور متاح فقط في تطبيق ويندوز.');
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('صورة تالفة في النسخة'));
    i.src = dataUrl;
  });
  const full = dataUrl.startsWith('data:image/jpeg') ? dataUrl : renderJpeg(img, 1280, 0.85);
  const thumb = renderJpeg(img, 160, 0.8);
  const res = await api().saveProductImage({ id, full, thumb });
  if (!res?.success) throw new Error('تعذر حفظ الصورة على هذا الجهاز.');
  cache.set(`full:${id}`, full);
  cache.set(`thumb:${id}`, thumb);
  ids = new Set(ids).add(id);
  notify();
}
