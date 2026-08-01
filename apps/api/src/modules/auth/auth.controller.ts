import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestUser } from '../../common/guards/auth.guard';
import { LoginDto } from './auth.dto';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto, { userAgent: request.headers['user-agent'], ip: request.ip });
    this.setRefreshCookie(response, result.refreshToken, dto.rememberMe);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.refresh(request.cookies?.refresh_token as string | undefined);
    this.setRefreshCookie(response, result.refreshToken, true);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(request.cookies?.refresh_token as string | undefined);
    response.clearCookie('refresh_token', { path: '/api/v1/auth' });
    return null;
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return user;
  }

  @Get('sessions')
  sessions(@CurrentUser() user: RequestUser) {
    return this.authService.listSessions(user.id);
  }

  private setRefreshCookie(response: Response, token: string, persistent: boolean): void {
    const isProduction = process.env.NODE_ENV === 'production';
    response.cookie('refresh_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/api/v1/auth',
      maxAge: persistent ? Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30) * 86_400_000 : undefined,
    });
  }
}
