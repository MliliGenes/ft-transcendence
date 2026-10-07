import {
  Controller,
  Post,
  Body,
  Header,
  HttpCode,
  HttpStatus,
  Get,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto.js';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('register')
  @Header('Cache-Control', 'no-store')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // The refresh token authenticates this request; no access-token guard is needed.
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.authService.logout(dto);
  }

  @Get('verify-email/:token')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async verifyEmail(@Param('token') token: string): Promise<{ verified: boolean }> {
    await this.authService.verifyEmail(token);
    return { verified: true };
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto): Promise<{ requested: boolean }> {
    await this.authService.requestPasswordReset(dto.email);
    return {requested: true};
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto): Promise<{ confirmed: boolean }> {
    await this.authService.confirmPasswordReset(dto.token, dto.newPassword);
    return { confirmed: true };
  }
}
