import * as runtime from "@prisma/client/runtime/index-browser";
export const Decimal = runtime.Decimal;
export const NullTypes = {
    DbNull: runtime.NullTypes.DbNull,
    JsonNull: runtime.NullTypes.JsonNull,
    AnyNull: runtime.NullTypes.AnyNull,
};
export const DbNull = runtime.DbNull;
export const JsonNull = runtime.JsonNull;
export const AnyNull = runtime.AnyNull;
export const ModelName = {
    ChatUser: 'ChatUser',
    Group: 'Group',
    GroupMember: 'GroupMember',
    Conversation: 'Conversation',
    ConversationReadState: 'ConversationReadState',
    Message: 'Message',
    Reaction: 'Reaction'
};
export const TransactionIsolationLevel = runtime.makeStrictEnum({
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
});
export const ChatUserScalarFieldEnum = {
    id: 'id',
    username: 'username',
    displayName: 'displayName',
    avatarUrl: 'avatarUrl',
    sourceUpdatedAt: 'sourceUpdatedAt',
    deletedAt: 'deletedAt'
};
export const GroupScalarFieldEnum = {
    id: 'id',
    name: 'name',
    description: 'description',
    rules: 'rules',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
};
export const GroupMemberScalarFieldEnum = {
    groupId: 'groupId',
    userId: 'userId',
    role: 'role',
    joinedAt: 'joinedAt'
};
export const ConversationScalarFieldEnum = {
    id: 'id',
    kind: 'kind',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    dmUserAId: 'dmUserAId',
    dmUserBId: 'dmUserBId',
    groupId: 'groupId',
    name: 'name',
    topic: 'topic'
};
export const ConversationReadStateScalarFieldEnum = {
    conversationId: 'conversationId',
    userId: 'userId',
    lastReadMessageId: 'lastReadMessageId',
    updatedAt: 'updatedAt'
};
export const MessageScalarFieldEnum = {
    id: 'id',
    conversationId: 'conversationId',
    authorId: 'authorId',
    content: 'content',
    attachments: 'attachments',
    createdAt: 'createdAt',
    editedAt: 'editedAt',
    deletedAt: 'deletedAt',
    clientRequestId: 'clientRequestId',
    requestHash: 'requestHash',
    version: 'version'
};
export const ReactionScalarFieldEnum = {
    messageId: 'messageId',
    userId: 'userId',
    emoji: 'emoji',
    createdAt: 'createdAt'
};
export const SortOrder = {
    asc: 'asc',
    desc: 'desc'
};
export const QueryMode = {
    default: 'default',
    insensitive: 'insensitive'
};
export const NullsOrder = {
    first: 'first',
    last: 'last'
};
//# sourceMappingURL=prismaNamespaceBrowser.js.map