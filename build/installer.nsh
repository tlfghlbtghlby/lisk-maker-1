!macro customInstall
  ; إنشاء اختصارات سطح المكتب لأقسام البرنامج
  CreateShortcut "$DESKTOP\ نقطة البيع.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=pos" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة نقطة البيع والمبيعات مباشرة"
  CreateShortcut "$DESKTOP\ المواد والمخزون.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=inventory" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة المواد والمخزون مباشرة"
  CreateShortcut "$DESKTOP\ سجل الفواتير.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=invoices" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة سجل القوائم والفواتير مباشرة"
  CreateShortcut "$DESKTOP\ الشفتات والورديات.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=shifts" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة الشفتات والورديات مباشرة"
  CreateShortcut "$DESKTOP\ البيع الآجل والديون.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=debts" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة البيع الآجل وحسابات الديون مباشرة"
  CreateShortcut "$DESKTOP\ التقارير المالية.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=reports" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة التقارير والأرباح مباشرة"
  CreateShortcut "$DESKTOP\ الإعدادات.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=settings" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة الإعدادات العامة مباشرة"
!macroend

!macro customUnInstall
  ; حذف الاختصارات تلقائياً عند إلغاء التثبيت
  Delete "$DESKTOP\ نقطة البيع.lnk"
  Delete "$DESKTOP\ المواد والمخزون.lnk"
  Delete "$DESKTOP\ سجل الفواتير.lnk"
  Delete "$DESKTOP\ الشفتات والورديات.lnk"
  Delete "$DESKTOP\- البيع الآجل والديون.lnk"
  Delete "$DESKTOP\ التقارير المالية.lnk"
  Delete "$DESKTOP\- الإعدادات.lnk"
!macroend
