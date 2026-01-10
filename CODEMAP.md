# ERS Runners — خريطة الأكواد والروابط (Code Map)

> تم توليد هذا الملف داخليًا من بنية المشروع وملفات `index.html` و`js/*.js`.
> التاريخ: 2026-01-05

## 1) نظرة عامة سريعة
التطبيق عبارة عن Web App / PWA مبني بـ HTML/CSS/Vanilla JS، ويستخدم:
- **Firebase (compat v9.22.0)**: Auth + Firestore
- **Leaflet 1.9.4**: خرائط
- **html2canvas 1.4.1**: تحويل عناصر DOM إلى صورة

---

## 2) نقطة الدخول (Bootstrap)
نقطة الدخول الفعلية هي: **`index.html`** التي تقوم بتحميل المكتبات الخارجية ثم ملفات المشروع بالترتيب.

### ترتيب تحميل السكربتات حسب `index.html`
> مهم: هذا الترتيب أساسي لأن المشروع يعتمد على متغيرات/دوال Global (بدون ES Modules).

- `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js`
- `https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js`
- `https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js`
- `https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js`
- `https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js`
- `js/config.js`
- `js/state.js`
- `js/utils.js`
- `js/ui.js`
- `js/coach.js`
- `js/activities.js`
- `js/challenges.js`
- `js/admin.js`
- `js/auth.js`
- `js/main.js`

---

## 3) خريطة الملفات (File Map)

### الجذر Root
- `index.html` — واجهة التطبيق + تحميل السكربتات + عناصر DOM الأساسية.
- `style.css`, `electric-blue.css` — الثيم والتنسيقات.
- `manifest.json` — إعدادات PWA (اسم، أيقونة، وضع العرض…).
- `service-worker.js` — كاش + تشغيل PWA offline (حسب ما هو مطبق داخله).
- `service-worker.json` — ملف إعداد إضافي (تحقق إن كان مستخدمًا داخل `service-worker.js`، وإلا يُفضّل حذفه لتقليل الالتباس).
- `app.js` — (تحقق من دوره: غالبًا تجميع/نسخة قديمة أو سكربت غير مستخدم إن لم يكن محمّلًا في `index.html`).

### مجلد JavaScript: `js/`
- `config.js`  
  يعرّف إعدادات Firebase ويقوم بالـ initialize ويعرّف Globals:
  - `auth` (Firebase Auth)
  - `db` (Firestore)

- `state.js`  
  حالة التطبيق العامة (Globals) مثل:
  - `currentUser`, `userData`
  - مؤشرات الفيد: `globalFeedLastDoc`, `globalFeedHasMore`, `globalFeedLoading`, `GLOBAL_FEED_PAGE_SIZE`
  - متغيرات التحرير: `editingRunId`, `editingOldType`, `editingOldDist`
  - كاش: `allUsersCache`
  - ملاحظة: يحتوي كذلك على `initApp()` (مهم لمعالجة الـ startup)

- `utils.js`  
  دوال مساعدة عامة (helpers) تُستخدم في أجزاء متعددة.

- `ui.js`  
  كل ما يخص DOM / العرض / تحديث الواجهة + فيد/صفحات…  
  يعتمد بكثرة على `state.js` وعلى `db` من `config.js`.

- `coach.js`  
  منطق صفحات/خصائص المدرب.

- `activities.js`  
  منطق الأنشطة (قراءة/كتابة Firestore + عرض).

- `challenges.js`  
  منطق التحديات.

- `admin.js`  
  لوحة الإدارة (قراءة/كتابة Firestore، صلاحيات، إدارة المستخدمين…).

- `auth.js`  
  تسجيل/تسجيل خروج/تبديل وضع signup/login، وينادي `initApp()` بعد نجاح الدخول غالبًا.

- `main.js`  
  نقطة التشغيل التي تربط كل شيء، ويُفضّل دائمًا أن تكون **آخر ملف**.

---

## 4) الروابط بين الملفات (Dependencies)

### المتغيرات/المصادر المشتركة (Globals)
- من `config.js`: `firebase`, `auth`, `db`
- من `state.js`: `currentUser`, `userData`, وغيرها المذكورة أعلاه

