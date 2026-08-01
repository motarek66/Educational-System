import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/guards/auth.guard';
import { PrismaService } from '../../database/prisma.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@CurrentUser() user: RequestUser) {
    const [organization, academicYear] = await this.prisma.$transaction([
      this.prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } }),
      this.prisma.academicYear.findFirst({ where: { organizationId: user.organizationId, status: 'ACTIVE' }, orderBy: { startDate: 'desc' } }),
    ]);
    const settings = organization.settingsJson as Record<string, unknown>;
    return {
      organizationName: organization.name,
      timezone: organization.timezone,
      locale: organization.locale,
      defaultCountry: String(settings.defaultCountry ?? 'EG'),
      lateAfterMinutes: Number(settings.lateAfterMinutes ?? 15),
      excusedAttendancePolicy: settings.excusedAttendancePolicy === 'INCLUDE' ? 'INCLUDE' : 'EXCLUDE',
      activeAcademicYear: academicYear?.name ?? null,
      lastBackupAt: settings.lastBackupAt ? String(settings.lastBackupAt) : null,
    };
  }
}
