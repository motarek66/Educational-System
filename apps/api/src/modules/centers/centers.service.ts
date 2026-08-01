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
}
