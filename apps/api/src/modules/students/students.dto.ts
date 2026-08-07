import { StudentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @MinLength(3)
  fullName!: string;

  @IsString()
  gradeLevel!: string;

  @IsString()
  centerId!: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

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

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;
}

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  fullName?: string;

  @IsOptional()
  @IsString()
  gradeLevel?: string;

  @IsOptional()
  @IsUUID()
  centerId?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  guardianName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  guardianPhone?: string;

  @IsOptional()
  @IsString()
  studentPhone?: string;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;
}

export class TransferStudentDto {
  @IsString()
  centerId!: string;

  @IsString()
  @MinLength(3)
  reason!: string;
}
