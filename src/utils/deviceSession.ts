import { DeviceSession } from '../types';

export const getOrCreateDeviceId = (): string => {
  try {
    const existing = localStorage.getItem('pos_device_id');
    if (existing && existing.trim()) {
      return existing.trim();
    }
    const fresh = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('pos_device_id', fresh);
    return fresh;
  } catch {
    return 'dev_fallback_' + Date.now().toString(36);
  }
};

export const getOrCreateSessionId = (userId: string): string => {
  const deviceId = getOrCreateDeviceId();
  return `sess_${userId || 'guest'}_${deviceId}`;
};

export interface DetectedSystemInfo {
  deviceType: 'desktop' | 'mobile' | 'tablet';
  deviceName: string;
  os: string;
  browser: string;
  location: string;
}

export const detectSystemInfo = (): DetectedSystemInfo => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      deviceType: 'desktop',
      deviceName: 'جهاز مكتبي (كمبيوتر)',
      os: 'Windows / PC',
      browser: 'Web Browser',
      location: 'العراق (موقع تقريبي)',
    };
  }

  const ua = navigator.userAgent || '';
  
  // 1. Detect Device Type
  const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk)/i.test(ua);
  const isMobile = !isTablet && /(android|iphone|ipod|mobile|phone|blackberry|iemobile|opera mini)/i.test(ua);
  const deviceType: 'desktop' | 'mobile' | 'tablet' = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  // 2. Detect OS
  let os = 'نظام غير محدد';
  if (/windows nt 10.0/i.test(ua)) os = 'Windows 10 / 11';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android (أندرويد)';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS (آبل)';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS (ماك)';
  else if (/linux/i.test(ua)) os = 'Linux';

  // 3. Detect Browser
  let browser = 'متصفح الإنترنت';
  if (/edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/samsungbrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/chrome|crios/i.test(ua)) browser = 'Google Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Mozilla Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Apple Safari';
  else if (/opr\//i.test(ua)) browser = 'Opera';

  // 4. Generate friendly Arabic device name
  let deviceName = '';
  if (deviceType === 'desktop') {
    deviceName = `كمبيوتر (${os})`;
  } else if (deviceType === 'tablet') {
    deviceName = `جهاز لوحي تاب (${os})`;
  } else {
    deviceName = `هاتف محمول (${os})`;
  }

  // 5. Detect Approximate Location from Timezone & Locale
  let location = 'العراق (موقع تقريبي)';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      if (tz.includes('Baghdad') || tz === 'Asia/Baghdad') {
        location = 'العراق / بغداد (Asia/Baghdad)';
      } else if (tz.includes('Basra') || tz === 'Asia/Basra') {
        location = 'العراق / البصرة';
      } else if (tz.includes('Riyadh')) {
        location = 'السعودية / الرياض';
      } else if (tz.includes('Cairo')) {
        location = 'مصر / القاهرة';
      } else if (tz.includes('Dubai')) {
        location = 'الإمارات / دبي';
      } else if (tz.includes('Amman')) {
        location = 'الأردن / عمان';
      } else if (tz.includes('Damascus')) {
        location = 'سوريا / دمشق';
      } else if (tz.includes('Beirut')) {
        location = 'لبنان / بيروت';
      } else if (tz.includes('Kuwait')) {
        location = 'الكويت';
      } else {
        const parts = tz.split('/');
        const city = parts[parts.length - 1].replace(/_/g, ' ');
        location = `${city} (${tz})`;
      }
    }
  } catch {}

  return {
    deviceType,
    deviceName,
    os,
    browser,
    location,
  };
};
