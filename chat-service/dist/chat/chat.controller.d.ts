import { ChatService } from './chat.service.js';
import { CreateDmDto } from './dtos/create-dm.dto.js';
import { SendMessageDto } from './dtos/message.dto.js';
import { GetMessagesQueryDto } from './dtos/get-messages-query.dto.js';
import { MarkReadDto } from './dtos/mark-read.dto.js';
import { EditMessageDto } from './dtos/edit-message.dto.js';
import { CreateAttachmentUploadUrlDto } from './dtos/create-attachment-upload-url.dto.js';
import type { Request as ExpressRequest } from 'express';
export declare class ChatController {
    private readonly chatService;
    constructor(chatService: ChatService);
    createOrGetDm(req: ExpressRequest & {
        user: {
            sub: string;
        };
    }, body: CreateDmDto): Promise<{
        id: string;
        name: string | null;
        createdAt: Date;
        updatedAt: Date;
        groupId: string | null;
        kind: import("../generated/prisma/enums.js").ConversationKind;
        dmUserAId: string | null;
        dmUserBId: string | null;
        topic: string | null;
    }>;
    getConversations(req: ExpressRequest & {
        user: {
            sub: string;
        };
    }): Promise<{
        lastReadMessageId: string | null;
        unreadCount: number;
        dmUserA: {
            id: string;
            username: string | null;
            displayName: string | null;
            avatarUrl: string | null;
        } | null;
        dmUserB: {
            id: string;
            username: string | null;
            displayName: string | null;
            avatarUrl: string | null;
        } | null;
        id: string;
        name: string | null;
        createdAt: Date;
        updatedAt: Date;
        groupId: string | null;
        kind: import("../generated/prisma/enums.js").ConversationKind;
        dmUserAId: string | null;
        dmUserBId: string | null;
        topic: string | null;
    }[]>;
    createMessage(req: ExpressRequest & {
        user: {
            sub: string;
        };
    }, _conversationId: string, message: SendMessageDto): Promise<{
        author: {
            id: string;
            username: string | null;
            displayName: string | null;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        deletedAt: Date | null;
        createdAt: Date;
        conversationId: string;
        authorId: string;
        content: string | null;
        attachments: string[];
        editedAt: Date | null;
        clientRequestId: string;
        requestHash: string;
        version: number;
    }>;
    createAttachmentUploadUrl(req: ExpressRequest & {
        user: {
            sub: string;
        };
    }, conversationId: string, body: CreateAttachmentUploadUrlDto): Promise<{
        objectKey: string;
        uploadUrl: string;
        method: "POST";
        fields: {
            [key: string]: any;
        };
        expiresInSeconds: number;
        maxBytes: number;
    }>;
    createAttachmentDownloadUrl(req: ExpressRequest & {
        user: {
            sub: string;
        };
    }, conversationId: string, objectKey: string): Promise<{
        url: string;
    }>;
    createAttachmentPreviewUrl(req: ExpressRequest & {
        user: {
            sub: string;
        };
    }, conversationId: string, objectKey: string): Promise<{
        contentType: string;
        previewUrl: string | null;
    }>;
    getMessages(req: ExpressRequest & {
        user: {
            sub: string;
        };
    }, conversationId: string, query: GetMessagesQueryDto): Promise<({
        author: {
            id: string;
            username: string | null;
            displayName: string | null;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        deletedAt: Date | null;
        createdAt: Date;
        conversationId: string;
        authorId: string;
        content: string | null;
        attachments: string[];
        editedAt: Date | null;
        clientRequestId: string;
        requestHash: string;
        version: number;
    })[]>;
    markRead(req: ExpressRequest & {
        user: {
            sub: string;
        };
    }, conversationId: string, body: MarkReadDto): Promise<void>;
    editMessage(req: ExpressRequest & {
        user: {
            sub: string;
        };
    }, messageId: string, body: EditMessageDto): Promise<{
        author: {
            id: string;
            username: string | null;
            displayName: string | null;
            avatarUrl: string | null;
        };
    } & {
        id: string;
        deletedAt: Date | null;
        createdAt: Date;
        conversationId: string;
        authorId: string;
        content: string | null;
        attachments: string[];
        editedAt: Date | null;
        clientRequestId: string;
        requestHash: string;
        version: number;
    }>;
    deleteMessage(req: ExpressRequest & {
        user: {
            sub: string;
        };
    }, messageId: string): Promise<void>;
}
