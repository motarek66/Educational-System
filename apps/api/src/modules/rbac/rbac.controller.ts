import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { RequestUser } from '../../common/guards/auth.guard';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../database/prisma.service';
import { CreateRoleDto, UpdateRolePermissionsDto, UpdateUserScopesDto } from './rbac.dto';

@Controller()
export class RbacController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('permissions')
  @RequirePermissions('users.view')
  permissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  @Get('roles')
  @RequirePermissions('users.view')
  roles(@CurrentUser() user: RequestUser) {
    return this.prisma.role.findMany({
      where: { organizationId: user.organizationId },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
    });
  }

  @Post('roles')
  @RequirePermissions('users.create')
  createRole(@CurrentUser() user: RequestUser, @Body() dto: CreateRoleDto) {
    return this.prisma.role.create({ data: { organizationId: user.organizationId, name: dto.name, description: dto.description } });
  }

  @Put('roles/:id/permissions')
  @RequirePermissions('users.update')
  async updatePermissions(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateRolePermissionsDto) {
    const role = await this.prisma.role.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!role) throw new DomainError('RESOURCE_NOT_FOUND', 'الدور غير موجود.', 404);
    const permissions = await this.prisma.permission.findMany({ where: { key: { in: dto.permissionKeys } } });
    if (permissions.length !== new Set(dto.permissionKeys).size) throw new DomainError('VALIDATION_FAILED', 'توجد صلاحيات غير معروفة.');
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      this.prisma.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })) }),
      this.prisma.auditLog.create({ data: { organizationId: user.organizationId, actorUserId: user.id, action: 'ROLE_PERMISSIONS_UPDATED', entityType: 'Role', entityId: role.id, metadataJson: { permissionKeys: dto.permissionKeys } } }),
    ]);
    return { roleId: role.id, permissionKeys: dto.permissionKeys };
  }

  @Put('users/:id/scopes')
  @RequirePermissions('users.update')
  async updateScopes(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateUserScopesDto) {
    const target = await this.prisma.user.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!target) throw new DomainError('RESOURCE_NOT_FOUND', 'المستخدم غير موجود.', 404);
    const centers = await this.prisma.center.count({ where: { id: { in: dto.centerIds }, organizationId: user.organizationId } });
    if (centers !== new Set(dto.centerIds).size) throw new DomainError('VALIDATION_FAILED', 'نطاقات غير صالحة.');
    await this.prisma.$transaction([
      this.prisma.userCenterScope.deleteMany({ where: { userId: id } }),
      this.prisma.userCenterScope.createMany({ data: dto.centerIds.map((centerId) => ({ userId: id, centerId })) }),
      this.prisma.auditLog.create({ data: { organizationId: user.organizationId, actorUserId: user.id, action: 'USER_SCOPES_UPDATED', entityType: 'User', entityId: id, metadataJson: { centerIds: dto.centerIds } } }),
    ]);
    return { userId: id, centerIds: dto.centerIds };
  }
}
