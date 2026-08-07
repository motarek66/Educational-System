import { HttpStatus, Injectable } from '@nestjs/common';
import { AttendanceStatus, GradeStatus, Prisma, StudentStatus } from '@prisma/client';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { DomainError } from '../../common/errors/domain-error';
import type { RequestUser } from '../../common/guards/auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { ScopeService } from '../rbac/scope.service';
import { CreateStudentDto, UpdateStudentDto } from './students.dto';
import { normalizeArabicName, normalizeEgyptPhone } from './student-utils';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService, private readonly scope: ScopeService) {}

  async list(user: RequestUser, query: { search?: string; status?: string; academicYearId?: string; sort?: 'newest' | 'oldest' | 'nameAsc' | 'nameDesc'; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const search = query.search?.trim();
    const status = Object.values(StudentStatus).includes(query.status as StudentStatus)
      ? (query.status as StudentStatus)
      : undefined;

    const scopeFilter: Prisma.EnrollmentWhereInput = user.isSuperAdmin
      ? { organizationId: user.organizationId }
      : {
          organizationId: user.organizationId,
          centerId: { in: user.centerScopeIds },
        };

    const where: Prisma.StudentWhereInput = {
      organizationId: user.organizationId,
      archivedAt: null,
      status,
      profiles: {
        some: {
          academicYearId: query.academicYearId,
          enrollments: { some: { ...scopeFilter, status: 'ACTIVE' } },
        },
      },
      ...(search
        ? {
            OR: [
              { normalizedName: { contains: normalizeArabicName(search) } },
              { studentPhoneE164: { contains: search } },
              { profiles: { some: { studentCode: { contains: search, mode: 'insensitive' } } } },
              { guardians: { some: { guardian: { phoneE164: { contains: search } } } } },
            ],
          }
        : {}),
    };

    const [total, students] = await this.prisma.$transaction([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: query.sort === 'oldest'
          ? { createdAt: 'asc' }
          : query.sort === 'nameAsc'
            ? { fullName: 'asc' }
            : query.sort === 'nameDesc'
              ? { fullName: 'desc' }
              : { createdAt: 'desc' },
        include: {
          profiles: {
            where: query.academicYearId ? { academicYearId: query.academicYearId } : undefined,
            include: {
              enrollments: {
                where: { status: 'ACTIVE' },
                include: { center: true },
                orderBy: { isPrimary: 'desc' },
                take: 1,
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          guardians: { where: { isPrimary: true }, include: { guardian: true }, take: 1 },
        },
      }),
    ]);

    return {
      data: students.map((student) => {
        const profile = student.profiles[0];
        const enrollment = profile?.enrollments[0];
        const guardian = student.guardians[0]?.guardian;
        return {
          id: student.id,
          fullName: student.fullName,
          studentCode: profile?.studentCode ?? '—',
          gradeLevel: profile?.gradeLevel ?? '—',
          centerName: enrollment?.center.name ?? 'غير مسجل',
          guardianPhone: guardian?.phoneE164 ?? null,
          status: student.status,
          academicYearId: profile?.academicYearId ?? null,
        };
      }),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(user: RequestUser, dto: CreateStudentDto) {
    this.scope.assertCenter(user, dto.centerId);
    const profileId = randomUUID();
    const qrToken = this.buildQrToken(profileId, 1);
    const qrTokenHash = createHash('sha256').update(qrToken).digest('hex');

    return this.prisma.$transaction(async (tx) => {
      const [center, academicYear] = await Promise.all([
        tx.center.findFirst({
          where: { id: dto.centerId, organizationId: user.organizationId, archivedAt: null },
        }),
        tx.academicYear.findFirst({
          where: {
            organizationId: user.organizationId,
            ...(dto.academicYearId ? { id: dto.academicYearId } : { status: 'ACTIVE' }),
          },
          orderBy: [{ isDefault: 'desc' }, { startDate: 'desc' }],
        }),
      ]);
      if (!center) {
        throw new DomainError('RESOURCE_NOT_FOUND', 'السنتر غير صالح.', HttpStatus.NOT_FOUND);
      }
      if (!academicYear) {
        throw new DomainError('ACADEMIC_YEAR_CLOSED', 'لا يمكن إضافة طالب إلى سنة مغلقة.', HttpStatus.CONFLICT);
      }

      const sequence = await tx.codeSequence.upsert({
        where: {
          organizationId_academicYearId_entityType: {
            organizationId: user.organizationId,
            academicYearId: academicYear.id,
            entityType: 'STUDENT',
          },
        },
        create: {
          organizationId: user.organizationId,
          academicYearId: academicYear.id,
          entityType: 'STUDENT',
          lastValue: 1,
        },
        update: { lastValue: { increment: 1 } },
      });
      const studentCode = `ST-${academicYear.codeYear}-${String(sequence.lastValue).padStart(4, '0')}`;

      const student = await tx.student.create({
        data: {
          organizationId: user.organizationId,
          fullName: dto.fullName.trim(),
          normalizedName: normalizeArabicName(dto.fullName),
          studentPhoneE164: dto.studentPhone ? normalizeEgyptPhone(dto.studentPhone) : null,
          schoolName: dto.schoolName,
          address: dto.address,
          status: dto.status ?? StudentStatus.ACTIVE,
          createdById: user.id,
        },
      });

      const normalizedGuardianPhone = normalizeEgyptPhone(dto.guardianPhone);
      const guardian =
        (await tx.guardian.findFirst({
          where: { organizationId: user.organizationId, phoneE164: normalizedGuardianPhone },
        })) ??
        (await tx.guardian.create({
          data: {
            organizationId: user.organizationId,
            fullName: dto.guardianName.trim(),
            phoneE164: normalizedGuardianPhone,
            whatsappPhoneE164: normalizedGuardianPhone,
          },
        }));

      await tx.studentGuardian.create({
        data: {
          studentId: student.id,
          guardianId: guardian.id,
          relationship: 'OTHER',
          isPrimary: true,
        },
      });

      const profile = await tx.studentAcademicProfile.create({
        data: {
          id: profileId,
          organizationId: user.organizationId,
          studentId: student.id,
          academicYearId: academicYear.id,
          studentCode,
          qrTokenHash,
          gradeLevel: dto.gradeLevel,
        },
      });

      const enrollment = await tx.enrollment.create({
        data: {
          organizationId: user.organizationId,
          academicYearId: academicYear.id,
          studentAcademicProfileId: profile.id,
          centerId: center.id,
          startDate: new Date(),
          createdById: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: 'STUDENT_CREATED',
          entityType: 'Student',
          entityId: student.id,
          afterJson: { studentCode, centerId: center.id },
        },
      });

      return {
        id: student.id,
        fullName: student.fullName,
        studentCode,
        enrollmentId: enrollment.id,
        qrValue: `STQR:${qrToken}`,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async update(user: RequestUser, studentId: string, dto: UpdateStudentDto) {
    const profile = await this.getScopedProfile(user, studentId);
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentAcademicProfileId: profile.id, status: 'ACTIVE' },
      orderBy: { isPrimary: 'desc' },
    });
    if (!enrollment) throw new DomainError('RESOURCE_NOT_FOUND', 'قيد الطالب غير موجود.', HttpStatus.NOT_FOUND);

    if (dto.centerId) {
      this.scope.assertCenter(user, dto.centerId);
      const centerExists = await this.prisma.center.count({
        where: { id: dto.centerId, organizationId: user.organizationId, archivedAt: null },
      });
      if (!centerExists) throw new DomainError('RESOURCE_NOT_FOUND', 'السنتر غير صالح.', HttpStatus.NOT_FOUND);
    }

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.student.findUnique({ where: { id: studentId } });
      const student = await tx.student.update({
        where: { id: studentId },
        data: {
          ...(dto.fullName !== undefined ? {
            fullName: dto.fullName.trim(),
            normalizedName: normalizeArabicName(dto.fullName),
          } : {}),
          ...(dto.studentPhone !== undefined ? {
            studentPhoneE164: dto.studentPhone.trim() ? normalizeEgyptPhone(dto.studentPhone) : null,
          } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });

      if (dto.gradeLevel !== undefined) {
        await tx.studentAcademicProfile.update({ where: { id: profile.id }, data: { gradeLevel: dto.gradeLevel } });
      }
      if (dto.centerId !== undefined && dto.centerId !== enrollment.centerId) {
        await tx.enrollment.update({
          where: { id: enrollment.id },
          data: { status: 'TRANSFERRED', endDate: new Date(), transferReason: 'تعديل بيانات الطالب' },
        });
        await tx.enrollment.create({
          data: {
            organizationId: user.organizationId,
            academicYearId: profile.academicYearId,
            studentAcademicProfileId: profile.id,
            centerId: dto.centerId,
            startDate: new Date(),
            isPrimary: true,
            createdById: user.id,
          },
        });
      }

      const primaryGuardian = await tx.studentGuardian.findFirst({
        where: { studentId, isPrimary: true },
        include: { guardian: true },
      });
      if (primaryGuardian && (dto.guardianName !== undefined || dto.guardianPhone !== undefined)) {
        await tx.guardian.update({
          where: { id: primaryGuardian.guardianId },
          data: {
            ...(dto.guardianName !== undefined ? { fullName: dto.guardianName.trim() } : {}),
            ...(dto.guardianPhone !== undefined ? {
              phoneE164: normalizeEgyptPhone(dto.guardianPhone),
              whatsappPhoneE164: normalizeEgyptPhone(dto.guardianPhone),
            } : {}),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: 'STUDENT_UPDATED',
          entityType: 'Student',
          entityId: studentId,
          beforeJson: before ?? undefined,
          afterJson: {
            fullName: student.fullName,
            status: student.status,
            gradeLevel: dto.gradeLevel ?? profile.gradeLevel,
            centerId: dto.centerId ?? enrollment.centerId,
          },
        },
      });
      return { id: student.id, fullName: student.fullName, status: student.status };
    });
  }

  async profile(user: RequestUser, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        organizationId: user.organizationId,
        archivedAt: null,
        profiles: {
          some: {
            enrollments: {
              some: user.isSuperAdmin
                ? { organizationId: user.organizationId }
                : {
                    organizationId: user.organizationId,
                    centerId: { in: user.centerScopeIds },
                  },
            },
          },
        },
      },
      include: {
        profiles: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            academicYear: true,
            enrollments: {
              where: { status: 'ACTIVE' },
              orderBy: { isPrimary: 'desc' },
              take: 1,
              include: { center: true },
            },
          },
        },
        guardians: { include: { guardian: true } },
      },
    });
    if (!student) throw new DomainError('RESOURCE_NOT_FOUND', 'الطالب غير موجود.', HttpStatus.NOT_FOUND);
    const profile = student.profiles[0];
    const enrollment = profile?.enrollments[0];

    const [attendanceCounts, gradeAggregate, publishedExamCount] = await this.prisma.$transaction([
      this.prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: { organizationId: user.organizationId, studentId },
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.grade.aggregate({
        where: {
          organizationId: user.organizationId,
          studentId,
          status: GradeStatus.GRADED,
          exam: { status: { in: ['PUBLISHED', 'LOCKED'] } },
        },
        _avg: { percentage: true },
      }),
      this.prisma.grade.count({
        where: {
          organizationId: user.organizationId,
          studentId,
          exam: { status: { in: ['PUBLISHED', 'LOCKED'] } },
        },
      }),
    ]);

    const attendanceMap = new Map(
      attendanceCounts.map((row) => [
        row.status,
        typeof row._count === 'object' ? row._count._all ?? 0 : 0,
      ]),
    );
    const present = (attendanceMap.get(AttendanceStatus.PRESENT) ?? 0) + (attendanceMap.get(AttendanceStatus.LATE) ?? 0);
    const absent = attendanceMap.get(AttendanceStatus.ABSENT) ?? 0;
    const total = present + absent;
    const attendanceSessions = profile && enrollment
      ? await this.prisma.lesson.findMany({
          where: {
            organizationId: user.organizationId,
            academicYearId: profile.academicYearId,
            centerId: enrollment.centerId,
          },
          include: {
            attendance: { where: { studentId }, take: 1 },
          },
          orderBy: { lessonDate: 'asc' },
        })
      : [];

    return {
      id: student.id,
      fullName: student.fullName,
      studentCode: profile?.studentCode ?? '—',
      academicYearId: profile?.academicYearId ?? null,
      gradeLevel: profile?.gradeLevel ?? '—',
      centerName: enrollment?.center.name ?? 'غير مسجل',
      centerId: enrollment?.center.id ?? null,
      guardianPhone: student.guardians.find((item) => item.isPrimary)?.guardian.phoneE164 ?? null,
      status: student.status,
      studentPhone: student.studentPhoneE164,
      schoolName: student.schoolName,
      address: student.address,
      academicYear: profile ? {
        id: profile.academicYear.id,
        name: profile.academicYear.name,
        startDate: profile.academicYear.startDate.toISOString(),
        endDate: profile.academicYear.endDate.toISOString(),
      } : null,
      guardians: student.guardians.map((link) => ({
        id: link.guardian.id,
        fullName: link.guardian.fullName,
        relationship: link.relationship,
        phoneE164: link.guardian.phoneE164,
        whatsappPhoneE164: link.guardian.whatsappPhoneE164,
        isPrimary: link.isPrimary,
      })),
      attendanceSummary: {
        present: attendanceMap.get(AttendanceStatus.PRESENT) ?? 0,
        late: attendanceMap.get(AttendanceStatus.LATE) ?? 0,
        absent,
        rate: total > 0 ? (present / total) * 100 : 0,
      },
      attendanceSessions: attendanceSessions.map((lesson) => ({
        lessonId: lesson.id,
        title: lesson.title ?? 'حصة السنتر',
        lessonDate: lesson.lessonDate.toISOString(),
        startsAt: lesson.startsAt.toISOString(),
        lessonStatus: lesson.status,
        attendanceStatus: lesson.attendance[0]?.status ?? null,
        checkInAt: lesson.attendance[0]?.checkInAt?.toISOString() ?? null,
      })),
      gradeSummary: {
        average: Number(gradeAggregate._avg.percentage ?? 0),
        publishedExams: publishedExamCount,
      },
    };
  }

  async qr(user: RequestUser, studentId: string) {
    const profile = await this.getScopedProfile(user, studentId);
    const token = this.buildQrToken(profile.id, profile.qrVersion);
    const value = `STQR:${token}`;
    return {
      studentId,
      studentCode: profile.studentCode,
      qrVersion: profile.qrVersion,
      value,
      svg: await QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }),
    };
  }

  async rotateQr(user: RequestUser, studentId: string) {
    const profile = await this.getScopedProfile(user, studentId);
    const nextVersion = profile.qrVersion + 1;
    const token = this.buildQrToken(profile.id, nextVersion);
    const qrTokenHash = createHash('sha256').update(token).digest('hex');
    await this.prisma.$transaction([
      this.prisma.studentAcademicProfile.update({
        where: { id: profile.id },
        data: { qrVersion: nextVersion, qrTokenHash, qrRotatedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: 'STUDENT_QR_ROTATED',
          entityType: 'Student',
          entityId: studentId,
          metadataJson: { oldVersion: profile.qrVersion, newVersion: nextVersion },
        },
      }),
    ]);
    const value = `STQR:${token}`;
    return {
      studentId,
      studentCode: profile.studentCode,
      qrVersion: nextVersion,
      value,
      svg: await QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }),
    };
  }

  async archive(user: RequestUser, studentId: string) {
    const profile = await this.getScopedProfile(user, studentId);
    return this.prisma.$transaction(async (tx) => {
      await tx.enrollment.updateMany({
        where: { studentAcademicProfileId: profile.id, status: 'ACTIVE' },
        data: { status: 'WITHDRAWN', endDate: new Date() },
      });
      const student = await tx.student.update({
        where: { id: studentId },
        data: { archivedAt: new Date(), status: 'INACTIVE' },
      });
      await tx.auditLog.create({
        data: { organizationId: user.organizationId, actorUserId: user.id, action: 'STUDENT_ARCHIVED', entityType: 'Student', entityId: studentId },
      });
      return student;
    });
  }

  async transfer(user: RequestUser, studentId: string, input: { centerId: string; reason: string }) {
    const profile = await this.getScopedProfile(user, studentId);
    const targetCenter = await this.prisma.center.findFirst({
      where: { id: input.centerId, organizationId: user.organizationId, archivedAt: null },
    });
    if (!targetCenter) throw new DomainError('RESOURCE_NOT_FOUND', 'السنتر الجديد غير موجود.', HttpStatus.NOT_FOUND);
    this.scope.assertCenter(user, targetCenter.id);

    return this.prisma.$transaction(async (tx) => {
      await tx.enrollment.updateMany({
        where: { studentAcademicProfileId: profile.id, isPrimary: true, status: 'ACTIVE' },
        data: { status: 'TRANSFERRED', endDate: new Date(), transferReason: input.reason },
      });
      const enrollment = await tx.enrollment.create({
        data: {
          organizationId: user.organizationId,
          academicYearId: profile.academicYearId,
          studentAcademicProfileId: profile.id,
          centerId: targetCenter.id,
          startDate: new Date(),
          isPrimary: true,
          createdById: user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: 'STUDENT_TRANSFERRED',
          entityType: 'Student',
          entityId: studentId,
          metadataJson: { targetCenterId: targetCenter.id, reason: input.reason },
        },
      });
      return enrollment;
    });
  }

  private async getScopedProfile(user: RequestUser, studentId: string) {
    const profile = await this.prisma.studentAcademicProfile.findFirst({
      where: {
        studentId,
        organizationId: user.organizationId,
        enrollments: {
          some: user.isSuperAdmin
            ? { organizationId: user.organizationId }
            : {
                organizationId: user.organizationId,
                centerId: { in: user.centerScopeIds },
              },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!profile) throw new DomainError('RESOURCE_NOT_FOUND', 'الطالب غير موجود.', HttpStatus.NOT_FOUND);
    return profile;
  }

  private buildQrToken(profileId: string, version: number): string {
    return createHmac('sha256', process.env.QR_TOKEN_SECRET!).update(`${profileId}:${version}`).digest('base64url');
  }

}
