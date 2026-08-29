import { Type } from 'class-transformer';
import { ArrayMinSize, IsDateString, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

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

export class UpdateAssessmentMaxScoreDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxScore!: number;
}

export class LessonGradeItemDto {
  @IsString()
  enrollmentId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  score!: number;
}

export class SaveLessonGradesBulkDto {
  @ValidateNested({ each: true })
  @Type(() => LessonGradeItemDto)
  @ArrayMinSize(1)
  items!: LessonGradeItemDto[];
}
