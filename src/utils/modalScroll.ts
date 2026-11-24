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
