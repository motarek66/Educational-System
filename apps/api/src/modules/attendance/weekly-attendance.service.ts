import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

type LocalDate = { year: number; month: number; day: number };

const readLocalDate = (value: Date, timeZone: string): LocalDate => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read('year'), month: read('month'), day: read('day') };
};

const addCalendarDays = (date: LocalDate, days: number): LocalDate => {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + days, 12));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
};

const dateOnly = (date: LocalDate): Date => new Date(Date.UTC(date.year, date.month - 1, date.day));

const zonedMidnight = (date: LocalDate, timeZone: string): Date => {
  const guess = Date.UTC(date.year, date.month - 1, date.day);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(guess));
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const representedAsUtc = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'), read('second'));
  return new Date(guess - (representedAsUtc - guess));
};

export function previousTeachingWeek(now: Date, timeZone: string) {
  const current = teachingWeekContaining(now, timeZone);
  const currentStart = readLocalDate(current.weekStart, 'UTC');
  const previousStart = addCalendarDays(currentStart, -7);
  const previousEnd = addCalendarDays(currentStart, -1);
  return {
    weekStart: dateOnly(previousStart),
    weekEnd: dateOnly(previousEnd),
    startsAt: zonedMidnight(previousStart, timeZone),
    endsBefore: zonedMidnight(currentStart, timeZone),
  };
}

export function teachingWeekContaining(now: Date, timeZone: string) {
  const localToday = readLocalDate(now, timeZone);
  const localNoon = new Date(Date.UTC(localToday.year, localToday.month - 1, localToday.day, 12));
  const daysSinceSaturday = (localNoon.getUTCDay() + 1) % 7;
  const currentWeekStart = addCalendarDays(localToday, -daysSinceSaturday);
  const currentWeekEnd = addCalendarDays(currentWeekStart, 6);
  return {
    weekStart: dateOnly(currentWeekStart),
    weekEnd: dateOnly(currentWeekEnd),
    startsAt: zonedMidnight(currentWeekStart, timeZone),
    endsBefore: zonedMidnight(addCalendarDays(currentWeekStart, 7), timeZone),
  };
}

@Injectable()
export class WeeklyAttendanceService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private initialTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.initialTimer = setTimeout(() => void this.finalizePreviousWeek().catch((error) => console.error('Weekly attendance finalization failed', error)), 10_000);
    this.timer = setInterval(() => void this.finalizePreviousWeek().catch((error) => console.error('Weekly attendance finalization failed', error)), 60 * 60 * 1000);
  }

  onModuleDestroy(): void {
    if (this.initialTimer) clearTimeout(this.initialTimer);
    if (this.timer) clearInterval(this.timer);
  }

  async finalizePreviousWeek(now = new Date()): Promise<{ created: number }> {
    const organizations = await this.prisma.organization.findMany({ select: { id: true, timezone: true } });
    let created = 0;
    for (const organization of organizations) {
      const range = previousTeachingWeek(now, organization.timezone || 'Africa/Cairo');
      const [lessons, enrollments] = await Promise.all([
        this.prisma.lesson.findMany({
          where: {
            organizationId: organization.id,
            startsAt: { gte: range.startsAt, lt: range.endsBefore },
            status: { in: ['OPEN', 'CLOSED'] },
          },
          select: { id: true, academicYearId: true, scopes: { select: { centerId: true } } },
        }),
        this.prisma.enrollment.findMany({
          where: {
            organizationId: organization.id,
            status: 'ACTIVE',
            profile: { student: { status: 'ACTIVE', archivedAt: null }, academicYear: { status: 'ACTIVE' } },
          },
          include: { profile: { select: { studentId: true } } },
        }),
      ]);
      if (lessons.length === 0 || enrollments.length === 0) continue;

      const lessonIds = lessons.map(({ id }) => id);
      const attendance = await this.prisma.attendanceRecord.findMany({
        where: { lessonId: { in: lessonIds }, status: { in: ['PRESENT', 'LATE', 'PARTIAL'] } },
        select: { lessonId: true, studentId: true },
      });
      const attended = new Set(attendance.map((row) => `${row.lessonId}:${row.studentId}`));
      const absences = enrollments.flatMap((enrollment) => {
        const eligibleLessons = lessons.filter((lesson) =>
          lesson.academicYearId === enrollment.academicYearId
          && lesson.scopes.some(({ centerId }) => centerId === enrollment.centerId));
        if (eligibleLessons.length === 0) return [];
        if (eligibleLessons.some((lesson) => attended.has(`${lesson.id}:${enrollment.profile.studentId}`))) return [];
        return [{
          organizationId: organization.id,
          academicYearId: enrollment.academicYearId,
          enrollmentId: enrollment.id,
          studentId: enrollment.profile.studentId,
          centerId: enrollment.centerId,
          weekStart: range.weekStart,
          weekEnd: range.weekEnd,
          status: 'ABSENT',
        }];
      });
      if (absences.length > 0) {
        const result = await this.prisma.weeklyAttendanceResult.createMany({ data: absences, skipDuplicates: true });
        created += result.count;
      }
    }
    return { created };
  }
}
