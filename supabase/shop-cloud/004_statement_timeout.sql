-- المحلات الكبيرة (آلاف الفواتير) تُحفظ في وثيقة واحدة كبيرة؛ المهلة الافتراضية (~8 ثوانٍ) قد تقطع الحفظ/القراءة.
alter role anon set statement_timeout = '120s';
alter role authenticated set statement_timeout = '120s';
notify pgrst, 'reload config';
