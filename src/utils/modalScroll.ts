/** النوافذ المنبثقة: عند فتح أي نافذة يُقفل تمرير الخلفية، وتمرّر النافذة نفسها فقط. */
const SEL = '.fixed.inset-0[class*="bg-black"],.fixed.inset-0[class*="bg-slate-900/"],.fixed.inset-0[class*="bg-slate-950/"],.fixed.inset-0[class*="backdrop-blur"],.fixed.inset-0.print-modal-overlay';
export function installModalScroll() {
  if (typeof document === 'undefined') return;
  let t: any = null;
  const check = () => {
    t = null;
    const open = !!document.querySelector(SEL);
    document.body.classList.toggle('modal-open', open);
  };
  const obs = new MutationObserver(() => { if (!t) t = setTimeout(check, 30); });
  obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  check();
}

/** القوائم المنبثقة (كليك يمين، اقتراحات، ورقة الباركود...) تُوضع عند المؤشر؛ إن خرجت عن حدود النافذة تُعاد داخلها تلقائياً. */
const POPUP_SEL = '.fixed[style*="left"][style*="top"],.fixed > .absolute[style*="left"][style*="top"]';
const M = 6;
function clampPopup(el: HTMLElement) {
  if (!el.isConnected) return;
  const vw = window.innerWidth, vh = window.innerHeight;
  let r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return;
  const scale = el.offsetWidth ? r.width / el.offsetWidth : 1;
  // أطول من الشاشة: نحدّ الارتفاع ونجعله يمرّر داخلياً
  if (r.height > vh - 2 * M) {
    el.style.maxHeight = `${Math.floor((vh - 2 * M) / (scale || 1))}px`;
    el.style.overflowY = 'auto';
    r = el.getBoundingClientRect();
  }
  let dx = 0, dy = 0;
  if (r.right > vw - M) dx = r.right - (vw - M);
  if (r.left - dx < M) dx = r.left - M;
  if (r.bottom > vh - M) dy = r.bottom - (vh - M);
  if (r.top - dy < M) dy = r.top - M;
  if (!dx && !dy) return;
  const cs = getComputedStyle(el);
  const left = parseFloat(cs.left), top = parseFloat(cs.top);
  if (Number.isFinite(left) && dx) el.style.left = `${left - dx / (scale || 1)}px`;
  if (Number.isFinite(top) && dy) el.style.top = `${top - dy / (scale || 1)}px`;
}
export function installPopupClamp() {
  if (typeof document === 'undefined') return;
  const queue = new Set<HTMLElement>();
  let raf = 0;
  const flush = () => { raf = 0; queue.forEach(clampPopup); queue.clear(); };
  const add = (el: HTMLElement) => { queue.add(el); if (!raf) raf = requestAnimationFrame(flush); };
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        if (n.matches(POPUP_SEL)) add(n);
        n.querySelectorAll?.(POPUP_SEL).forEach((e) => add(e as HTMLElement));
      });
      if (m.type === 'attributes' && m.target instanceof HTMLElement && m.target.matches(POPUP_SEL)) add(m.target);
    }
  });
  obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
}
