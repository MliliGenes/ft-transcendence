import {
  Controller,
  Post,
  Body,
  Header,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Get,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto.js';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto.js';
import { assertTrustedBrowserOrigin } from './browser-origin.js';
import {
  clearRefreshCookie,
  publicSession,
  readRefreshCookie,
  setRefreshCookie,
} from './session-cookie.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @Header('Cache-Control', 'no-store')
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    assertTrustedBrowserOrigin(request, this.config);
    const session = await this.authService.register(dto);
    setRefreshCookie(response, this.config, session.refreshToken);
    return publicSession(session);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    assertTrustedBrowserOrigin(request, this.config);
    const session = await this.authService.login(dto);
    setRefreshCookie(response, this.config, session.refreshToken);
    return publicSession(session);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    assertTrustedBrowserOrigin(request, this.config);
    try {
      const session = await this.authService.refresh({
        refreshToken: readRefreshCookie(request),
      });
      setRefreshCookie(response, this.config, session.refreshToken);
      return publicSession(session);
    } catch (error) {
      if (error instanceof UnauthorizedException)
        clearRefreshCookie(response, this.config);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    assertTrustedBrowserOrigin(request, this.config);
    try {
      const refreshToken = readRefreshCookie(request);
      if (refreshToken) await this.authService.logout({ refreshToken });
    } finally {
      clearRefreshCookie(response, this.config);
    }
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
