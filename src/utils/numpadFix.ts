/**
 * دعم لوحة الأرقام (الجهة اليمنى من الكيبورد):
 * مع تخطيط لوحة المفاتيح العربية قد تُنتج الأرقام هندية (٣٢١) أو الفاصلة العشرية العربية (٫)،
 * فترفضها حقول الأرقام ولا يفهمها الماسح/البحث. نحوّلها فوراً إلى أرقام لاتينية عند الكتابة في حقول الإدخال.
 * يعمل أيضاً مع Enter الخاص بلوحة الأرقام (NumpadEnter) لأنه يُرسل key=Enter أصلاً.
 */
const INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

function westernOf(key: string, code: string): string | null {
  if (key.length !== 1) return null;
  let i = INDIC.indexOf(key);
  if (i >= 0) return String(i);
  i = PERSIAN.indexOf(key);
  if (i >= 0) return String(i);
  // الفاصلة العشرية من لوحة الأرقام في التخطيطات العربية
  if (code === 'NumpadDecimal' && (key === '٫' || key === ',' || key === '،' || key === '.')) return '.';
  return null;
}

let installed = false;
export function installNumpadFix() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const t = e.target as HTMLElement | null;
    if (!t) return;
    const tag = t.tagName;
    const isField = tag === 'INPUT' || tag === 'TEXTAREA';
    if (!isField) return;
    const input = t as HTMLInputElement;
    const type = (input.type || 'text').toLowerCase();
    if (input.readOnly || input.disabled) return;
    if (['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color', 'date', 'time', 'datetime-local', 'password'].includes(type)) return;
    const isNumeric = type === 'number' || type === 'tel' || /numeric|decimal/.test(input.inputMode || '');
    const fromNumpad = (e.code || '').startsWith('Numpad');
    if (!isNumeric && !fromNumpad) return;
    const w = westernOf(e.key, e.code || '');
    if (!w) return;
    e.preventDefault();
    try {
      // insertText يُطلق أحداث الإدخال التي يلتقطها React ويعمل مع type=number
      if (!document.execCommand('insertText', false, w)) throw new Error('noexec');
    } catch {
      try {
        const s = input.selectionStart ?? input.value.length;
        const en = input.selectionEnd ?? s;
        input.setRangeText(w, s, en, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      } catch { /* ignore */ }
    }
  }, true);
}
