import type { InvoiceItem, Product, Promotion, StoreSettings } from '../types';

export type PromoStatus = 'running' | 'scheduled' | 'expired' | 'paused';

const pad = (n: number) => String(n).padStart(2, '0');
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function getPromoStatus(p: Promotion, now = new Date()): PromoStatus {
  if (!p.active) return 'paused';
  const t = todayKey(now);
  if (p.startDate && t < p.startDate) return 'scheduled';
  if (p.endDate && t > p.endDate) return 'expired';
  return 'running';
}

export const PROMO_KIND_LABELS: Record<Promotion['kind'], string> = {
  discount: 'خصم على مادة',
  qty_discount: 'خصم عند أخذ عدد معين من القطع (نسبة أو مبلغ)',
  bonus_same: 'اشترِ N وخذ M من نفس المادة (تُضاف قطع مجانية)',
  bonus_other: 'اشترِ N وخذ M من مادة أخرى مجاناً',
  nth_free: 'N والتالي مجاني (ضمن نفس الكمية المشتراة)',
};

export function describePromotion(p: Promotion): string {
  const name = p.productName || '';
  switch (p.kind) {
    case 'discount':
      return p.discountType === 'percent'
        ? `خصم ${p.discountValue || 0}% على ${name}`
        : `خصم ${(p.discountValue || 0).toLocaleString()} د.ع لكل قطعة من ${name}`;
    case 'qty_discount': {
      const v = p.discountValue || 0;
      const how = p.discountType === 'percent'
        ? `${v}%`
        : p.discountScope === 'total' ? `${v.toLocaleString()} د.ع` : `${v.toLocaleString()} د.ع لكل قطعة`;
      return p.discountRepeat === false
        ? `عند أخذ ${p.buyQty || 0} قطع فأكثر من ${name}: خصم ${how}`
        : `كل ${p.buyQty || 0} قطع من ${name}: خصم ${p.discountType === 'percent' ? how : p.discountScope === 'total' ? `${v.toLocaleString()} د.ع للمجموعة` : how}`;
    }
    case 'bonus_same':
      return `${p.buyQty || 0}+${p.getQty || 0} من ${name} (قطع مجانية إضافية)`;
    case 'bonus_other':
      return `${p.buyQty || 0} من ${name} + ${p.getQty || 0} من ${p.rewardProductName || 'مادة أخرى'} مجاناً`;
    case 'nth_free':
      return `${p.buyQty || 0} من ${name} والـ ${p.getQty || 0} التالية مجانية`;
  }
}

export interface PromoResult {
  items: InvoiceItem[];
  discountTotal: number;        // مجموع الخصومات (لا يشمل قيمة الهدايا المضافة)
  showDiscountColumn: boolean;
  showGiftColumn: boolean;
  notes: string[];              // ملخص يظهر في السلة
}

const piecesOf = (it: InvoiceItem): number => {
  if (it.isWeighted) return 0;
  if (typeof it.deductedPieces === 'number') return it.deductedPieces;
  const n = it.unitType === 'carton' ? Math.max(1, it.piecesPerCarton || 1) : 1;
  return it.quantity * n;
};

const perPieceDivisor = (it: InvoiceItem): number =>
  it.unitType === 'carton' ? Math.max(1, it.piecesPerCarton || 1) : 1;

/**
 * يطبق العروض والخصومات الفعالة على محتويات السلة.
 * لا يعدّل السلة الأصلية، ويُرجع نسخة جديدة من السطور (مع سطور الهدايا المضافة).
 */
