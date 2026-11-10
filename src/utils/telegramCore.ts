// عميل ربط التليجرام + تنسيق الرسائل.
// التوكن ليس هنا: الإرسال يتم عبر دالة Supabase (supabase/functions/telegram-bot) التي تحتفظ بالتوكن.
import type { Invoice, InvoiceItem, TelegramEventKey, TelegramSettings, PaymentRecord } from '../types';


export const TELEGRAM_EVENT_LABELS: Record<TelegramEventKey, { label: string; hint: string }> = {
  invoiceSold: { label: 'بيع قائمة', hint: 'كل قائمة تُباع، بكامل موادها وتفاصيلها' },
  creditSale: { label: 'بيع بالدين', hint: 'عند إضافة دين على زبون (الدين القديم والجديد)' },
  debtPayment: { label: 'تسديد دين', hint: 'دفعات الزبائن والمتبقي بعدها' },
  invoiceDeleted: { label: 'حذف قائمة', hint: 'من حذفها ومتى وتفاصيلها' },
  invoiceReturnedFull: { label: 'إرجاع كامل', hint: 'الجهة التي أرجعت، الوقت، السبب' },
  invoiceReturnedPartial: { label: 'إرجاع جزئي', hint: 'المواد المرجعة، السبب، من قام به' },
  invoiceEdited: { label: 'تعديل قائمة', hint: 'ما تغيّر في القائمة: الإجمالي والمدفوع والمتبقي ومن عدّلها' },
  productAdded: { label: 'إضافة مادة', hint: 'مادة جديدة في المخزن' },
  productEdited: { label: 'تعديل مادة', hint: 'تغيّر في الأسعار أو الكمية أو البيانات' },
  productDeleted: { label: 'حذف مادة', hint: 'مواد تُنقل إلى سلة المحذوفات' },
  customerAdded: { label: 'إضافة زبون', hint: 'زبون جديد' },
  customerDeleted: { label: 'حذف زبون', hint: 'زبون يُنقل إلى سلة المحذوفات' },
  shiftStarted: { label: 'بدء شفت', hint: 'من فتح الشفت ومتى' },
  shiftEnded: { label: 'إنهاء شفت', hint: 'ملخص الشفت' },
  repChanges: { label: 'تغييرات المندوبين', hint: 'إضافة أو تعديل أو حذف مندوب' },
  trashRestored: { label: 'استعادة من السلة', hint: 'أي عنصر يُستعاد من سلة المحذوفات' },
};

export const DEFAULT_TELEGRAM_SETTINGS: TelegramSettings = {
  enabled: true,
  code: '',
  secret: '',
  linked: false,
  events: Object.keys(TELEGRAM_EVENT_LABELS).reduce((acc, k) => ({ ...acc, [k]: true }), {}),
  includeItems: true,
  includeProfit: true,
  customerNotifications: true,
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateTelegramCode(prefix: 'ST' | 'CU' | 'RP'): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `${prefix}-${Array.from(bytes).map(b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')}`;
}

export function generateTelegramSecret(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

// ============ تنسيق الرسائل (HTML) ============
export const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const num = (n: unknown): string => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });
const money = (n: unknown, cur: string): string => `${num(n)} ${esc(cur)}`;
const when = (iso?: string): string => {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString('ar-IQ', { dateStyle: 'full', timeStyle: 'short' });
};

const qtyText = (it: InvoiceItem): string => {
  if (it.isWeighted) return `${num(it.quantity)} كغم`;
  if (it.unitType === 'carton') {
    const per = it.piecesPerCarton || 1;
    return `${num(it.quantity)} كرتون (${per} قطعة/كرتون = ${num(it.quantity * per)} قطعة)`;
  }
  return `${num(it.quantity)} ${esc(it.unit || 'قطعة')}`;
};

export interface FmtCtx {
  currency: string;
  storeName?: string;
  actor?: string;
  includeItems?: boolean;
  includeProfit?: boolean;
}

