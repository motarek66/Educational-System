import { DomainError } from '../../common/errors/domain-error';
import { AttendanceService } from './attendance.service';

describe('AttendanceService weekly registration rule', () => {
  const user = {
    id: 'user-1',
    organizationId: 'org-1',
    fullName: 'المشرف',
    isSuperAdmin: true,
    permissions: [],
    centerScopeIds: [],
  };
  const profile = {
    id: 'profile-1',
    academicYearId: 'year-1',
    studentId: 'student-1',
    studentCode: 'ST-1',
    student: { id: 'student-1', fullName: 'أحمد محمد', photoUrl: null, status: 'ACTIVE' },
    enrollments: [{ id: 'enrollment-1', centerId: 'center-1', academicYearId: 'year-1' }],
  };
  const lesson = {
    id: 'lesson-2',
    academicYearId: 'year-1',
    title: 'حصة الأحد',
    startsAt: new Date('2026-08-30T14:00:00.000Z'),
    lateAfterMinutes: 15,
    organization: { timezone: 'Africa/Cairo' },
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-30T14:05:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  function setup(options: { sameLesson?: boolean; previousWeeklyLesson?: boolean } = {}) {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      attendanceRecord: {
        findUnique: jest.fn().mockResolvedValue(options.sameLesson ? {
          checkInAt: new Date('2026-08-30T14:01:00.000Z'),
          recordedBy: { fullName: 'المشرف' },
        } : null),
        findFirst: jest.fn().mockResolvedValue(options.previousWeeklyLesson ? {
          checkInAt: new Date('2026-08-29T14:01:00.000Z'),
          lesson: { id: 'lesson-1', title: 'حصة السبت' },
        } : null),
        create: jest.fn().mockResolvedValue({ id: 'attendance-1' }),
      },
    };
    const prisma = {
      studentAcademicProfile: { findFirst: jest.fn().mockResolvedValue(profile) },
      lesson: { findFirst: jest.fn().mockResolvedValue(lesson) },
      attendanceRecord: {
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn(),
      },
      enrollment: { count: jest.fn().mockResolvedValue(10) },
      $transaction: jest.fn().mockImplementation(async (input: unknown) => {
        if (typeof input === 'function') return (input as (client: typeof tx) => unknown)(tx);
        return Promise.all(input as Promise<unknown>[]);
      }),
    };
    const scope = { assertCenter: jest.fn() };
    return { service: new AttendanceService(prisma as never, scope as never), tx };
  }

  it('returns a clear message when the student is scanned twice in the same lesson', async () => {
    const { service, tx } = setup({ sameLesson: true });

    await expect(service.manual(user, 'ST-1')).rejects.toMatchObject<Partial<DomainError>>({
      code: 'ATTENDANCE_ALREADY_RECORDED',
      message: 'الطالب أحمد محمد مسجل بالفعل في هذه الحصة.',
    });
    expect(tx.attendanceRecord.create).not.toHaveBeenCalled();
  });

  it('rejects a second attendance in another lesson during the same teaching week', async () => {
    const { service, tx } = setup({ previousWeeklyLesson: true });

    await expect(service.manual(user, 'ST-1')).rejects.toMatchObject<Partial<DomainError>>({
      code: 'WEEKLY_ATTENDANCE_ALREADY_RECORDED',
      message: 'الطالب أحمد محمد سجل حصته الأسبوعية بالفعل في «حصة السبت»، ولا يمكن تسجيل أكثر من حصة في الأسبوع.',
    });
    expect(tx.attendanceRecord.create).not.toHaveBeenCalled();
  });

  it('allows the first attendance in the week', async () => {
    const { service, tx } = setup();

    await expect(service.manual(user, 'ST-1')).resolves.toMatchObject({
      attendanceId: 'attendance-1',
      status: 'PRESENT',
    });
    expect(tx.attendanceRecord.create).toHaveBeenCalledTimes(1);
  });
});
