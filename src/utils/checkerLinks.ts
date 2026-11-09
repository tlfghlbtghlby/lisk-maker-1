import type { PriceType, Product } from '../types';

/** رموز مستويات السعر في رابط الزبائن: بعد الرمز المشفر للمتجر ~ ثم الرمز. المفرد بلا لاحقة (متوافق مع الروابط القديمة). */
const LEVEL_SUFFIX: Record<PriceType, string> = {
  retail: '',
  wholesale: 'w',
  superWholesale: 'sw',
  special: 'sp',
};

export const CHECKER_LEVEL_LABELS: Record<PriceType, string> = {
  retail: 'مفرد',
  wholesale: 'جملة',
  superWholesale: 'جملة الجملة',
  special: 'خاص',
};

export function parseCheckerToken(raw: string | null | undefined): { token: string; level: PriceType } {
  const clean = String(raw || '').trim().replace(/^#\/?/, '');
  const idx = clean.lastIndexOf('~');
  if (idx < 0) return { token: clean, level: 'retail' };
  const suffix = clean.slice(idx + 1).toLowerCase();
  const level = (Object.keys(LEVEL_SUFFIX) as PriceType[]).find(k => LEVEL_SUFFIX[k] && LEVEL_SUFFIX[k] === suffix) || 'retail';
  return { token: clean.slice(0, idx), level };
}

export function buildCheckerUrl(baseUrl: string, encodedStoreToken: string, level: PriceType): string {
  const suffix = LEVEL_SUFFIX[level];
  return `${baseUrl}#${encodedStoreToken}${suffix ? '~' + suffix : ''}`;
}

type PricedProduct = Pick<Product, 'retailPrice' | 'wholesalePrice' | 'superWholesalePrice' | 'specialPrice'>;
const pos = (n: unknown): number | undefined => {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : undefined;
};
export type FallbackChoice = 'wholesale' | 'retail' | 'none';

/** سعر المستوى المطلوب؛ إن لم يكن للمادة سعر لهذا المستوى يُستعمل البديل الذي حدّده صاحب المتجر (أو null = غير متاح) */
export function priceForLevel(
  p: Partial<PricedProduct>,
  level: PriceType,
  fallbacks: { super?: FallbackChoice; special?: FallbackChoice } = {}
): number | null {
  const retail = Number(p.retailPrice) || 0;
  const wholesale = pos(p.wholesalePrice) ?? retail;
  const pick = (c: FallbackChoice | undefined, def: FallbackChoice): number | null => {
    const choice = c || def;
    return choice === 'none' ? null : choice === 'wholesale' ? wholesale : retail;
  };
  switch (level) {
    case 'wholesale': return wholesale;
    case 'superWholesale': return pos(p.superWholesalePrice) ?? pick(fallbacks.super, 'wholesale');
    case 'special': return pos(p.specialPrice) ?? pick(fallbacks.special, 'retail');
    default: return retail;
  }
}

export type StockLevel = 'none' | 'red' | 'yellow' | 'green';

export const STOCK_COLOR_DEFAULTS = { redMax: 5, yellowMax: 20 };

/** الرمادي (صفر) ثابت؛ الأحمر من 1 إلى redMax، الأصفر حتى yellowMax، والأخضر بعدهما */
export function stockLevelOf(stock: number, redMax: number, yellowMax: number): 'gray' | 'red' | 'yellow' | 'green' {
  if (!(stock > 0)) return 'gray';
  if (stock <= redMax) return 'red';
  if (stock <= yellowMax) return 'yellow';
  return 'green';
}
