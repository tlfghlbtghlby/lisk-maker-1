// «عكس اللون»: كل كتابة تأخذ لوناً مغايراً للخلفية التي هي عليها (أسود على الفاتح، أبيض على الداكن).
// تعمل بمراقبة الصفحة وتعدّل لون النص عند ضعف التباين فقط، وتُلغى بالكامل عند الإيقاف.

export const AC_LS_KEY = 'mufakir_auto_contrast';
const ATTR = 'data-ac';
const MIN_RATIO = 4.5;

let on = false;
let obs: MutationObserver | null = null;
let queue = new Set<Element>();
let scheduled = false;

type RGBA = [number, number, number, number];

function parse(c: string): RGBA | null {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  if (p.length < 3 || p.some((x) => Number.isNaN(x))) return null;
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
}
function lum([r, g, b]: RGBA): number {
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(a: RGBA, b: RGBA): number {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function over(top: RGBA, bottom: RGBA): RGBA {
  const a = top[3];
  return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
}

/** لون الخلفية الفعلي خلف عنصر (null إن وُجدت صورة/تدرّج لا يمكن قياسه) */
function effectiveBg(el: Element): RGBA | null {
  const layers: RGBA[] = [];
  let cur: Element | null = el;
  while (cur) {
    const cs = getComputedStyle(cur);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
    const bg = parse(cs.backgroundColor);
    if (bg && bg[3] > 0) {
      layers.push(bg);
      if (bg[3] >= 1) break;
    }
    cur = cur.parentElement;
  }
  let base: RGBA = [255, 255, 255, 1];
  if (!layers.length || layers[layers.length - 1][3] < 1) {
    const root = parse(getComputedStyle(document.body).backgroundColor);
    base = root && root[3] >= 1 ? root : (document.documentElement.classList.contains('dark') ? [7, 13, 24, 1] : [255, 255, 255, 1]);
  }
  for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
  return base;
}

function hasOwnText(el: Element): boolean {
  for (const n of Array.from(el.childNodes)) if (n.nodeType === 3 && (n.textContent || '').trim()) return true;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  return false;
}

function release(el: HTMLElement) {
  const prev = el.getAttribute(ATTR);
  if (prev === null) return;
  const [v, pr] = prev.split('|');
  if (v) el.style.setProperty('color', v, pr || '');
  else el.style.removeProperty('color');
  el.removeAttribute(ATTR);
}

function fix(el: Element) {
  if (!(el instanceof HTMLElement) || el.closest('.keep-light, [data-ac-skip], script, style, svg')) return;
  if (!hasOwnText(el)) return;
  // أعد القياس من اللون الأصلي
  if (el.hasAttribute(ATTR)) release(el);
  const cs = getComputedStyle(el);
  if (cs.visibility === 'hidden' || cs.display === 'none') return;
  const fg = parse(cs.color);
  const bg = effectiveBg(el);
  if (!fg || !bg) return;
  const fgOver = fg[3] < 1 ? over(fg, bg) : fg;
  if (ratio(fgOver, bg) >= MIN_RATIO) return;
  const white: RGBA = [255, 255, 255, 1], black: RGBA = [15, 23, 42, 1];
  const pick = ratio(white, bg) >= ratio(black, bg) ? '#ffffff' : '#0f172a';
  el.setAttribute(ATTR, `${el.style.getPropertyValue('color')}|${el.style.getPropertyPriority('color')}`);
  el.style.setProperty('color', pick, 'important');
}

function flush() {
  scheduled = false;
  if (!on) { queue.clear(); return; }
  const batch = Array.from(queue).slice(0, 400);
  batch.forEach((e) => queue.delete(e));
  for (const e of batch) { try { fix(e); } catch { /* ignore */ } }
  if (queue.size) schedule();
}
function schedule() {
  if (scheduled) return;
  scheduled = true;
  const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: any) => void);
  if (ric) ric(flush, { timeout: 300 }); else setTimeout(flush, 60);
}
function enqueueTree(root: Element) {
  queue.add(root);
  root.querySelectorAll('*').forEach((e) => queue.add(e));
  schedule();
}

export function setAutoContrast(enabled: boolean) {
  try { localStorage.setItem(AC_LS_KEY, enabled ? '1' : '0'); } catch { /* ignore */ }
  if (enabled === on) return;
  on = enabled;
  if (on) {
    obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'childList') m.addedNodes.forEach((n) => { if (n.nodeType === 1) enqueueTree(n as Element); else if (n.parentElement) { queue.add(n.parentElement); schedule(); } });
        else if (m.type === 'characterData' && m.target.parentElement) { queue.add(m.target.parentElement); schedule(); }
        else if (m.type === 'attributes') {
          const t = m.target as Element;
          if (t === document.documentElement) enqueueTree(document.body);
          else if (m.attributeName !== ATTR && !(m.attributeName === 'style' && t.hasAttribute(ATTR))) enqueueTree(t);
        }
      }
    });
    obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    enqueueTree(document.body);
  } else {
    obs?.disconnect(); obs = null; queue.clear();
    document.querySelectorAll(`[${ATTR}]`).forEach((e) => release(e as HTMLElement));
  }
}

export function installAutoContrast() {
  let v = false;
  try { v = localStorage.getItem(AC_LS_KEY) === '1'; } catch { /* ignore */ }
  if (v) {
    if (document.body) setAutoContrast(true);
    else window.addEventListener('DOMContentLoaded', () => setAutoContrast(true), { once: true });
  }
}
