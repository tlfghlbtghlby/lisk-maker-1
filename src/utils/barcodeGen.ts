/**
 * توليد باركود داخلي: 16 رقماً (أطول بثلاثة أرقام من أطول باركود تجاري طبيعي EAN-13)
 * حتى لا يتطابق رمز مولَّد مع باركود حقيقي لمادة أخرى في متجر آخر.
 */
export const INTERNAL_BARCODE_LENGTH = 16;

export function generateInternalBarcode(existing?: Set<string> | string[]): string {
  const used = existing instanceof Set ? existing : new Set(existing || []);
  let code = '';
  let attempts = 0;
  do {
    code = String(1 + Math.floor(Math.random() * 9));
    while (code.length < INTERNAL_BARCODE_LENGTH) code += String(Math.floor(Math.random() * 10));
    attempts++;
  } while (used.has(code) && attempts < 200);
  return code;
}
