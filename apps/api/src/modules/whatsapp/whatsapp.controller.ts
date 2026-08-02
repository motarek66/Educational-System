import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { RequestUser } from '../../common/guards/auth.guard';
import { CreateWhatsAppTemplateDto, UpdateWhatsAppTemplateDto, WhatsAppPreviewDto } from './whatsapp.dto';
import { WhatsAppService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Get('templates')
  @RequirePermissions('whatsapp.open_message')
  templates(@CurrentUser() user: RequestUser) {
    return this.whatsapp.listActive(user);
  }

  @Get('templates/manage')
  @RequirePermissions('whatsapp.manage_templates')
  manageTemplates(@CurrentUser() user: RequestUser) {
    return this.whatsapp.listAll(user);
  }

  @Post('templates')
  @RequirePermissions('whatsapp.manage_templates')
  createTemplate(@CurrentUser() user: RequestUser, @Body() dto: CreateWhatsAppTemplateDto) {
    return this.whatsapp.create(user, dto);
  }

  @Patch('templates/:id')
  @RequirePermissions('whatsapp.manage_templates')
  updateTemplate(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateWhatsAppTemplateDto) {
    return this.whatsapp.update(user, id, dto);
  }

  @Delete('templates/:id')
  @RequirePermissions('whatsapp.manage_templates')
  deleteTemplate(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.whatsapp.remove(user, id);
  }

  @Post('preview')
  @RequirePermissions('whatsapp.open_message')
  preview(@CurrentUser() user: RequestUser, @Body() dto: WhatsAppPreviewDto) {
    return this.whatsapp.preview(user, dto);
  }
}
