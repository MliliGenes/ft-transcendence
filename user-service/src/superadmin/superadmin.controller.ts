import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/guards/access-token.guard.js';
import { SuperadminService } from './superadmin.service.js';
import { UserQueryDto } from './dto/user-query.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { UpdateAccountDto } from '../accounts/dto/update-account.dto.js';
import { AccessTokenGuard } from '../auth/guards/access-token.guard.js';
import { SuperadminGuard } from './guards/superadmin.guard.js';

@Controller('superadmin')
@UseGuards(AccessTokenGuard, SuperadminGuard)
export class SuperadminController {
  constructor(private readonly service: SuperadminService) {}

  @Get('stats')
  @Header('Cache-Control', 'no-store')
  getStats() {
    return this.service.getStats();
  }

  @Get('users')
  @Header('Cache-Control', 'no-store')
  getUsers(@Query() query: UserQueryDto) {
    return this.service.getUsers(query);
  }

  @Get('users/:id')
  @Header('Cache-Control', 'no-store')
  getUser(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getUser(id);
  }

  @Post('users')
  @Header('Cache-Control', 'no-store')
  createUser(@Req() req: AuthenticatedRequest, @Body() dto: CreateUserDto) {
    return this.service.createUser(req.user.sub, dto);
  }

  @Patch('users/:id')
  @Header('Cache-Control', 'no-store')
  updateUser(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.service.updateUser(req.user.sub, id, dto);
  }

  @Patch('users/:id/role')
  @Header('Cache-Control', 'no-store')
  updateRole(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.service.updateRole(req.user.sub, id, dto);
  }

  @Delete('users/:id')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async deleteUser(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.service.deleteUser(req.user.sub, id);
  }
}
