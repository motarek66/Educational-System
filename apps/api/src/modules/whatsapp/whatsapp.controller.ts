import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/guards/auth.guard';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../database/prisma.service';
import { WhatsAppPreviewDto } from './whatsapp.dto';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('templates')
  templates(@CurrentUser() user: RequestUser) {
    return this.prisma.whatsAppTemplate.findMany({ where: { organizationId: user.organizationId, isActive: true }, orderBy: { name: 'asc' } });
  }

  @Post('preview')
  async preview(@CurrentUser() user: RequestUser, @Body() dto: WhatsAppPreviewDto) {
    const template = await this.prisma.whatsAppTemplate.findFirst({ where: { id: dto.templateId, organizationId: user.organizationId, isActive: true } });
    if (!template) throw new DomainError('RESOURCE_NOT_FOUND', 'قالب الرسالة غير موجود.', 404);
    const unknownVariables = new Set<string>();
    const message = template.bodyTemplate.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => {
      const value = dto.variables[key];
      if (value === undefined) { unknownVariables.add(key); return `{{${key}}}`; }
      return String(value);
    });
    if (unknownVariables.size) throw new DomainError('WHATSAPP_TEMPLATE_VARIABLE_MISSING', 'توجد متغيرات ناقصة في الرسالة.', 422, { variables: [...unknownVariables] });
    const phone = dto.phoneE164?.replace(/\D/g, '');
    return { message, url: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null };
  }
}