export function formatItems(items: InvoiceItem[], cur: string): string {
  return (items || [])
    .map((it, i) => {
      const gift = it.isGift ? ' 🎁 هدية' : '';
      const returned = it.returnedQuantity ? ` (مُرجَع: ${num(it.returnedQuantity)})` : '';
      return `${i + 1}. <b>${esc(it.productName || (it as any).name)}</b>${gift}\n    ${qtyText(it)}${returned} × ${num(it.unitPrice)} = <b>${money(it.isGift ? 0 : Math.max(0, it.unitPrice * it.quantity - ((it as any).discount || 0)), cur)}</b>${((it as any).discount && !it.isGift ? ` (خصم ${money((it as any).discount, cur)})` : '')}${
        it.notes && !it.isGift ? `\n    📝 ${esc(it.notes)}` : ''
      }`;
    })
    .join('\n');
}

const typeLabel = (t?: string) => (t === 'direct' ? 'نقدي' : t === 'credit' ? 'آجل (دين)' : esc(t || ''));

export function formatInvoice(inv: Invoice, ctx: FmtCtx, title: string, forCustomer = false): string {
  const cur = ctx.currency;
  const lines: string[] = [];
  lines.push(`${title}${ctx.storeName ? ` — ${esc(ctx.storeName)}` : ''}`);
  lines.push(`🧾 رقم القائمة: <code>${esc(inv.invoiceNumber)}</code>`);
  lines.push(`🕒 ${when(inv.date)}`);
  lines.push(`💳 النوع: ${typeLabel(inv.type)}`);
  lines.push(`👤 الزبون: ${esc(inv.customerName || 'غير مسجل')}${inv.customerPhone ? ` — ${esc(inv.customerPhone)}` : ''}`);
  if (!forCustomer && ctx.actor) lines.push(`🧑‍💼 المنفذ: ${esc(ctx.actor)}`);
  if (inv.salesRepName) lines.push(`🚚 المندوب: ${esc(inv.salesRepName)}`);
  if (inv.paymentDueDate) lines.push(`📅 تاريخ الاستحقاق: ${esc(inv.paymentDueDate)}`);
  if (ctx.includeItems !== false) {
    lines.push('', '📦 <b>المواد:</b>', formatItems(inv.items, cur));
  }
  lines.push('');
  lines.push(`مجموع القائمة: <b>${money(inv.subtotal, cur)}</b>`);
  if (inv.discount) lines.push(`الخصم: ${money(inv.discount, cur)}`);
  lines.push(`الإجمالي: <b>${money(inv.total, cur)}</b>`);
  lines.push(`الواصل: ${money(inv.paidAmount, cur)}`);
  lines.push(`المتبقي من هذه القائمة: <b>${money(inv.remainingAmount, cur)}</b>`);
  if (inv.customerId) {
    lines.push(`الدين القديم: ${money(inv.previousDebt, cur)}`);
    lines.push(`إجمالي الدين الحالي: <b>${money(inv.currentTotalDebt, cur)}</b>`);
  }
  if (inv.notes) lines.push(`📝 ملاحظات: ${esc(inv.notes)}`);
  if (!forCustomer && ctx.includeProfit) {
    lines.push('', `📈 الربح: ${money(inv.netProfit, cur)}${inv.salesRepCommission ? ` (عمولة المندوب ${money(inv.salesRepCommission, cur)}، ربح المتجر ${money(inv.storeNetProfit, cur)})` : ''}`);
  }
  if (inv.seal) lines.push('', `🔏 بصمة: <code>${esc(inv.storeCode ? inv.storeCode + '·' : '')}${esc(inv.seal)}</code>`);
  return lines.join('\n');
}

