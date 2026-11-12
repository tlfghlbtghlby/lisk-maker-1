import type { CapacitorConfig } from '@capacitor/cli';

// إعداد Capacitor لتحويل واجهة الويب (مجلد dist الناتج عن vite build) إلى تطبيق أندرويد.
// ملاحظة: appId هو معرّف التطبيق على الهاتف. تغييره لاحقاً يجعل الهاتف يعتبر التطبيق مختلفاً،
// فلا يتحدّث فوق النسخة المثبّتة ولا يرى بياناتها.
const config: CapacitorConfig = {
  appId: 'com.listmaker.pos',
  appName: 'برنامج المفكر المحاسبي',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  ios: {
    // المحتوى يبتعد تلقائياً عن النتوء وشريط الحالة وشريط الأسفل
    contentInset: 'always',
    backgroundColor: '#0b1728',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
      overlaysWebView: false,
    },
  },
};

export default config;
