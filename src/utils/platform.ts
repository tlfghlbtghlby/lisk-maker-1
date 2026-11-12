// كشف منصة التشغيل. لا يعتمد على أي حزمة: Capacitor يحقن window.Capacitor في تطبيق الأندرويد فقط.
export const isAndroidNative: boolean = (() => {
  try {
    const c = (window as any).Capacitor;
    return !!c?.isNativePlatform?.() && c.getPlatform?.() === 'android';
  } catch {
    return false;
  }
})();

/** هاتف أندرويد (وليس لوحياً): نفرض عليه واجهة الهاتف دون تغيير الإعداد المحفوظ في السحابة */
export const isAndroidPhone: boolean = isAndroidNative && typeof window !== 'undefined' && Math.min(window.screen.width, window.screen.height) < 600;

export const isIosNative: boolean = (() => {
  try {
    const c = (window as any).Capacitor;
    return !!c?.isNativePlatform?.() && c.getPlatform?.() === 'ios';
  } catch {
    return false;
  }
})();

/** آيفون (وليس آيباد): نفرض واجهة الهاتف محلياً */
export const isIosPhone: boolean = isIosNative && typeof window !== 'undefined' && Math.min(window.screen.width, window.screen.height) < 600;

/** هاتف (أندرويد أو آيفون) يعرض واجهة الهاتف دون تغيير الإعداد المشترك */
export const isNativePhone: boolean = isAndroidPhone || isIosPhone;
