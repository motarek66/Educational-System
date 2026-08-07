import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateLessonDto {
  @IsString()
  centerId!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  lateAfterMinutes?: number;
}

export class SaveLessonGradeDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  score!: number;
}
