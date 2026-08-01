import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { RequestUser } from '../../common/guards/auth.guard';
import { CreateLessonDto } from './lessons.dto';
import { LessonsService } from './lessons.service';

class CloseLessonDto { @IsBoolean() markAbsent!: boolean; }

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  @Get('today')
  @RequirePermissions('attendance.view')
  today(@CurrentUser() user: RequestUser) { return this.lessons.today(user); }

  @Post()
  @RequirePermissions('lessons.create')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateLessonDto) { return this.lessons.create(user, dto); }

  @Post(':id/open')
  @RequirePermissions('attendance.scan')
  open(@CurrentUser() user: RequestUser, @Param('id') id: string) { return this.lessons.open(user, id); }

  @Post(':id/close')
  @RequirePermissions('attendance.correct')
  close(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: CloseLessonDto) { return this.lessons.close(user, id, dto.markAbsent); }
}