export function applyPromotions(
  cart: InvoiceItem[],
  promotions: Promotion[] | undefined,
  products: Product[],
  settings: Pick<StoreSettings, 'promoDiscountDisplay' | 'promoOfferDisplay'>,
  now = new Date()
): PromoResult {
  const discountDisplay = settings.promoDiscountDisplay === 'hidden' ? 'hidden' : 'column';
  const offerDisplay = settings.promoOfferDisplay || 'gift_column';

  // نبدأ بنسخة نظيفة (بدون آثار عروض سابقة)
  const items: InvoiceItem[] = cart.map((it) => {
    const { discount, discountIsOffer, giftQty, hiddenFromPrint, promoLabel, ...rest } = it as any;
    const base = it.isGift ? 0 : (typeof it.total === 'number' ? it.total + (Number(discount) || 0) : it.unitPrice * it.quantity);
    return { ...rest, total: base, _base: base } as any as InvoiceItem;
  });

  const active = (promotions || []).filter((p) => getPromoStatus(p, now) === 'running');
  const notes: string[] = [];
  const extraGifts: InvoiceItem[] = [];

  if (active.length === 0) {
    return { items, discountTotal: 0, showDiscountColumn: false, showGiftColumn: false, notes };
  }

  const byProduct = (id: string) => products.find((p) => p.id === id);

  // الخصم حسب الكمية: عند تعدد الشرائح لنفس المادة تُطبَّق أعلى شريحة تحققت فقط (لا تتراكم)
  const bestTier = new Map<string, string>();
  {
    const tiers = new Map<string, { id: string; min: number }>();
    for (const promo of active) {
      if (promo.kind !== 'qty_discount' || promo.discountRepeat !== false) continue;
      const min = Math.max(1, Math.floor(Number(promo.buyQty) || 0));
      const pcs = items.filter((it) => it.productId === promo.productId && !it.isGift).reduce((s, it) => s + piecesOf(it), 0);
      if (pcs < min) continue;
      const cur = tiers.get(promo.productId);
      if (!cur || min > cur.min) tiers.set(promo.productId, { id: promo.id, min });
    }
    tiers.forEach((v, k) => bestTier.set(k, v.id));
  }

  // خصم الباقات: كل مجموعة كاملة من N قطعة تأخذ خصمها، وتُملأ الأكبر أولاً ثم الأصغر بالباقي
  // مثال (سعر 500): عند 2 ← 750، عند 3 ← 1000: الكمية 4 = 1500، و5 = 1750، و6 = 2000
  {
    const pids = Array.from(new Set(active.filter((p) => p.kind === 'qty_discount' && p.discountRepeat !== false).map((p) => p.productId)));
    for (const pid of pids) {
      const lines = items.filter((it) => it.productId === pid && !it.isGift && !(it as any).isCustomPrice);
      const totalPieces = lines.reduce((s, it) => s + piecesOf(it), 0);
      const totalBase = lines.reduce((s, it) => s + ((it as any)._base as number), 0);
      if (totalPieces <= 0 || totalBase <= 0) continue;
      const avgPiece = totalBase / totalPieces;
      const tiers = active
        .filter((p) => p.kind === 'qty_discount' && p.discountRepeat !== false && p.productId === pid)
        .map((p) => ({ p, min: Math.max(1, Math.floor(Number(p.buyQty) || 0)), v: Math.max(0, Number(p.discountValue) || 0) }))
        .filter((t) => t.v > 0)
        .sort((a, b) => b.min - a.min);
      let remaining = totalPieces;
      for (const t of tiers) {
        const groups = Math.floor(remaining / t.min);
        if (groups <= 0) continue;
        remaining -= groups * t.min;
        const perGroup = t.p.discountType === 'percent'
          ? (avgPiece * t.min * Math.min(100, t.v)) / 100
          : t.p.discountScope === 'total' ? t.v : t.v * t.min;
        let D = Math.round(perGroup * groups);
        if (D <= 0) continue;
        let sum = 0;
        lines.forEach((it, i) => {
          const base = (it as any)._base as number;
          const room = base - (it.discount || 0);
          const share = i === lines.length - 1 ? D - sum : Math.round((D * base) / totalBase);
          const d = Math.max(0, Math.min(room, share));
          if (d <= 0) return;
          it.discount = (it.discount || 0) + d;
          it.total = Math.max(0, base - it.discount);
          it.promoLabel = describePromotion(t.p);
          sum += d;
        });
        if (sum > 0) notes.push(`${describePromotion(t.p)} ×${groups}: -${sum.toLocaleString()}`);
      }
    }
  }

  for (const promo of active) {
    const lines = items.filter((it) => it.productId === promo.productId && !it.isGift);
    if (lines.length === 0) continue;
    const productName = promo.productName || lines[0].productName;

    if (promo.kind === 'discount') {
      const value = Math.max(0, Number(promo.discountValue) || 0);
      if (value <= 0) continue;
      let sum = 0;
      for (const it of lines) {
        if ((it as any).isCustomPrice) continue; // السعر المعدّل يدوياً لا يُخصم عليه
        const base = (it as any)._base as number;
        let d = promo.discountType === 'percent'
          ? (base * Math.min(100, value)) / 100
          : value * perPieceDivisor(it) * it.quantity;
        d = Math.min(base, Math.round(d));
        if (d <= 0) continue;
        it.discount = (it.discount || 0) + d;
        it.total = Math.max(0, base - it.discount);
        it.promoLabel = describePromotion(promo);
        sum += d;
      }
      if (sum > 0) notes.push(`${describePromotion(promo)}: -${sum.toLocaleString()}`);
      continue;
    }

    if (promo.kind === 'qty_discount') {
      if (promo.discountRepeat !== false) continue; // عرض الباقات عُولج أعلاه
      if (bestTier.get(promo.productId) !== promo.id) continue;
      const value = Math.max(0, Number(promo.discountValue) || 0);
      if (value <= 0) continue;
      let remaining = value; // للمبلغ الثابت «مرة واحدة»
      let sum = 0;
      for (const it of lines) {
        if ((it as any).isCustomPrice) continue;
        const base = (it as any)._base as number;
        let d: number;
        if (promo.discountType === 'percent') d = (base * Math.min(100, value)) / 100;
        else if (promo.discountScope === 'total') { d = remaining; }
        else d = value * perPieceDivisor(it) * it.quantity;
        d = Math.min(base - (it.discount || 0), Math.round(d));
        if (d <= 0) continue;
        if (promo.discountType !== 'percent' && promo.discountScope === 'total') remaining -= d;
        it.discount = (it.discount || 0) + d;
        it.total = Math.max(0, base - it.discount);
        it.promoLabel = describePromotion(promo);
        sum += d;
      }
      if (sum > 0) notes.push(`${describePromotion(promo)}: -${sum.toLocaleString()}`);
      continue;
    }

    const buy = Math.max(1, Math.floor(Number(promo.buyQty) || 0));
    const get = Math.max(1, Math.floor(Number(promo.getQty) || 0));
    const totalPieces = lines.reduce((s, it) => s + piecesOf(it), 0);

    if (promo.kind === 'nth_free') {
      const group = buy + get;
      const freeTotal = Math.floor(totalPieces / group) * get;
      if (freeTotal <= 0) continue;
      let left = freeTotal;
      for (const it of lines) {
        if (left <= 0) break;
        const linePieces = piecesOf(it);
        const free = Math.min(left, linePieces);
        if (free <= 0) continue;
        const pieceNet = it.unitPrice / perPieceDivisor(it);
        const base = (it as any)._base as number;
        const d = Math.min(base - (it.discount || 0), Math.round(free * pieceNet));
        it.discount = (it.discount || 0) + d;
        it.discountIsOffer = true;
        it.total = Math.max(0, base - it.discount);
        if (offerDisplay === 'gift_column') it.giftQty = (it.giftQty || 0) + free;
        it.promoLabel = describePromotion(promo);
        left -= free;
      }
      notes.push(`${describePromotion(promo)}: ${freeTotal} قطعة مجانية`);
      continue;
    }

    // bonus_same / bonus_other: قطع مجانية تُضاف إلى القائمة
    const free = Math.floor(totalPieces / buy) * get;
    if (free <= 0) continue;
    const rewardId = promo.kind === 'bonus_other' ? promo.rewardProductId : promo.productId;
    const rewardProduct = rewardId ? byProduct(rewardId) : undefined;
    if (!rewardId) continue;
    const isSame = rewardId === promo.productId;
    const refLine = lines[0];

    const gift: InvoiceItem = {
      productId: rewardId,
      productName: rewardProduct?.name || promo.rewardProductName || refLine.productName,
      code: rewardProduct?.code || refLine.code,
      unit: rewardProduct?.unit || refLine.unit,
      priceType: 'retail',
      unitType: 'piece',
      piecesPerCarton: rewardProduct?.piecesPerCarton || refLine.piecesPerCarton || 1,
      deductedPieces: free,
      costPrice: rewardProduct?.costPrice ?? (refLine.costPrice / perPieceDivisor(refLine)),
      unitPrice: 0,
      quantity: free,
      total: 0,
      isGift: true,
      notes: 'هدية',
      promoLabel: describePromotion(promo),
    } as InvoiceItem;

    if (offerDisplay === 'hidden') {
      gift.hiddenFromPrint = true;
    } else if (offerDisplay === 'gift_column') {
      if (isSame) {
        // تُذكر في عمود «هدية» على سطر المادة نفسها، ولا يُطبع سطر منفصل
        refLine.giftQty = (refLine.giftQty || 0) + free;
        gift.hiddenFromPrint = true;
      } else {
        gift.giftQty = free; // يظهر سطر المادة الهدية وفي عمود «هدية» العدد
      }
    }
    extraGifts.push(gift);
    notes.push(`${describePromotion(promo)}: +${free} ${gift.productName} مجاناً`);
  }

  items.forEach((it) => { delete (it as any)._base; });
  const all = [...items, ...extraGifts];
  const discountTotal = items.reduce((s, it) => s + (it.discount || 0), 0);
  const showDiscountColumn =
    discountDisplay === 'column' && items.some((it) => (it.discount || 0) > 0 && !it.discountIsOffer);
  const showGiftColumn = offerDisplay === 'gift_column' && all.some((it) => (it.giftQty || 0) > 0);

  return { items: all, discountTotal, showDiscountColumn, showGiftColumn, notes };
}

/** سعر الوحدة الصافي بعد الخصم (يُستعمل في المرتجعات حتى لا يُسترجع أكثر مما دُفع) */
export function netUnitPrice(item: { unitPrice: number; quantity: number; discount?: number }): number {
  if (!item.discount || !item.quantity) return item.unitPrice;
  return Math.max(0, (item.unitPrice * item.quantity - item.discount) / item.quantity);
}
