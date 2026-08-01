import { Controller, Get, Header, Param, Post, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { RequestUser } from '../../common/guards/auth.guard';
import { ImportsService } from './imports.service';

@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get('templates/students')
  @Header('Cache-Control', 'private, no-store')
  async template(@Res({ passthrough: true }) response: Response): Promise<StreamableFile> {
    const { stream, fileName } = await this.importsService.template();
    response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return stream;
  }

  @Post('students/upload')
  @RequirePermissions('students.create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(@CurrentUser() user: RequestUser, @UploadedFile() file: Express.Multer.File) {
    return this.importsService.upload(user, file);
  }

  @Get(':id/preview')
  @RequirePermissions('students.create')
  preview(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.importsService.preview(user, id);
  }

  @Post(':id/commit')
  @RequirePermissions('students.create')
  commit(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.importsService.commit(user, id);
  }
}
