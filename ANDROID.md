# تطبيق الأندرويد (المفكر المحاسبي)

يُبنى التطبيق بتحويل واجهة الويب نفسها إلى تطبيق أندرويد عبر **Capacitor**، فالكود واحد للموقع والويندوز والأندرويد.

## الحصول على ملف APK (تلقائي)

1. ارفع أي تعديل إلى الفرع `android-app` (أو شغّل العملية يدوياً: تبويب **Actions** ← **Build Android APK** ← **Run workflow**).
2. انتظر انتهاء البناء (نحو 5 إلى 10 دقائق).
3. افتح صفحة التشغيل ونزّل من قسم **Artifacts**:
   - `AlMufakir-Android-Debug-APK`: نسخة جاهزة للتثبيت مباشرة على الهاتف.
   - `AlMufakir-Android-Release-APK`: تظهر فقط إذا أضفت أسرار التوقيع (أدناه).
4. فك ضغط الملف، وانقل الـ APK إلى الهاتف وثبّته (قد تحتاج السماح بالتثبيت من مصدر غير معروف).

الملفات الناتجة تبقى 30 يوماً.

## نسخة موقّعة للنشر (اختياري)

نسخة debug تكفي للتجربة والاستخدام الشخصي. للنشر على متجر Google Play أو للتحديث فوق نسخ سابقة بتوقيع ثابت، أنشئ مفتاح توقيع **مرة واحدة** واحتفظ به في مكان آمن (إن ضاع لن تستطيع تحديث التطبيق المنشور):

```
keytool -genkeypair -v -keystore release.jks -alias almufakir \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.jks > release.jks.b64
```

ثم من المستودع: **Settings ← Secrets and variables ← Actions ← New repository secret**، وأضف:

| اسم السر | القيمة |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | محتوى الملف `release.jks.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | كلمة مرور المخزن |
| `ANDROID_KEY_ALIAS` | `almufakir` (أو ما اخترته) |
| `ANDROID_KEY_PASSWORD` | كلمة مرور المفتاح |

عند أي بناء تالٍ يُنتج الـ APK الموقّع تلقائياً. لا ترفع ملف `release.jks` إلى المستودع أبداً.

## ما الذي يفعله سير العمل

1. يثبّت الحزم ويبني الواجهة (`npm run build` ← مجلد `dist`).
2. ينشئ مشروع الأندرويد (`npx cap add android`)، فمجلد `android/` غير مخزَّن في المستودع ويُولَّد في كل بناء.
3. يولّد أيقونات التطبيق من `public/logo.png`.
4. يشغّل `scripts/android-setup.mjs`، الذي يضيف إذن الكاميرا (لماسح الباركود) وإذن الإنترنت، ويضبط لوحة المفاتيح، ويضع رقم الإصدار من رقم تشغيل GitHub.
5. يزامن الواجهة مع المشروع (`npx cap sync android`) ويبني الـ APK.

## البناء على جهازك (اختياري)

يلزمك Node 22 وJDK 21 وAndroid Studio:

```
npm install --legacy-peer-deps
npx cap add android        # مرة واحدة
npm run android:setup
npm run android:sync
npm run android:open       # يفتح Android Studio لتشغيل التطبيق أو بناء APK
```

## ملاحظات

- معرّف التطبيق `com.listmaker.pos` في `capacitor.config.ts`. لا تغيّره بعد نشر التطبيق.
- البيانات والحسابات تُدار عبر Supabase مباشرة، فلا يحتاج التطبيق إلى خادم محلي. أما عرض عناوين الشبكة المحلية في إعدادات QR فهو خاص بنسخة الويندوز ولن يظهر في الأندرويد.
- الطباعة والمشاركة تستخدم إضافتي Filesystem وShare الموجودتين في المشروع.
