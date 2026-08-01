import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export type RequestUser = {
  id: string;
  organizationId: string;
  fullName: string;
  isSuperAdmin: boolean;
  permissions: string[];
  centerScopeIds: string[];
};

export type AuthenticatedRequest = Request & { user: RequestUser };

type AccessTokenPayload = RequestUser & { sub: string; type: 'access' };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('الجلسة غير صالحة أو منتهية.');

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: process.env.ACCESS_TOKEN_SECRET,
      });
      if (payload.type !== 'access') throw new Error('Invalid token type');
      request.user = {
        id: payload.sub,
        organizationId: payload.organizationId,
        fullName: payload.fullName,
        isSuperAdmin: payload.isSuperAdmin,
        permissions: payload.permissions,
        centerScopeIds: payload.centerScopeIds,
      };
      return true;
    } catch {
      throw new UnauthorizedException('الجلسة غير صالحة أو منتهية.');
    }
  }
}
