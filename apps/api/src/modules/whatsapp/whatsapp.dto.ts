import { IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export const whatsappTemplateTypes = ['GENERAL', 'GRADE', 'ABSENCE', 'LATE', 'CUSTOM'] as const;

export class CreateWhatsAppTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsIn(whatsappTemplateTypes)
  type!: (typeof whatsappTemplateTypes)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  bodyTemplate!: string;
}

export class UpdateWhatsAppTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(whatsappTemplateTypes)
  type?: (typeof whatsappTemplateTypes)[number];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  bodyTemplate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class WhatsAppPreviewDto {
  @IsUUID()
  templateId!: string;

  @IsObject()
  variables!: Record<string, string | number>;

  @IsOptional()
  @IsString()
  phoneE164?: string;
}
