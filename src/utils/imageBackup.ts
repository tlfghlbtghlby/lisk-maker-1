// نسخة احتياطية للصور المحلية (صور المواد + صورة رأس القائمة) واستعادتها على أي جهاز.
// الصور لا تُرفع للسحابة: تُحفظ في ملف النسخة وتُستعاد محليًا فقط.
import { Product } from '../types';
import { loadLocalHeaderImage, saveLocalHeaderImage } from './localImageStore';
import { imagesSupported, listProductImageIds, readFullProductImage, saveProductImageFromDataUrl } from './productImages';

export interface ImageBackup {
  header?: string;
  products: { id: string; code?: string; name?: string; image: string }[];
}

export async function collectImageBackup(products: Product[]): Promise<ImageBackup> {
  const out: ImageBackup = { products: [] };
  const header = await loadLocalHeaderImage();
  if (header) out.header = header;
  const byId = new Map(products.map(p => [p.id, p]));
  for (const id of await listProductImageIds()) {
    const img = await readFullProductImage(id);
    if (!img) continue;
    const p = byId.get(id);
    out.products.push({ id, code: p?.code, name: p?.name, image: img });
  }
  return out;
}

export interface RestoreResult {
  header: boolean;
  restored: number;
  skipped: number;
  productImagesUnsupported: boolean;
}

export async function restoreImageBackup(data: ImageBackup, products: Product[]): Promise<RestoreResult> {
  const res: RestoreResult = { header: false, restored: 0, skipped: 0, productImagesUnsupported: false };
  if (data?.header) {
    await saveLocalHeaderImage(data.header);
    res.header = true;
  }
  const list = Array.isArray(data?.products) ? data.products : [];
  if (!list.length) return res;
  if (!imagesSupported()) {
    res.productImagesUnsupported = true;
    res.skipped = list.length;
    return res;
  }
  const ids = new Set(products.map(p => p.id));
  const byCode = new Map(products.filter(p => p.code).map(p => [p.code, p.id]));
  for (const item of list) {
    const target = ids.has(item.id) ? item.id : (item.code ? byCode.get(item.code) : undefined);
    if (!target || !item.image) { res.skipped++; continue; }
    try {
      await saveProductImageFromDataUrl(target, item.image);
      res.restored++;
    } catch {
      res.skipped++;
    }
  }
  return res;
}

export const describeRestore = (r: RestoreResult): string => {
  const parts: string[] = [];
  if (r.header) parts.push('صورة رأس القائمة');
  if (r.restored) parts.push(`${r.restored} صورة مادة`);
  let msg = parts.length ? `تمت استعادة ${parts.join(' و')} على هذا الجهاز فقط.` : 'لم تُستعد أي صورة.';
  if (r.productImagesUnsupported) msg += ' هذا الجهاز لا يدعم حفظ صور المواد.';
  else if (r.skipped) msg += ` تعذّر مطابقة ${r.skipped} صورة مع مواد موجودة.`;
  return msg;
};
