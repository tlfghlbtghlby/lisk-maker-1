// «الوضع العصري»: طبقة تنسيق شاملة + شاشة رئيسية وشريط تحكم، تُفعَّل بالصنف modern على <html>.
// كل الأيقونات والواجهات مضمَّنة في البرنامج نفسه (لا تُحمَّل من السحابة ولا تُخزَّن فيها).
import { useEffect, useState } from 'react';

export const MODERN_LS_KEY = 'mufakir_modern';
const EVT = 'mufakir-modern-change';

export function isModernMode(): boolean {
  try { return localStorage.getItem(MODERN_LS_KEY) === '1'; } catch { return false; }
}

export function setModernMode(on: boolean): void {
  try { localStorage.setItem(MODERN_LS_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('modern', on);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVT));
}

let fxInstalled = false;

/** مؤثرات عامة للوضع العصري: موجة لمس عند كل نقرة، وأنيميشن خروج للنوافذ التي تُغلق. */
function installModernFx(): void {
  if (fxInstalled || typeof document === 'undefined') return;
  fxInstalled = true;
  const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  const modernOn = () => document.documentElement.classList.contains('modern') && !reduced();

  // 1) موجة (ripple) عند النقر على أي زر/رابط/عنصر قابل للضغط
  document.addEventListener('pointerdown', (e) => {
    if (!modernOn()) return;
    const t = (e.target as Element | null)?.closest?.('button, a, [role="button"], label, summary, select, .cursor-pointer') as HTMLElement | null;
    if (!t || (t as any).disabled) return;
    const r = t.getBoundingClientRect();
    if (r.width < 8 || r.height < 8 || r.width > 900) return;
    const size = Math.max(r.width, r.height) * 1.6;
    const dot = document.createElement('span');
    dot.className = 'm-ripple';
    dot.style.cssText = `left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px;width:${size}px;height:${size}px`;
    const cs = getComputedStyle(t);
    if (cs.position === 'static') t.classList.add('m-ripple-host');
    t.classList.add('m-ripple-clip');
    t.appendChild(dot);
    setTimeout(() => { dot.remove(); t.classList.remove('m-ripple-clip'); }, 650);
  }, { passive: true, capture: true });

  // 2) خروج ناعم للنوافذ المنبثقة: ننسخ العنصر المحذوف ونحرّكه للخارج ثم نزيله
  const mo = new MutationObserver((muts) => {
    if (!modernOn()) return;
    for (const m of muts) {
      m.removedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement) || !n.classList.contains('fixed') || !n.classList.contains('inset-0')) return;
        if (n.classList.contains('m-exiting') || (n.className || '').toString().includes('pointer-events-none')) return;
        const parent = m.target as Node;
        if (!parent || !(parent as any).isConnected) return;
        const ghost = n.cloneNode(true) as HTMLElement;
        ghost.classList.add('m-exiting');
        ghost.style.pointerEvents = 'none';
        ghost.setAttribute('aria-hidden', 'true');
        ghost.querySelectorAll('input,textarea,select,button').forEach((el) => el.setAttribute('tabindex', '-1'));
        try { parent.appendChild(ghost); } catch { return; }
        setTimeout(() => ghost.remove(), 260);
      });
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

export function installModernMode(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('modern', isModernMode());
  installModernFx();
}

export function useModernMode(): boolean {
  const [on, setOn] = useState<boolean>(() => isModernMode());
  useEffect(() => {
    const h = () => setOn(isModernMode());
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);
  return on;
}
