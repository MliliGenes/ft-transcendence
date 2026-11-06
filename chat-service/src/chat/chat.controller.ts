import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { EnsureActiveUserGuard } from './ensure-active-user.guard.js';
import { ChatService } from './chat.service.js';
import { CreateDmDto } from './dtos/create-dm.dto.js';
import { SendMessageDto } from './dtos/message.dto.js';
import { GetMessagesQueryDto } from './dtos/get-messages-query.dto.js';
import { MarkReadDto } from './dtos/mark-read.dto.js';
import { EditMessageDto } from './dtos/edit-message.dto.js';
import { CreateAttachmentUploadUrlDto } from './dtos/create-attachment-upload-url.dto.js';
import type { Request as ExpressRequest } from 'express';

@Controller('chat')
@UseGuards(AuthGuard, EnsureActiveUserGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService
  ) {}

  @Post('conversations/dm')
  createOrGetDm(@Request() req: ExpressRequest & { user: { sub: string } }, @Body() body: CreateDmDto) {
    return this.chatService.createOrGetDm(
      req.user.sub,
      body.userId,
      req.headers.authorization ?? '',
    );
  }

  @Get('conversations')
  getConversations(@Request() req: ExpressRequest & { user: { sub: string } }) {
    return this.chatService.getConversations(req.user.sub);
  }

  @Post('conversations/:conversationId/messages')
  createMessage(
    @Request() req: ExpressRequest & { user: { sub: string } },
    @Param('conversationId') _conversationId: string,
    @Body() message: SendMessageDto
  ) {
    return this.chatService.sendMessage(
      req.user.sub,
      message,
      _conversationId,
      req.headers.authorization ?? '',
    );
  }

  @Post('conversations/:conversationId/attachments/upload-url')
  createAttachmentUploadUrl(
    @Request() req: ExpressRequest & { user: { sub: string } },
    @Param('conversationId', new ParseUUIDPipe({ version: '4' })) conversationId: string,
    @Body() body: CreateAttachmentUploadUrlDto,
  ) {
    return this.chatService.createAttachmentUploadUrl(
      req.user.sub,
      conversationId,
      req.headers.authorization ?? '',
      body.contentType,
    );
  }

  @Get('conversations/:conversationId/attachments/download-url')
  createAttachmentDownloadUrl(
    @Request() req: ExpressRequest & { user: { sub: string } },
    @Param('conversationId', new ParseUUIDPipe({ version: '4' })) conversationId: string,
    @Query('objectKey') objectKey: string,
  ) {
    return this.chatService.createAttachmentDownloadUrl(
      req.user.sub,
      conversationId,
      objectKey,
      req.headers.authorization ?? '',
    );
  }

  @Get('conversations/:conversationId/attachments/preview-url')
  createAttachmentPreviewUrl(
    @Request() req: ExpressRequest & { user: { sub: string } },
    @Param('conversationId', new ParseUUIDPipe({ version: '4' })) conversationId: string,
    @Query('objectKey') objectKey: string,
  ) {
    return this.chatService.createAttachmentPreviewUrl(
      req.user.sub,
      conversationId,
      objectKey,
      req.headers.authorization ?? '',
    );
  }

  @Get('conversations/:conversationId/messages')
  getMessages(
    @Request() req: ExpressRequest & { user: { sub: string } },
    @Param('conversationId', new ParseUUIDPipe({ version: '4' })) conversationId: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.chatService.getMessages(req.user.sub, conversationId, query);
  }

  @Patch('conversations/:conversationId/read-state')
  markRead(
    @Request() req: ExpressRequest & { user: { sub: string } },
    @Param('conversationId', new ParseUUIDPipe({ version: '4' })) conversationId: string,
    @Body() body: MarkReadDto,
  ) {
    return this.chatService.markRead(req.user.sub, conversationId, body.messageId);
  }

  @Patch('messages/:messageId')
  editMessage(
    @Request() req: ExpressRequest & { user: { sub: string } },
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
    @Body() body: EditMessageDto,
  ) {
    return this.chatService.editMessage(req.user.sub, messageId, body);
  }

  @Delete('messages/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMessage(
    @Request() req: ExpressRequest & { user: { sub: string } },
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
  ) {
    return this.chatService.deleteMessage(req.user.sub, messageId);
  }
}
