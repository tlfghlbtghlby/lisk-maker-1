# إعداد بوت التليجرام (مرة واحدة)

> ⚠️ **أمان التوكن:** توكن البوت **لا يُكتب في الكود ولا في GitHub**. يُحفظ كسرّ داخل Supabase فقط، والبرنامج يتكلم مع دالة Supabase وليس مع التليجرام مباشرة.
> التوكن الذي كُتب في المحادثة صار مكشوفاً، فمن الأفضل أن تذهب إلى @BotFather → `/revoke` (أو Bot Settings → Revoke) وتأخذ توكناً جديداً وتستخدمه في الخطوة 3.

## 1) إنشاء الجداول
Supabase → **SQL Editor** → الصق محتوى الملف `supabase/telegram.sql` → Run.
(الجداول مقفلة بـ RLS ولا يصل لها إلا الدالة.)

## 2) نشر الدالة
بالطريقة السهلة من اللوحة: **Edge Functions → Create function** باسم `telegram-bot` والصق محتوى
`supabase/functions/telegram-bot/index.ts`، وأوقف خيار **Verify JWT**، ثم Deploy.

أو بالأوامر:
```bash
supabase functions deploy telegram-bot --no-verify-jwt --project-ref obodoxxzolgcwvzkkoua
```

## 3) ضبط الأسرار
Edge Functions → Secrets (أو بالأوامر):
```bash
supabase secrets set TELEGRAM_BOT_TOKEN="<توكن البوت>" TELEGRAM_WEBHOOK_SECRET="<نص عشوائي طويل>" --project-ref obodoxxzolgcwvzkkoua
```

## 4) ربط البوت بالدالة (Webhook)
افتح هذا الرابط في المتصفح مرة واحدة (بعد استبدال القيم):
```
https://api.telegram.org/bot<توكن البوت>/setWebhook?url=https://obodoxxzolgcwvzkkoua.supabase.co/functions/v1/telegram-bot&secret_token=<نفس WEBHOOK_SECRET>
```
يجب أن يظهر `"ok":true`.

## 5) الاستخدام
- **المتجر:** الإعدادات → «بوت التليجرام» → انسخ الرمز (ST-…) وأرسله للبوت → اضغط «ربط بالتليجرام».
- **الزبون:** صفحة الزبائن → زر «تليجرام» بجانب الزبون → أعطه الرمز (CU-…) ليرسله للبوت.
- لإيقاف الإشعارات من التليجرام: أرسل `/stop` للبوت.

## ملاحظات
- الإشعارات «أفضل جهد»: إن كان الجهاز بلا إنترنت لحظة الحدث فلن يُعاد إرسالها لاحقاً.
- لكل (متجر، زبون) رمز مستقل، فلا يتعارض زبون واحد بين متاجر مختلفة.
