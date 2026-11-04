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
  Request,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { AuthGuard } from '../../auth/auth.guard.js';
import { EnsureActiveUserGuard } from '../ensure-active-user.guard.js';
import { GroupsService } from './groups.service.js';
import { CreateGroupDto } from './dtos/create-group.dto.js';
import { UpdateGroupDto } from './dtos/update-group.dto.js';
import { CreateChannelDto } from './dtos/create-channel.dto.js';
import { UpdateChannelDto } from './dtos/update-channel.dto.js';
import { AddGroupMemberDto } from './dtos/add-group-member.dto.js';
import { UpdateGroupMemberRoleDto } from './dtos/update-group-member-role.dto.js';

type AuthenticatedRequest = ExpressRequest & { user: { sub: string } };

@UseGuards(AuthGuard, EnsureActiveUserGuard)
@Controller('chat/groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  createGroup(
    @Body() body: CreateGroupDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.createGroup(body, req.user.sub);
  }

  @Get()
  getGroups(@Request() req: AuthenticatedRequest) {
    return this.groupsService.getGroups(req.user.sub);
  }

  @Get(':groupId')
  getGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.getGroup(groupId, req.user.sub);
  }

  @Patch(':groupId')
  updateGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() body: UpdateGroupDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.updateGroup(groupId, req.user.sub, body);
  }

  @Delete(':groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.deleteGroup(groupId, req.user.sub);
  }

  @Get(':groupId/members')
  getMembers(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.getMembers(groupId, req.user.sub);
  }

  @Post(':groupId/members')
  addMember(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() body: AddGroupMemberDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.addMember(groupId, req.user.sub, body.userId);
  }

  @Patch(':groupId/members/:userId/role')
  updateMemberRole(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: UpdateGroupMemberRoleDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.updateMemberRole(
      groupId,
      req.user.sub,
      userId,
      body.role,
    );
  }

  @Delete(':groupId/members/me')
  @HttpCode(HttpStatus.NO_CONTENT)
  leaveGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.removeMember(groupId, req.user.sub, req.user.sub);
  }

  @Delete(':groupId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.removeMember(groupId, req.user.sub, userId);
  }

  @Post(':groupId/channels')
  createChannel(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() body: CreateChannelDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.createChannel(groupId, req.user.sub, body);
  }

  @Get(':groupId/channels')
  getChannels(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.getChannels(groupId, req.user.sub);
  }

  @Get(':groupId/channels/:channelId')
  getChannel(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.getChannel(groupId, channelId, req.user.sub);
  }

  @Patch(':groupId/channels/:channelId')
  updateChannel(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Body() body: UpdateChannelDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.updateChannel(
      groupId,
      channelId,
      req.user.sub,
      body,
    );
  }

  @Delete(':groupId/channels/:channelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteChannel(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.deleteChannel(groupId, channelId, req.user.sub);
  }
}
