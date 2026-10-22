# إعداد Firebase الفعلي

آخر تحقق للربط: ٢٢ أكتوبر ٢٠٢٦. بيانات إنشاء القاعدة والفوترة موثقة من تحقق ١٨ أكتوبر.

| العنصر | القيمة |
| --- | --- |
| المشروع | `qurangames-80d96` |
| رقم المشروع | `450731970655` |
| تطبيق الويب | `QuranGames Web` |
| App ID | `1:450731970655:web:ba18b0478680b8a25f0bea` |
| قاعدة البيانات | `(default)`، Standard، Native mode |
| الموقع | `me-central1` — الدوحة |
| الفوترة | غير مفعلة؛ القاعدة ضمن الحصة المجانية |
| الدخول بالبريد | فُعّل عبر نشر إعداد `auth` |
| القواعد والفهارس | نُشرت من ملفات هذا المستودع |

## استرجاع إعداد التطبيق

بعد تسجيل الدخول إلى Firebase CLI، استرجع إعدادات تطبيق الويب:

```sh
npx -y firebase-tools@latest apps:sdkconfig WEB '1:450731970655:web:ba18b0478680b8a25f0bea' --project qurangames-80d96
```

تُطابق `apiKey` و`authDomain` و`projectId` و`appId` متغيرات `VITE_FIREBASE_API_KEY` و`VITE_FIREBASE_AUTH_DOMAIN` و`VITE_FIREBASE_PROJECT_ID` و`VITE_FIREBASE_APP_ID` في Vercel. هذه إعدادات تطبيق الويب العامة، وليست مفتاح حساب الخدمة.

## حالة الربط المكتملة

- الإنتاج العام: https://qurangemaes.vercel.app/، والمستودع متصل بـ Vercel للنشر التلقائي من `main`.
- متغيرات الويب الأربعة و`FIREBASE_PROJECT_ID` محفوظة في Production. حُفظ `FIREBASE_CLIENT_EMAIL` و`FIREBASE_PRIVATE_KEY` من ملف حساب الخدمة الذي زوّده المالك كـ Secret في Vercel؛ لا توجد قيمة سرية في المستودع.
- أضيف `qurangemaes.vercel.app` إلى Authorized domains مع إبقاء نطاقات Firebase الأصلية.
- ضُبط `NODE_OPTIONS=--experimental-require-module` في Production. يحتاجه Firebase Admin 14 مع اعتماد `jwks-rsa`/`jose` في بيئة Vercel؛ بدونه يفشل تشغيل الوظيفة بـ `ERR_REQUIRE_ESM`. هذا الإعداد موثق في https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration .
- نشر `dpl_86R5RrtjFfvPTftET1tV2D8yGPAG` جاهز. نجح طلب `content.public` إلى `/api/app` بحالة HTTP 200 وبنك من ٢١١ مادة بعد قراءة Firestore. رُفض `content.save` دون هوية بحالة HTTP 401.
- لا تُعِد إنشاء المشروع أو تسجيل تطبيق الويب أو إضافة الأسرار إن بقيت الإعدادات موجودة. فشل اتصال إضافة Vercel سابقًا بـ403 لا يعني أن ربط GitHub أو جلسة لوحة Vercel غير موجودين؛ أُنجز الإعداد عبر اللوحة بإذن المالك.

## المتبقي لتفعيل محرر المحتوى والتحقق من العضويات

1. ينشئ المالك حسابًا داخل الموقع ويفعّل بريده، ثم يؤخذ UID من «رحلة إتقانك».
2. يضاف UID إلى `CONTENT_EDITOR_UIDS` في Production ويعاد النشر لتفعيل صلاحية المحرر. لم يُضف حساب محرر بعد.
3. يختبر حسابان فعليان نشر البنك ورفض غير المحرر، ثم حفظ الجلسات واستعادتها من جهاز ثانٍ. هذه التدفقات لم تُختبر بحسابات فعلية بعد؛ نجاح قراءة الخادم لا يثبتها وحده.

## تحديث إعداد Firebase

```sh
npx -y firebase-tools@latest deploy --only auth,firestore --project qurangames-80d96
```

قواعد Firestore الحالية تمنع وصول العميل المباشر. يتولى `api/app.js` التحقق من الهوية والأدوار وقراءة البيانات وكتابتها باستخدام Admin SDK. لا تغيّر القواعد إلى وصول عام لإصلاح مشكلة إعداد الخادم.
