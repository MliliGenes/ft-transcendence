import { PrismaService } from '../prisma/prisma.service.js';
import { SendMessageDto } from './dtos/message.dto.js';
import { GetMessagesQueryDto } from './dtos/get-messages-query.dto.js';
import { EditMessageDto } from './dtos/edit-message.dto.js';
import { ChatGateway } from './gateway/chat.gateway.js';
import { UserProfilesService } from './user-profiles.service.js';
import { MinioService } from '../minio/minio.service.js';
export declare class ChatService {
    private readonly prisma;
    private readonly chatGateway;
    private readonly userProfiles;
    private readonly minio;
    constructor(prisma: PrismaService, chatGateway: ChatGateway, userProfiles: UserProfilesService, minio: MinioService);
    createAttachmentUploadUrl(userId: string, conversationId: string, authorization: string, contentType: string): Promise<{
        objectKey: string;
        uploadUrl: string;
        method: "POST";
        fields: {
            [key: string]: any;
        };
        expiresInSeconds: number;
        maxBytes: number;
    }>;
    createAttachmentDownloadUrl(userId: string, conversationId: string, objectKey: string, authorization: string): Promise<{
        url: string;
    }>;
    createAttachmentPreviewUrl(userId: string, conversationId: string, objectKey: string, authorization: string): Promise<{
        contentType: string;
        previewUrl: string | null;
    }>;
    private assertAttachmentAccessible;
    getMessages(userId: string, conversationId: string, _query: GetMessagesQueryDto): Promise<({
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
    createOrGetDm(userId: string, otherUserId: string, authorization: string): Promise<{
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
    getConversations(userId: string): Promise<{
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
    sendMessage(userId: string, msg: SendMessageDto, conversationId: string, authorization?: string): Promise<{
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
    private getAccessibleConversation;
    editMessage(userId: string, messageId: string, body: EditMessageDto): Promise<{
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
    deleteMessage(userId: string, messageId: string): Promise<void>;
    markRead(userId: string, conversationId: string, _messageId: string): Promise<void>;
}
