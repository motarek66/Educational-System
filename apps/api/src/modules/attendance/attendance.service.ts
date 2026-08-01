import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { DomainError } from '../../common/errors/domain-error';
import type { RequestUser } from '../../common/guards/auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { ScopeService } from '../rbac/scope.service';

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
    const slot = this.attendanceSlot(now);
    const lesson = await this.getOrCreateWeeklyLesson(user, enrollment.centerId, profile.academicYearId, now, slot);
    const lateAt = new Date(lesson.startsAt.getTime() + lesson.lateAfterMinutes * 60_000);
    const status = now > lateAt ? 'LATE' : 'PRESENT';

    try {
      const record = await this.prisma.attendanceRecord.create({
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
      const [present, late, expected] = await this.prisma.$transaction([
        this.prisma.attendanceRecord.count({ where: { lessonId: lesson.id, status: 'PRESENT' } }),
        this.prisma.attendanceRecord.count({ where: { lessonId: lesson.id, status: 'LATE' } }),
        this.prisma.enrollment.count({ where: { centerId: lesson.centerId, academicYearId: lesson.academicYearId, status: 'ACTIVE' } }),
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
          title: lesson.title ?? `حصة الأسبوع ${slot.week}`,
          month: slot.month,
          year: slot.year,
          week: slot.week,
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
          'تم تسجيل حضور الطالب مسبقًا في حصة هذا الأسبوع.',
          HttpStatus.CONFLICT,
          { recordedAt: existing?.checkInAt, recordedBy: existing?.recordedBy.fullName },
        );
      }
      throw error;
    }
  }

  private async getOrCreateWeeklyLesson(
    user: RequestUser,
    centerId: string,
    academicYearId: string,
    now: Date,
    slot: { key: string; year: number; month: number; day: number; week: number },
  ) {
    const where = { organizationId: user.organizationId, academicYearId, centerId, weeklySlotKey: slot.key };
    const existing = await this.prisma.lesson.findFirst({ where });
    if (existing) return existing;

    const monthName = new Intl.DateTimeFormat('ar-EG', { month: 'long', timeZone: process.env.APP_TIMEZONE ?? 'Africa/Cairo' }).format(now);
    try {
      return await this.prisma.lesson.create({
        data: {
          organizationId: user.organizationId,
          academicYearId,
          centerId,
          weeklySlotKey: slot.key,
          title: `حصة الأسبوع ${slot.week} - ${monthName}`,
          lessonDate: new Date(Date.UTC(slot.year, slot.month - 1, slot.day)),
          startsAt: now,
          endsAt: new Date(now.getTime() + 2 * 60 * 60_000),
          lateAfterMinutes: 15,
          status: 'OPEN',
          openedById: user.id,
          openedAt: now,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const concurrent = await this.prisma.lesson.findFirst({ where });
        if (concurrent) return concurrent;
      }
      throw error;
    }
  }

  private attendanceSlot(now: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: process.env.APP_TIMEZONE ?? 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    const year = read('year');
    const month = read('month');
    const day = read('day');
    const week = Math.min(4, Math.ceil(day / 7));
    return { key: `${year}-${String(month).padStart(2, '0')}-W${week}`, year, month, day, week };
  }
}
