import {
  Body,
  Controller,
  Get,
  NotImplementedException,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { ChatService } from './chat.service.js';
import { CreateDmDto } from './dtos/create-dm.dto.js';
import { SendMessageDto } from './dtos/message.dto.js';

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

  @Get('conversations/:conversationId/messages')
  getMessages(@Param('conversationId') _conversationId: string) {
    throw new NotImplementedException();
  }

  @Patch('messages/:messageId')
  editMessage(@Param('messageId') _messageId: string) {
    throw new NotImplementedException();
  }
}
