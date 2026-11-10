import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { biometricSupported, verifyBiometric, BiometricCredential } from '../utils/biometric';

export type BioStatus = 'unsupported' | 'none' | 'waiting' | 'idle';

/** يستمع لبصمة أي مشرف مسجَّل؛ عند التطابق يستدعي onMatch(معرّف المشرف) */
export function useSupervisorBiometric(active: boolean, onMatch: (supervisorId: string) => void) {
  const { settings } = useApp();
  const owners = useMemo(() => {
    const map = new Map<string, string>();
    const creds: BiometricCredential[] = [];
    for (const sup of settings.supervisors || []) {
      for (const b of sup.biometrics || []) {
        map.set(b.id, sup.id);
        creds.push(b);
      }
    }
    return { map, creds };
  }, [settings.supervisors]);

  const [status, setStatus] = useState<BioStatus>('idle');
  const ctrl = useRef<AbortController | null>(null);
  const cb = useRef(onMatch);
  cb.current = onMatch;
  const ownersRef = useRef(owners);
  ownersRef.current = owners;

  const stop = useCallback(() => {
    ctrl.current?.abort();
    ctrl.current = null;
  }, []);

  const start = useCallback(async () => {
    const { map, creds } = ownersRef.current;
    if (!biometricSupported()) { setStatus('unsupported'); return; }
    if (creds.length === 0) { setStatus('none'); return; }
    stop();
    const c = new AbortController();
    ctrl.current = c;
    setStatus('waiting');
    const id = await verifyBiometric(creds, c.signal);
    if (c.signal.aborted) return;
    ctrl.current = null;
    const sup = id ? map.get(id) : undefined;
    if (sup) cb.current(sup);
    else setStatus('idle');
  }, [stop]);

  useEffect(() => {
    if (!active) { stop(); return; }
    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, owners.creds.length]);

  return { status, start, stop, hasCreds: owners.creds.length > 0 };
}
