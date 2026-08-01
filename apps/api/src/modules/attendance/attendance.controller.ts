import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { RequestUser } from '../../common/guards/auth.guard';
import { ManualAttendanceDto, ScanAttendanceDto } from './attendance.dto';
import { AttendanceService } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('scan')
  @RequirePermissions('attendance.scan')
  scan(@CurrentUser() user: RequestUser, @Body() dto: ScanAttendanceDto) {
    return this.attendance.scan(user, dto.qrToken);
  }

  @Post('manual')
  @RequirePermissions('attendance.create_manual')
  manual(@CurrentUser() user: RequestUser, @Body() dto: ManualAttendanceDto) {
    return this.attendance.manual(user, dto.studentCode);
  }
}
