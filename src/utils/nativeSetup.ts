// تهيئة خاصة بتطبيق الأندرويد فقط (Capacitor). لا تفعل شيئاً في المتصفح أو Electron.

export async function setupNativeApp(): Promise<void> {
  try {
    const cap = (window as any).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    if (cap.getPlatform?.() === 'android') {
      document.documentElement.classList.add('android-native');
    }
    if (cap.getPlatform?.() === 'ios') {
      document.documentElement.classList.add('ios-native');
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setStyle({ style: Style.Dark });
      } catch {}
      return;
    }

    // شريط الحالة: لون داكن يطابق واجهة البرنامج ولا يتداخل مع المحتوى
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0f172a' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (err) {
    // أي فشل هنا لا يجب أن يمنع تشغيل البرنامج
    console.warn('Native setup skipped:', err);
  }
}
