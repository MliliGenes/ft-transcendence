import * as runtime from "@prisma/client/runtime/index-browser";
export type * from '../models.js';
export type * from './prismaNamespace.js';
export declare const Decimal: typeof runtime.Decimal;
export declare const NullTypes: {
    DbNull: (new (secret: never) => typeof runtime.DbNull);
    JsonNull: (new (secret: never) => typeof runtime.JsonNull);
    AnyNull: (new (secret: never) => typeof runtime.AnyNull);
};
export declare const DbNull: import("@prisma/client-runtime-utils").DbNullClass;
export declare const JsonNull: import("@prisma/client-runtime-utils").JsonNullClass;
export declare const AnyNull: import("@prisma/client-runtime-utils").AnyNullClass;
export declare const ModelName: {
    readonly ChatUser: "ChatUser";
    readonly Group: "Group";
    readonly GroupMember: "GroupMember";
    readonly Conversation: "Conversation";
    readonly ConversationReadState: "ConversationReadState";
    readonly Message: "Message";
    readonly Reaction: "Reaction";
};
export type ModelName = (typeof ModelName)[keyof typeof ModelName];
export declare const TransactionIsolationLevel: {
    readonly ReadUncommitted: "ReadUncommitted";
    readonly ReadCommitted: "ReadCommitted";
    readonly RepeatableRead: "RepeatableRead";
    readonly Serializable: "Serializable";
};
export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel];
export declare const ChatUserScalarFieldEnum: {
    readonly id: "id";
    readonly username: "username";
    readonly displayName: "displayName";
    readonly avatarUrl: "avatarUrl";
    readonly sourceUpdatedAt: "sourceUpdatedAt";
    readonly deletedAt: "deletedAt";
};
export type ChatUserScalarFieldEnum = (typeof ChatUserScalarFieldEnum)[keyof typeof ChatUserScalarFieldEnum];
export declare const GroupScalarFieldEnum: {
    readonly id: "id";
    readonly name: "name";
    readonly description: "description";
    readonly rules: "rules";
    readonly createdAt: "createdAt";
    readonly updatedAt: "updatedAt";
};
export type GroupScalarFieldEnum = (typeof GroupScalarFieldEnum)[keyof typeof GroupScalarFieldEnum];
export declare const GroupMemberScalarFieldEnum: {
    readonly groupId: "groupId";
    readonly userId: "userId";
    readonly role: "role";
    readonly joinedAt: "joinedAt";
};
export type GroupMemberScalarFieldEnum = (typeof GroupMemberScalarFieldEnum)[keyof typeof GroupMemberScalarFieldEnum];
export declare const ConversationScalarFieldEnum: {
    readonly id: "id";
    readonly kind: "kind";
    readonly createdAt: "createdAt";
    readonly updatedAt: "updatedAt";
    readonly dmUserAId: "dmUserAId";
    readonly dmUserBId: "dmUserBId";
    readonly groupId: "groupId";
    readonly name: "name";
    readonly topic: "topic";
};
export type ConversationScalarFieldEnum = (typeof ConversationScalarFieldEnum)[keyof typeof ConversationScalarFieldEnum];
export declare const ConversationReadStateScalarFieldEnum: {
    readonly conversationId: "conversationId";
    readonly userId: "userId";
    readonly lastReadMessageId: "lastReadMessageId";
    readonly updatedAt: "updatedAt";
};
export type ConversationReadStateScalarFieldEnum = (typeof ConversationReadStateScalarFieldEnum)[keyof typeof ConversationReadStateScalarFieldEnum];
export declare const MessageScalarFieldEnum: {
    readonly id: "id";
    readonly conversationId: "conversationId";
    readonly authorId: "authorId";
    readonly content: "content";
    readonly attachments: "attachments";
    readonly createdAt: "createdAt";
    readonly editedAt: "editedAt";
    readonly deletedAt: "deletedAt";
    readonly clientRequestId: "clientRequestId";
    readonly requestHash: "requestHash";
    readonly version: "version";
};
export type MessageScalarFieldEnum = (typeof MessageScalarFieldEnum)[keyof typeof MessageScalarFieldEnum];
export declare const ReactionScalarFieldEnum: {
    readonly messageId: "messageId";
    readonly userId: "userId";
    readonly emoji: "emoji";
    readonly createdAt: "createdAt";
};
export type ReactionScalarFieldEnum = (typeof ReactionScalarFieldEnum)[keyof typeof ReactionScalarFieldEnum];
export declare const SortOrder: {
    readonly asc: "asc";
    readonly desc: "desc";
};
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];
export declare const QueryMode: {
    readonly default: "default";
    readonly insensitive: "insensitive";
};
export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode];
export declare const NullsOrder: {
    readonly first: "first";
    readonly last: "last";
};
export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder];
