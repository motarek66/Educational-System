import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { RequestUser } from '../../common/guards/auth.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './users.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('users.view')
  list(@CurrentUser() user: RequestUser) {
    return this.usersService.list(user);
  }

  @Post()
  @RequirePermissions('users.create')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user, dto);
  }
}
