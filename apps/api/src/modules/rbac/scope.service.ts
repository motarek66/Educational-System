import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DomainError } from '../../common/errors/domain-error';
import type { RequestUser } from '../../common/guards/auth.guard';

@Injectable()
export class ScopeService {
  centerWhere(user: RequestUser): Prisma.CenterWhereInput {
    if (user.isSuperAdmin) return { organizationId: user.organizationId };
    if (user.centerScopeIds.length === 0) {
      return { organizationId: user.organizationId, id: { in: [] } };
    }
    return {
      organizationId: user.organizationId,
      id: { in: user.centerScopeIds },
    };
  }

  assertCenter(user: RequestUser, centerId: string): void {
    if (!user.isSuperAdmin && !user.centerScopeIds.includes(centerId)) {
      throw new DomainError('RESOURCE_OUT_OF_SCOPE', 'هذا السنتر خارج نطاق صلاحياتك.', HttpStatus.NOT_FOUND);
    }
  }
}
