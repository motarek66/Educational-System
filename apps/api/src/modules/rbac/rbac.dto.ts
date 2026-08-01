import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateRolePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissionKeys!: string[];
}

export class UpdateUserScopesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  centerIds!: string[];
}
