!macro customInstall
  ; ضبط ترميز النصوص في سكريبت التثبيت
  Unicode true

  ; إنشاء اختصارات سطح المكتب الرسمية لكل قسم مع أيقونتها ومعامل التشغيل
  CreateShortcut "$DESKTOP\المفكر المحاسبي - نقطة البيع.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=pos" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة نقطة البيع والمبيعات مباشرة"
  CreateShortcut "$DESKTOP\المفكر المحاسبي - المواد والمخزون.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=inventory" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة المواد والمخزون مباشرة"
  CreateShortcut "$DESKTOP\المفكر المحاسبي - سجل الفواتير.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=invoices" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة سجل القوائم والفواتير مباشرة"
  CreateShortcut "$DESKTOP\المفكر المحاسبي - الشفتات والورديات.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=shifts" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة الشفتات والورديات مباشرة"
  CreateShortcut "$DESKTOP\المفكر المحاسبي - البيع الآجل والديون.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=debts" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة البيع الآجل وحسابات الديون مباشرة"
  CreateShortcut "$DESKTOP\المفكر المحاسبي - التقارير المالية.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=reports" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة التقارير والأرباح مباشرة"
  CreateShortcut "$DESKTOP\المفكر المحاسبي - الإعدادات.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=settings" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة الإعدادات العامة مباشرة"
!macroend

!macro customUnInstall
  ; حذف كافة الاختصارات تلقائياً عند إلغاء تثبيت البرنامج
  Delete "$DESKTOP\المفكر المحاسبي - نقطة البيع.lnk"
  Delete "$DESKTOP\المفكر المحاسبي - المواد والمخزون.lnk"
  Delete "$DESKTOP\المفكر المحاسبي - سجل الفواتير.lnk"
  Delete "$DESKTOP\المفكر المحاسبي - الشفتات والورديات.lnk"
  Delete "$DESKTOP\المفكر المحاسبي - البيع الآجل والديون.lnk"
  Delete "$DESKTOP\المفكر المحاسبي - التقارير المالية.lnk"
  Delete "$DESKTOP\المفكر المحاسبي - الإعدادات.lnk"
!macroend
