import { IsString, IsUUID, MinLength } from 'class-validator';

export class ScanAttendanceDto {
  @IsString()
  @MinLength(20)
  qrToken!: string;

  @IsUUID()
  idempotencyKey!: string;
}

export class ManualAttendanceDto {
  @IsString()
  studentCode!: string;

  @IsUUID()
  idempotencyKey!: string;
}
