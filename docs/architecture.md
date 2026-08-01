# معمارية المشروع

## الصورة العامة

```text
Browser / PWA
    │ HTTPS + REST /api/v1
    ▼
React + Vite + TypeScript
    │ typed API boundary
    ▼
NestJS modules + DTO validation + RBAC + data scopes
    │ Prisma transactions
    ▼
PostgreSQL
```

- الواجهة لا تتصل بقاعدة البيانات مباشرة.
- الـBackend هو مصدر الحقيقة للصلاحيات، النطاق، Student Code، QR، الحضور والدرجات.
- كل Query للمستخدمين التشغيليين تُقيّد بـ`organizationId` ثم Center/Group scope عند الحاجة.
- العمليات المركبة مثل إنشاء طالب، نقله، تسجيل حضوره وإغلاق الحصة تستخدم Transactions وقيود قاعدة البيانات.

## Frontend

- Feature-based React architecture.
- TanStack Query للـserver state، وReact Hook Form + Zod للنماذج.
- Access token في الذاكرة، وRefresh token داخل HttpOnly cookie.
- Desktop layout مطابق للمرجع: topbar بارتفاع 80px، شريط أيقونات يمين 96px، خلفية رمادية هادئة وبطاقات بيضاء.
- Mobile-first مع bottom navigation وواجهة حضور مناسبة للمس.

## Backend

- Modules منفصلة: auth, rbac, users, academic years, centers, groups, students, lessons, attendance, exams, dashboard, imports, exports, WhatsApp, audit, settings, health.
- Controllers خفيفة، والخدمات تحتوي قواعد العمل.
- Global exception filter يعيد Error Codes ثابتة مع Request ID.
- Global response interceptor يوحّد استجابات JSON ويستثني الملفات المتدفقة.

## قاعدة البيانات

- PostgreSQL + Prisma Migrate.
- Soft archive للعناصر التاريخية.
- Unique constraint على `(lessonId, enrollmentId)` لمنع تكرار الحضور حتى في السباق المتزامن.
- تاريخ النقل محفوظ بإنهاء Enrollment وإنشاء Enrollment جديد.
- QR لا يحتوي بيانات شخصية؛ يستخدم token opaque وتخزن بصمته.

## ملفات المشروع

```text
apps/web          React application
apps/api          NestJS API + Prisma
packages          shared config/constants
docs              specification, ADRs and operational docs
infra             Nginx and backup scripts
.github/workflows CI pipeline
```
