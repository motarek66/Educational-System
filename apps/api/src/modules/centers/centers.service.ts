import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainError } from '../../common/errors/domain-error';
import type { RequestUser } from '../../common/guards/auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { ScopeService } from '../rbac/scope.service';
import { CreateCenterDto } from './centers.dto';

@Injectable()
export class CentersService {
  constructor(private readonly prisma: PrismaService, private readonly scope: ScopeService) {}

  async list(user: RequestUser) {
    const centers = await this.prisma.center.findMany({
      where: { ...this.scope.centerWhere(user), archivedAt: null },
      include: {
        _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { name: 'asc' },
    });
    return centers.map((center) => ({
      id: center.id,
      name: center.name,
      code: center.code,
      address: center.address,
      status: center.status,
      studentsCount: center._count.enrollments,
    }));
  }

  async options(user: RequestUser) {
    return this.prisma.center.findMany({
      where: { ...this.scope.centerWhere(user), status: 'ACTIVE', archivedAt: null },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
  }

  async detail(user: RequestUser, centerId: string) {
    const center = await this.prisma.center.findFirst({
      where: { id: centerId, ...this.scope.centerWhere(user), archivedAt: null },
    });
    if (!center) throw new DomainError('RESOURCE_NOT_FOUND', 'السنتر غير موجود.', HttpStatus.NOT_FOUND);

    const enrollments = await this.prisma.enrollment.findMany({
      where: { centerId, organizationId: user.organizationId, status: 'ACTIVE' },
      include: {
        profile: {
          include: {
            student: {
              include: { guardians: { where: { isPrimary: true }, take: 1, include: { guardian: true } } },
            },
          },
        },
      },
      orderBy: { profile: { student: { fullName: 'asc' } } },
    });

    return {
      id: center.id,
      name: center.name,
      code: center.code,
      address: center.address,
      status: center.status,
      students: enrollments.map((enrollment) => ({
        id: enrollment.profile.student.id,
        fullName: enrollment.profile.student.fullName,
        studentCode: enrollment.profile.studentCode,
        gradeLevel: enrollment.profile.gradeLevel,
        guardianPhone: enrollment.profile.student.guardians[0]?.guardian.phoneE164 ?? null,
        status: enrollment.profile.student.status,
      })),
    };
  }

  create(user: RequestUser, dto: CreateCenterDto) {
    return this.prisma.center.create({ data: { organizationId: user.organizationId, ...dto } });
  }

  async remove(user: RequestUser, centerId: string) {
    const center = await this.prisma.center.findFirst({ where: { id: centerId, organizationId: user.organizationId } });
    if (!center) throw new DomainError('RESOURCE_NOT_FOUND', 'السنتر غير موجود.', HttpStatus.NOT_FOUND);

    const activeEnrollments = await this.prisma.enrollment.count({ where: { centerId, status: 'ACTIVE' } });
    if (activeEnrollments > 0) {
      throw new DomainError('RESOURCE_HAS_DEPENDENTS', 'لا يمكن حذف السنتر لوجود طلاب مسجلين فيه حاليًا. انقلهم إلى سنتر آخر أو أرشفهم أولًا.', HttpStatus.CONFLICT);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.grade.deleteMany({ where: { enrollment: { centerId } } });
      await tx.attendanceRecord.deleteMany({ where: { OR: [{ enrollment: { centerId } }, { originalCenterId: centerId }] } });
      await tx.weeklyAttendanceResult.deleteMany({ where: { centerId } });
      await tx.enrollment.deleteMany({ where: { centerId } });
      await tx.examCenterAssignment.deleteMany({ where: { centerId } });
      await tx.lesson.updateMany({ where: { centerId }, data: { centerId: null } });
      await tx.center.delete({ where: { id: centerId } });
      await tx.auditLog.create({
        data: { organizationId: user.organizationId, actorUserId: user.id, action: 'CENTER_DELETED', entityType: 'Center', entityId: centerId, beforeJson: { name: center.name, code: center.code } },
      });
    });
    return { id: centerId };
  }
}
