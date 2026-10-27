import {
  Controller,
  Get,
  NotImplementedException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

@Controller('chat')
export class ChatController {
  @Post('conversations/dm')
  createOrGetDm() {
    throw new NotImplementedException();
  }

  @Get('conversations')
  getConversations() {
    throw new NotImplementedException();
  }

  @Post('conversations/:conversationId/messages')
  createMessage(@Param('conversationId') _conversationId: string) {
    throw new NotImplementedException();
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
