import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  HttpException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { DiscordStrategy } from './strategies/discord.strategy.js';
import { AuthService } from './auth.service.js';
import {
  AccessTokenGuard,
  type AuthenticatedRequest,
} from './guards/access-token.guard.js';

@Controller('auth/discord')
export class DiscordController {
  constructor(
    private readonly discord: DiscordStrategy,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  async login(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    try {
      response.redirect(await this.discord.authorize(response));
    } catch (error) {
      this.oauthError(error, request, response, 'login');
    }
  }

  @Post('link')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  async link(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return {
      authorizationUrl: await this.discord.authorizeLink(
        request.user.sub,
        response,
      ),
    };
  }

  @Delete('link')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @Header('Cache-Control', 'no-store')
  async unlink(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.auth.unlinkDiscord(request.user.sub);
  }

  @Get('link/callback')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  async linkCallback(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const { userId, profile } = await this.discord.authenticateLink(
        request,
        response,
      );
      const result = await this.auth.linkDiscord(userId, profile);
      if (request.headers.accept?.includes('text/html')) {
        const redirect = this.frontendUrl();
        redirect.hash = new URLSearchParams({
          providerLinked: 'discord',
        }).toString();
        return response.redirect(redirect.toString());
      }
      return result;
    } catch (error) {
      return this.oauthError(error, request, response, 'link');
    }
  }

  @Get('callback')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  async callback(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const profile = await this.discord.authenticate(request, response);
      const tokens = await this.auth.loginWithDiscord(profile);
      if (request.headers.accept?.includes('text/html')) {
        const redirect = this.frontendUrl();
        redirect.hash = new URLSearchParams({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        }).toString();
        return response.redirect(redirect.toString());
      }
      return tokens;
    } catch (error) {
      return this.oauthError(error, request, response, 'login');
    }
  }

  private oauthError(
    error: unknown,
    request: Request,
    response: Response,
    flow: 'login' | 'link',
  ): void {
    if (!request.headers.accept?.includes('text/html')) throw error;
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const code =
      status === 409
        ? 'conflict'
        : status === 401
          ? 'authorization'
          : status === 503
            ? 'configuration'
            : 'unavailable';
    const redirect = this.frontendUrl();
    // Only stable error codes reach the browser; provider responses stay private.
    redirect.hash = new URLSearchParams({
      oauthError: code,
      oauthFlow: flow,
    }).toString();
    response.redirect(redirect.toString());
  }

  private frontendUrl(): URL {
    return new URL(
      this.config.get<string>('AUTH_FRONTEND_URL')?.trim() ||
        'http://localhost:5173',
    );
  }
}
