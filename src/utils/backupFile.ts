// ضغط/فك ضغط ملفات النسخ الاحتياطي (gzip) وتحويلها لـ base64.
export async function gzipText(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new (window as any).CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) bin += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(bin);
}

/** يقرأ ملف نسخة (.json أو .json.gz) ويرجع نصه. */
export async function readBackupFileText(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const isGzip = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b;
  if (!isGzip) return new TextDecoder().decode(buf);
  const DS = (window as any).DecompressionStream;
  if (!DS) throw new Error('المتصفح لا يدعم فك ضغط الملف. استخدم متصفحاً أحدث.');
  const stream = new Blob([buf]).stream().pipeThrough(new DS('gzip'));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}