### من يعتمد على ماذا (بصورة عملية)
- `config.js` → يجب تحميله قبل أي ملف يستخدم `db/auth`
- `state.js` → يجب تحميله قبل `ui.js` وملفات الفيتشر
- `ui.js` → يعتمد على `state.js` و`db`
- `activities.js` → يعتمد على `state.js` و`db`
- `challenges.js` → يعتمد على `state.js` و`db`
- `coach.js` → يعتمد على `state.js` و`db/auth`
- `admin.js` → يعتمد على `state.js` و`db`
- `auth.js` → يعتمد على `state.js` و`auth/db` ويقوم ببدء `initApp()`
- `main.js` → يعتمد على أغلب ما سبق (تشغيل وربط Events)

### Mermaid Diagram (لمراجعة سريعة)
> إن كان عارض GitHub يدعم Mermaid ستظهر كـ رسم.

```mermaid
flowchart TD
  HTML[index.html] --> EXT1[Leaflet]
  HTML --> EXT2[Firebase compat]
  HTML --> EXT3[html2canvas]

  HTML --> CFG[js/config.js<br/>defines: auth, db]
  HTML --> ST[js/state.js<br/>defines: currentUser, userData, initApp()]
  HTML --> UT[js/utils.js]
  HTML --> UI[js/ui.js]
  HTML --> CO[js/coach.js]
  HTML --> AC[js/activities.js]
  HTML --> CH[js/challenges.js]
  HTML --> AD[js/admin.js]
  HTML --> AU[js/auth.js]
  HTML --> MN[js/main.js]

  CFG --> UI
  CFG --> CO
  CFG --> AC
  CFG --> CH
  CFG --> AD
  CFG --> AU
  CFG --> MN

  ST --> UI
  ST --> CO
  ST --> AC
  ST --> CH
  ST --> AD
  ST --> AU
  ST --> MN
```

---

## 5) نقاط مخاطر/تعارضات معروفة داخل المشروع (مهم قبل التصحيح)
### (A) وجود مجلد بأسماء Unicode غير طبيعية في الحزمة
داخل الملف المضغوط يوجد مجلد باسم غير مقروء يحتوي على:
- `admin.js`
- `state.js`

هذا **قد يعني** نسخة احتياط/قديمة.  
**المخاطر**: تضارب، ارتباك، أو نشر الملف الخطأ مستقبلًا.

✅ التوصية: حذف هذا المجلد أو نقله لاسم واضح مثل `backup/` مع توثيق السبب.

### (B) ترتيب تحميل السكربتات
حاليًا `index.html` يحمّل `admin.js` قبل `auth.js`.  
إذا كان `admin.js` يستدعي دوال من `auth.js` أثناء التحميل (top-level) فهذا قد يسبب أخطاء.  
✅ التوصية: إن وُجد اعتماد مباشر: إمّا إعادة ترتيب التحميل أو تأجيل تنفيذ `admin` إلى ما بعد `auth`/`initApp`.

### (C) Globals كثيرة
المشروع يعتمد على Globals (طبيعي في Vanilla)، لكن هذا يرفع احتمال:
- إعادة تعريف متغير
- صدام أسماء
- صعوبة تتبع المصدر

✅ تحسين لاحق: تحويل تدريجي لـ ES Modules أو تجميع كل globals تحت كائن واحد مثل `window.ERS = Ellipsis`.

---

## 6) Checklist سريع لتشخيص الأعطال
1. **خطأ: `db is not defined`** → تأكد أن `config.js` محمّل قبل الملف الذي يستخدم `db`.
2. **خطأ: `currentUser is not defined`** → تأكد أن `state.js` محمّل قبل الملفات الأخرى.
3. **شاشات لا تتحدث بعد تسجيل الدخول** → راجع أين يتم استدعاء `initApp()` (عادة في `auth.js`).
4. **PWA لا يحدث بعد نشر نسخة جديدة** → راجع `service-worker.js` وسياسة cache/versioning.

---

## 7) أين نضيف توثيق إضافي لاحقًا؟
- توثيق قواعد Firestore Collections/Docs
- توثيق Roles/Permissions (Admin/Coach/User)
- توثيق أهم flows: Login → initApp → UI render

