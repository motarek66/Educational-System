import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { DomainError } from '../../common/errors/domain-error';
import type { RequestUser } from '../../common/guards/auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { ScopeService } from '../rbac/scope.service';
import { teachingWeekContaining } from './weekly-attendance.service';

type AttendanceProfile = {
  id: string;
  academicYearId: string;
  studentId: string;
  studentCode: string;
  student: { id: string; fullName: string; photoUrl: string | null; status: string };
  enrollments: Array<{ id: string; centerId: string; academicYearId: string }>;
};

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService, private readonly scope: ScopeService) {}

  async scan(user: RequestUser, qrToken: string) {
    const tokenHash = createHash('sha256').update(qrToken).digest('hex');
    const profile = await this.prisma.studentAcademicProfile.findFirst({
      where: { organizationId: user.organizationId, qrTokenHash: tokenHash },
      include: { student: true, enrollments: { where: { status: 'ACTIVE' }, orderBy: { isPrimary: 'desc' } } },
    });
    if (!profile) throw new DomainError('QR_INVALID', 'الكود غير صالح أو تم استبداله.', HttpStatus.NOT_FOUND);
    return this.record(user, profile, 'QR');
  }

  async manual(user: RequestUser, studentCode: string) {
    const profile = await this.prisma.studentAcademicProfile.findFirst({
      where: { organizationId: user.organizationId, studentCode: { equals: studentCode.trim(), mode: 'insensitive' } },
      include: { student: true, enrollments: { where: { status: 'ACTIVE' }, orderBy: { isPrimary: 'desc' } } },
    });
    if (!profile) throw new DomainError('RESOURCE_NOT_FOUND', 'لم يتم العثور على الطالب.', HttpStatus.NOT_FOUND);
    return this.record(user, profile, 'CODE');
  }

  private async record(user: RequestUser, profile: AttendanceProfile, method: 'QR' | 'CODE') {
    if (profile.student.status !== 'ACTIVE') {
      throw new DomainError('STUDENT_INACTIVE', 'الطالب غير نشط ولا يمكن تسجيل حضوره.', HttpStatus.CONFLICT);
    }
    const enrollment = profile.enrollments.find(({ academicYearId }) => academicYearId === profile.academicYearId);
    if (!enrollment) {
      throw new DomainError('STUDENT_NOT_ENROLLED', 'الطالب غير مسجل في سنتر نشط لهذه السنة.', HttpStatus.CONFLICT);
    }
    this.scope.assertCenter(user, enrollment.centerId);

    const now = new Date();
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        organizationId: user.organizationId,
        academicYearId: profile.academicYearId,
        status: 'OPEN',
        scopes: { some: { centerId: enrollment.centerId } },
      },
      orderBy: { startsAt: 'desc' },
      include: { organization: { select: { timezone: true } } },
    });
    if (!lesson) {
      throw new DomainError('LESSON_NOT_OPEN', 'لا توجد حصة جارية متاحة لهذا الطالب. ابدأ الحصة أولًا.', HttpStatus.CONFLICT);
    }
    const lateAt = new Date(lesson.startsAt.getTime() + lesson.lateAfterMinutes * 60_000);
    const status = now > lateAt ? 'LATE' : 'PRESENT';
    const timeZone = lesson.organization.timezone || process.env.APP_TIMEZONE || 'Africa/Cairo';
    const week = teachingWeekContaining(now, timeZone);
    const weekKey = week.weekStart.toISOString().slice(0, 10);

    try {
      const record = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendance-week:${user.organizationId}:${profile.studentId}:${weekKey}`}))`;

        const existingInLesson = await tx.attendanceRecord.findUnique({
          where: { lessonId_enrollmentId: { lessonId: lesson.id, enrollmentId: enrollment.id } },
          include: { recordedBy: { select: { fullName: true } } },
        });
        if (existingInLesson) {
          throw new DomainError(
            'ATTENDANCE_ALREADY_RECORDED',
            `الطالب ${profile.student.fullName} مسجل بالفعل في هذه الحصة.`,
            HttpStatus.CONFLICT,
            { recordedAt: existingInLesson.checkInAt, recordedBy: existingInLesson.recordedBy.fullName },
          );
        }

        const existingThisWeek = await tx.attendanceRecord.findFirst({
          where: {
            organizationId: user.organizationId,
            studentId: profile.studentId,
            checkInAt: { gte: week.startsAt, lt: week.endsBefore },
          },
          include: { lesson: { select: { id: true, title: true } } },
          orderBy: { checkInAt: 'desc' },
        });
        if (existingThisWeek) {
          throw new DomainError(
            'WEEKLY_ATTENDANCE_ALREADY_RECORDED',
            `الطالب ${profile.student.fullName} سجل حصته الأسبوعية بالفعل${existingThisWeek.lesson.title ? ` في «${existingThisWeek.lesson.title}»` : ''}، ولا يمكن تسجيل أكثر من حصة في الأسبوع.`,
            HttpStatus.CONFLICT,
            { lessonId: existingThisWeek.lesson.id, recordedAt: existingThisWeek.checkInAt },
          );
        }

        return tx.attendanceRecord.create({
          data: {
            organizationId: user.organizationId,
            lessonId: lesson.id,
            enrollmentId: enrollment.id,
            studentId: profile.studentId,
            status,
            checkInAt: now,
            method,
            recordedById: user.id,
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      const [present, late, expected] = await this.prisma.$transaction([
        this.prisma.attendanceRecord.count({ where: { lessonId: lesson.id, status: 'PRESENT' } }),
        this.prisma.attendanceRecord.count({ where: { lessonId: lesson.id, status: 'LATE' } }),
        this.prisma.enrollment.count({
          where: {
            center: { lessonScopes: { some: { lessonId: lesson.id } } },
            academicYearId: lesson.academicYearId,
            status: 'ACTIVE',
          },
        }),
      ]);
      return {
        attendanceId: record.id,
        status,
        recordedAt: now.toISOString(),
        student: {
          id: profile.student.id,
          fullName: profile.student.fullName,
          studentCode: profile.studentCode,
          photoUrl: profile.student.photoUrl,
        },
        lesson: {
          id: lesson.id,
          title: lesson.title ?? 'الحصة الجارية',
          startsAt: lesson.startsAt.toISOString(),
        },
        lessonStats: { present, late, expected },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.attendanceRecord.findUnique({
          where: { lessonId_enrollmentId: { lessonId: lesson.id, enrollmentId: enrollment.id } },
          include: { recordedBy: { select: { fullName: true } } },
        });
        throw new DomainError(
          'ATTENDANCE_ALREADY_RECORDED',
          `الطالب ${profile.student.fullName} مسجل بالفعل في هذه الحصة.`,
          HttpStatus.CONFLICT,
          { recordedAt: existing?.checkInAt, recordedBy: existing?.recordedBy.fullName },
        );
      }
      throw error;
    }
  }

}
