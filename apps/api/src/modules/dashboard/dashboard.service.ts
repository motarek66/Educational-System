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
      center: this.scope.centerWhere(user),
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
          lesson: { center: this.scope.centerWhere(user) },
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
        select: { id: true, action: true, entityType: true, createdAt: true, actor: { select: { fullName: true } } },
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

    const absenceCounts = await this.prisma.attendanceRecord.groupBy({
      by: ['studentId'],
      where: {
        organizationId: user.organizationId,
        status: 'ABSENT',
        createdAt: { gte: monthStart },
        lesson: { center: this.scope.centerWhere(user) },
      },
      _count: { _all: true },
      orderBy: { _count: { studentId: 'desc' } },
      take: 5,
    });
    const riskStudents = await this.prisma.student.findMany({
      where: { id: { in: absenceCounts.map(({ studentId }) => studentId) } },
      select: { id: true, fullName: true },
    });
    const riskMap = new Map(absenceCounts.map((row) => [row.studentId, row._count._all]));

    return {
      activeStudents,
      centers,
      todayLessons,
      attendanceRate,
      gradeAverage: Number(gradeAggregate._avg.percentage ?? 0),
      attendanceTrend,
      atRiskStudents: riskStudents.map((student) => ({
        id: student.id,
        fullName: student.fullName,
        reason: 'غياب متكرر خلال آخر 30 يومًا',
        value: `${riskMap.get(student.id) ?? 0} غياب`,
      })),
      recentActivity: recentAudit.map((item) => ({
        id: item.id,
        title: this.actionLabel(item.action),
        description: `${item.actor?.fullName ?? 'النظام'} · ${item.entityType}`,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  private actionLabel(action: string): string {
    const labels: Record<string, string> = {
      STUDENT_CREATED: 'إضافة طالب جديد',
      LESSON_CLOSED: 'إغلاق حصة واعتماد الحضور',
      EXAM_PUBLISHED: 'نشر درجات امتحان',
      EXPORT_CREATED: 'إنشاء ملف تصدير',
      USER_CREATED: 'إضافة مستخدم',
    };
    return labels[action] ?? action.replaceAll('_', ' ');
  }
}
