import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { RequestUser } from '../../common/guards/auth.guard';
import { CreateLessonDto, SaveLessonGradeDto, SaveLessonGradesBulkDto, UpdateAssessmentMaxScoreDto } from './lessons.dto';
import { LessonsService } from './lessons.service';

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  @Get()
  @RequirePermissions('attendance.view')
  list(@CurrentUser() user: RequestUser, @Query('status') status?: string) { return this.lessons.list(user, status); }

  @Get('active')
  @RequirePermissions('attendance.view')
  active(@CurrentUser() user: RequestUser) { return this.lessons.active(user); }

  @Get('today')
  @RequirePermissions('attendance.view')
  today(@CurrentUser() user: RequestUser) { return this.lessons.today(user); }

  @Get(':id')
  @RequirePermissions('attendance.view')
  details(@CurrentUser() user: RequestUser, @Param('id') id: string) { return this.lessons.details(user, id); }

  @Post('start')
  @RequirePermissions('lessons.create')
  start(@CurrentUser() user: RequestUser) { return this.lessons.start(user); }

  @Post()
  @RequirePermissions('lessons.create')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateLessonDto) { return this.lessons.create(user, dto); }

  @Post(':id/open')
  @RequirePermissions('attendance.scan')
  open(@CurrentUser() user: RequestUser, @Param('id') id: string) { return this.lessons.open(user, id); }

  @Post(':id/close')
  @RequirePermissions('lessons.create')
  close(@CurrentUser() user: RequestUser, @Param('id') id: string) { return this.lessons.close(user, id); }

  @Put(':id/grades/:enrollmentId')
  @RequirePermissions('grades.enter')
  saveGrade(@CurrentUser() user: RequestUser, @Param('id') id: string, @Param('enrollmentId') enrollmentId: string, @Body() dto: SaveLessonGradeDto) {
    return this.lessons.saveGrade(user, id, enrollmentId, dto.score);
  }

  @Put(':id/grades')
  @RequirePermissions('grades.enter')
  saveGradesBulk(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: SaveLessonGradesBulkDto) {
    return this.lessons.saveGradesBulk(user, id, dto.items);
  }

  @Put(':id/assessment')
  @RequirePermissions('grades.enter')
  updateAssessment(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateAssessmentMaxScoreDto) {
    return this.lessons.updateAssessmentMaxScore(user, id, dto.maxScore);
  }
}
