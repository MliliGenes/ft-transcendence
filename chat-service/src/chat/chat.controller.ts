import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { ChatService } from './chat.service.js';
import { CreateDmDto } from './dtos/create-dm.dto.js';
import { SendMessageDto } from './dtos/message.dto.js';
import { GetMessagesQueryDto } from './dtos/get-messages-query.dto.js';
import { MarkReadDto } from './dtos/mark-read.dto.js';
import { EditMessageDto } from './dtos/edit-message.dto.js';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService
  ) {}

  @UseGuards(AuthGuard)
  @Post('conversations/dm')
  createOrGetDm(@Request() req: Request & { user: { sub: string } }, @Body() body: CreateDmDto) {
    return this.chatService.createOrGetDm( req.user.sub, body.userId);
  }

  @UseGuards(AuthGuard)
  @Get('conversations')
  getConversations(@Request() req: Request & { user: { sub: string } }) {
    return this.chatService.getConversations(req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Post('conversations/:conversationId/messages')
  createMessage(
    @Request() req: Request & { user: { sub: string } },
    @Param('conversationId') _conversationId: string,
    @Body() message: SendMessageDto
  ) {
    return this.chatService.sendMessage(req.user.sub, message, _conversationId);
  }

  @UseGuards(AuthGuard)
  @Get('conversations/:conversationId/messages')
  getMessages(
    @Request() req: Request & { user: { sub: string } },
    @Param('conversationId', new ParseUUIDPipe({ version: '4' })) conversationId: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.chatService.getMessages(req.user.sub, conversationId, query);
  }

  @UseGuards(AuthGuard)
  @Patch('conversations/:conversationId/read-state')
  markRead(
    @Request() req: Request & { user: { sub: string } },
    @Param('conversationId', new ParseUUIDPipe({ version: '4' })) conversationId: string,
    @Body() body: MarkReadDto,
  ) {
    return this.chatService.markRead(req.user.sub, conversationId, body.messageId);
  }

  @UseGuards(AuthGuard)
  @Patch('messages/:messageId')
  editMessage(
    @Request() req: Request & { user: { sub: string } },
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
    @Body() body: EditMessageDto,
  ) {
    return this.chatService.editMessage(req.user.sub, messageId, body);
  }
}
