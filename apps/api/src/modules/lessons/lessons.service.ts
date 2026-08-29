import { HttpStatus, Injectable } from '@nestjs/common';
import { GradeStatus, LessonStatus, Prisma } from '@prisma/client';
import { DomainError } from '../../common/errors/domain-error';
import type { RequestUser } from '../../common/guards/auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { ScopeService } from '../rbac/scope.service';
import { CreateLessonDto } from './lessons.dto';

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService, private readonly scope: ScopeService) {}

  async active(user: RequestUser) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { ...this.lessonScope(user), status: LessonStatus.OPEN },
      orderBy: { startsAt: 'desc' },
    });
    return lesson ? this.details(user, lesson.id) : null;
  }

  async start(user: RequestUser) {
    const now = new Date();
    const [academicYear, centers, organization] = await Promise.all([
      this.prisma.academicYear.findFirst({
        where: { organizationId: user.organizationId, status: 'ACTIVE' },
        orderBy: [{ isDefault: 'desc' }, { startDate: 'desc' }],
      }),
      this.prisma.center.findMany({
        where: { ...this.scope.centerWhere(user), status: 'ACTIVE', archivedAt: null },
        select: { id: true },
      }),
      this.prisma.organization.findUnique({ where: { id: user.organizationId }, select: { settingsJson: true } }),
    ]);
    if (!academicYear) throw new DomainError('ACADEMIC_YEAR_CLOSED', 'لا توجد سنة دراسية نشطة.', HttpStatus.CONFLICT);
    if (centers.length === 0) throw new DomainError('RESOURCE_OUT_OF_SCOPE', 'لا توجد سناتر نشطة داخل نطاق صلاحياتك.', HttpStatus.CONFLICT);

    const settings = organization?.settingsJson && typeof organization.settingsJson === 'object'
      ? organization.settingsJson as Record<string, unknown>
      : {};
    const configuredLateMinutes = Number(settings.lateAfterMinutes ?? 15);
    const lateAfterMinutes = Number.isFinite(configuredLateMinutes) && configuredLateMinutes >= 0 ? configuredLateMinutes : 15;

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`active-lesson:${user.organizationId}`}))`;
      const existing = await tx.lesson.findFirst({
        where: {
          organizationId: user.organizationId,
          status: LessonStatus.OPEN,
          scopes: { some: { centerId: { in: centers.map(({ id }) => id) } } },
        },
        orderBy: { startsAt: 'desc' },
      });
      if (existing) throw new DomainError('LESSON_ALREADY_OPEN', 'توجد حصة جارية بالفعل.', HttpStatus.CONFLICT, { lessonId: existing.id });

      const title = `حصة ${new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short', timeZone: process.env.APP_TIMEZONE ?? 'Africa/Cairo' }).format(now)}`;
      const lesson = await tx.lesson.create({
        data: {
          organizationId: user.organizationId,
          academicYearId: academicYear.id,
          centerId: null,
          title,
          lessonDate: now,
          startsAt: now,
          endsAt: null,
          lateAfterMinutes,
          status: LessonStatus.OPEN,
          openedById: user.id,
          openedAt: now,
          scopes: { create: centers.map(({ id }) => ({ centerId: id })) },
          assessment: {
            create: {
              organizationId: user.organizationId,
              academicYearId: academicYear.id,
              name: `تقييم ${title}`,
              type: 'QUIZ',
              examDate: now,
              maxScore: 10,
              status: 'OPEN_FOR_GRADING',
              createdById: user.id,
              assignments: { create: centers.map(({ id }) => ({ centerId: id })) },
            },
          },
        },
      });
      await tx.auditLog.create({
        data: { organizationId: user.organizationId, actorUserId: user.id, action: 'LESSON_STARTED', entityType: 'Lesson', entityId: lesson.id },
      });
      return lesson;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async list(user: RequestUser, status?: string) {
    const parsedStatus = Object.values(LessonStatus).includes(status as LessonStatus) ? status as LessonStatus : undefined;
    const lessons = await this.prisma.lesson.findMany({
      where: { ...this.lessonScope(user), status: parsedStatus },
      include: {
        scopes: { include: { center: { select: { id: true, name: true } } } },
        assessment: { select: { id: true, maxScore: true, _count: { select: { grades: { where: { status: GradeStatus.GRADED } } } } } },
        attendance: { select: { status: true } },
      },
      orderBy: { startsAt: 'desc' },
      take: 200,
    });
    return lessons.map((lesson) => this.lessonListItem(lesson));
  }

  async today(user: RequestUser) {
    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    const lessons = await this.prisma.lesson.findMany({
      where: { ...this.lessonScope(user), startsAt: { gte: start, lte: end } },
      include: {
        scopes: { include: { center: { select: { id: true, name: true } } } },
        assessment: { select: { id: true, maxScore: true, _count: { select: { grades: { where: { status: GradeStatus.GRADED } } } } } },
        attendance: { select: { status: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
    return lessons.map((lesson) => this.lessonListItem(lesson));
  }

  async details(user: RequestUser, lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, ...this.lessonScope(user) },
      include: {
        scopes: { include: { center: { select: { id: true, name: true } } } },
        assessment: { include: { grades: true } },
        attendance: {
          include: {
            enrollment: { include: { center: true, profile: { include: { student: true } } } },
          },
          orderBy: { checkInAt: 'desc' },
        },
      },
    });
    if (!lesson) throw new DomainError('RESOURCE_NOT_FOUND', 'الحصة غير موجودة.', HttpStatus.NOT_FOUND);
    const gradeMap = new Map(lesson.assessment?.grades.map((grade) => [grade.enrollmentId, grade]) ?? []);
    const rows = lesson.attendance.map((attendance) => {
      const grade = gradeMap.get(attendance.enrollmentId);
      return {
        attendanceId: attendance.id,
        enrollmentId: attendance.enrollmentId,
        studentId: attendance.studentId,
        studentCode: attendance.enrollment.profile.studentCode,
        fullName: attendance.enrollment.profile.student.fullName,
        centerName: attendance.enrollment.center.name,
        gradeLevel: attendance.enrollment.profile.gradeLevel,
        checkInAt: attendance.checkInAt?.toISOString() ?? attendance.createdAt.toISOString(),
        attendanceStatus: attendance.status,
        score: grade?.score === null || grade?.score === undefined ? null : Number(grade.score),
        gradeUpdatedAt: grade?.updatedAt.toISOString() ?? null,
      };
    });
    return {
      id: lesson.id,
      title: lesson.title ?? 'حصة',
      status: lesson.status,
      startsAt: lesson.startsAt.toISOString(),
      endsAt: lesson.endsAt?.toISOString() ?? null,
      lateAfterMinutes: lesson.lateAfterMinutes,
      lateAt: new Date(lesson.startsAt.getTime() + lesson.lateAfterMinutes * 60_000).toISOString(),
      academicYearId: lesson.academicYearId,
      centers: lesson.scopes.map(({ center }) => center),
      assessment: lesson.assessment ? { id: lesson.assessment.id, maxScore: Number(lesson.assessment.maxScore) } : null,
      rows,
      summary: {
        registered: rows.length,
        present: rows.filter(({ attendanceStatus }) => attendanceStatus === 'PRESENT').length,
        late: rows.filter(({ attendanceStatus }) => attendanceStatus === 'LATE').length,
        gradesEntered: rows.filter(({ score }) => score !== null).length,
      },
    };
  }

  async saveGrade(user: RequestUser, lessonId: string, enrollmentId: string, score: number) {
    const [result] = await this.saveGradesBulk(user, lessonId, [{ enrollmentId, score }]);
    return result;
  }

  async saveGradesBulk(user: RequestUser, lessonId: string, items: Array<{ enrollmentId: string; score: number }>) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, ...this.lessonScope(user) },
      include: {
        assessment: true,
        attendance: { where: { enrollmentId: { in: items.map((item) => item.enrollmentId) } } },
      },
    });
    if (!lesson) throw new DomainError('RESOURCE_NOT_FOUND', 'الحصة غير موجودة.', HttpStatus.NOT_FOUND);
    if (!lesson.assessment) throw new DomainError('RESOURCE_NOT_FOUND', 'تقييم الحصة غير موجود.', HttpStatus.NOT_FOUND);
    const attendedEnrollmentIds = new Set(lesson.attendance.map((attendance) => attendance.enrollmentId));
    const maxScore = Number(lesson.assessment.maxScore);

    for (const item of items) {
      if (!attendedEnrollmentIds.has(item.enrollmentId)) {
        throw new DomainError('RESOURCE_OUT_OF_SCOPE', 'الطالب لم يسجل حضورًا في هذه الحصة.', HttpStatus.CONFLICT);
      }
      if (!Number.isFinite(item.score) || item.score < 0 || item.score > maxScore) {
        throw new DomainError('GRADE_OUT_OF_RANGE', `الدرجة يجب أن تكون بين 0 و${maxScore}.`, HttpStatus.UNPROCESSABLE_ENTITY);
      }
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: { id: { in: items.map((item) => item.enrollmentId) } },
      include: { profile: true },
    });
    const enrollmentMap = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment]));

    return this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of items) {
        const enrollment = enrollmentMap.get(item.enrollmentId);
        if (!enrollment) throw new DomainError('RESOURCE_NOT_FOUND', 'قيد الطالب غير موجود.', HttpStatus.NOT_FOUND);
        const percentage = new Prisma.Decimal((item.score / maxScore) * 100);
        const existing = await tx.grade.findUnique({ where: { examId_enrollmentId: { examId: lesson.assessment!.id, enrollmentId: item.enrollmentId } } });
        const grade = existing
          ? await tx.grade.update({
              where: { id: existing.id },
              data: { score: item.score, percentage, status: GradeStatus.GRADED, enteredById: user.id },
            })
          : await tx.grade.create({
              data: {
                organizationId: user.organizationId,
                examId: lesson.assessment!.id,
                enrollmentId: item.enrollmentId,
                studentId: enrollment.profile.studentId,
                score: item.score,
                percentage,
                status: GradeStatus.GRADED,
                enteredById: user.id,
              },
            });
        if (existing && (Number(existing.score) !== item.score || existing.status !== GradeStatus.GRADED)) {
          await tx.gradeChangeHistory.create({
            data: {
              gradeId: grade.id,
              oldScore: existing.score,
              newScore: item.score,
              oldStatus: existing.status,
              newStatus: GradeStatus.GRADED,
              reason: 'تعديل درجة الحصة',
              changedById: user.id,
            },
          });
        }
        results.push({ id: grade.id, enrollmentId: item.enrollmentId, score: Number(grade.score), updatedAt: grade.updatedAt.toISOString() });
      }
      return results;
    });
  }

  async updateAssessmentMaxScore(user: RequestUser, lessonId: string, maxScore: number) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, ...this.lessonScope(user) },
      include: { assessment: { include: { grades: true } } },
    });
    if (!lesson) throw new DomainError('RESOURCE_NOT_FOUND', 'الحصة غير موجودة.', HttpStatus.NOT_FOUND);
    if (!lesson.assessment) throw new DomainError('RESOURCE_NOT_FOUND', 'تقييم الحصة غير موجود.', HttpStatus.NOT_FOUND);
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      throw new DomainError('VALIDATION_FAILED', 'الدرجة النهائية يجب أن تكون أكبر من صفر.');
    }
    const highestExistingScore = Math.max(0, ...lesson.assessment.grades.map((grade) => Number(grade.score ?? 0)));
    if (highestExistingScore > maxScore) {
      throw new DomainError('VALIDATION_FAILED', `توجد درجات مُدخلة أعلى من ${maxScore}، عدّل الدرجات أولًا أو اختر درجة نهائية أكبر.`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.exam.update({ where: { id: lesson.assessment!.id }, data: { maxScore } });
      for (const grade of lesson.assessment!.grades) {
        if (grade.score === null) continue;
        await tx.grade.update({
          where: { id: grade.id },
          data: { percentage: new Prisma.Decimal((Number(grade.score) / maxScore) * 100) },
        });
      }
      return { id: lesson.assessment!.id, maxScore };
    });
  }

  async close(user: RequestUser, lessonId: string) {
    const lesson = await this.getScopedLesson(user, lessonId);
    if (lesson.status !== LessonStatus.OPEN) throw new DomainError('LESSON_NOT_OPEN', 'الحصة ليست مفتوحة.', HttpStatus.CONFLICT);
    const endsAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lesson.update({
        where: { id: lesson.id },
        data: { status: LessonStatus.CLOSED, closedById: user.id, closedAt: endsAt, endsAt },
      });
      const [registered, present, late, gradesEntered] = await Promise.all([
        tx.attendanceRecord.count({ where: { lessonId } }),
        tx.attendanceRecord.count({ where: { lessonId, status: 'PRESENT' } }),
        tx.attendanceRecord.count({ where: { lessonId, status: 'LATE' } }),
        tx.grade.count({ where: { exam: { lessonId }, status: GradeStatus.GRADED } }),
      ]);
      await tx.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: 'LESSON_CLOSED',
          entityType: 'Lesson',
          entityId: lesson.id,
          metadataJson: { registered, present, late, gradesEntered },
        },
      });
      return { ...updated, summary: { registered, present, late, gradesEntered } };
    });
  }

  // Backward-compatible draft creation for existing API consumers.
  async create(user: RequestUser, dto: CreateLessonDto) {
    const center = await this.prisma.center.findFirst({ where: { id: dto.centerId, ...this.scope.centerWhere(user), archivedAt: null } });
    if (!center) throw new DomainError('RESOURCE_NOT_FOUND', 'السنتر غير موجود.', HttpStatus.NOT_FOUND);
    const academicYear = await this.prisma.academicYear.findFirst({ where: { organizationId: user.organizationId, status: 'ACTIVE' }, orderBy: [{ isDefault: 'desc' }, { startDate: 'desc' }] });
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
        scopes: { create: { centerId: center.id } },
      },
    });
  }

  async open(user: RequestUser, lessonId: string) {
    const lesson = await this.getScopedLesson(user, lessonId);
    if (lesson.status !== LessonStatus.DRAFT) throw new DomainError('LESSON_NOT_DRAFT', 'يمكن فتح الحصة من حالة المسودة فقط.', HttpStatus.CONFLICT);
    return this.prisma.lesson.update({ where: { id: lesson.id }, data: { status: LessonStatus.OPEN, openedById: user.id, openedAt: new Date(), startsAt: new Date(), endsAt: null } });
  }

  private lessonScope(user: RequestUser): Prisma.LessonWhereInput {
    return {
      organizationId: user.organizationId,
      scopes: { some: { center: this.scope.centerWhere(user) } },
    };
  }

  private async getScopedLesson(user: RequestUser, lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({ where: { id: lessonId, ...this.lessonScope(user) } });
    if (!lesson) throw new DomainError('RESOURCE_NOT_FOUND', 'الحصة غير موجودة.', HttpStatus.NOT_FOUND);
    return lesson;
  }

  private lessonListItem(lesson: {
    id: string; title: string | null; status: LessonStatus; startsAt: Date; endsAt: Date | null; lateAfterMinutes: number;
    scopes: Array<{ center: { id: string; name: string } }>;
    attendance: Array<{ status: string }>;
    assessment: { id: string; maxScore: Prisma.Decimal; _count: { grades: number } } | null;
  }) {
    return {
      id: lesson.id,
      title: lesson.title ?? 'حصة',
      status: lesson.status,
      startsAt: lesson.startsAt.toISOString(),
      endsAt: lesson.endsAt?.toISOString() ?? null,
      lateAfterMinutes: lesson.lateAfterMinutes,
      centers: lesson.scopes.map(({ center }) => center),
      registeredCount: lesson.attendance.length,
      presentCount: lesson.attendance.filter(({ status }) => status === 'PRESENT').length,
      lateCount: lesson.attendance.filter(({ status }) => status === 'LATE').length,
      gradesEntered: lesson.assessment?._count.grades ?? 0,
      maxScore: lesson.assessment ? Number(lesson.assessment.maxScore) : null,
    };
  }
}
