import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import argon2 from 'argon2';
import { createHash, randomUUID } from 'node:crypto';
import { DomainError } from '../../common/errors/domain-error';
import type { RequestUser } from '../../common/guards/auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './auth.dto';

type SessionContext = { userAgent?: string; ip?: string };
type RefreshPayload = { sub: string; sessionId: string; type: 'refresh'; jti: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto, context: SessionContext) {
    const user = await this.prisma.user.findFirst({
      where: {
        archivedAt: null,
        OR: [{ email: dto.identifier.toLowerCase() }, { phoneE164: dto.identifier }],
      },
      include: this.userSecurityInclude(),
    });

    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      if (user) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount: { increment: 1 } },
        });
      }
      throw new DomainError('AUTH_INVALID_CREDENTIALS', 'بيانات الدخول غير صحيحة.', HttpStatus.UNAUTHORIZED);
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new DomainError('AUTH_ACCOUNT_SUSPENDED', 'تم إيقاف هذا الحساب.', HttpStatus.FORBIDDEN);
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new DomainError('AUTH_ACCOUNT_LOCKED', 'الحساب مقفل مؤقتًا. حاول لاحقًا.', HttpStatus.TOO_MANY_REQUESTS);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    });

    const requestUser = this.toRequestUser(user);
    const sessionId = randomUUID();
    const refreshToken = await this.signRefreshToken(user.id, sessionId, dto.rememberMe);
    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: await argon2.hash(refreshToken),
        deviceName: this.extractDeviceName(context.userAgent),
        userAgent: context.userAgent?.slice(0, 500),
        ipHash: context.ip ? createHash('sha256').update(context.ip).digest('hex') : null,
        expiresAt: this.refreshExpiry(dto.rememberMe),
      },
    });

    return {
      accessToken: await this.signAccessToken(requestUser),
      refreshToken,
      user: requestUser,
    };
  }

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new DomainError('AUTH_SESSION_EXPIRED', 'انتهت الجلسة. سجل الدخول مرة أخرى.', HttpStatus.UNAUTHORIZED);
    }

    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: process.env.REFRESH_TOKEN_SECRET,
      });
    } catch {
      throw new DomainError('AUTH_SESSION_EXPIRED', 'انتهت الجلسة. سجل الدخول مرة أخرى.', HttpStatus.UNAUTHORIZED);
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sessionId },
      include: { user: { include: this.userSecurityInclude() } },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new DomainError('AUTH_SESSION_EXPIRED', 'انتهت الجلسة. سجل الدخول مرة أخرى.', HttpStatus.UNAUTHORIZED);
    }

    const matches = await argon2.verify(session.refreshTokenHash, refreshToken);
    if (!matches) {
      await this.prisma.authSession.updateMany({
        where: { userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new DomainError('AUTH_REFRESH_REUSED', 'تم إلغاء الجلسات لأسباب أمنية.', HttpStatus.UNAUTHORIZED);
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      throw new DomainError('AUTH_ACCOUNT_SUSPENDED', 'الحساب غير نشط.', HttpStatus.FORBIDDEN);
    }

    const requestUser = this.toRequestUser(session.user);
    const rotatedRefreshToken = await this.signRefreshToken(session.user.id, session.id, true);
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: await argon2.hash(rotatedRefreshToken),
        lastUsedAt: new Date(),
        expiresAt: this.refreshExpiry(true),
      },
    });

    return {
      accessToken: await this.signAccessToken(requestUser),
      refreshToken: rotatedRefreshToken,
      user: requestUser,
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: process.env.REFRESH_TOKEN_SECRET,
      });
      await this.prisma.authSession.updateMany({
        where: { id: payload.sessionId },
        data: { revokedAt: new Date() },
      });
    } catch {
      return;
    }
  }

  async listSessions(userId: string) {
    return this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, deviceName: true, lastUsedAt: true, createdAt: true, expiresAt: true },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  private async signAccessToken(user: RequestUser): Promise<string> {
    return this.jwt.signAsync(
      { ...user, sub: user.id, type: 'access' },
      { secret: process.env.ACCESS_TOKEN_SECRET, expiresIn: process.env.ACCESS_TOKEN_TTL ?? '15m' },
    );
  }

  private async signRefreshToken(userId: string, sessionId: string, rememberMe: boolean): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, sessionId, type: 'refresh', jti: randomUUID() },
      {
        secret: process.env.REFRESH_TOKEN_SECRET,
        expiresIn: rememberMe ? `${Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30)}d` : '1d',
      },
    );
  }

  private refreshExpiry(rememberMe: boolean): Date {
    const days = rememberMe ? Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30) : 1;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private userSecurityInclude() {
    return {
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      centerScopes: true,
    } as const;
  }

  private toRequestUser(user: {
    id: string;
    organizationId: string;
    fullName: string;
    roles: Array<{ role: { name: string; permissions: Array<{ permission: { key: string } }> } }>;
    centerScopes: Array<{ centerId: string }>;
  }): RequestUser {
    const isSuperAdmin = user.roles.some(({ role }) => role.name === 'SUPER_ADMIN');
    return {
      id: user.id,
      organizationId: user.organizationId,
      fullName: user.fullName,
      isSuperAdmin,
      permissions: [...new Set(user.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.key)))],
      centerScopeIds: user.centerScopes.map(({ centerId }) => centerId),
    };
  }

  private extractDeviceName(userAgent?: string): string {
    if (!userAgent) return 'جهاز غير معروف';
    if (/Android/i.test(userAgent)) return 'Android';
    if (/iPhone|iPad/i.test(userAgent)) return 'iPhone / iPad';
    if (/Windows/i.test(userAgent)) return 'Windows';
    if (/Macintosh/i.test(userAgent)) return 'Mac';
    return 'متصفح ويب';
  }
}
