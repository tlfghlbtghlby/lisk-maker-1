import { Customer, Invoice, PaymentRecord } from '../types';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

/** رقم دولي لواتساب (العراق افتراضياً) */
export function normalizeWaPhone(raw?: string): string {
  let n = String(raw || '').replace(/[^0-9]/g, '');
  if (!n) return '';
  if (n.startsWith('00')) n = n.slice(2);
  else if (n.startsWith('07') && n.length === 11) n = '964' + n.slice(1);
  else if (n.startsWith('7') && n.length === 10) n = '964' + n;
  return n;
}

/** تاريخ + وقت للكشوف */
const dt = (v: unknown): string => {
  const d = new Date(v as any);
  if (isNaN(d.getTime())) return String(v).slice(0, 10);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fmt = (n: number) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });

export type DebtEventKind = 'invoice' | 'payment' | 'manual' | 'notice';
export interface DebtEvent {
  customerId: string;
  kind: DebtEventKind;
  amount: number;       // قيمة الحركة (فاتورة/دفعة)
  newDebt: number;      // الدين بعد الحركة
  invoiceNumber?: string;
  paid?: number;
  extraPaid?: number;
  invoice?: any;
  prevDebt?: number;
}

const curName = (c: string) => (/^(د\.?\s?ع\.?|iqd)$/i.test((c || '').trim()) || !c ? 'دينار عراقي' : c);

export function buildDebtMessage(c: Customer, ev: DebtEvent, storeName: string, currency: string): string {
  const cur = curName(currency);
  const head = `مرحباً ${c.name} 👋${storeName ? `\n${storeName}` : ''}`;
  let body = '';
  if (ev.kind === 'payment') body = `تم استلام دفعة بقيمة ${fmt(ev.amount)} ${cur}، عفواً وشكراً لكم.`;
  else if (ev.kind === 'invoice') {
    body = `قائمة البيع${ev.invoiceNumber ? ' رقم ' + ev.invoiceNumber : ''} بقيمة ${fmt(ev.amount)} ${cur}.`;
    if (ev.paid) body += `\nالمسدد: ${fmt(ev.paid)} ${cur}.`;
    if (ev.extraPaid) body += `\nزيادة مسددة خُصمت من الدين القديم: ${fmt(ev.extraPaid)} ${cur}.`;
  } else if (ev.kind === 'notice') body = 'نذكّركم بحسابكم لدينا.';
  else body = `تم تسجيل حركة على حسابكم بقيمة ${fmt(ev.amount)} ${cur}.`;
  const debtLine = ev.newDebt > 0
    ? `إجمالي الدين: ${fmt(ev.newDebt)} ${cur}.`
    : ev.newDebt < 0 ? `لكم رصيد: ${fmt(-ev.newDebt)} ${cur}.` : 'لا يوجد دين مستحق عليكم.';
  return `${head}\n\n${body}\n${debtLine}\n\nشكراً لتعاملكم معنا 🌹`;
}

export function buildStatementText(c: Customer, invoices: Invoice[], payments: PaymentRecord[], storeName: string, currency: string): string {
  const rows: { d: string; t: string }[] = [];
  invoices.filter(i => i.customerId === c.id).forEach(i =>
    rows.push({ d: i.date, t: `قائمة ${i.invoiceNumber}: ${fmt(i.total)} (مسدد ${fmt(i.paidAmount)})` }));
  payments.filter(p => p.customerId === c.id && !p.voided).forEach(p =>
    rows.push({ d: p.date, t: `دفعة: ${fmt(p.amount)}` }));
  rows.sort((a, b) => String(b.d).localeCompare(String(a.d)));
  const last = rows.slice(0, 10).map(r => `• ${dt(r.d)} — ${r.t}`).join('\n');
  const debt = c.totalDebt > 0 ? `إجمالي الدين: ${fmt(c.totalDebt)} ${currency}` : c.totalDebt < 0 ? `لكم رصيد: ${fmt(-c.totalDebt)} ${currency}` : 'لا يوجد دين مستحق';
  return `كشف حساب — ${storeName}\nالزبون: ${c.name}\n${debt}${last ? '\n\nآخر الحركات:\n' + last : ''}`;
}

