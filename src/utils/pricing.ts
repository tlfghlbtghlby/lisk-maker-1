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

// سعر القطعة الواحدة حسب مستوى السعر.
// إن لم يُحدَّد سعر "جملة الجملة" يُستخدم سعر الجملة، وإن لم يُحدَّد "السعر الخاص" يُستخدم سعر المفرد،
// حتى لا تُباع مادة بسعر صفر بالخطأ.
export function getPiecePrice(product: PricedProduct, type: PriceType): number {
  switch (type) {
    case 'wholesale':
      return product.wholesalePrice;
    case 'superWholesale':
      return positive(product.superWholesalePrice) ?? product.wholesalePrice;
    case 'special':
      return positive(product.specialPrice) ?? product.retailPrice;
    default:
      return product.retailPrice;
  }
}

// هل حُدِّد سعر فعلي لهذا المستوى (وليس بديلاً احتياطياً)؟
export function hasOwnPrice(product: PricedProduct, type: PriceType): boolean {
  if (type === 'superWholesale') return positive(product.superWholesalePrice) !== undefined;
  if (type === 'special') return positive(product.specialPrice) !== undefined;
  return true;
}
