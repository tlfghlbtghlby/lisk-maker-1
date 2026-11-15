; ===== اختيار اختصارات سطح المكتب أثناء التثبيت =====
; صفحة تسأل المستخدم: أي الاختصارات يريد إنشاءها (واحد، اثنان، الكل، أو لا شيء)

!macro customHeader
  !include "nsDialogs.nsh"
  !include "LogicLib.nsh"
  Var scDlg
  Var scShown
  Var scMain
  Var scPos
  Var scInv
  Var scStk
  Var scShf
  Var scDbt
  Var scRep
  Var scSet
!macroend

!macro customPageAfterChangeDir
  Function ShortcutsPageCreate
    nsDialogs::Create 1018
    Pop $scDlg
    ${If} $scDlg == error
      Abort
    ${EndIf}
    StrCpy $scShown "1"

    ${NSD_CreateLabel} 0 0 100% 22u "اختر الاختصارات التي تريد إنشاءها على سطح المكتب (لن يُنشأ إلا ما تحدده):"
    Pop $0

    ${NSD_CreateCheckbox} 0 26u 48% 12u "البرنامج الرئيسي (كامل)"
    Pop $scMain
    ${NSD_Check} $scMain
    ${NSD_CreateCheckbox} 0 41u 48% 12u "نقطة البيع (نافذة منفصلة)"
    Pop $scPos
    ${NSD_Check} $scPos
    ${NSD_CreateCheckbox} 0 56u 48% 12u "سجل الفواتير"
    Pop $scInv
    ${NSD_CreateCheckbox} 0 71u 48% 12u "المواد والمخزون"
    Pop $scStk

    ${NSD_CreateCheckbox} 52% 26u 48% 12u "الشفتات والورديات"
    Pop $scShf
    ${NSD_CreateCheckbox} 52% 41u 48% 12u "البيع الآجل والديون"
    Pop $scDbt
    ${NSD_CreateCheckbox} 52% 56u 48% 12u "التقارير المالية"
    Pop $scRep
    ${NSD_CreateCheckbox} 52% 71u 48% 12u "الإعدادات"
    Pop $scSet

    ${NSD_CreateButton} 0 92u 32% 14u "تحديد الكل"
    Pop $0
    ${NSD_OnClick} $0 ShortcutsSelectAll
    ${NSD_CreateButton} 34% 92u 32% 14u "الأساسي فقط (الرئيسي + البيع)"
    Pop $0
    ${NSD_OnClick} $0 ShortcutsSelectMain
    ${NSD_CreateButton} 68% 92u 32% 14u "إلغاء الكل"
    Pop $0
    ${NSD_OnClick} $0 ShortcutsSelectNone

    nsDialogs::Show
  FunctionEnd

  Function ShortcutsSelectAll
    ${NSD_Check} $scMain
    ${NSD_Check} $scPos
    ${NSD_Check} $scInv
    ${NSD_Check} $scStk
    ${NSD_Check} $scShf
    ${NSD_Check} $scDbt
    ${NSD_Check} $scRep
    ${NSD_Check} $scSet
  FunctionEnd

  Function ShortcutsSelectNone
    ${NSD_Uncheck} $scMain
    ${NSD_Uncheck} $scPos
    ${NSD_Uncheck} $scInv
    ${NSD_Uncheck} $scStk
    ${NSD_Uncheck} $scShf
    ${NSD_Uncheck} $scDbt
    ${NSD_Uncheck} $scRep
    ${NSD_Uncheck} $scSet
  FunctionEnd

  Function ShortcutsSelectMain
    Call ShortcutsSelectNone
    ${NSD_Check} $scMain
    ${NSD_Check} $scPos
  FunctionEnd

  Function ShortcutsPageLeave
    ${NSD_GetState} $scMain $scMain
    ${NSD_GetState} $scPos $scPos
    ${NSD_GetState} $scInv $scInv
    ${NSD_GetState} $scStk $scStk
    ${NSD_GetState} $scShf $scShf
    ${NSD_GetState} $scDbt $scDbt
    ${NSD_GetState} $scRep $scRep
    ${NSD_GetState} $scSet $scSet
  FunctionEnd

  Page custom ShortcutsPageCreate ShortcutsPageLeave
!macroend

!macro customInstall
  ; إذا لم تظهر الصفحة (تثبيت صامت/تحديث تلقائي) يُنشأ الاختصار الرئيسي فقط كما كان
  ${If} $scShown != "1"
    CreateShortcut "$DESKTOP\${PRODUCT_FILENAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
  ${Else}
    ${If} $scMain == ${BST_CHECKED}
      CreateShortcut "$DESKTOP\${PRODUCT_FILENAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
    ${EndIf}
    ${If} $scPos == ${BST_CHECKED}
      CreateShortcut "$DESKTOP\ نقطة البيع.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=pos" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة نقطة البيع والمبيعات مباشرة"
    ${EndIf}
    ${If} $scStk == ${BST_CHECKED}
      CreateShortcut "$DESKTOP\ المواد والمخزون.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=inventory" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة المواد والمخزون مباشرة"
    ${EndIf}
    ${If} $scInv == ${BST_CHECKED}
      CreateShortcut "$DESKTOP\ سجل الفواتير.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=invoices" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة سجل القوائم والفواتير مباشرة"
    ${EndIf}
    ${If} $scShf == ${BST_CHECKED}
      CreateShortcut "$DESKTOP\ الشفتات والورديات.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=shifts" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة الشفتات والورديات مباشرة"
    ${EndIf}
    ${If} $scDbt == ${BST_CHECKED}
      CreateShortcut "$DESKTOP\ البيع الآجل والديون.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=debts" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة البيع الآجل وحسابات الديون مباشرة"
    ${EndIf}
    ${If} $scRep == ${BST_CHECKED}
      CreateShortcut "$DESKTOP\ التقارير المالية.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=reports" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة التقارير والأرباح مباشرة"
    ${EndIf}
    ${If} $scSet == ${BST_CHECKED}
      CreateShortcut "$DESKTOP\ الإعدادات.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--open-route=settings" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "تشغيل شاشة الإعدادات العامة مباشرة"
    ${EndIf}
  ${EndIf}
!macroend

!macro customUnInstall
  ; حذف الاختصارات تلقائياً عند إلغاء التثبيت
  Delete "$DESKTOP\${PRODUCT_FILENAME}.lnk"
  Delete "$DESKTOP\ نقطة البيع.lnk"
  Delete "$DESKTOP\ المواد والمخزون.lnk"
  Delete "$DESKTOP\ سجل الفواتير.lnk"
  Delete "$DESKTOP\ الشفتات والورديات.lnk"
  Delete "$DESKTOP\ البيع الآجل والديون.lnk"
  Delete "$DESKTOP\ التقارير المالية.lnk"
  Delete "$DESKTOP\ الإعدادات.lnk"
!macroend
