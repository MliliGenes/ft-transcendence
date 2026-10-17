import { Controller, Get, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from './access-token.guard.js';

@Controller('session')
export class SessionController {
  @Get()
  getSession(@Req() request: AuthenticatedRequest) {
    return { userId: request.userId };
  }
}
