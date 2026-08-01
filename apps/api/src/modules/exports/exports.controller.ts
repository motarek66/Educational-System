import { Controller, Get, Header, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { RequestUser } from '../../common/guards/auth.guard';
import { ExportsService } from './exports.service';

@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get()
  @RequirePermissions('reports.export')
  list(@CurrentUser() user: RequestUser) { return this.exportsService.list(user); }

  @Post('students')
  @RequirePermissions('students.export')
  students(@CurrentUser() user: RequestUser) { return this.exportsService.createExcel(user, 'students'); }

  @Post('attendance')
  @RequirePermissions('reports.export')
  attendance(@CurrentUser() user: RequestUser) { return this.exportsService.createExcel(user, 'attendance'); }

  @Post('grades')
  @RequirePermissions('reports.export')
  grades(@CurrentUser() user: RequestUser) { return this.exportsService.createExcel(user, 'grades'); }

  @Post('full-snapshot')
  @RequirePermissions('reports.export')
  fullSnapshot(@CurrentUser() user: RequestUser) { return this.exportsService.createFullSnapshot(user); }

  @Get(':id/download')
  @Header('Cache-Control', 'private, no-store')
  async download(@CurrentUser() user: RequestUser, @Param('id') id: string, @Res({ passthrough: true }) response: Response) {
    const { stream, fileName } = await this.exportsService.download(user, id);
    response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return stream;
  }
}
