// تشفير كلمات المرور باستخدام PBKDF2-SHA256 عبر Web Crypto (يعمل في المتصفح وElectron وNode).
// الصيغة المخزنة: pbkdf2$<iterations>$<salt base64>$<hash base64>
// لا يمكن استرجاع كلمة المرور الأصلية من هذه القيمة، ويمكن فقط التحقق من تطابقها.

const ITERATIONS = 210_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;
const PREFIX = 'pbkdf2';

const toB64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};

const fromB64 = (b64: string): Uint8Array => {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

const derive = async (password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    KEY_BITS
  );
};

// مقارنة بزمن ثابت لتفادي تسريب معلومات عبر زمن المقارنة
const safeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};

export const isPasswordHash = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(`${PREFIX}$`) && value.split('$').length === 4;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `${PREFIX}$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!password || !isPasswordHash(stored)) return false;
  try {
    const [, iterStr, saltB64, hashB64] = stored.split('$');
    const iterations = parseInt(iterStr, 10);
    if (!Number.isFinite(iterations) || iterations < 1) return false;
    const computed = await derive(password, fromB64(saltB64), iterations);
    return safeEqual(new Uint8Array(computed), fromB64(hashB64));
  } catch {
    return false;
  }
}
