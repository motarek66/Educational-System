# نظام إدارة ومتابعة الطلاب

منصة ويب عربية RTL لإدارة الطلاب والسناتر والمجموعات والحضور والدرجات والتواصل مع أولياء الأمور. الواجهة مبنية بـ React وVite، والـAPI بـ NestJS وPrisma وPostgreSQL.

## المتطلبات

- Node.js 20+
- pnpm 9+
- Docker وDocker Compose
- PostgreSQL 16+

## التشغيل السريع

```bash
cp .env.example .env
corepack enable
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- الواجهة: `http://localhost:5173`
- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`

## Docker

```bash
cp .env.example .env
docker compose up --build
```

الواجهة ستعمل على `http://localhost:8080`.

## حساب البداية

يُنشأ من متغيرات البيئة `SUPER_ADMIN_*`. غيّر كلمة المرور فور أول تسجيل دخول.

## أوامر الجودة

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm check:source
```

## قاعدة البيانات

```bash
pnpm db:migrate
pnpm db:seed
```

لا تستخدم `prisma db push` في الإنتاج.

## النسخ الاحتياطي والاستعادة

```bash
./infra/backup/backup.sh
./infra/backup/restore.sh backups/<file>.dump
```

راجع الملفات التالية قبل تعديل قواعد العمل أو الواجهة:

- `docs/student_management_system_full_spec.md`
- `docs/design-system.md`
- `docs/architecture.md`
- `docs/api/endpoint-matrix.md`
- `docs/testing/test-plan.md`

بعد أول `pnpm install`، ثبّت `pnpm-lock.yaml` داخل المستودع ثم استخدم `--frozen-lockfile` في CI وDocker.
