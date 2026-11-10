import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { broadcastSync, subscribeSync, CURRENT_WINDOW_ID } from '../utils/syncChannel';
import { handleByPos, isPosMountedHere } from '../utils/barcodeBus';

/**
 * قارئ الباركود العام: يلتقط المسح من أي قسم في البرنامج (حتى لو لم تكن نقطة البيع هي المفتوحة)
 * ويضيف المادة للقائمة. إن كانت نقطة البيع مفتوحة في نافذة أخرى تُضاف هناك، وإلا تُضاف للقائمة النشطة هنا.
 * لا يمنع الحقل المفتوح من استلام الباركود أيضاً (للبحث في قسم آخر مثلاً).
 */
export const GlobalBarcodeListener: React.FC = () => {
  const { settings, addBarcodeToActiveDraft, hasPermission, setSyncNotice, currentUser } = useApp();

  const latest = useRef({ settings, addBarcodeToActiveDraft, hasPermission, setSyncNotice, currentUser });
  latest.current = { settings, addBarcodeToActiveDraft, hasPermission, setSyncNotice, currentUser };
  const acked = useRef<Set<string>>(new Set());

  const notify = (text: string) => {
    latest.current.setSyncNotice(text);
    setTimeout(() => latest.current.setSyncNotice(null), 3500);
  };

  const addHere = (code: string) => {
    const r = latest.current.addBarcodeToActiveDraft(code);
    notify(r.found ? `تمت إضافة «${r.name}» إلى قائمة البيع (+1)` : `الباركود #${code} غير مسجل في المخزن`);
  };

  // المسح داخل هذه النافذة
  useEffect(() => {
    let buffer = '';
    let startedAt = 0;
    let lastAt = 0;

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const now = Date.now();

      if (e.key === 'Enter') {
        const len = buffer.length;
        const code = buffer;
        const avg = len > 0 ? (lastAt - startedAt) / Math.max(1, len - 1) : 999;
        buffer = '';
        if (len < 4 || avg > 45) return; // كتابة يدوية وليست ماسحاً
        const { settings: st, hasPermission: can, currentUser: user } = latest.current;
        if (!user || st.globalBarcodeCapture === false || !can('canSell')) return;
        if (isPosMountedHere()) return; // نقطة البيع هنا تعالج الباركود بنفسها
        const target = e.target as HTMLElement | null;
        if (target && target.closest && target.closest('.fixed.inset-0')) return; // داخل نافذة منبثقة

        const id = `${CURRENT_WINDOW_ID}_${now}`;
        broadcastSync('BARCODE_SCANNED', { code, id }, user.uid);
        setTimeout(() => {
          if (acked.current.has(id)) { acked.current.delete(id); return; }
          addHere(code);
        }, 250);
        return;
      }

      if (e.key.length === 1) {
        if (now - lastAt > 100) { buffer = ''; startedAt = now; }
        if (buffer === '') startedAt = now;
        buffer += e.key;
        lastAt = now;
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // استقبال مسح جاء من نافذة أخرى
  useEffect(() => {
    return subscribeSync(msg => {
      if (msg.senderId === CURRENT_WINDOW_ID) return;
      if (msg.type === 'BARCODE_HANDLED') {
        if (msg.data?.id) acked.current.add(msg.data.id);
        return;
      }
      if (msg.type === 'BARCODE_SCANNED') {
        const uid = latest.current.currentUser?.uid;
        if (!uid || (msg.storeUid && msg.storeUid !== uid)) return;
        if (latest.current.settings.globalBarcodeCapture === false) return;
        if (handleByPos(String(msg.data?.code || ''))) {
          broadcastSync('BARCODE_HANDLED', { id: msg.data?.id }, uid);
        }
      }
    });
  }, []);

  return null;
}; 
