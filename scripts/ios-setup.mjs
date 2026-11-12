// يعدّل مشروع iOS المولَّد بواسطة `npx cap add ios`: أذونات الكاميرا والصور (ماسح الباركود وصور المواد).
// آمن للتكرار: لا يضيف مفتاحاً موجوداً مسبقاً.
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || process.cwd();
const plistPath = path.join(root, 'ios/App/App/Info.plist');
const log = (m) => console.log(`[ios-setup] ${m}`);

if (!fs.existsSync(plistPath)) {
  console.error(`[ios-setup] لم يُعثر على ${plistPath}. شغّل "npx cap add ios" أولاً.`);
  process.exit(1);
}

let plist = fs.readFileSync(plistPath, 'utf8');
const entries = [
  ['NSCameraUsageDescription', '<string>تستخدم الكاميرا لمسح باركود المواد وتصوير صور المواد.</string>'],
  ['NSPhotoLibraryUsageDescription', '<string>للاختيار من الصور لإضافة صور المواد وترويسة الفاتورة.</string>'],
  ['NSPhotoLibraryAddUsageDescription', '<string>لحفظ الصور والملفات التي تصدّرها من البرنامج.</string>'],
  ['ITSAppUsesNonExemptEncryption', '<false/>'],
];

let added = 0;
for (const [key, value] of entries) {
  if (plist.includes(`<key>${key}</key>`)) continue;
  plist = plist.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>${key}</key>\n\t${value}\n</dict>\n</plist>\n`);
  added++;
}
if (added > 0) {
  fs.writeFileSync(plistPath, plist);
  log(`أُضيف ${added} مفتاح/مفاتيح إلى Info.plist.`);
} else {
  log('لا شيء لإضافته.');
}
