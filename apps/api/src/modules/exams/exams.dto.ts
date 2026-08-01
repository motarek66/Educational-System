import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ExamType, GradeStatus } from '@prisma/client';

export class CreateExamDto {
  @IsString()
  name!: string;

  @IsEnum(ExamType)
  type!: ExamType;

  @IsDateString()
  examDate!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  maxScore!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  passScore?: number;

  @IsArray()
  @IsUUID('4', { each: true })
  centerIds!: string[];
}

export class BulkGradeItemDto {
  @IsUUID()
  enrollmentId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  score!: number | null;

  @IsEnum(GradeStatus)
  status!: GradeStatus;
}

export class BulkGradesDto {
  @IsArray()
  grades!: BulkGradeItemDto[];
}
