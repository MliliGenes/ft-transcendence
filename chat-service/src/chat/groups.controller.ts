import {
  Body,
  Controller,
  Delete,
  Get,
  NotImplementedException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { EnsureActiveUserGuard } from './ensure-active-user.guard.js';
import { GroupsService } from './groups.service.js';
import { CreateGroupDto } from './dtos/create-group.dto.js';
import { UpdateGroupDto } from './dtos/update-group.dto.js';

@UseGuards(AuthGuard, EnsureActiveUserGuard)
@Controller('chat/groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  createGroup(
    @Body() createGroupDto: CreateGroupDto,
    @Req() req: Request & { user: { sub: string } },
  ) {
    return this.groupsService.createGroup(createGroupDto, req.user.sub);
  }

  @Get()
  getGroups(@Req() req: Request & { user: { sub: string } }) {
    return this.groupsService.getGroups(req.user.sub);
  }

  @Get('invitations')
  getInvitations() {
    throw new NotImplementedException();
  }

  @Get(':groupId')
  getGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Req() req: Request & { user: { sub: string } },
  ) {
    return this.groupsService.getGroup(groupId, req.user.sub);
  }

  @Patch(':groupId')
  updateGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Req() req: Request & { user: { sub: string } },
    @Body() updateGroupDto: UpdateGroupDto,
  ) {
    return this.groupsService.updateGroup(
      groupId,
      req.user.sub,
      updateGroupDto,
    );
  }

  @Delete(':groupId')
  deleteGroup() {
    throw new NotImplementedException();
  }

  @Get(':groupId/members')
  getMembers() {
    throw new NotImplementedException();
  }

  @Delete(':groupId/members/me')
  leaveGroup() {
    throw new NotImplementedException();
  }

  @Delete(':groupId/members/:userId')
  removeMember() {
    throw new NotImplementedException();
  }

  @Post(':groupId/invitations')
  inviteMember() {
    throw new NotImplementedException();
  }

  @Post(':groupId/invitations/:invitationId/accept')
  acceptInvitation() {
    throw new NotImplementedException();
  }

  // The invitee declines, or an authorized owner/admin revokes the invitation.
  @Delete(':groupId/invitations/:invitationId')
  deleteInvitation() {
    throw new NotImplementedException();
  }

  @Post(':groupId/channels')
  createChannel() {
    throw new NotImplementedException();
  }

  @Get(':groupId/channels')
  getChannels() {
    throw new NotImplementedException();
  }

  @Get(':groupId/channels/:channelId')
  getChannel() {
    throw new NotImplementedException();
  }

  @Patch(':groupId/channels/:channelId')
  updateChannel() {
    throw new NotImplementedException();
  }

  @Delete(':groupId/channels/:channelId')
  deleteChannel() {
    throw new NotImplementedException();
  }
}
