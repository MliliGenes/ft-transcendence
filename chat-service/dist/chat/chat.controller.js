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
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Request, UseGuards, } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { EnsureActiveUserGuard } from './ensure-active-user.guard.js';
import { ChatService } from './chat.service.js';
import { CreateDmDto } from './dtos/create-dm.dto.js';
import { SendMessageDto } from './dtos/message.dto.js';
import { GetMessagesQueryDto } from './dtos/get-messages-query.dto.js';
import { MarkReadDto } from './dtos/mark-read.dto.js';
import { EditMessageDto } from './dtos/edit-message.dto.js';
import { CreateAttachmentUploadUrlDto } from './dtos/create-attachment-upload-url.dto.js';
let ChatController = class ChatController {
    chatService;
    constructor(chatService) {
        this.chatService = chatService;
    }
    createOrGetDm(req, body) {
        return this.chatService.createOrGetDm(req.user.sub, body.userId, req.headers.authorization ?? '');
    }
    getConversations(req) {
        return this.chatService.getConversations(req.user.sub);
    }
    createMessage(req, _conversationId, message) {
        return this.chatService.sendMessage(req.user.sub, message, _conversationId, req.headers.authorization ?? '');
    }
    createAttachmentUploadUrl(req, conversationId, body) {
        return this.chatService.createAttachmentUploadUrl(req.user.sub, conversationId, req.headers.authorization ?? '', body.contentType);
    }
    createAttachmentDownloadUrl(req, conversationId, objectKey) {
        return this.chatService.createAttachmentDownloadUrl(req.user.sub, conversationId, objectKey, req.headers.authorization ?? '');
    }
    createAttachmentPreviewUrl(req, conversationId, objectKey) {
        return this.chatService.createAttachmentPreviewUrl(req.user.sub, conversationId, objectKey, req.headers.authorization ?? '');
    }
    getMessages(req, conversationId, query) {
        return this.chatService.getMessages(req.user.sub, conversationId, query);
    }
    markRead(req, conversationId, body) {
        return this.chatService.markRead(req.user.sub, conversationId, body.messageId);
    }
    editMessage(req, messageId, body) {
        return this.chatService.editMessage(req.user.sub, messageId, body);
    }
    deleteMessage(req, messageId) {
        return this.chatService.deleteMessage(req.user.sub, messageId);
    }
};
__decorate([
    Post('conversations/dm'),
    __param(0, Request()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateDmDto]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "createOrGetDm", null);
__decorate([
    Get('conversations'),
    __param(0, Request()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "getConversations", null);
__decorate([
    Post('conversations/:conversationId/messages'),
    __param(0, Request()),
    __param(1, Param('conversationId')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, SendMessageDto]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "createMessage", null);
__decorate([
    Post('conversations/:conversationId/attachments/upload-url'),
    __param(0, Request()),
    __param(1, Param('conversationId', new ParseUUIDPipe({ version: '4' }))),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, CreateAttachmentUploadUrlDto]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "createAttachmentUploadUrl", null);
__decorate([
    Get('conversations/:conversationId/attachments/download-url'),
    __param(0, Request()),
    __param(1, Param('conversationId', new ParseUUIDPipe({ version: '4' }))),
    __param(2, Query('objectKey')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "createAttachmentDownloadUrl", null);
__decorate([
    Get('conversations/:conversationId/attachments/preview-url'),
    __param(0, Request()),
    __param(1, Param('conversationId', new ParseUUIDPipe({ version: '4' }))),
    __param(2, Query('objectKey')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "createAttachmentPreviewUrl", null);
__decorate([
    Get('conversations/:conversationId/messages'),
    __param(0, Request()),
    __param(1, Param('conversationId', new ParseUUIDPipe({ version: '4' }))),
    __param(2, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, GetMessagesQueryDto]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "getMessages", null);
__decorate([
    Patch('conversations/:conversationId/read-state'),
    __param(0, Request()),
    __param(1, Param('conversationId', new ParseUUIDPipe({ version: '4' }))),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, MarkReadDto]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "markRead", null);
__decorate([
    Patch('messages/:messageId'),
    __param(0, Request()),
    __param(1, Param('messageId', new ParseUUIDPipe({ version: '4' }))),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, EditMessageDto]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "editMessage", null);
__decorate([
    Delete('messages/:messageId'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, Request()),
    __param(1, Param('messageId', new ParseUUIDPipe({ version: '4' }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "deleteMessage", null);
ChatController = __decorate([
    Controller('chat'),
    UseGuards(AuthGuard, EnsureActiveUserGuard),
    __metadata("design:paramtypes", [ChatService])
], ChatController);
export { ChatController };
//# sourceMappingURL=chat.controller.js.map