import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { unicodeEnvOrFallback } from './seed-utils';

const prisma = new PrismaClient();

const permissions = [
  'users.view', 'users.create', 'users.update',
  'students.view', 'students.create', 'students.update', 'students.archive', 'students.export',
  'attendance.view', 'attendance.scan', 'attendance.create_manual', 'attendance.correct', 'attendance.guest',
  'lessons.create',
  'exams.view', 'exams.create',
  'grades.enter', 'grades.edit_draft', 'grades.edit_published',
  'whatsapp.open_message', 'whatsapp.manage_templates',
  'centers.view', 'centers.create',
  'dashboard.view', 'reports.export',
] as const;

async function main(): Promise<void> {
  const organization = await prisma.organization.upsert({
    where: { slug: 'default-organization' },
    update: {},
    create: {
      name: process.env.ORGANIZATION_NAME ?? 'منصة متابعة الطلاب',
      slug: 'default-organization',
      timezone: process.env.APP_TIMEZONE ?? 'Africa/Cairo',
      locale: 'ar-EG',
      settingsJson: { defaultCountry: process.env.DEFAULT_COUNTRY ?? 'EG', lateAfterMinutes: 15, excusedAttendancePolicy: 'EXCLUDE' },
    },
  });

  for (const key of permissions) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: key },
    });
  }

  const superAdminRole = await prisma.role.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: 'SUPER_ADMIN' } },
    update: {},
    create: { organizationId: organization.id, name: 'SUPER_ADMIN', description: 'صلاحيات كاملة', isSystemRole: true },
  });

  const attendanceRole = await prisma.role.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: 'مشرف حضور' } },
    update: {},
    create: { organizationId: organization.id, name: 'مشرف حضور', description: 'إدارة الحضور داخل النطاق', isSystemRole: true },
  });

  const gradeRole = await prisma.role.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: 'مشرف درجات' } },
    update: {},
    create: { organizationId: organization.id, name: 'مشرف درجات', description: 'إدخال الدرجات داخل النطاق', isSystemRole: true },
  });

  const allPermissions = await prisma.permission.findMany();
  await prisma.rolePermission.createMany({
    data: allPermissions.map((permission) => ({ roleId: superAdminRole.id, permissionId: permission.id })),
    skipDuplicates: true,
  });

  const attendanceKeys = new Set(['students.view', 'attendance.view', 'attendance.scan', 'attendance.create_manual', 'lessons.create', 'centers.view', 'dashboard.view']);
  await prisma.rolePermission.createMany({
    data: allPermissions.filter((permission) => attendanceKeys.has(permission.key)).map((permission) => ({ roleId: attendanceRole.id, permissionId: permission.id })),
    skipDuplicates: true,
  });

  const gradeKeys = new Set(['students.view', 'exams.view', 'grades.enter', 'grades.edit_draft', 'centers.view', 'dashboard.view', 'whatsapp.open_message']);
  await prisma.rolePermission.createMany({
    data: allPermissions.filter((permission) => gradeKeys.has(permission.key)).map((permission) => ({ roleId: gradeRole.id, permissionId: permission.id })),
    skipDuplicates: true,
  });

  const email = process.env.SUPER_ADMIN_EMAIL ?? 'admin@example.com';
  const phoneE164 = process.env.SUPER_ADMIN_PHONE ?? '+201000000000';
  const fullName = unicodeEnvOrFallback(process.env.SUPER_ADMIN_NAME, 'مدير النظام');
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error('SUPER_ADMIN_PASSWORD must be set and contain at least 12 characters');
  }

  const admin = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: organization.id, email } },
    update: { fullName, phoneE164, status: 'ACTIVE' },
    create: {
      organizationId: organization.id,
      fullName,
      email,
      phoneE164,
      passwordHash: await argon2.hash(password),
      mustChangePassword: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: superAdminRole.id },
  });

  const currentYear = new Date().getFullYear();
  await prisma.academicYear.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: `${currentYear}/${currentYear + 1}` } },
    update: {},
    create: {
      organizationId: organization.id,
      name: `${currentYear}/${currentYear + 1}`,
      codeYear: String(currentYear),
      startDate: new Date(`${currentYear}-09-01T00:00:00.000Z`),
      endDate: new Date(`${currentYear + 1}-06-30T00:00:00.000Z`),
      status: 'ACTIVE',
      isDefault: true,
    },
  });

  const defaultTemplates = [
    { name: 'رسالة عامة للطالب', type: 'GENERAL', bodyTemplate: 'مرحبًا، نود التواصل معك بخصوص الطالب {{student_name}} (كود {{student_code}}) في {{center_name}}.' },
    { name: 'نتيجة امتحان', type: 'GRADE', bodyTemplate: 'السلام عليكم، نحيط حضرتكم علمًا بأن الطالب {{student_name}} حصل على {{score}} من {{max_score}} في {{exam_name}} بنسبة {{percentage}}%.' },
    { name: 'غياب', type: 'ABSENCE', bodyTemplate: 'السلام عليكم، نحيط حضرتكم علمًا بأن الطالب {{student_name}} لم يحضر حصة يوم {{lesson_date}} في {{center_name}}. برجاء المتابعة.' },
    { name: 'تأخر متكرر', type: 'LATE', bodyTemplate: 'السلام عليكم، نود إبلاغ حضرتكم بأن الطالب {{student_name}} تأخر في الحضور {{late_count}} مرات خلال الفترة الأخيرة.' },
  ];
  const templatesCount = await prisma.whatsAppTemplate.count({ where: { organizationId: organization.id } });
  if (templatesCount === 0) {
    await prisma.whatsAppTemplate.createMany({
      data: defaultTemplates.map((template) => ({ organizationId: organization.id, ...template })),
    });
  }
}

main()
  .finally(async () => prisma.$disconnect());
