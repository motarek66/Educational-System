import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/errors/domain-error';
import type { RequestUser } from '../../common/guards/auth.guard';
import { PrismaService } from '../../database/prisma.service';
import type { CreateWhatsAppTemplateDto, UpdateWhatsAppTemplateDto, WhatsAppPreviewDto } from './whatsapp.dto';
import { buildWhatsAppUrl, renderWhatsAppTemplate } from './whatsapp.utils';

@Injectable()
export class WhatsAppService {
  constructor(private readonly prisma: PrismaService) {}

  listActive(user: RequestUser) {
    return this.prisma.whatsAppTemplate.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  listAll(user: RequestUser) {
    return this.prisma.whatsAppTemplate.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async create(user: RequestUser, dto: CreateWhatsAppTemplateDto) {
    const template = await this.prisma.whatsAppTemplate.create({
      data: {
        organizationId: user.organizationId,
        name: dto.name.trim(),
        type: dto.type,
        bodyTemplate: dto.bodyTemplate.trim(),
      },
    });
    await this.recordAudit(user, 'WHATSAPP_TEMPLATE_CREATED', template.id, { name: template.name, type: template.type });
    return template;
  }

  async update(user: RequestUser, id: string, dto: UpdateWhatsAppTemplateDto) {
    await this.findTemplate(user, id);
    const template = await this.prisma.whatsAppTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.bodyTemplate !== undefined ? { bodyTemplate: dto.bodyTemplate.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.recordAudit(user, 'WHATSAPP_TEMPLATE_UPDATED', template.id, { name: template.name, type: template.type, isActive: template.isActive });
    return template;
  }

  async remove(user: RequestUser, id: string) {
    const template = await this.findTemplate(user, id);
    await this.prisma.whatsAppTemplate.delete({ where: { id } });
    await this.recordAudit(user, 'WHATSAPP_TEMPLATE_DELETED', id, { name: template.name, type: template.type });
    return null;
  }

  async preview(user: RequestUser, dto: WhatsAppPreviewDto) {
    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: { id: dto.templateId, organizationId: user.organizationId, isActive: true },
    });
    if (!template) {
      throw new DomainError('RESOURCE_NOT_FOUND', 'قالب الرسالة غير موجود أو غير مفعّل.', 404);
    }
    const message = renderWhatsAppTemplate(template.bodyTemplate, dto.variables);
    const url = dto.phoneE164 ? buildWhatsAppUrl(dto.phoneE164, message) : null;
    return { templateId: template.id, templateName: template.name, message, url };
  }

  private async findTemplate(user: RequestUser, id: string) {
    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!template) throw new DomainError('RESOURCE_NOT_FOUND', 'قالب الرسالة غير موجود.', 404);
    return template;
  }

  private async recordAudit(user: RequestUser, action: string, entityId: string, metadata: Record<string, string | boolean>) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        actorUserId: user.id,
        action,
        entityType: 'WhatsAppTemplate',
        entityId,
        metadataJson: metadata,
      },
    });
  }
}
