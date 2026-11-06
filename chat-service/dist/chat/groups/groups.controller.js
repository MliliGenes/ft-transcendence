var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Request, UseGuards, } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard.js';
import { EnsureActiveUserGuard } from '../ensure-active-user.guard.js';
import { GroupsService } from './groups.service.js';
import { CreateGroupDto } from './dtos/create-group.dto.js';
import { UpdateGroupDto } from './dtos/update-group.dto.js';
import { CreateChannelDto } from './dtos/create-channel.dto.js';
import { UpdateChannelDto } from './dtos/update-channel.dto.js';
import { AddGroupMemberDto } from './dtos/add-group-member.dto.js';
import { UpdateGroupMemberRoleDto } from './dtos/update-group-member-role.dto.js';
let GroupsController = class GroupsController {
    groupsService;
    constructor(groupsService) {
        this.groupsService = groupsService;
    }
    createGroup(body, req) {
        return this.groupsService.createGroup(body, req.user.sub);
    }
    getGroups(req) {
        return this.groupsService.getGroups(req.user.sub);
    }
    getGroup(groupId, req) {
        return this.groupsService.getGroup(groupId, req.user.sub);
    }
    updateGroup(groupId, body, req) {
        return this.groupsService.updateGroup(groupId, req.user.sub, body);
    }
    deleteGroup(groupId, req) {
        return this.groupsService.deleteGroup(groupId, req.user.sub);
    }
    getMembers(groupId, req) {
        return this.groupsService.getMembers(groupId, req.user.sub);
    }
    addMember(groupId, body, req) {
        return this.groupsService.addMember(groupId, req.user.sub, body.userId);
    }
    updateMemberRole(groupId, userId, body, req) {
        return this.groupsService.updateMemberRole(groupId, req.user.sub, userId, body.role);
    }
    leaveGroup(groupId, req) {
        return this.groupsService.removeMember(groupId, req.user.sub, req.user.sub);
    }
    removeMember(groupId, userId, req) {
        return this.groupsService.removeMember(groupId, req.user.sub, userId);
    }
    createChannel(groupId, body, req) {
        return this.groupsService.createChannel(groupId, req.user.sub, body);
    }
    getChannels(groupId, req) {
        return this.groupsService.getChannels(groupId, req.user.sub);
    }
    getChannel(groupId, channelId, req) {
        return this.groupsService.getChannel(groupId, channelId, req.user.sub);
    }
    updateChannel(groupId, channelId, body, req) {
        return this.groupsService.updateChannel(groupId, channelId, req.user.sub, body);
    }
    deleteChannel(groupId, channelId, req) {
        return this.groupsService.deleteChannel(groupId, channelId, req.user.sub);
    }
};
__decorate([
    Post(),
    __param(0, Body()),
    __param(1, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateGroupDto, Object]),
    __metadata("design:returntype", void 0)
], GroupsController.prototype, "createGroup", null);
__decorate([
    Get(),
    __param(0, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GroupsController.prototype, "getGroups", null);
__decorate([
    Get(':groupId'),
    __param(0, Param('groupId', ParseUUIDPipe)),
    __param(1, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], GroupsController.prototype, "getGroup", null);
__decorate([
    Patch(':groupId'),
    __param(0, Param('groupId', ParseUUIDPipe)),
    __param(1, Body()),
    __param(2, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateGroupDto, Object]),
    __metadata("design:returntype", void 0)
], GroupsController.prototype, "updateGroup", null);
__decorate([
    Delete(':groupId'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, Param('groupId', ParseUUIDPipe)),
    __param(1, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], GroupsController.prototype, "deleteGroup", null);
__decorate([
    Get(':groupId/members'),
    __param(0, Param('groupId', ParseUUIDPipe)),
    __param(1, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], GroupsController.prototype, "getMembers", null);
__decorate([
    Post(':groupId/members'),
    __param(0, Param('groupId', ParseUUIDPipe)),
    __param(1, Body()),
    __param(2, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, AddGroupMemberDto, Object]),
    __metadata("design:returntype", void 0)
], GroupsController.prototype, "addMember", null);
__decorate([
    Patch(':groupId/members/:userId/role'),
    __param(0, Param('groupId', ParseUUIDPipe)),
    __param(1, Param('userId', ParseUUIDPipe)),
    __param(2, Body()),
    __param(3, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, UpdateGroupMemberRoleDto, Object]),
    __metadata("design:returntype", void 0)
], GroupsController.prototype, "updateMemberRole", null);
__decorate([
    Delete(':groupId/members/me'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, Param('groupId', ParseUUIDPipe)),
    __param(1, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], GroupsController.prototype, "leaveGroup", null);
__decorate([
    Delete(':groupId/members/:userId'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, Param('groupId', ParseUUIDPipe)),
    __param(1, Param('userId', ParseUUIDPipe)),
    __param(2, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], GroupsController.prototype, "removeMember", null);
__decorate([
    Post(':groupId/channels'),
    __param(0, Param('groupId', ParseUUIDPipe)),
    __param(1, Body()),
    __param(2, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, CreateChannelDto, Object]),
    __metadata("design:returntype", void 0)
], GroupsController.prototype, "createChannel", null);
__decorate([
    Get(':groupId/channels'),
    __param(0, Param('groupId', ParseUUIDPipe)),
    __param(1, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], GroupsController.prototype, "getChannels", null);
__decorate([
    Get(':groupId/channels/:channelId'),
    __param(0, Param('groupId', ParseUUIDPipe)),
    __param(1, Param('channelId', ParseUUIDPipe)),
    __param(2, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], GroupsController.prototype, "getChannel", null);
__decorate([
    Patch(':groupId/channels/:channelId'),
    __param(0, Param('groupId', ParseUUIDPipe)),
    __param(1, Param('channelId', ParseUUIDPipe)),
    __param(2, Body()),
    __param(3, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, UpdateChannelDto, Object]),
    __metadata("design:returntype", void 0)
], GroupsController.prototype, "updateChannel", null);
__decorate([
    Delete(':groupId/channels/:channelId'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, Param('groupId', ParseUUIDPipe)),
    __param(1, Param('channelId', ParseUUIDPipe)),
    __param(2, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], GroupsController.prototype, "deleteChannel", null);
GroupsController = __decorate([
    UseGuards(AuthGuard, EnsureActiveUserGuard),
    Controller('chat/groups'),
    __metadata("design:paramtypes", [GroupsService])
], GroupsController);
export { GroupsController };
//# sourceMappingURL=groups.controller.js.map