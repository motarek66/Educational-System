import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { RequestUser } from '../../common/guards/auth.guard';
import { BulkGradesDto, CreateExamDto } from './exams.dto';
import { ExamsService } from './exams.service';

@Controller('exams')
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  @RequirePermissions('exams.view')
  list(@CurrentUser() user: RequestUser) { return this.exams.list(user); }

  @Post()
  @RequirePermissions('exams.create')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateExamDto) { return this.exams.create(user, dto); }

  @Get(':id/gradebook')
  @RequirePermissions('grades.enter')
  gradebook(@CurrentUser() user: RequestUser, @Param('id') id: string) { return this.exams.gradebook(user, id); }

  @Put(':id/grades/bulk')
  @RequirePermissions('grades.enter')
  saveGrades(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: BulkGradesDto) { return this.exams.saveGrades(user, id, dto); }

  @Post(':id/publish')
  @RequirePermissions('grades.enter')
  publish(@CurrentUser() user: RequestUser, @Param('id') id: string) { return this.exams.publish(user, id); }
}
