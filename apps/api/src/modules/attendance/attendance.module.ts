import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { WeeklyAttendanceService } from './weekly-attendance.service';

@Module({ controllers: [AttendanceController], providers: [AttendanceService, WeeklyAttendanceService] })
export class AttendanceModule {}
