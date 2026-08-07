import { previousTeachingWeek, WeeklyAttendanceService } from './weekly-attendance.service';

describe('previousTeachingWeek', () => {
  it('returns the previous Saturday through Friday in Cairo', () => {
    const range = previousTeachingWeek(new Date('2026-08-12T12:00:00.000Z'), 'Africa/Cairo');
    expect(range.weekStart.toISOString().slice(0, 10)).toBe('2026-08-01');
    expect(range.weekEnd.toISOString().slice(0, 10)).toBe('2026-08-07');
    expect(range.startsAt.toISOString()).toBe('2026-07-31T21:00:00.000Z');
    expect(range.endsBefore.toISOString()).toBe('2026-08-07T21:00:00.000Z');
  });
});

describe('WeeklyAttendanceService', () => {
  const now = new Date('2026-08-12T12:00:00.000Z');
  const base = {
    organization: { findMany: jest.fn().mockResolvedValue([{ id: 'org-1', timezone: 'Africa/Cairo' }]) },
    lesson: { findMany: jest.fn().mockResolvedValue([{ id: 'lesson-1', academicYearId: 'year-1', scopes: [{ centerId: 'center-1' }] }]) },
    enrollment: { findMany: jest.fn().mockResolvedValue([{ id: 'enrollment-1', organizationId: 'org-1', academicYearId: 'year-1', centerId: 'center-1', profile: { studentId: 'student-1' } }]) },
    attendanceRecord: { findMany: jest.fn() },
    weeklyAttendanceResult: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };

  it('does not mark a student absent when they attended any eligible lesson in the week', async () => {
    const prisma = { ...base, attendanceRecord: { findMany: jest.fn().mockResolvedValue([{ lessonId: 'lesson-1', studentId: 'student-1' }]) } };
    const service = new WeeklyAttendanceService(prisma as never);
    await expect(service.finalizePreviousWeek(now)).resolves.toEqual({ created: 0 });
    expect(prisma.weeklyAttendanceResult.createMany).not.toHaveBeenCalled();
  });

  it('creates one weekly absence when the student missed every eligible lesson', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { ...base, attendanceRecord: { findMany: jest.fn().mockResolvedValue([]) }, weeklyAttendanceResult: { createMany } };
    const service = new WeeklyAttendanceService(prisma as never);
    await expect(service.finalizePreviousWeek(now)).resolves.toEqual({ created: 1 });
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [expect.objectContaining({ studentId: 'student-1', status: 'ABSENT' })],
    }));
  });
});
