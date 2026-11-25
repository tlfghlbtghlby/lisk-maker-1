import type { Customer, Invoice, PaymentRecord } from '../types';

export type StmtKind = 'invoice' | 'payment' | 'debt';
export interface StmtRow {
  key: string;
  kind: StmtKind;
  t: number;
  date: string;
  ref: string;            // رقم القائمة / السند
  label: string;          // البيان
  total: number | null;   // قيمة القائمة (أو مبلغ الدين المضاف)
  paid: number | null;    // المسدّد (من القائمة أو سند تسديد)
  remaining: number | null; // المتبقي دين من القائمة
  balance: number | null; // الرصيد بعد العملية (null للملغى)
  note?: string;
  voided?: boolean;
  returned?: boolean;
}
export interface Statement {
  opening: number;
  closing: number;
  rows: StmtRow[];
  totals: { invoices: number; invoicesCount: number; paidOnInvoices: number; debtsAdded: number; payments: number; remainingOnInvoices: number };
}

const parseDay = (s: string, end: boolean): number | null => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return (end ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0)).getTime();
};

/**
 * كشف حساب زبون لفترة: الحركات مرتبة زمنياً (الأقدم أولاً) مع «الرصيد بعد العملية».
 * الأرصدة تُحسب للخلف من الدين الحالي الفعلي (نفس منطق شاشة الكشف) فيتطابق الرصيد بعد آخر حركة مع الدين الحالي.
 * الرصيد الافتتاحي = الرصيد قبل أول حركة في الفترة.
 */
export function buildStatement(
  cust: Customer,
  invoices: Invoice[],
  payments: PaymentRecord[],
  debtEntries: any[],
  fromDay: string,
  toDay: string
): Statement {
  type Ev = StmtRow & { delta: number };
  const evs: Ev[] = [];
  invoices
    .filter((i) => i.customerId === cust.id || i.customerName === cust.name)
    .forEach((i) => {
      const returned = i.status === 'returned';
      const t = new Date(i.date).getTime() || 0;
      evs.push({
        key: 'inv_' + i.id, kind: 'invoice', t, date: i.date, ref: String(i.invoiceNumber || ''),
        label: returned ? 'قائمة بيع (مرتجعة)' : i.type === 'direct' ? 'قائمة بيع نقدية' : 'قائمة بيع آجلة',
        total: Number(i.total) || 0, paid: Number(i.paidAmount) || 0, remaining: Number(i.remainingAmount) || 0,
        balance: null, note: (i as any).specialNote || undefined, returned,
        delta: returned ? 0 : Number(i.remainingAmount) || 0,
      });
    });
  (debtEntries || [])
    .filter((d) => d.customerId === cust.id)
    .forEach((d) => {
      const amt = Number(d.amount) || 0;
      evs.push({
        key: 'debt_' + d.id, kind: 'debt', t: new Date(d.date).getTime() || 0, date: d.date, ref: String(d.receiptNumber || ''),
        label: 'دين مضاف', total: amt, paid: null, remaining: amt, balance: null, note: d.notes || undefined, delta: amt,
      });
    });
  payments
    .filter((p) => p.customerId === cust.id)
    .forEach((p) => {
      const amt = Number(p.amount) || 0;
      evs.push({
        key: 'pay_' + p.id, kind: 'payment', t: new Date(p.date).getTime() || 0, date: p.date, ref: String(p.receiptNumber || ''),
        label: p.voided ? 'سند تسديد (ملغى)' : 'سند تسديد', total: null, paid: amt, remaining: null, balance: null,
        note: p.notes || undefined, voided: !!p.voided, delta: p.voided ? 0 : -amt,
      });
    });
  evs.sort((a, b) => a.t - b.t);

  // الرصيد بعد كل حركة (من الدين الحالي للخلف)
  let running = Number(cust.totalDebt) || 0;
  const before: number[] = new Array(evs.length); // الرصيد قبل الحركة
  for (let i = evs.length - 1; i >= 0; i--) {
    evs[i].balance = evs[i].voided ? null : running;
    running -= evs[i].delta;
    before[i] = running;
  }

  const from = parseDay(fromDay, false);
  const to = parseDay(toDay, true);
  const idx: number[] = [];
  evs.forEach((e, i) => { if ((from === null || e.t >= from) && (to === null || e.t <= to)) idx.push(i); });

  let opening: number;
  let closing: number;
  if (idx.length) {
    opening = before[idx[0]];
    closing = before[idx[idx.length - 1]] + evs[idx[idx.length - 1]].delta;
  } else {
    // لا حركات في الفترة: الرصيد = الرصيد بعد آخر حركة قبل الفترة (أو الحالي إن لم توجد)
    let last = -1;
    evs.forEach((e, i) => { if (from !== null && e.t < from) last = i; });
    if (last >= 0) opening = closing = before[last] + evs[last].delta;
    else if (evs.length && from !== null && evs[0].t > (to ?? Infinity)) opening = closing = before[0];
    else opening = closing = Number(cust.totalDebt) || 0;
  }

  const rows: StmtRow[] = idx.map((i) => { const { delta, ...r } = evs[i]; void delta; return r; });
  const totals = { invoices: 0, invoicesCount: 0, paidOnInvoices: 0, debtsAdded: 0, payments: 0, remainingOnInvoices: 0 };
  rows.forEach((r) => {
    if (r.kind === 'invoice' && !r.returned) { totals.invoices += r.total || 0; totals.paidOnInvoices += r.paid || 0; totals.remainingOnInvoices += r.remaining || 0; totals.invoicesCount++; }
    else if (r.kind === 'debt') totals.debtsAdded += r.total || 0;
    else if (r.kind === 'payment' && !r.voided) totals.payments += r.paid || 0;
  });
  return { opening, closing, rows, totals };
}