/** كشف حساب PDF (يُرسم في عنصر مخفي ثم يُلتقط كصورة داخل PDF لدعم العربية) */
async function elementToPdf(el: HTMLElement): Promise<string> {
  document.body.appendChild(el);
  try {
    try { await (document as any).fonts?.ready; } catch { /* ignore */ }
    // العنصر مخفي خارج الشاشة (left:-10000px) فتلتقطه المكتبة فارغاً؛ نلغي موضعه في النسخة الملتقطة فقط
    const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true, style: { position: 'static', left: '0', top: '0' } });
    const img = new Image();
    img.src = dataUrl;
    await new Promise((r) => { img.onload = r; });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const w = 200;
    const h = (img.naturalHeight * w) / img.naturalWidth;
    const pageH = 287;
    let y = 5, left = h;
    pdf.addImage(dataUrl, 'PNG', 5, y, w, h, undefined, 'FAST');
    left -= pageH;
    while (left > 0) { pdf.addPage(); y -= pageH; pdf.addImage(dataUrl, 'PNG', 5, y, w, h, undefined, 'FAST'); left -= pageH; }
    return pdf.output('datauristring').split(',')[1];
  } finally {
    el.remove();
  }
}

/** PDF لقائمة البيع نفسها (مواد، مجموع، مسدد، دين) مع توقيع البرنامج */
export async function buildInvoicePdf(inv: any, c: Customer, storeName: string, currency: string, prevDebt: number, newDebt: number): Promise<{ base64: string; fileName: string }> {
  const cur = curName(currency);
  const td = 'padding:5px 8px;border:1px solid #ccc';
  const rows = (inv.items || []).map((it: any) =>
    `<tr><td style="${td}">${it.productName || it.name || ''}${it.packLabel ? ' (' + it.packLabel + ')' : ''}</td><td style="${td};text-align:center">${fmt(it.quantity)}</td><td style="${td};text-align:left">${fmt(it.unitPrice)}</td><td style="${td};text-align:left">${fmt(it.total)}</td></tr>`).join('');
  const el = document.createElement('div');
  el.setAttribute('dir', 'rtl');
  el.style.cssText = 'position:fixed;left:-10000px;top:0;width:760px;background:#fff;color:#000;font-family:Tajawal,Arial,sans-serif;padding:24px;font-size:14px';
  el.innerHTML = `<h2 style="margin:0 0 4px">${storeName}</h2>
    <h3 style="margin:0 0 4px">قائمة بيع رقم ${inv.invoiceNumber}</h3>
    <div style="margin-bottom:10px">الزبون: <b>${c.name}</b> &nbsp;|&nbsp; التاريخ: ${String(inv.date || '').slice(0, 10)}</div>
    <table style="width:100%;border-collapse:collapse"><thead><tr style="background:#eee"><th style="${td}">المادة</th><th style="${td}">الكمية</th><th style="${td}">السعر</th><th style="${td}">المجموع</th></tr></thead><tbody>${rows}</tbody></table>
    <div style="margin-top:12px;line-height:1.9">
      ${inv.discount ? `<div>الخصم: ${fmt(inv.discount)} ${cur}</div>` : ''}
      <div>مجموع القائمة: <b>${fmt(inv.total)} ${cur}</b></div>
      <div>المسدد: ${fmt(inv.paidAmount || 0)} ${cur}</div>
      <div>الدين القديم: ${fmt(prevDebt)} ${cur}</div>
      <div style="font-size:16px">إجمالي الدين: <b>${fmt(newDebt)} ${cur}</b></div>
    </div>
    <div style="margin-top:18px;text-align:center;font-size:11px;color:#6b7280">✦ صدرت هذه القائمة من برنامج المفكر المحاسبي ✦</div>`;
  return { base64: await elementToPdf(el), fileName: `invoice-${inv.invoiceNumber}.pdf` };
}

