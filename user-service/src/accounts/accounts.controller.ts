import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Patch,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IMAGE_SETTINGS, type UploadedImage } from './image.constants.js';
import { AccessTokenGuard } from '../auth/guards/access-token.guard.js';
import type { AuthenticatedRequest } from '../auth/guards/access-token.guard.js';
import { AccountsService } from './accounts.service.js';
import { PaginationDto } from './dto/pagination.dto.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';
import {
  SetPasswordDto,
  UpdatePasswordDto,
} from './dto/update-password.dto.js';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @Header('Cache-Control', 'no-store')
  getMe(@Req() request: AuthenticatedRequest) {
    return this.accountsService.getMe(request.user.sub);
  }

  @Patch('me')
  @UseGuards(AccessTokenGuard)
  @Header('Cache-Control', 'no-store')
  updateMe(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.updateMe(request.user.sub, dto);
  }

  @Patch('me/password')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async updatePassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdatePasswordDto,
  ): Promise<void> {
    await this.accountsService.updatePassword(request.user.sub, dto);
  }

  @Post('me/password')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async setPassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SetPasswordDto,
  ): Promise<void> {
    await this.accountsService.setPassword(request.user.sub, dto);
  }

  @Delete('me')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async deleteMe(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.accountsService.deleteMe(request.user.sub);
  }

  @Put('me/avatar')
  @UseGuards(AccessTokenGuard)
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: IMAGE_SETTINGS.AVATAR.maxBytes, files: 1, fields: 0 },
    }),
  )
  uploadAvatar(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file?: UploadedImage,
  ) {
    return this.accountsService.storeImage(request.user.sub, 'AVATAR', file);
  }

  @Put('me/banner')
  @UseGuards(AccessTokenGuard)
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: IMAGE_SETTINGS.BANNER.maxBytes, files: 1, fields: 0 },
    }),
  )
  uploadBanner(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file?: UploadedImage,
  ) {
    return this.accountsService.storeImage(request.user.sub, 'BANNER', file);
  }

  @Delete('me/avatar')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async removeAvatar(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.accountsService.removeImage(request.user.sub, 'AVATAR');
  }

  @Delete('me/banner')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async removeBanner(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.accountsService.removeImage(request.user.sub, 'BANNER');
  }

  @Get()
  getUsers(@Query() query: PaginationDto) {
    return this.accountsService.getUsers(query);
  }

  @Get('search')
  searchUsers(@Query('username') username: string) {
    return this.accountsService.searchUsersByUsername(username);
  }

  // Keep the literal /me route above this parameter route.
  @Get(':id')
  getUser(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.accountsService.getUser(id);
  }
}
