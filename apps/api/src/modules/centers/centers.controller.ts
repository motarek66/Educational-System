import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { RequestUser } from '../../common/guards/auth.guard';
import { CreateCenterDto } from './centers.dto';
import { CentersService } from './centers.service';

@Controller('centers')
export class CentersController {
  constructor(private readonly centers: CentersService) {}

  @Get()
  @RequirePermissions('centers.view')
  list(@CurrentUser() user: RequestUser) { return this.centers.list(user); }

  @Get('options')
  @RequirePermissions('centers.view')
  options(@CurrentUser() user: RequestUser) { return this.centers.options(user); }

  @Get(':id')
  @RequirePermissions('centers.view')
  detail(@CurrentUser() user: RequestUser, @Param('id') id: string) { return this.centers.detail(user, id); }

  @Post()
  @RequirePermissions('centers.create')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCenterDto) { return this.centers.create(user, dto); }
}
