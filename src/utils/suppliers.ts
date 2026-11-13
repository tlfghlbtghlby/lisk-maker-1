import type { Supplier, SupplierTxn } from '../types';

export const newId = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const fmtDate = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '');

/** تأثير الحركة على الدين الذي علينا: الاستلام يزيده بقدر غير المدفوع، والتسديد ينقصه */
export const txnEffect = (t: SupplierTxn): number =>
  t.type === 'purchase' ? (Number(t.total) || 0) - (Number(t.paid) || 0) : -(Number(t.total) || 0);

export const txnsOf = (supplierId: string, txns: SupplierTxn[]) =>
  txns.filter((t) => t.supplierId === supplierId).sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));

/** الدين الحالي علينا للمورد (موجب = علينا، سالب = لنا رصيد عنده) */
export const owedTo = (s: Supplier, txns: SupplierTxn[]): number =>
  (Number(s.openingDebt) || 0) + txnsOf(s.id, txns).reduce((sum, t) => sum + txnEffect(t), 0);

export const nextReceiptNo = (txns: SupplierTxn[]) => {
  const n = txns.filter((t) => t.type === 'payment').length + 1;
  return `SP-${String(n).padStart(4, '0')}`;
};
