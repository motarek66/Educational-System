import { IsDateString, IsString, Matches } from 'class-validator';

export class CreateAcademicYearDto {
  @IsString()
  name!: string;

  @Matches(/^\d{4}$/)
  codeYear!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
