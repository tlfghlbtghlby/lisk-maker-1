/**
 * مولّد باركود SVG بلا مكتبات خارجية.
 * - EAN-13: للأرقام الـ13 الصحيحة (المعيار التجاري، يقرؤه أي قارئ).
 * - Code 128: لكل ما عداه، ونستعمل الفئة C (رقمان في كل رمز) للأرقام فيخرج الباركود قصيراً جداً
 *   (باركود المخزن الداخلي 16 رقماً = 8 رموز فقط) وهذا أسهل ما يمكن على القارئات الليزرية الضعيفة.
 * الأبعاد: مساحة هادئة (quiet zone) 10 وحدات على الجانبين، وكل الخطوط أعداد صحيحة من الوحدة.
 */

// أنماط Code 128 (عرض أشرطة/فراغات متتالية تبدأ بشريط) للقيم 0..106
const C128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const START_B = 104, START_C = 105, CODE_C = 99, CODE_B = 100, STOP = 106;

export interface BarcodeModules {
  /** عروض متتالية (شريط، فراغ، شريط ...) بوحدة الوحدة */
  widths: number[];
  /** مجموع الوحدات بما فيها المساحة الهادئة */
  total: number;
  type: 'EAN13' | 'CODE128';
  /** النص المقروء تحت الباركود */
  text: string;
}

const QUIET = 10;

export function isValidEan13(s: string): boolean {
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(s[12]);
}

function code128Values(text: string): number[] {
  const out: number[] = [];
  const isDigits = /^\d+$/.test(text);
  if (isDigits && text.length >= 4) {
    if (text.length % 2 === 0) {
      out.push(START_C);
      for (let i = 0; i < text.length; i += 2) out.push(Number(text.slice(i, i + 2)));
    } else {
      // رقم فردي: أول رقم بالفئة B ثم نبدّل إلى C
      out.push(START_B, text.charCodeAt(0) - 32, CODE_C);
      for (let i = 1; i < text.length; i += 2) out.push(Number(text.slice(i, i + 2)));
    }
  } else {
    out.push(START_B);
    for (const ch of text) {
      const c = ch.charCodeAt(0);
      out.push(c >= 32 && c <= 126 ? c - 32 : 31); // حرف غير مدعوم (مثل العربي) يتحول إلى «?»
    }
  }
  let sum = out[0];
  for (let i = 1; i < out.length; i++) sum += out[i] * i;
  out.push(sum % 103, STOP);
  return out;
}

const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
const flip = (b: string) => b.split('').map((x) => (x === '0' ? '1' : '0')).join('');

function eanBits(s: string): string {
  const parity = EAN_PARITY[Number(s[0])];
  let bits = '101';
  for (let i = 0; i < 6; i++) {
    const L = EAN_L[Number(s[i + 1])];
    bits += parity[i] === 'L' ? L : flip(L).split('').reverse().join('');
  }
  bits += '01010';
  for (let i = 0; i < 6; i++) bits += flip(EAN_L[Number(s[i + 7])]);
  bits += '101';
  return bits;
}

function bitsToWidths(bits: string): number[] {
  const w: number[] = [];
  let cur = bits[0], n = 0;
  if (cur === '0') w.push(0); // نبدأ دائماً بشريط
  for (const b of bits) {
    if (b === cur) n++;
    else { w.push(n); cur = b; n = 1; }
  }
  w.push(n);
  return w;
}

export function encodeBarcode(raw: string): BarcodeModules {
  const text = String(raw ?? '').trim();
  if (isValidEan13(text)) {
    const bits = eanBits(text);
    return { widths: bitsToWidths(bits), total: bits.length + QUIET * 2, type: 'EAN13', text };
  }
  const vals = code128Values(text || ' ');
  const widths: number[] = [];
  for (const v of vals) for (const d of C128[v]) widths.push(Number(d));
  const total = widths.reduce((a, b) => a + b, 0) + QUIET * 2;
  return { widths, total, type: 'CODE128', text };
}

/** SVG جاهز (الحجم بالملّيمتر): moduleMm = عرض أرق شريط، heightMm = ارتفاع الأشرطة */
export function barcodeSvg(raw: string, opts: { moduleMm?: number; heightMm?: number } = {}): { svg: string; widthMm: number } {
  const m = encodeBarcode(raw);
  const mod = opts.moduleMm ?? 0.33;
  const h = opts.heightMm ?? 14;
  let x = QUIET;
  const rects: string[] = [];
  m.widths.forEach((w, i) => {
    if (i % 2 === 0 && w > 0) rects.push(`<rect x="${x}" y="0" width="${w}" height="${h / mod}"/>`);
    x += w;
  });
  const widthMm = m.total * mod;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${m.total} ${h / mod}" width="${widthMm.toFixed(2)}mm" height="${h}mm" shape-rendering="crispEdges" preserveAspectRatio="none"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${rects.join('')}</g></svg>`;
  return { svg, widthMm };
}

/** للاختبار الذاتي فقط */
export const __test = { C128, code128Values, eanBits };
