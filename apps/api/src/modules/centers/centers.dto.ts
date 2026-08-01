import { IsOptional, IsString } from 'class-validator';

export class CreateCenterDto {
  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  address?: string;
}
