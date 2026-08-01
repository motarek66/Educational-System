import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { RequestUser } from '../../common/guards/auth.guard';
import { CreateStudentDto, TransferStudentDto } from './students.dto';
import { StudentsService } from './students.service';

class ListStudentsQuery {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @RequirePermissions('students.view')
  list(@CurrentUser() user: RequestUser, @Query() query: ListStudentsQuery) {
    return this.students.list(user, query);
  }

  @Post()
  @RequirePermissions('students.create')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateStudentDto) {
    return this.students.create(user, dto);
  }

  @Get(':id/profile')
  @RequirePermissions('students.view')
  profile(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.students.profile(user, id);
  }

  @Get(':id/qr')
  @RequirePermissions('students.view')
  qr(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.students.qr(user, id);
  }

  @Post(':id/qr/rotate')
  @RequirePermissions('students.update')
  rotateQr(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.students.rotateQr(user, id);
  }

  @Post(':id/archive')
  @RequirePermissions('students.archive')
  archive(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.students.archive(user, id);
  }

  @Post(':id/transfer')
  @RequirePermissions('students.update')
  transfer(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: TransferStudentDto) {
    return this.students.transfer(user, id, dto);
  }
}
