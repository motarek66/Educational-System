import { IsArray, IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  fullName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  phoneE164!: string;

  @IsString()
  @MinLength(12)
  temporaryPassword!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  roleIds!: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  centerIds!: string[];
}
