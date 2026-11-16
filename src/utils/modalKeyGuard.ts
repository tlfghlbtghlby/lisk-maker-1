/**
 * التحكم بلوحة المفاتيح للنافذة الظاهرة فقط:
 * عند فتح أي نافذة منبثقة (fixed inset-0 بـ z-index عالٍ أو role=dialog) لا يصل أي مفتاح
 * إلى العناصر التي خلفها (حقل البحث، القائمة، أزرار الصفحة...). فمثلاً Enter لا يبيع القائمة
 * الموجودة خلف نافذة إضافة المادة أو الشفت.
 */
const SELECTOR = '.fixed.inset-0, [role="dialog"], [aria-modal="true"]';

function visibleOverlays(): HTMLElement[] {
  const out: HTMLElement[] = [];
  document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
    if (el.dataset.keyPassthrough !== undefined) return;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || st.pointerEvents === 'none') return;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return;
    const z = parseInt(st.zIndex || '0', 10) || 0;
    // حاويات الصفحة الثابتة بلا z-index عالٍ ليست نوافذ
    if (z < 40 && el.getAttribute('role') !== 'dialog' && el.getAttribute('aria-modal') !== 'true') return;
    out.push(el);
  });
  return out;
}

export function topmostOverlay(): HTMLElement | null {
  const list = visibleOverlays();
  if (list.length === 0) return null;
  let best = list[0];
  let bestZ = parseInt(getComputedStyle(best).zIndex || '0', 10) || 0;
  for (const el of list) {
    const z = parseInt(getComputedStyle(el).zIndex || '0', 10) || 0;
    // عند التساوي الأحدث في الشجرة هو الأعلى
    if (z >= bestZ) { best = el; bestZ = z; }
  }
  return best;
}

/** هل توجد نافذة منبثقة مفتوحة الآن؟ */
export function isOverlayOpen(): boolean {
  return topmostOverlay() !== null;
}

let installed = false;
export function installModalKeyGuard() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'F12' || e.key === 'F11') return;
    if (e.ctrlKey && e.key.toLowerCase() === 'r') return;
    const top = topmostOverlay();
    if (!top) return;
    const target = e.target as Node | null;
    if (target && top.contains(target)) return; // المفتاح داخل النافذة الظاهرة: يعمل طبيعياً
    // المفتاح موجّه لما خلف النافذة: نمنعه ونعيد التركيز إلى النافذة
    e.stopPropagation();
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Tab') e.preventDefault();
    const t = target as HTMLElement | null;
    const isTyping = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (isTyping || e.key === 'Enter') {
      const f = top.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])');
      try { f?.focus(); } catch { /* ignore */ }
    }
  }, true);
}
