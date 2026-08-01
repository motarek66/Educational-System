import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/guards/auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { CreateAcademicYearDto } from './academic-years.dto';

@Controller('academic-years')
export class AcademicYearsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.prisma.academicYear.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { startDate: 'desc' },
    });
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateAcademicYearDto) {
    return this.prisma.academicYear.create({
      data: {
        organizationId: user.organizationId,
        name: dto.name,
        codeYear: dto.codeYear,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
  }
}