export async function buildStatementPdf(c: Customer, invoices: Invoice[], payments: PaymentRecord[], storeName: string, currency: string): Promise<{ base64: string; fileName: string }> {
  const rows: { d: string; t: string; debit: number; credit: number }[] = [];
  invoices.filter(i => i.customerId === c.id).forEach(i =>
    rows.push({ d: i.date, t: `قائمة ${i.invoiceNumber}`, debit: Math.max(0, i.total - (i.paidAmount || 0)), credit: 0 }));
  payments.filter(p => p.customerId === c.id && !p.voided).forEach(p =>
    rows.push({ d: p.date, t: 'دفعة ' + (p.receiptNumber || ''), debit: 0, credit: p.amount }));
  rows.sort((a, b) => String(b.d).localeCompare(String(a.d)));
  const body = rows.slice(0, 60).map(r =>
    `<tr><td style="padding:5px 8px;border:1px solid #ccc">${dt(r.d)}</td><td style="padding:5px 8px;border:1px solid #ccc">${r.t}</td><td style="padding:5px 8px;border:1px solid #ccc;text-align:left">${r.debit ? fmt(r.debit) : ''}</td><td style="padding:5px 8px;border:1px solid #ccc;text-align:left">${r.credit ? fmt(r.credit) : ''}</td></tr>`).join('');
  const el = document.createElement('div');
  el.setAttribute('dir', 'rtl');
  el.style.cssText = 'position:fixed;left:-10000px;top:0;width:760px;background:#fff;color:#000;font-family:Tajawal,Arial,sans-serif;padding:24px;font-size:14px';
  el.innerHTML = `<h2 style="margin:0 0 4px">${storeName}</h2><h3 style="margin:0 0 12px">كشف حساب الزبون: ${c.name}</h3>
    <div style="margin-bottom:12px;font-weight:bold">الدين الحالي: ${fmt(c.totalDebt)} ${currency}</div>
    <table style="width:100%;border-collapse:collapse"><thead><tr style="background:#eee"><th style="padding:5px 8px;border:1px solid #ccc">التاريخ</th><th style="padding:5px 8px;border:1px solid #ccc">البيان</th><th style="padding:5px 8px;border:1px solid #ccc">دين</th><th style="padding:5px 8px;border:1px solid #ccc">مسدد</th></tr></thead><tbody>${body}</tbody></table><div style="margin-top:18px;text-align:center;font-size:11px;color:#6b7280">✦ صدرت هذه القائمة من برنامج المفكر المحاسبي ✦</div>`;
  return { base64: await elementToPdf(el), fileName: `statement-${c.name.replace(/[\\/:*?"<>|\s]/g, '_')}.pdf` };
}

export interface WaResult { ok: boolean; note: string }

/**
 * يفتح محادثة واتساب للرقم بالنص جاهزاً. واتساب لا يتيح الإرسال الصامت عبر التطبيق المثبّت،
 * لذا يلزم ضغط «إرسال» داخل واتساب (ومع ملف PDF: لصقه Ctrl+V).
 */
export interface WaOpts { target?: 'app' | 'web'; autoPaste?: boolean }

export async function sendViaWhatsApp(phoneRaw: string, text: string, pdf?: { base64: string; fileName: string }, opts: WaOpts = {}): Promise<WaResult> {
  const phone = normalizeWaPhone(phoneRaw);
  if (!phone) return { ok: false, note: 'لا يوجد رقم واتساب للزبون' };
  const e = (window as any).electronAPI;
  try {
    if (pdf && e?.whatsappSendPdf) {
      const r = await e.whatsappSendPdf({ base64: pdf.base64, fileName: pdf.fileName, phone, text, target: opts.target, autoPaste: opts.autoPaste });
      if (r?.success) return { ok: true, note: r.pasted ? 'فُتحت المحادثة وأُلصق ملف PDF جاهزاً: راجع واضغط «إرسال»' : r.copied ? 'فُتحت محادثة واتساب والنص جاهز، وملف PDF منسوخ: اضغط Ctrl+V في المحادثة ثم إرسال' : 'فُتحت محادثة واتساب؛ أرفق ملف PDF من المجلد المفتوح ثم أرسل' };
    }
    if (!pdf && e?.whatsappOpenChat) {
      const r = await e.whatsappOpenChat({ phone, text, target: opts.target });
      if (r?.success) return { ok: true, note: 'فُتحت محادثة واتساب والنص جاهز: اضغط «إرسال»' };
    }
    window.open(opts.target === 'web' ? `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}` : `https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    return { ok: true, note: 'فُتحت محادثة واتساب والنص جاهز: اضغط «إرسال»' };
  } catch (err: any) {
    return { ok: false, note: 'تعذر فتح واتساب: ' + (err?.message || '') };
  }
}
