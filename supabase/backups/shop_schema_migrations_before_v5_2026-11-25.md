# نسخة قبل إضافة التعديل 5 (2026-11-25)
جدول `shop_schema_migrations` في قاعدة POS الرئيسية كان يحوي الإصدارات 1–4 (نصوصها مطابقة لملفات supabase/shop-cloud/001..004 وما سُجِّل وقتها).
للرجوع: `delete from shop_schema_migrations where version = 5;` (ولا يُلغي ما طُبِّق على قواعد المحلات: التراجع عن 5 يكون بـ
`drop trigger documents_delta_guard on public.documents;` ثم `alter table public.documents drop column seq;` ورجوع السياسة لنص الإصدار 1).
النسخة الكاملة للصفوف محفوظة أيضاً في جدول `shop_schema_migrations_bak_20261125` في القاعدة الرئيسية.
