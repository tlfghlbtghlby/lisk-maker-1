// عميل ربط التليجرام. التوكن ليس هنا: الإرسال عبر دالة Supabase (supabase/functions/telegram-bot).
import { supabaseUrl, supabaseAnonKey } from '../supabase';
export * from './telegramCore';

export const TG_FUNCTION_URL = `${supabaseUrl}/functions/v1/telegram-bot`;

async function call(body: Record<string, unknown>): Promise<any> {
  const res = await fetch(TG_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey },
    body: JSON.stringify(body),
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const err: any = new Error(data?.error || `http_${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const tgInfo = () => call({ action: 'info' });
export const tgRegister = (p: {
  storeUid: string; secret: string; kind: 'store' | 'customer' | 'rep'; code: string;
  customerId?: string; customerName?: string; storeName?: string; repId?: string; repName?: string;
}) => call({ action: 'register', ...p });
export const tgStatus = (p: { storeUid: string; secret: string; kind: 'store' | 'customer' | 'rep'; customerId?: string; repId?: string }) =>
  call({ action: 'status', ...p });
export const tgUnlink = (p: { storeUid: string; secret: string; kind: 'store' | 'customer' | 'rep'; customerId?: string; repId?: string }) =>
  call({ action: 'unlink', ...p });
export const tgNotify = (p: {
  storeUid: string; secret: string; text?: string; customerId?: string; customerText?: string; repId?: string; repText?: string;
}) => call({ action: 'notify', ...p });

export const describeTelegramError = (e: any): string => {
  const m = String(e?.message || '');
  if (m === 'forbidden') return 'رُفض الطلب: سرّ المتجر لا يطابق المسجّل. أعد إنشاء الرمز.';
  if (m === 'code_taken') return 'الرمز مستخدم، أعد المحاولة.';
  if (m === 'bot_token_not_configured') return 'لم يُضبط توكن البوت في Supabase بعد (راجع ملف الإعداد).';
  if (e?.status === 404 || m.includes('Failed to fetch') || m.includes('NetworkError'))
    return 'تعذر الوصول إلى دالة التليجرام. تأكد من نشرها في Supabase واتصال الإنترنت.';
  return 'حدث خطأ غير متوقع: ' + m;
};

