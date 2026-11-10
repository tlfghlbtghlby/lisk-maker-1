// حساب أرباح المندوب غير المصفّاة (بعد آخر تصفية) + رسائل التليجرام الخاصة به.
import type { Invoice, SalesRep } from '../types';
import { esc, type FmtCtx } from './telegramCore';

export interface RepItemRow {
  key: string;
  name: string;
  unit: string;
  qty: number;
  sales: number;
  commission: number;
}

export interface RepEarnings {
  invoices: Invoice[];
  qty: number;
  sales: number;
  commission: number;
  items: RepItemRow[];
  since?: string;
}

/** قوائم المندوب غير المصفّاة: غير مرجعة وتاريخها بعد آخر تصفية */
export function computeRepEarnings(
  rep: SalesRep,
  invoices: Invoice[],
  defaultType: SalesRep['commissionType'] = 'percentage_profit'
): RepEarnings {
  const since = rep.settledAt;
  const sinceMs = since ? new Date(since).getTime() : 0;
  const list = invoices
    .filter(i => i.salesRepId === rep.id && i.status !== 'returned' && new Date(i.date).getTime() > sinceMs)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const type = rep.commissionType || defaultType;
  const rate = rep.commissionRate || 0;
  const map = new Map<string, RepItemRow>();
  let qty = 0, sales = 0, commission = 0;

  for (const inv of list) {
    sales += inv.total || 0;
    commission += inv.salesRepCommission || 0;
    for (const it of inv.items || []) {
      const netQty = Math.max(0, (it.quantity || 0) - (it.returnedQuantity || 0));
      if (netQty <= 0) continue;
      const lineSales = Math.round(netQty * (it.unitPrice || 0));
      const lineGross = Math.max(0, lineSales - Math.round(netQty * (it.costPrice || 0)));
      let c = 0;
      if (rate > 0) {
        if (type === 'fixed_per_piece') c = Math.round(netQty * rate);
        else if (type === 'percentage_sales') c = Math.round((lineSales * rate) / 100);
        else if (type === 'percentage_profit') c = Math.round((lineGross * rate) / 100);
      }
      qty += netQty;
      const key = it.productId || it.name || (it as any).productName || 'x';
      const row = map.get(key);
      if (row) { row.qty += netQty; row.sales += lineSales; row.commission += c; }
      else map.set(key, { key, name: it.name || (it as any).productName || 'مادة', unit: it.unit || 'قطعة', qty: netQty, sales: lineSales, commission: c });
    }
  }
  return { invoices: list, qty, sales, commission, items: Array.from(map.values()).sort((a, b) => b.sales - a.sales), since };
}

const num = (n: unknown) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });
const day = (iso: string) => new Date(iso).toLocaleDateString('ar-IQ', { dateStyle: 'medium' });

/** كشف موجز للمندوب: أرباحه الحالية والقوائم المباعة باسمه */
export function formatRepStatement(rep: SalesRep, e: RepEarnings, ctx: FmtCtx): string {
  const cur = esc(ctx.currency);
  const lines: string[] = [
    `📊 <b>كشف أرباحك</b>${ctx.storeName ? ` — ${esc(ctx.storeName)}` : ''}`,
    `👤 ${esc(rep.name)}`,
    e.since ? `📅 منذ آخر تصفية: ${day(e.since)}` : '📅 منذ البداية (لم تُصفَّ أرباحك بعد)',
    '',
    `🧾 عدد القوائم: <b>${num(e.invoices.length)}</b>`,
    `📦 الكمية المباعة: <b>${num(e.qty)}</b>`,
    `💰 إجمالي المبيعات: <b>${num(e.sales)} ${cur}</b>`,
    `✅ أرباحك الحالية: <b>${num(e.commission)} ${cur}</b>`,
  ];
  if (e.invoices.length) {
    lines.push('', '🧾 <b>آخر القوائم باسمك:</b>');
    for (const inv of e.invoices.slice(0, 10)) {
      lines.push(`• ${day(inv.date)} — ${num(inv.total)} ${cur} ← ربحك ${num(inv.salesRepCommission || 0)} ${cur}`);
    }
    if (e.invoices.length > 10) lines.push(`… و${e.invoices.length - 10} قائمة أخرى`);
  }
  return lines.join('\n');
}

/** رسالة تصفية الأرباح (تصل للمندوب وللمالك) */
export function formatRepSettlement(rep: SalesRep, amount: number, e: RepEarnings, ctx: FmtCtx, forRep: boolean): string {
  const cur = esc(ctx.currency);
  return [
    forRep ? `💵 <b>تمت تصفية أرباحك</b>${ctx.storeName ? ` — ${esc(ctx.storeName)}` : ''}` : `💵 <b>تصفية أرباح مندوب</b>`,
    `👤 ${esc(rep.name)}`,
    '',
    `🧾 القوائم: <b>${num(e.invoices.length)}</b> | 📦 الكمية: <b>${num(e.qty)}</b>`,
    `💰 المبيعات: <b>${num(e.sales)} ${cur}</b>`,
    `✅ المبلغ المدفوع: <b>${num(amount)} ${cur}</b>`,
    '',
    forRep ? 'رصيد أرباحك الآن: 0' : 'صُفّر رصيد المندوب.',
    '🕒 ' + new Date().toLocaleString('ar-IQ', { dateStyle: 'full', timeStyle: 'short' }),
  ].join('\n');
}
