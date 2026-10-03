import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guards/access-token.guard.js';
import { Request } from 'express';
import { FriendshipsService } from './friendships.service.js';

type GetFriendshipsRequest = Request & {
  user: {
    sub: string;
  };
};

@Controller('social')
@UseGuards(AccessTokenGuard)
export class SocialController {
  constructor(
    private readonly friendshipsService: FriendshipsService
  ) {}

  @Post('friendships/:id')
  createFriendship(@Req() request: GetFriendshipsRequest, @Param('id') id: string) {
    return this.friendshipsService.createFriendship(request.user.sub, id);
  }

  @Get('friendships')
  getFriendships(@Req() request: GetFriendshipsRequest) {
    return this.friendshipsService.getFriendships(request.user.sub);
  }

  @Get('friendships/requests')
  getFriendshipRequests(@Req() request: GetFriendshipsRequest) {
    return this.friendshipsService.getFriendshipRequests(request.user.sub);
  }

  @Get('friendships/sent')
  getSentFriendships(@Req() request: GetFriendshipsRequest) {
    return this.friendshipsService.getSentFriendships(request.user.sub);
  }

  @Patch('friendships/:friendshipId/accept')
  acceptFriendship(
    @Req() request: GetFriendshipsRequest,
    @Param('friendshipId') friendshipId: string,
  ) {
    return this.friendshipsService.acceptFriendship(
      friendshipId,
      request.user.sub,
    );
  }

  @Patch('friendships/:friendshipId/reject')
  rejectFriendship(
    @Req() request: GetFriendshipsRequest,
    @Param('friendshipId') friendshipId: string,
  ) {
    return this.friendshipsService.rejectFriendship(
      friendshipId,
      request.user.sub,
    );
  }

  @Delete('friendships/:friendshipId')
  deleteFriendship(
    @Req() request: GetFriendshipsRequest,
    @Param('friendshipId') friendshipId: string,
  ) {
    return this.friendshipsService.deleteFriendship(
      friendshipId,
      request.user.sub,
    );
  }
}