export function formatPayment(p: PaymentRecord, remainingDebt: number, ctx: FmtCtx, forCustomer = false): string {
  const cur = ctx.currency;
  return [
    `💵 <b>تسديد دين</b>${ctx.storeName ? ` — ${esc(ctx.storeName)}` : ''}`,
    `🕒 ${when(p.date)}`,
    `👤 الزبون: ${esc(p.customerName)}`,
    `المبلغ المسدَّد: <b>${money(p.amount, cur)}</b>`,
    `المتبقي عليه: <b>${money(remainingDebt, cur)}</b>`,
    p.notes ? `📝 ${esc(p.notes)}` : '',
    `🧾 سند: <code>${esc(p.receiptNumber)}</code>`,
    !forCustomer && ctx.actor ? `🧑‍💼 المنفذ: ${esc(ctx.actor)}` : '',
  ].filter(Boolean).join('\n');
}

export function formatReturnFull(inv: Invoice, ctx: FmtCtx, reason: string): string {
  return [
    `↩️ <b>إرجاع كامل لقائمة</b>${ctx.storeName ? ` — ${esc(ctx.storeName)}` : ''}`,
    `🧑‍💼 المنفذ: ${esc(ctx.actor || '')}`,
    `🕒 وقت الإرجاع: ${when()}`,
    `📝 السبب: ${esc(reason || 'غير مذكور')}`,
    '',
    formatInvoice(inv, { ...ctx, actor: undefined }, '🧾 القائمة المُرجَعة'),
  ].join('\n');
}

export function formatReturnPartial(
  inv: Invoice,
  returned: { productName: string; quantity: number; unit?: string; unitPrice: number; refundAmount: number }[],
  ctx: FmtCtx,
  reason: string,
  notes: string | undefined,
  refund: { total: number; debtReduction: number; cashRefund: number }
): string {
  const cur = ctx.currency;
  return [
    `↩️ <b>إرجاع جزئي</b>${ctx.storeName ? ` — ${esc(ctx.storeName)}` : ''}`,
    `🧾 القائمة: <code>${esc(inv.invoiceNumber)}</code> — ${esc(inv.customerName)}`,
    `🧑‍💼 المنفذ: ${esc(ctx.actor || '')}`,
    `🕒 وقت الإرجاع: ${when()}`,
    `📝 السبب: ${esc(reason || 'غير مذكور')}${notes ? `\nملاحظات: ${esc(notes)}` : ''}`,
    '',
    '📦 <b>المواد المرجعة:</b>',
    returned.map((r, i) => `${i + 1}. ${esc(r.productName)} — ${num(r.quantity)} ${esc(r.unit || '')} × ${num(r.unitPrice)} = ${money(r.refundAmount, cur)}`).join('\n'),
    '',
    `إجمالي المرتجع: <b>${money(refund.total, cur)}</b>`,
    refund.debtReduction ? `خُصم من دين الزبون: ${money(refund.debtReduction, cur)}` : '',
    refund.cashRefund ? `مُسترد نقداً: ${money(refund.cashRefund, cur)}` : '',
  ].filter(l => l !== '').join('\n');
}

export function formatDeletedInvoice(inv: Invoice, ctx: FmtCtx): string {
  return [
    `🗑️ <b>حذف قائمة</b>${ctx.storeName ? ` — ${esc(ctx.storeName)}` : ''}`,
    `🧑‍💼 المنفذ: ${esc(ctx.actor || '')}`,
    `🕒 ${when()}`,
    '',
    formatInvoice(inv, { ...ctx, actor: undefined }, '🧾 القائمة المحذوفة'),
    '',
    'ℹ️ نُقلت إلى سلة المحذوفات ويمكن استعادتها خلال 3 أيام.',
  ].join('\n');
}

