import type { PriceType, Product } from '../types';

// أسماء مستويات الأسعار كما تظهر في البرنامج والقائمة
export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  retail: 'مفرد',
  wholesale: 'جملة',
  superWholesale: 'جملة الجملة',
  special: 'سعر خاص',
};

const positive = (n: unknown): number | undefined => {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : undefined;
};

type PricedProduct = Pick<Product, 'retailPrice' | 'wholesalePrice' | 'superWholesalePrice' | 'specialPrice'>;

export type PriceFallbackChoice = 'wholesale' | 'retail' | 'none';
// ما يُستخدم إذا لم يكن للمادة سعر المستوى المطلوب (يحدده صاحب المتجر من الإعدادات، ويسري على الروابط ونقطة البيع)
export interface PriceFallbacks {
  wholesale?: 'retail' | 'none';
  super?: PriceFallbackChoice;
  special?: PriceFallbackChoice;
}

// سعر القطعة الواحدة حسب مستوى السعر، أو null إذا لم يوجد سعر واختار صاحب المتجر «لا شيء».
// الافتراضي: جملة ← المفرد، جملة الجملة ← الجملة، السعر الخاص ← المفرد، حتى لا تُباع مادة بسعر صفر بالخطأ.
export function resolvePiecePrice(product: PricedProduct, type: PriceType, fb: PriceFallbacks = {}): number | null {
  const retail = product.retailPrice;
  const wholesale = positive(product.wholesalePrice) ?? (fb.wholesale === 'none' ? null : retail);
  const pick = (c: PriceFallbackChoice | undefined, def: PriceFallbackChoice): number | null => {
    const choice = c || def;
    return choice === 'none' ? null : choice === 'wholesale' ? wholesale : retail;
  };
  switch (type) {
    case 'wholesale':
      return wholesale;
    case 'superWholesale':
      return positive(product.superWholesalePrice) ?? pick(fb.super, 'wholesale');
    case 'special':
      return positive(product.specialPrice) ?? pick(fb.special, 'retail');
    default:
      return retail;
  }
}

// نفس السابق لكن يرجع رقماً دائماً (عند «لا شيء» يُستعمل سعر المفرد) للأماكن التي لا تتعامل مع الغياب
export function getPiecePrice(product: PricedProduct, type: PriceType, fb: PriceFallbacks = {}): number {
  return resolvePiecePrice(product, type, fb) ?? product.retailPrice;
}

// هل حُدِّد سعر فعلي لهذا المستوى (وليس بديلاً احتياطياً)؟
export function hasOwnPrice(product: PricedProduct, type: PriceType): boolean {
  if (type === 'superWholesale') return positive(product.superWholesalePrice) !== undefined;
  if (type === 'special') return positive(product.specialPrice) !== undefined;
  return true;
}
