import type { InvoiceItem } from '../types';

/** عدد القطع الفعلي المباع في سطر القائمة (الدرزن والكرتون تُحوَّل إلى قطع). الوزني يبقى كما هو. */
export const soldPieces = (it: InvoiceItem): number => {
  if (it.isWeighted) return Number(it.quantity) || 0;
  if (typeof it.deductedPieces === 'number' && Number.isFinite(it.deductedPieces)) return it.deductedPieces;
  const n = it.unitType === 'carton' ? Math.max(1, it.piecesPerCarton || 1) : 1;
  return (Number(it.quantity) || 0) * n;
};
