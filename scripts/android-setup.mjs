// يعدّل مشروع الأندرويد المولَّد بواسطة `npx cap add android` بما يحتاجه البرنامج.
// يعمل في سير عمل GitHub ويمكن تشغيله محلياً: node scripts/android-setup.mjs
// آمن للتكرار: لا يضيف شيئاً موجوداً مسبقاً.
//
// متغيرات بيئة اختيارية:
//   ANDROID_VERSION_CODE  رقم الإصدار الصحيح (يزداد مع كل بناء)، مثل رقم تشغيل GitHub
//   ANDROID_VERSION_NAME  اسم الإصدار الظاهر للمستخدم، مثل 2.0.15

import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || process.cwd();
const manifestPath = path.join(root, 'android/app/src/main/AndroidManifest.xml');
const gradlePath = path.join(root, 'android/app/build.gradle');

let failed = false;
const log = (msg) => console.log(`[android-setup] ${msg}`);
const warn = (msg) => console.warn(`[android-setup] تحذير: ${msg}`);

// ---------- AndroidManifest.xml ----------
if (!fs.existsSync(manifestPath)) {
  console.error(`[android-setup] لم يُعثر على ${manifestPath}. شغّل "npx cap add android" أولاً.`);
  process.exit(1);
}

let manifest = fs.readFileSync(manifestPath, 'utf8');
const original = manifest;

// أذونات: الكاميرا (ماسح الباركود) والإنترنت (Supabase). الكاميرا ليست إلزامية لتثبيت التطبيق.
const permissionLines = [
  ['android.permission.INTERNET', '<uses-permission android:name="android.permission.INTERNET" />'],
  ['android.permission.CAMERA', '<uses-permission android:name="android.permission.CAMERA" />'],
  ['android.hardware.camera', '<uses-feature android:name="android.hardware.camera" android:required="false" />'],
  ['android.hardware.camera.autofocus', '<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />'],
];

const missing = permissionLines.filter(([key]) => !manifest.includes(key)).map(([, line]) => line);
if (missing.length > 0) {
  if (/<application[\s>]/.test(manifest)) {
    manifest = manifest.replace(/<application/, `${missing.join('\n    ')}\n\n    <application`);
    log(`أُضيفت ${missing.length} من الأذونات/الميزات إلى المانيفست.`);
  } else {
    warn('لم أجد وسم <application> في المانيفست، لم تُضف الأذونات.');
    failed = true;
  }
}

// لوحة المفاتيح لا تغطي حقول الإدخال (البحث، الكميات...)
if (!manifest.includes('android:windowSoftInputMode')) {
  if (/<activity\b/.test(manifest)) {
    manifest = manifest.replace(/<activity\b/, '<activity\n            android:windowSoftInputMode="adjustResize"');
    log('أُضيف windowSoftInputMode=adjustResize.');
  } else {
    warn('لم أجد وسم <activity>.');
  }
}

if (manifest !== original) fs.writeFileSync(manifestPath, manifest);

// ---------- build.gradle: رقم الإصدار واسمه ----------
const versionCode = process.env.ANDROID_VERSION_CODE;
const versionName = process.env.ANDROID_VERSION_NAME;

if ((versionCode || versionName) && fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  const before = gradle;

  if (versionCode) {
    if (!/^\d+$/.test(versionCode)) {
      warn(`ANDROID_VERSION_CODE غير صالح: "${versionCode}"`);
    } else if (/versionCode\s*=?\s*\d+/.test(gradle)) {
      gradle = gradle.replace(/versionCode\s*=?\s*\d+/, `versionCode ${versionCode}`);
    } else {
      warn('لم أجد versionCode في build.gradle.');
    }
  }
  if (versionName) {
    if (!/^[\w.\-+]+$/.test(versionName)) {
      warn(`ANDROID_VERSION_NAME غير صالح: "${versionName}"`);
    } else if (/versionName\s*=?\s*["'][^"']*["']/.test(gradle)) {
      gradle = gradle.replace(/versionName\s*=?\s*["'][^"']*["']/, `versionName "${versionName}"`);
    } else {
      warn('لم أجد versionName في build.gradle.');
    }
  }
  if (gradle !== before) {
    fs.writeFileSync(gradlePath, gradle);
    log(`ضُبط الإصدار: code=${versionCode || '-'} name=${versionName || '-'}`);
  }
}

// ---------- توقيع ثابت لنسخة debug ----------
// بدون هذا يولّد كل بناء على GitHub مفتاح توقيع جديداً، فيرفض الأندرويد تثبيت التحديث فوق القديم (تعارض التوقيع).
// نستخدم مفتاحاً ثابتاً محفوظاً في المستودع (android-signing/debug.keystore) فتُوقَّع كل النسخ بالتوقيع نفسه.
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  const ksFile = path.join(root, 'android-signing/debug.keystore');
  if (!fs.existsSync(ksFile)) {
    warn('android-signing/debug.keystore غير موجود؛ سيستعمل البناء مفتاحاً عشوائياً وقد يحدث تعارض عند التحديث.');
  } else if (!gradle.includes('android-signing/debug.keystore')) {
    const block = `    signingConfigs {
        debug {
            storeFile file("../../android-signing/debug.keystore")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }
    }

`;
    if (/^\s*buildTypes\s*\{/m.test(gradle)) {
      gradle = gradle.replace(/^(\s*)buildTypes\s*\{/m, (m) => block + m);
      fs.writeFileSync(gradlePath, gradle);
      log('ضُبط توقيع ثابت لنسخة debug.');
    } else {
      warn('لم أجد buildTypes في build.gradle؛ لم يُضبط التوقيع الثابت.');
    }
  }
}

if (failed) process.exit(1);
log('اكتمل إعداد مشروع الأندرويد.');
