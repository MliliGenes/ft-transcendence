import { Controller, Get, Header, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DiscordStrategy } from './strategies/discord.strategy.js';
import { AuthService } from './auth.service.js';

@Controller('auth/discord')
export class DiscordController {
  constructor(
    private readonly discord: DiscordStrategy,
    private readonly auth: AuthService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  async login(@Res() response: Response): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.redirect(await this.discord.authorize(response));
  }

  @Get('callback')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  async callback(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const profile = await this.discord.authenticate(request, response);
    return this.auth.loginWithDiscord(profile);
  }
}
