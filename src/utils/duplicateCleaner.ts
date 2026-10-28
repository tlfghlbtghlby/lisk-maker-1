import { Product, DuplicateProductGroup } from '../types';

export const normalizeString = (str: string): string => {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove arabic tashkeel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
};

export const findDuplicateGroups = (products: Product[]): DuplicateProductGroup[] => {
  if (!products || products.length < 2) return [];

  const barcodeMap = new Map<string, Product[]>();
  const exactMap = new Map<string, Product[]>();
  const namePriceMap = new Map<string, Product[]>();

  products.forEach((p) => {
    // 1. Group by code/barcode if present and not empty
    const cleanCode = (p.code || '').trim().toLowerCase();
    if (cleanCode && cleanCode !== '0' && cleanCode !== 'null' && cleanCode !== 'undefined') {
      const existing = barcodeMap.get(cleanCode) || [];
      existing.push(p);
      barcodeMap.set(cleanCode, existing);
    }

    // 2. Group by 100% exact details (all specifications identical, ignoring createdAt / addition date):
    // name + category + unit + cost + retail + wholesale + piecesPerCarton
    const normName = normalizeString(p.name);
    const normCategory = normalizeString(p.category || 'عام');
    const normUnit = normalizeString(p.unit || 'قطعة');
    const cost = Math.round((p.costPrice || 0) * 100);
    const retail = Math.round((p.retailPrice || 0) * 100);
    const wholesale = Math.round((p.wholesalePrice || 0) * 100);
    const carton = p.piecesPerCarton || 0;

    const exactKey = `${normName}__${normCategory}__${normUnit}__${cost}__${retail}__${wholesale}__${carton}`;
    const existingExact = exactMap.get(exactKey) || [];
    existingExact.push(p);
    exactMap.set(exactKey, existingExact);

    // 3. Group by Name & Selling Price
    if (normName) {
      const namePriceKey = `${normName}__${retail}`;
      const existingNP = namePriceMap.get(namePriceKey) || [];
      existingNP.push(p);
      namePriceMap.set(namePriceKey, existingNP);
    }
  });

  const processedProductIds = new Set<string>();
  const duplicateGroups: DuplicateProductGroup[] = [];

  // Helper to pick primary item (prefer item with stock > 0, then earlier addition date createdAt)
  const sortAndSeparate = (items: Product[]) => {
    const sorted = [...items].sort((a, b) => {
      if ((b.stock || 0) !== (a.stock || 0)) return (b.stock || 0) - (a.stock || 0);
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });
    return {
      primaryItem: sorted[0],
      duplicateItems: sorted.slice(1),
      allProducts: sorted,
    };
  };

  // 1. Check Barcode duplicates
  barcodeMap.forEach((items, code) => {
    if (items.length > 1) {
      const first = items[0];
      const normFirstName = normalizeString(first.name);
      const normFirstCategory = normalizeString(first.category || 'عام');
      const normFirstUnit = normalizeString(first.unit || 'قطعة');
      const firstCost = Math.round((first.costPrice || 0) * 100);
      const firstRetail = Math.round((first.retailPrice || 0) * 100);
      const firstWholesale = Math.round((first.wholesalePrice || 0) * 100);
      const firstCarton = first.piecesPerCarton || 0;

      const isAlsoExact = items.every((i) => {
        return (
          normalizeString(i.name) === normFirstName &&
          normalizeString(i.category || 'عام') === normFirstCategory &&
          normalizeString(i.unit || 'قطعة') === normFirstUnit &&
          Math.round((i.costPrice || 0) * 100) === firstCost &&
          Math.round((i.retailPrice || 0) * 100) === firstRetail &&
          Math.round((i.wholesalePrice || 0) * 100) === firstWholesale &&
          (i.piecesPerCarton || 0) === firstCarton
        );
      });

      const isAlsoNamePrice = items.every((i) => {
        return (
          normalizeString(i.name) === normFirstName &&
          Math.round((i.retailPrice || 0) * 100) === firstRetail
        );
      });

      const { primaryItem, duplicateItems, allProducts } = sortAndSeparate(items);
      let matchType: 'barcode' | 'exact_details' | 'name_price' | 'both' = 'barcode';
      let matchLabel = `تطابق في كود المادة / الباركود (${code})`;

      if (isAlsoExact) {
        matchType = 'both';
        matchLabel = `تطابق تام في الباركود (${code}) وتشابه 100% في كافة البيانات (ما عدا تاريخ الإضافة)`;
      } else if (isAlsoNamePrice) {
        matchType = 'both';
        matchLabel = `تطابق في الباركود (${code}) وتشابه في الاسم وسعر البيع`;
      }

      duplicateGroups.push({
        id: `dup_barcode_${code}_${primaryItem.id}`,
        matchType,
        matchLabel,
        matchKey: code,
        primaryItem,
        duplicateItems,
        allProducts,
        isBarcodeMatch: true,
        isExactMatch: isAlsoExact,
        isNamePriceMatch: isAlsoNamePrice,
      });

      items.forEach((p) => processedProductIds.add(p.id));
    }
  });

  // 2. Check 100% exact details duplicates (excluding products already grouped by barcode)
  exactMap.forEach((items) => {
    const unhandledItems = items.filter((p) => !processedProductIds.has(p.id));
    if (unhandledItems.length > 1) {
      const { primaryItem, duplicateItems, allProducts } = sortAndSeparate(unhandledItems);
      duplicateGroups.push({
        id: `dup_exact_${primaryItem.id}`,
        matchType: 'exact_details',
        matchLabel: `تشابه وتطابق 100% في بيانات المادة (${primaryItem.name})، التصنيف، الأسعار والوحدة (ما عدا تاريخ الإضافة)`,
        matchKey: primaryItem.name,
        primaryItem,
        duplicateItems,
        allProducts,
        isBarcodeMatch: false,
        isExactMatch: true,
        isNamePriceMatch: true, // exact details always includes identical name & price
      });
      unhandledItems.forEach((p) => processedProductIds.add(p.id));
    }
  });

  // 3. Check Name & Retail Price duplicates (excluding products already grouped above)
  namePriceMap.forEach((items) => {
    const unhandledItems = items.filter((p) => !processedProductIds.has(p.id));
    if (unhandledItems.length > 1) {
      const { primaryItem, duplicateItems, allProducts } = sortAndSeparate(unhandledItems);
      duplicateGroups.push({
        id: `dup_name_price_${primaryItem.id}`,
        matchType: 'name_price',
        matchLabel: `تشابه في اسم المادة (${primaryItem.name}) وسعر البيع (${primaryItem.retailPrice || 0})`,
        matchKey: `${primaryItem.name}_${primaryItem.retailPrice}`,
        primaryItem,
        duplicateItems,
        allProducts,
        isBarcodeMatch: false,
        isExactMatch: false,
        isNamePriceMatch: true,
      });
      unhandledItems.forEach((p) => processedProductIds.add(p.id));
    }
  });

  return duplicateGroups;
};
