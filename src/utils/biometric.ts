// بصمة المشرف عبر WebAuthn: تعمل مع البصمة المدمجة (Windows Hello، Touch ID، بصمة الهاتف)
// ومع مفاتيح FIDO2 الخارجية التي تحمل قارئ بصمة. لا تُرسل أي بيانات بيومترية: الجهاز نفسه يتحقق
// من الإصبع ثم يوقّع تحدّياً عشوائياً، ونحن نتحقق من التوقيع محلياً بالمفتاح العام المحفوظ.

export interface BiometricCredential {
  id: string;          // base64url
  publicKey?: string;  // SPKI بصيغة base64url
  alg?: number;        // -7 (ES256) أو -257 (RS256)
  label?: string;
  createdAt: string;
}

const b64u = {
  enc(buf: ArrayBuffer | Uint8Array): string {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec(str: string): Uint8Array {
    const p = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    const bin = atob(p);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

export const biometricSupported = (): boolean =>
  typeof window !== 'undefined' &&
  !!(window as any).PublicKeyCredential &&
  !!navigator.credentials &&
  (window.isSecureContext ?? true);

/** هل في الجهاز بصمة مدمجة؟ (المفاتيح الخارجية تُكتشف عند الاستعمال) */
export async function platformAuthenticatorAvailable(): Promise<boolean> {
  try {
    if (!biometricSupported()) return false;
    return await (window as any).PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

const rpId = () => window.location.hostname;

/** تحويل توقيع ECDSA بصيغة DER إلى r||s الخام الذي تطلبه WebCrypto */
export function derToRawEcdsa(der: Uint8Array, size = 32): Uint8Array {
  let i = 2;
  if (der[1] & 0x80) i = 2 + (der[1] & 0x7f);
  const readInt = () => {
    i++; // 0x02
    const len = der[i++];
    let v = der.slice(i, i + len);
    i += len;
    while (v.length > size && v[0] === 0) v = v.slice(1);
    const out = new Uint8Array(size);
    out.set(v, size - v.length);
    return out;
  };
  const r = readInt();
  const s = readInt();
  const raw = new Uint8Array(size * 2);
  raw.set(r, 0);
  raw.set(s, size);
  return raw;
}

export interface AssertionParts {
  publicKey: string;
  alg: number;
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
  signature: Uint8Array;
  expectedChallenge: string;
  origin: string;
  rpId: string;
}

/** التحقق من التوقيع والتحدي والأصل وعلامات الحضور/التحقق من المستخدم */
export async function verifyAssertion(a: AssertionParts, subtle: SubtleCrypto = crypto.subtle): Promise<boolean> {
  try {
    const client = JSON.parse(new TextDecoder().decode(a.clientDataJSON));
    if (client.type !== 'webauthn.get') return false;
    if (client.challenge !== a.expectedChallenge) return false;
    if (client.origin !== a.origin) return false;

    const ad = a.authenticatorData;
    if (ad.length < 37) return false;
    const rpHash = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(a.rpId)));
    for (let i = 0; i < 32; i++) if (ad[i] !== rpHash[i]) return false;
    const flags = ad[32];
    if (!(flags & 0x01)) return false; // حضور المستخدم
    if (!(flags & 0x04)) return false; // التحقق من المستخدم (البصمة/الرمز)

    const clientHash = new Uint8Array(await subtle.digest('SHA-256', a.clientDataJSON));
    const signed = new Uint8Array(ad.length + 32);
    signed.set(ad, 0);
    signed.set(clientHash, ad.length);

    const spki = b64u.dec(a.publicKey);
    if (a.alg === -7) {
      const key = await subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      return subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRawEcdsa(a.signature), signed);
    }
    if (a.alg === -257) {
      const key = await subtle.importKey('spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
      return subtle.verify('RSASSA-PKCS1-v1_5', key, a.signature, signed);
    }
    return false;
  } catch {
    return false;
  }
}

/** تسجيل بصمة جديدة (أول مرة) */
export async function registerBiometric(opts: { userId: string; userName: string; label?: string }): Promise<BiometricCredential> {
  if (!biometricSupported()) throw new Error('هذا الجهاز أو المتصفح لا يدعم البصمة (يلزم اتصال آمن https).');
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'المفكر المحاسبي', id: rpId() },
      user: { id: new TextEncoder().encode(opts.userId).slice(0, 64), name: opts.userName, displayName: opts.userName },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('لم يتم تسجيل البصمة.');
  const resp = cred.response as AuthenticatorAttestationResponse;
  const pk = (resp as any).getPublicKey?.() as ArrayBuffer | null;
  const alg = (resp as any).getPublicKeyAlgorithm?.() as number | undefined;
  return {
    id: b64u.enc(cred.rawId),
    publicKey: pk ? b64u.enc(pk) : undefined,
    alg: alg ?? -7,
    label: opts.label,
    createdAt: new Date().toISOString(),
  };
}

/** انتظار بصمة من أي من البصمات المسجلة؛ يعيد معرّف البصمة المطابقة أو null عند الإلغاء/الفشل */
export async function verifyBiometric(creds: BiometricCredential[], signal?: AbortSignal): Promise<string | null> {
  if (!biometricSupported() || creds.length === 0) return null;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  let assertion: PublicKeyCredential | null = null;
  try {
    assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: rpId(),
        allowCredentials: creds.map(c => ({ type: 'public-key' as const, id: b64u.dec(c.id) })),
        userVerification: 'required',
        timeout: 120000,
      },
      signal,
    })) as PublicKeyCredential | null;
  } catch {
    return null;
  }
  if (!assertion) return null;
  const id = b64u.enc(assertion.rawId);
  const cred = creds.find(c => c.id === id);
  if (!cred) return null;
  const resp = assertion.response as AuthenticatorAssertionResponse;
  if (cred.publicKey) {
    const ok = await verifyAssertion({
      publicKey: cred.publicKey,
      alg: cred.alg ?? -7,
      authenticatorData: new Uint8Array(resp.authenticatorData),
      clientDataJSON: new Uint8Array(resp.clientDataJSON),
      signature: new Uint8Array(resp.signature),
      expectedChallenge: b64u.enc(challenge),
      origin: window.location.origin,
      rpId: rpId(),
    });
    if (!ok) return null;
  }
  return id;
}
