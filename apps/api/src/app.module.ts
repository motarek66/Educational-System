import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AuthGuard } from './common/guards/auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { AcademicYearsModule } from './modules/academic-years/academic-years.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CentersModule } from './modules/centers/centers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExamsModule } from './modules/exams/exams.module';
import { ExportsModule } from './modules/exports/exports.module';
import { ImportsModule } from './modules/imports/imports.module';
import { HealthModule } from './modules/health/health.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { SettingsModule } from './modules/settings/settings.module';
import { StudentsModule } from './modules/students/students.module';
import { UsersModule } from './modules/users/users.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie', 'password', 'refreshToken'],
      },
    }),
    DatabaseModule,
    RbacModule,
    AuditModule,
    AuthModule,
    UsersModule,
    AcademicYearsModule,
    CentersModule,
    StudentsModule,
    LessonsModule,
    AttendanceModule,
    ExamsModule,
    DashboardModule,
    ExportsModule,
    ImportsModule,
    WhatsAppModule,
    SettingsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