export function formatProductEvent(kind: 'added' | 'edited' | 'deleted', p: any, ctx: FmtCtx, changes?: string[]): string {
  const cur = ctx.currency;
  const head = kind === 'added' ? '➕ <b>إضافة مادة</b>' : kind === 'edited' ? '✏️ <b>تعديل مادة</b>' : '🗑️ <b>حذف مادة</b>';
  const lines = [
    `${head}${ctx.storeName ? ` — ${esc(ctx.storeName)}` : ''}`,
    `🧑‍💼 المنفذ: ${esc(ctx.actor || '')}`,
    `🕒 ${when()}`,
    `📦 <b>${esc(p.name)}</b> (كود: <code>${esc(p.code)}</code>)`,
  ];
  if (kind !== 'deleted' || true) {
    lines.push(`القسم: ${esc(p.category || '-')} | الوحدة: ${esc(p.unit || '-')} | التعبئة: ${num(p.piecesPerCarton || 1)}`);
    lines.push(`المخزون: ${num(p.stock)}`);
    lines.push(`المفرد: ${money(p.retailPrice, cur)} | الجملة: ${money(p.wholesalePrice, cur)}`);
    if (p.superWholesalePrice) lines.push(`جملة الجملة: ${money(p.superWholesalePrice, cur)}`);
    if (p.specialPrice) lines.push(`السعر الخاص: ${money(p.specialPrice, cur)}`);
    if (ctx.includeProfit) lines.push(`التكلفة: ${money(p.costPrice, cur)}`);
  }
  if (changes && changes.length) lines.push('', '🔄 <b>التغييرات:</b>', ...changes.map(c => `• ${c}`));
  if (kind === 'deleted') lines.push('', 'ℹ️ نُقلت إلى سلة المحذوفات ويمكن استعادتها خلال 3 أيام.');
  return lines.join('\n');
}

const PRODUCT_FIELD_LABELS: Record<string, string> = {
  name: 'الاسم', code: 'الكود', category: 'القسم', unit: 'الوحدة', stock: 'المخزون',
  retailPrice: 'سعر المفرد', wholesalePrice: 'سعر الجملة', superWholesalePrice: 'جملة الجملة',
  specialPrice: 'السعر الخاص', costPrice: 'التكلفة', piecesPerCarton: 'التعبئة', minStock: 'حد التنبيه',
};

export function diffProduct(before: any, after: any, includeCost: boolean): string[] {
  const out: string[] = [];
  Object.entries(PRODUCT_FIELD_LABELS).forEach(([k, label]) => {
    if (k === 'costPrice' && !includeCost) return;
    if ((before?.[k] ?? '') !== (after?.[k] ?? '')) out.push(`${label}: ${esc(before?.[k] ?? '-')} ← ${esc(after?.[k] ?? '-')}`);
  });
  return out;
}

export function formatSimple(title: string, rows: (string | undefined | false)[], ctx: FmtCtx): string {
  return [`${title}${ctx.storeName ? ` — ${esc(ctx.storeName)}` : ''}`, `🕒 ${when()}`, ...rows.filter(Boolean) as string[]].join('\n');
}


/** رسالة تذكير بالدين لزبون: آخر دين أُخذ، آخر دفعة، والمتبقي */
export function formatDebtReminder(
  customerName: string,
  totalDebt: number,
  lastDebt: { amount: number; date: string } | null,
  lastPayment: { amount: number; date: string } | null,
  ctx: FmtCtx
): string {
  const cur = ctx.currency;
  const day = (iso: string) => new Date(iso).toLocaleDateString('ar-IQ', { dateStyle: 'medium' });
  const lines: string[] = [
    `🔔 <b>إشعار بحسابك</b>${ctx.storeName ? ` — ${esc(ctx.storeName)}` : ''}`,
    `👤 ${esc(customerName)}`,
    '',
  ];
  lines.push(lastDebt ? `📌 آخر مبلغ أُخذ بالدين: <b>${money(lastDebt.amount, cur)}</b> (${day(lastDebt.date)})` : '📌 آخر مبلغ أُخذ بالدين: لا يوجد');
  lines.push(lastPayment ? `💵 آخر مبلغ سُدّد: <b>${money(lastPayment.amount, cur)}</b> (${day(lastPayment.date)})` : '💵 آخر مبلغ سُدّد: لا توجد دفعات');
  lines.push('');
  lines.push(totalDebt > 0 ? `⚠️ المتبقي عليك: <b>${money(totalDebt, cur)}</b>` : `✅ لا يوجد دين عليك. المتبقي: <b>${money(0, cur)}</b>`);
  lines.push('', '🕒 ' + when());
  return lines.join('\n');
}
