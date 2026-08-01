import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class WhatsAppPreviewDto {
  @IsUUID()
  templateId!: string;

  @IsObject()
  variables!: Record<string, string | number>;

  @IsOptional()
  @IsString()
  phoneE164?: string;
}
