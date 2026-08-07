import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { RequestUser } from '../../common/guards/auth.guard';
import { PrismaService } from '../../database/prisma.service';

class AuditQuery {
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('notifications')
  @RequirePermissions('dashboard.view')
  notifications(@CurrentUser() user: RequestUser) {
    return this.prisma.auditLog.findMany({
      where: { organizationId: user.organizationId },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        actor: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  @Get()
  @RequirePermissions('users.view')
  async list(@CurrentUser() user: RequestUser, @Query() query: AuditQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where = { organizationId: user.organizationId, action: query.action, entityType: query.entityType };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, include: { actor: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    return { data: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
