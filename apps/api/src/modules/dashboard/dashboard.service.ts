import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { RequestUser } from '../../common/guards/auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { ScopeService } from '../rbac/scope.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService, private readonly scope: ScopeService) {}

  async overview(user: RequestUser) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const monthStart = new Date(now);
    monthStart.setDate(monthStart.getDate() - 30);

    const enrollmentScope: Prisma.EnrollmentWhereInput = user.isSuperAdmin
      ? { organizationId: user.organizationId }
      : {
          organizationId: user.organizationId,
          centerId: { in: user.centerScopeIds },
        };

    const lessonScope: Prisma.LessonWhereInput = {
      organizationId: user.organizationId,
      scopes: { some: { center: this.scope.centerWhere(user) } },
    };

    const [activeStudents, centers, todayLessons, attendanceRows, gradeAggregate, recentAudit] = await this.prisma.$transaction([
      this.prisma.student.count({
        where: {
          organizationId: user.organizationId,
          status: 'ACTIVE',
          archivedAt: null,
          profiles: { some: { enrollments: { some: { ...enrollmentScope, status: 'ACTIVE' } } } },
        },
      }),
      this.prisma.center.count({ where: { ...this.scope.centerWhere(user), status: 'ACTIVE', archivedAt: null } }),
      this.prisma.lesson.count({ where: { ...lessonScope, lessonDate: { gte: todayStart, lte: todayEnd } } }),
      this.prisma.attendanceRecord.findMany({
        where: {
          organizationId: user.organizationId,
          createdAt: { gte: monthStart },
          lesson: { scopes: { some: { center: this.scope.centerWhere(user) } } },
        },
        select: { status: true, createdAt: true },
      }),
      this.prisma.grade.aggregate({
        where: {
          organizationId: user.organizationId,
          status: 'GRADED',
          exam: {
            status: { in: ['PUBLISHED', 'LOCKED'] },
            assignments: { some: { center: this.scope.centerWhere(user) } },
          },
        },
        _avg: { percentage: true },
      }),
      this.prisma.auditLog.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          action: true,
          entityType: true,
          createdAt: true,
          actor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              roles: { select: { role: { select: { name: true } } } },
            },
          },
        },
      }),
    ]);

    const presentCount = attendanceRows.filter(({ status }) => ['PRESENT', 'LATE', 'PARTIAL'].includes(status)).length;
    const absentCount = attendanceRows.filter(({ status }) => status === 'ABSENT').length;
    const attendanceRate = presentCount + absentCount > 0 ? (presentCount / (presentCount + absentCount)) * 100 : 0;

    const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(todayStart);
      date.setDate(date.getDate() - (6 - index));
      return date;
    });
    const attendanceTrend = lastSevenDays.map((date) => {
      const key = date.toISOString().slice(0, 10);
      const rows = attendanceRows.filter(({ createdAt }) => createdAt.toISOString().slice(0, 10) === key);
      return {
        label: new Intl.DateTimeFormat('ar-EG', { weekday: 'short' }).format(date),
        present: rows.filter(({ status }) => ['PRESENT', 'LATE', 'PARTIAL'].includes(status)).length,
        absent: rows.filter(({ status }) => status === 'ABSENT').length,
      };
    });

    const absenceCounts = await this.prisma.weeklyAttendanceResult.groupBy({
      by: ['studentId'],
      where: {
        organizationId: user.organizationId,
        status: 'ABSENT',
        createdAt: { gte: monthStart },
        center: this.scope.centerWhere(user),
      },
      _count: { _all: true },
      orderBy: { _count: { studentId: 'desc' } },
      take: 5,
    });
    const lateCounts = await this.prisma.attendanceRecord.groupBy({
      by: ['studentId'],
      where: {
        organizationId: user.organizationId,
        status: 'LATE',
        createdAt: { gte: monthStart },
        lesson: { scopes: { some: { center: this.scope.centerWhere(user) } } },
      },
      _count: { _all: true },
      orderBy: { _count: { studentId: 'desc' } },
      take: 5,
    });
    const rankedStudents = await this.prisma.student.findMany({
      where: { id: { in: [...new Set([...absenceCounts, ...lateCounts].map(({ studentId }) => studentId))] } },
      select: { id: true, fullName: true },
    });
    const studentMap = new Map(rankedStudents.map((student) => [student.id, student]));
    const riskMap = new Map(absenceCounts.map((row) => [row.studentId, row._count._all]));
    const lateMap = new Map(lateCounts.map((row) => [row.studentId, row._count._all]));
    const mostAbsentStudents = absenceCounts.flatMap((row) => {
      const student = studentMap.get(row.studentId);
      return student ? [{ id: student.id, fullName: student.fullName, count: riskMap.get(student.id) ?? 0 }] : [];
    });
    const mostLateStudents = lateCounts.flatMap((row) => {
      const student = studentMap.get(row.studentId);
      return student ? [{ id: student.id, fullName: student.fullName, count: lateMap.get(student.id) ?? 0 }] : [];
    });

    return {
      activeStudents,
      centers,
      todayLessons,
      attendanceRate,
      gradeAverage: Number(gradeAggregate._avg.percentage ?? 0),
      attendanceTrend,
      mostAbsentStudents,
      mostLateStudents,
      atRiskStudents: mostAbsentStudents.map((student) => ({
        id: student.id,
        fullName: student.fullName,
        reason: 'غياب أسبوعي متكرر خلال آخر 30 يومًا',
        value: `${student.count} غياب`,
      })),
      recentActivity: recentAudit.map((item) => ({
        id: item.id,
        action: item.action,
        entityType: item.entityType,
        title: this.actionLabel(item.action),
        description: this.entityLabel(item.entityType),
        createdAt: item.createdAt.toISOString(),
        actor: item.actor
          ? {
              id: item.actor.id,
              fullName: item.actor.fullName,
              email: item.actor.email,
              isSuperAdmin: item.actor.roles.some(({ role }) => role.name === 'SUPER_ADMIN'),
            }
          : null,
      })),
    };
  }

  private actionLabel(action: string): string {
    const labels: Record<string, string> = {
      STUDENT_CREATED: 'إضافة طالب جديد',
      LESSON_CLOSED: 'إغلاق حصة واعتماد الحضور',
      EXAM_PUBLISHED: 'نشر درجات امتحان',
      EXPORT_CREATED: 'إنشاء ملف تصدير',
      IMPORT_COMMITTED: 'اعتماد ملف استيراد',
      USER_CREATED: 'إضافة مستخدم',
      STUDENT_ARCHIVED: 'أرشفة طالب',
      STUDENT_QR_ROTATED: 'تحديث رمز QR لطالب',
      STUDENT_TRANSFERRED: 'نقل طالب',
      LESSON_STARTED: 'بدء حصة جديدة',
      ROLE_PERMISSIONS_UPDATED: 'تحديث صلاحيات دور',
      USER_SCOPES_UPDATED: 'تحديث نطاقات مستخدم',
      WHATSAPP_TEMPLATE_CREATED: 'إنشاء قالب واتساب',
      WHATSAPP_TEMPLATE_UPDATED: 'تحديث قالب واتساب',
      WHATSAPP_TEMPLATE_DELETED: 'حذف قالب واتساب',
    };
    return labels[action] ?? action.replaceAll('_', ' ');
  }

  private entityLabel(entityType: string): string {
    const labels: Record<string, string> = {
      Student: 'طالب',
      Lesson: 'حصة',
      Exam: 'امتحان',
      ExportJob: 'ملف تصدير',
      ImportJob: 'ملف استيراد',
      User: 'مستخدم',
      Role: 'دور وصلاحيات',
      WhatsAppTemplate: 'قالب واتساب',
    };
    return labels[entityType] ?? entityType;
  }
}
