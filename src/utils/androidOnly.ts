/** أندرويد فقط (تطبيق Capacitor). ويندوز (Electron) والويب يرجعان false. */
export function isAndroidApp(): boolean {
  try {
    const cap = (window as any).Capacitor;
    return !!cap?.isNativePlatform?.() && cap?.getPlatform?.() === 'android';
  } catch {
    return false;
  }
}
