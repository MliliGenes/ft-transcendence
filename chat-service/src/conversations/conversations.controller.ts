import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { AuthenticatedRequest } from '../auth/access-token.guard.js';
import { ConversationsService } from './conversations.service.js';
import { readPage } from './pagination.js';

function bodyFields(body: unknown, fields: string[]): Record<string, unknown> {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !fields.includes(key)) ||
    fields.some((key) => !Object.hasOwn(body, key))
  )
    throw new BadRequestException('Provide only the required request fields');
  return body as Record<string, unknown>;
}
function uuid(value: unknown) {
  if (typeof value !== 'string' || !isUUID(value))
    throw new BadRequestException('A valid user/request UUID is required');
  return value.toLowerCase();
}

@Controller('chat')
export class ConversationsController {
  constructor(
    @Inject(ConversationsService)
    private readonly conversations: ConversationsService,
  ) {}

  @Post('dms')
  open(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const fields = bodyFields(body, ['userId']);
    return this.conversations.openDm(req.userId, uuid(fields.userId));
  }

  @Get('conversations')
  list(
    @Req() req: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.conversations.list(
      req.userId,
      readPage(query, 'conversations:' + req.userId),
    );
  }

  @Get('conversations/:id/messages')
  history(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.conversations.history(
      req.userId,
      id.toLowerCase(),
      readPage(query, 'messages:' + id.toLowerCase()),
    );
  }

  @Post('conversations/:id/messages')
  send(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const fields = bodyFields(body, ['content', 'clientRequestId']);
    if (typeof fields.content !== 'string')
      throw new BadRequestException('content must be plain text');
    const content = fields.content.trim();
    const length = [...content].length;
    if (length < 1 || length > 2000 || content.includes('\u0000'))
      throw new BadRequestException(
        'content must contain 1 to 2000 characters after trimming, without NUL',
      );
    return this.conversations.send(
      req.userId,
      id.toLowerCase(),
      content,
      uuid(fields.clientRequestId),
    );
  }
}
