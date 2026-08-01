import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainError } from '../../common/errors/domain-error';
import type { RequestUser } from '../../common/guards/auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { ScopeService } from '../rbac/scope.service';
import { CreateLessonDto } from './lessons.dto';

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService, private readonly scope: ScopeService) {}

  async today(user: RequestUser) {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const lessons = await this.prisma.lesson.findMany({
      where: {
        organizationId: user.organizationId,
        lessonDate: { gte: start, lte: end },
        center: this.scope.centerWhere(user),
      },
      include: {
        center: { include: { _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } } } },
        attendance: { where: { status: { in: ['PRESENT', 'LATE'] } }, select: { id: true } },
      },
      orderBy: { startsAt: 'asc' },
    });

    return lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title ?? 'حصة السنتر',
      lessonDate: lesson.lessonDate.toISOString(),
      startsAt: lesson.startsAt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      endsAt: lesson.endsAt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      centerName: lesson.center.name,
      status: lesson.status,
      presentCount: lesson.attendance.length,
      expectedCount: lesson.center._count.enrollments,
    }));
  }

  async create(user: RequestUser, dto: CreateLessonDto) {
    const center = await this.prisma.center.findFirst({
      where: { id: dto.centerId, ...this.scope.centerWhere(user), archivedAt: null },
    });
    if (!center) throw new DomainError('RESOURCE_NOT_FOUND', 'السنتر غير موجود.', HttpStatus.NOT_FOUND);
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { organizationId: user.organizationId, status: 'ACTIVE' },
      orderBy: [{ isDefault: 'desc' }, { startDate: 'desc' }],
    });
    if (!academicYear) throw new DomainError('ACADEMIC_YEAR_CLOSED', 'لا توجد سنة دراسية نشطة.', HttpStatus.CONFLICT);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) throw new DomainError('VALIDATION_FAILED', 'وقت النهاية يجب أن يكون بعد البداية.');

    return this.prisma.lesson.create({
      data: {
        organizationId: user.organizationId,
        academicYearId: academicYear.id,
        centerId: center.id,
        title: dto.title,
        lessonDate: startsAt,
        startsAt,
        endsAt,
        lateAfterMinutes: dto.lateAfterMinutes ?? 15,
      },
    });
  }

  async open(user: RequestUser, lessonId: string) {
    const lesson = await this.getScopedLesson(user, lessonId);
    if (lesson.status !== 'DRAFT') throw new DomainError('LESSON_NOT_DRAFT', 'يمكن فتح الحصة من حالة المسودة فقط.', HttpStatus.CONFLICT);
    return this.prisma.lesson.update({
      where: { id: lesson.id },
      data: { status: 'OPEN', openedById: user.id, openedAt: new Date() },
    });
  }

  async close(user: RequestUser, lessonId: string, markAbsent: boolean) {
    const lesson = await this.getScopedLesson(user, lessonId);
    if (lesson.status !== 'OPEN') throw new DomainError('LESSON_NOT_OPEN', 'الحصة ليست مفتوحة.', HttpStatus.CONFLICT);

    return this.prisma.$transaction(async (tx) => {
      if (markAbsent) {
        const enrollments = await tx.enrollment.findMany({
          where: { centerId: lesson.centerId, academicYearId: lesson.academicYearId, status: 'ACTIVE' },
          include: { profile: { select: { studentId: true } } },
        });
        const existing = await tx.attendanceRecord.findMany({
          where: { lessonId: lesson.id },
          select: { enrollmentId: true },
        });
        const existingIds = new Set(existing.map(({ enrollmentId }) => enrollmentId));
        await tx.attendanceRecord.createMany({
          data: enrollments
            .filter(({ id }) => !existingIds.has(id))
            .map((enrollment) => ({
              organizationId: user.organizationId,
              lessonId: lesson.id,
              enrollmentId: enrollment.id,
              studentId: enrollment.profile.studentId,
              status: 'ABSENT' as const,
              method: 'MANUAL' as const,
              recordedById: user.id,
            })),
          skipDuplicates: true,
        });
      }
      const updated = await tx.lesson.update({
        where: { id: lesson.id },
        data: { status: 'CLOSED', closedById: user.id, closedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: 'LESSON_CLOSED',
          entityType: 'Lesson',
          entityId: lesson.id,
          metadataJson: { markAbsent },
        },
      });
      return updated;
    });
  }

  private async getScopedLesson(user: RequestUser, lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, organizationId: user.organizationId, center: this.scope.centerWhere(user) },
    });
    if (!lesson) throw new DomainError('RESOURCE_NOT_FOUND', 'الحصة غير موجودة.', HttpStatus.NOT_FOUND);
    return lesson;
  }
}
