// الشاشة الثانية للزبون: نافذة منفصلة تستقبل من نافذة الكاشير (عبر BroadcastChannel) ما يُسمح بعرضه فقط.
// لا يُرسل أبداً: الأرباح، رقم القائمة، الجلسة/الشفت، قائمة الزبائن أو الديون. اسم الزبون يُرسل فقط عند اختياره لبيع آجل.

export interface CDLine { name: string; qty: string; price: string; total: string; disc?: string; gift?: boolean }
export interface CDCart {
  kind: 'cart';
  storeName?: string;
  lines: CDLine[];
  subtotal: string;
  discount?: string;   // نص مُنسَّق، يُرسل فقط إذا وُجد خصم
  total: string;
  /** اسم الزبون: فقط للبيع الآجل بعد اختيار الزبون من الكاشير */
  customerName?: string;
  saleType: 'cash' | 'credit';
}
export interface CDDone { kind: 'done'; customerName?: string; saleType: 'cash' | 'credit'; at: number }
export type CDMessage = CDCart | CDDone | { kind: 'hello' };

export const CD_CHANNEL = 'mufakir_customer_display_v1';
export const CD_HASH = '#customer-display';

let ch: BroadcastChannel | null = null;
export function cdChannel(): BroadcastChannel | null {
  if (ch) return ch;
  try { if (typeof BroadcastChannel !== 'undefined') ch = new BroadcastChannel(CD_CHANNEL); } catch { ch = null; }
  return ch;
}
export function cdPost(m: CDMessage) { try { cdChannel()?.postMessage(m); } catch { /* ignore */ } }

export function isCustomerDisplayRoute(): boolean {
  try { return typeof window !== 'undefined' && window.location.hash.startsWith(CD_HASH); } catch { return false; }
}

export function openCustomerDisplay(): boolean {
  try {
    const u = new URL(window.location.href);
    u.hash = CD_HASH;
    u.search = '';
    const w = window.open(u.toString(), 'mufakir_customer_display', 'width=1024,height=700,left=120,top=80,menubar=no,toolbar=no,location=no,status=no');
    return !!w;
  } catch { return false; }
}
