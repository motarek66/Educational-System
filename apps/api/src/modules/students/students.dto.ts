import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @MinLength(3)
  fullName!: string;

  @IsString()
  gradeLevel!: string;

  @IsString()
  centerId!: string;

  @IsString()
  @MinLength(3)
  guardianName!: string;

  @IsString()
  @MinLength(8)
  guardianPhone!: string;

  @IsOptional()
  @IsString()
  studentPhone?: string;

  @IsOptional()
  @IsString()
  schoolName?: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class TransferStudentDto {
  @IsString()
  centerId!: string;

  @IsString()
  @MinLength(3)
  reason!: string;
}
