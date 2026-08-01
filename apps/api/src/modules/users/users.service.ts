import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { DomainError } from '../../common/errors/domain-error';
import { CreateUserDto } from './users.dto';
import type { RequestUser } from '../../common/guards/auth.guard';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: RequestUser) {
    const users = await this.prisma.user.findMany({
      where: { organizationId: user.organizationId, archivedAt: null },
      include: {
        roles: { include: { role: true } },
        centerScopes: { include: { center: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return users.filter((item) => !item.roles.some(({ role }) => role.name === 'SUPER_ADMIN')).map((item) => ({
      id: item.id,
      fullName: item.fullName,
      email: item.email,
      phoneE164: item.phoneE164,
      status: item.status,
      roles: item.roles.map(({ role }) => role.name).filter((name) => name !== 'SUPER_ADMIN'),
      centers: item.centerScopes.map(({ center }) => center.name),
    }));
  }

  async create(actor: RequestUser, dto: CreateUserDto) {
    const [roleCount, centerCount] = await Promise.all([
      this.prisma.role.count({ where: { id: { in: dto.roleIds }, organizationId: actor.organizationId } }),
      this.prisma.center.count({ where: { id: { in: dto.centerIds }, organizationId: actor.organizationId } }),
    ]);
    if (roleCount !== new Set(dto.roleIds).size || centerCount !== new Set(dto.centerIds).size) {
      throw new DomainError('VALIDATION_FAILED', 'الأدوار أو النطاقات غير صالحة.');
    }
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId: actor.organizationId,
          fullName: dto.fullName,
          email: dto.email?.toLowerCase(),
          phoneE164: dto.phoneE164,
          passwordHash: await argon2.hash(dto.temporaryPassword),
          mustChangePassword: true,
          createdById: actor.id,
        },
      });
      await tx.userRole.createMany({ data: dto.roleIds.map((roleId) => ({ userId: user.id, roleId })) });
      await tx.userCenterScope.createMany({ data: dto.centerIds.map((centerId) => ({ userId: user.id, centerId })) });
      await tx.auditLog.create({ data: { organizationId: actor.organizationId, actorUserId: actor.id, action: 'USER_CREATED', entityType: 'User', entityId: user.id } });
      return { id: user.id, fullName: user.fullName, email: user.email, phoneE164: user.phoneE164, status: user.status };
    });
  }
}
