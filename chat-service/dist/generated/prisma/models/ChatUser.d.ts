import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type ChatUserModel = runtime.Types.Result.DefaultSelection<Prisma.$ChatUserPayload>;
export type AggregateChatUser = {
    _count: ChatUserCountAggregateOutputType | null;
    _min: ChatUserMinAggregateOutputType | null;
    _max: ChatUserMaxAggregateOutputType | null;
};
export type ChatUserMinAggregateOutputType = {
    id: string | null;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    sourceUpdatedAt: Date | null;
    deletedAt: Date | null;
};
export type ChatUserMaxAggregateOutputType = {
    id: string | null;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    sourceUpdatedAt: Date | null;
    deletedAt: Date | null;
};
export type ChatUserCountAggregateOutputType = {
    id: number;
    username: number;
    displayName: number;
    avatarUrl: number;
    sourceUpdatedAt: number;
    deletedAt: number;
    _all: number;
};
export type ChatUserMinAggregateInputType = {
    id?: true;
    username?: true;
    displayName?: true;
    avatarUrl?: true;
    sourceUpdatedAt?: true;
    deletedAt?: true;
};
export type ChatUserMaxAggregateInputType = {
    id?: true;
    username?: true;
    displayName?: true;
    avatarUrl?: true;
    sourceUpdatedAt?: true;
    deletedAt?: true;
};
export type ChatUserCountAggregateInputType = {
    id?: true;
    username?: true;
    displayName?: true;
    avatarUrl?: true;
    sourceUpdatedAt?: true;
    deletedAt?: true;
    _all?: true;
};
export type ChatUserAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ChatUserWhereInput;
    orderBy?: Prisma.ChatUserOrderByWithRelationInput | Prisma.ChatUserOrderByWithRelationInput[];
    cursor?: Prisma.ChatUserWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | ChatUserCountAggregateInputType;
    _min?: ChatUserMinAggregateInputType;
    _max?: ChatUserMaxAggregateInputType;
};
export type GetChatUserAggregateType<T extends ChatUserAggregateArgs> = {
    [P in keyof T & keyof AggregateChatUser]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateChatUser[P]> : Prisma.GetScalarType<T[P], AggregateChatUser[P]>;
};
export type ChatUserGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ChatUserWhereInput;
    orderBy?: Prisma.ChatUserOrderByWithAggregationInput | Prisma.ChatUserOrderByWithAggregationInput[];
    by: Prisma.ChatUserScalarFieldEnum[] | Prisma.ChatUserScalarFieldEnum;
    having?: Prisma.ChatUserScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: ChatUserCountAggregateInputType | true;
    _min?: ChatUserMinAggregateInputType;
    _max?: ChatUserMaxAggregateInputType;
};
export type ChatUserGroupByOutputType = {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    sourceUpdatedAt: Date;
    deletedAt: Date | null;
    _count: ChatUserCountAggregateOutputType | null;
    _min: ChatUserMinAggregateOutputType | null;
    _max: ChatUserMaxAggregateOutputType | null;
};
export type GetChatUserGroupByPayload<T extends ChatUserGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<ChatUserGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof ChatUserGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], ChatUserGroupByOutputType[P]> : Prisma.GetScalarType<T[P], ChatUserGroupByOutputType[P]>;
}>>;
export type ChatUserWhereInput = {
    AND?: Prisma.ChatUserWhereInput | Prisma.ChatUserWhereInput[];
    OR?: Prisma.ChatUserWhereInput[];
    NOT?: Prisma.ChatUserWhereInput | Prisma.ChatUserWhereInput[];
    id?: Prisma.UuidFilter<"ChatUser"> | string;
    username?: Prisma.StringNullableFilter<"ChatUser"> | string | null;
    displayName?: Prisma.StringNullableFilter<"ChatUser"> | string | null;
    avatarUrl?: Prisma.StringNullableFilter<"ChatUser"> | string | null;
    sourceUpdatedAt?: Prisma.DateTimeFilter<"ChatUser"> | Date | string;
    deletedAt?: Prisma.DateTimeNullableFilter<"ChatUser"> | Date | string | null;
    memberships?: Prisma.GroupMemberListRelationFilter;
    dmsAsUserA?: Prisma.ConversationListRelationFilter;
    dmsAsUserB?: Prisma.ConversationListRelationFilter;
    messages?: Prisma.MessageListRelationFilter;
    readStates?: Prisma.ConversationReadStateListRelationFilter;
    reactions?: Prisma.ReactionListRelationFilter;
};
export type ChatUserOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    username?: Prisma.SortOrderInput | Prisma.SortOrder;
    displayName?: Prisma.SortOrderInput | Prisma.SortOrder;
    avatarUrl?: Prisma.SortOrderInput | Prisma.SortOrder;
    sourceUpdatedAt?: Prisma.SortOrder;
    deletedAt?: Prisma.SortOrderInput | Prisma.SortOrder;
    memberships?: Prisma.GroupMemberOrderByRelationAggregateInput;
    dmsAsUserA?: Prisma.ConversationOrderByRelationAggregateInput;
    dmsAsUserB?: Prisma.ConversationOrderByRelationAggregateInput;
    messages?: Prisma.MessageOrderByRelationAggregateInput;
    readStates?: Prisma.ConversationReadStateOrderByRelationAggregateInput;
    reactions?: Prisma.ReactionOrderByRelationAggregateInput;
};
export type ChatUserWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    AND?: Prisma.ChatUserWhereInput | Prisma.ChatUserWhereInput[];
    OR?: Prisma.ChatUserWhereInput[];
    NOT?: Prisma.ChatUserWhereInput | Prisma.ChatUserWhereInput[];
    username?: Prisma.StringNullableFilter<"ChatUser"> | string | null;
    displayName?: Prisma.StringNullableFilter<"ChatUser"> | string | null;
    avatarUrl?: Prisma.StringNullableFilter<"ChatUser"> | string | null;
    sourceUpdatedAt?: Prisma.DateTimeFilter<"ChatUser"> | Date | string;
    deletedAt?: Prisma.DateTimeNullableFilter<"ChatUser"> | Date | string | null;
    memberships?: Prisma.GroupMemberListRelationFilter;
    dmsAsUserA?: Prisma.ConversationListRelationFilter;
    dmsAsUserB?: Prisma.ConversationListRelationFilter;
    messages?: Prisma.MessageListRelationFilter;
    readStates?: Prisma.ConversationReadStateListRelationFilter;
    reactions?: Prisma.ReactionListRelationFilter;
}, "id">;
export type ChatUserOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    username?: Prisma.SortOrderInput | Prisma.SortOrder;
    displayName?: Prisma.SortOrderInput | Prisma.SortOrder;
    avatarUrl?: Prisma.SortOrderInput | Prisma.SortOrder;
    sourceUpdatedAt?: Prisma.SortOrder;
    deletedAt?: Prisma.SortOrderInput | Prisma.SortOrder;
    _count?: Prisma.ChatUserCountOrderByAggregateInput;
    _max?: Prisma.ChatUserMaxOrderByAggregateInput;
    _min?: Prisma.ChatUserMinOrderByAggregateInput;
};
export type ChatUserScalarWhereWithAggregatesInput = {
    AND?: Prisma.ChatUserScalarWhereWithAggregatesInput | Prisma.ChatUserScalarWhereWithAggregatesInput[];
    OR?: Prisma.ChatUserScalarWhereWithAggregatesInput[];
    NOT?: Prisma.ChatUserScalarWhereWithAggregatesInput | Prisma.ChatUserScalarWhereWithAggregatesInput[];
    id?: Prisma.UuidWithAggregatesFilter<"ChatUser"> | string;
    username?: Prisma.StringNullableWithAggregatesFilter<"ChatUser"> | string | null;
    displayName?: Prisma.StringNullableWithAggregatesFilter<"ChatUser"> | string | null;
    avatarUrl?: Prisma.StringNullableWithAggregatesFilter<"ChatUser"> | string | null;
    sourceUpdatedAt?: Prisma.DateTimeWithAggregatesFilter<"ChatUser"> | Date | string;
    deletedAt?: Prisma.DateTimeNullableWithAggregatesFilter<"ChatUser"> | Date | string | null;
};
export type ChatUserCreateInput = {
    id: string;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    sourceUpdatedAt: Date | string;
    deletedAt?: Date | string | null;
    memberships?: Prisma.GroupMemberCreateNestedManyWithoutUserInput;
    dmsAsUserA?: Prisma.ConversationCreateNestedManyWithoutDmUserAInput;
    dmsAsUserB?: Prisma.ConversationCreateNestedManyWithoutDmUserBInput;
    messages?: Prisma.MessageCreateNestedManyWithoutAuthorInput;
    readStates?: Prisma.ConversationReadStateCreateNestedManyWithoutUserInput;
    reactions?: Prisma.ReactionCreateNestedManyWithoutUserInput;
};
export type ChatUserUncheckedCreateInput = {
    id: string;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    sourceUpdatedAt: Date | string;
    deletedAt?: Date | string | null;
    memberships?: Prisma.GroupMemberUncheckedCreateNestedManyWithoutUserInput;
    dmsAsUserA?: Prisma.ConversationUncheckedCreateNestedManyWithoutDmUserAInput;
    dmsAsUserB?: Prisma.ConversationUncheckedCreateNestedManyWithoutDmUserBInput;
    messages?: Prisma.MessageUncheckedCreateNestedManyWithoutAuthorInput;
    readStates?: Prisma.ConversationReadStateUncheckedCreateNestedManyWithoutUserInput;
    reactions?: Prisma.ReactionUncheckedCreateNestedManyWithoutUserInput;
};
export type ChatUserUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    username?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    displayName?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatarUrl?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    sourceUpdatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    memberships?: Prisma.GroupMemberUpdateManyWithoutUserNestedInput;
    dmsAsUserA?: Prisma.ConversationUpdateManyWithoutDmUserANestedInput;
    dmsAsUserB?: Prisma.ConversationUpdateManyWithoutDmUserBNestedInput;
    messages?: Prisma.MessageUpdateManyWithoutAuthorNestedInput;
    readStates?: Prisma.ConversationReadStateUpdateManyWithoutUserNestedInput;
    reactions?: Prisma.ReactionUpdateManyWithoutUserNestedInput;
};
export type ChatUserUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    username?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    displayName?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatarUrl?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    sourceUpdatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    memberships?: Prisma.GroupMemberUncheckedUpdateManyWithoutUserNestedInput;
    dmsAsUserA?: Prisma.ConversationUncheckedUpdateManyWithoutDmUserANestedInput;
    dmsAsUserB?: Prisma.ConversationUncheckedUpdateManyWithoutDmUserBNestedInput;
    messages?: Prisma.MessageUncheckedUpdateManyWithoutAuthorNestedInput;
    readStates?: Prisma.ConversationReadStateUncheckedUpdateManyWithoutUserNestedInput;
    reactions?: Prisma.ReactionUncheckedUpdateManyWithoutUserNestedInput;
};
export type ChatUserCreateManyInput = {
    id: string;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    sourceUpdatedAt: Date | string;
    deletedAt?: Date | string | null;
};
export type ChatUserUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    username?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    displayName?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatarUrl?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    sourceUpdatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
};
export type ChatUserUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    username?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    displayName?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatarUrl?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    sourceUpdatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
};
export type ChatUserCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    username?: Prisma.SortOrder;
    displayName?: Prisma.SortOrder;
    avatarUrl?: Prisma.SortOrder;
    sourceUpdatedAt?: Prisma.SortOrder;
    deletedAt?: Prisma.SortOrder;
};
export type ChatUserMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    username?: Prisma.SortOrder;
    displayName?: Prisma.SortOrder;
    avatarUrl?: Prisma.SortOrder;
    sourceUpdatedAt?: Prisma.SortOrder;
    deletedAt?: Prisma.SortOrder;
};
export type ChatUserMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    username?: Prisma.SortOrder;
    displayName?: Prisma.SortOrder;
    avatarUrl?: Prisma.SortOrder;
    sourceUpdatedAt?: Prisma.SortOrder;
    deletedAt?: Prisma.SortOrder;
};
export type ChatUserScalarRelationFilter = {
    is?: Prisma.ChatUserWhereInput;
    isNot?: Prisma.ChatUserWhereInput;
};
export type ChatUserNullableScalarRelationFilter = {
    is?: Prisma.ChatUserWhereInput | null;
    isNot?: Prisma.ChatUserWhereInput | null;
};
export type StringFieldUpdateOperationsInput = {
    set?: string;
};
export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null;
};
export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string;
};
export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null;
};
export type ChatUserCreateNestedOneWithoutMembershipsInput = {
    create?: Prisma.XOR<Prisma.ChatUserCreateWithoutMembershipsInput, Prisma.ChatUserUncheckedCreateWithoutMembershipsInput>;
    connectOrCreate?: Prisma.ChatUserCreateOrConnectWithoutMembershipsInput;
    connect?: Prisma.ChatUserWhereUniqueInput;
};
export type ChatUserUpdateOneRequiredWithoutMembershipsNestedInput = {
    create?: Prisma.XOR<Prisma.ChatUserCreateWithoutMembershipsInput, Prisma.ChatUserUncheckedCreateWithoutMembershipsInput>;
    connectOrCreate?: Prisma.ChatUserCreateOrConnectWithoutMembershipsInput;
    upsert?: Prisma.ChatUserUpsertWithoutMembershipsInput;
    connect?: Prisma.ChatUserWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.ChatUserUpdateToOneWithWhereWithoutMembershipsInput, Prisma.ChatUserUpdateWithoutMembershipsInput>, Prisma.ChatUserUncheckedUpdateWithoutMembershipsInput>;
};
export type ChatUserCreateNestedOneWithoutDmsAsUserAInput = {
    create?: Prisma.XOR<Prisma.ChatUserCreateWithoutDmsAsUserAInput, Prisma.ChatUserUncheckedCreateWithoutDmsAsUserAInput>;
    connectOrCreate?: Prisma.ChatUserCreateOrConnectWithoutDmsAsUserAInput;
    connect?: Prisma.ChatUserWhereUniqueInput;
};
export type ChatUserCreateNestedOneWithoutDmsAsUserBInput = {
    create?: Prisma.XOR<Prisma.ChatUserCreateWithoutDmsAsUserBInput, Prisma.ChatUserUncheckedCreateWithoutDmsAsUserBInput>;
    connectOrCreate?: Prisma.ChatUserCreateOrConnectWithoutDmsAsUserBInput;
    connect?: Prisma.ChatUserWhereUniqueInput;
};
export type ChatUserUpdateOneWithoutDmsAsUserANestedInput = {
    create?: Prisma.XOR<Prisma.ChatUserCreateWithoutDmsAsUserAInput, Prisma.ChatUserUncheckedCreateWithoutDmsAsUserAInput>;
    connectOrCreate?: Prisma.ChatUserCreateOrConnectWithoutDmsAsUserAInput;
    upsert?: Prisma.ChatUserUpsertWithoutDmsAsUserAInput;
    disconnect?: Prisma.ChatUserWhereInput | boolean;
    delete?: Prisma.ChatUserWhereInput | boolean;
    connect?: Prisma.ChatUserWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.ChatUserUpdateToOneWithWhereWithoutDmsAsUserAInput, Prisma.ChatUserUpdateWithoutDmsAsUserAInput>, Prisma.ChatUserUncheckedUpdateWithoutDmsAsUserAInput>;
};
export type ChatUserUpdateOneWithoutDmsAsUserBNestedInput = {
    create?: Prisma.XOR<Prisma.ChatUserCreateWithoutDmsAsUserBInput, Prisma.ChatUserUncheckedCreateWithoutDmsAsUserBInput>;
    connectOrCreate?: Prisma.ChatUserCreateOrConnectWithoutDmsAsUserBInput;
    upsert?: Prisma.ChatUserUpsertWithoutDmsAsUserBInput;
    disconnect?: Prisma.ChatUserWhereInput | boolean;
    delete?: Prisma.ChatUserWhereInput | boolean;
    connect?: Prisma.ChatUserWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.ChatUserUpdateToOneWithWhereWithoutDmsAsUserBInput, Prisma.ChatUserUpdateWithoutDmsAsUserBInput>, Prisma.ChatUserUncheckedUpdateWithoutDmsAsUserBInput>;
};
export type ChatUserCreateNestedOneWithoutReadStatesInput = {
    create?: Prisma.XOR<Prisma.ChatUserCreateWithoutReadStatesInput, Prisma.ChatUserUncheckedCreateWithoutReadStatesInput>;
    connectOrCreate?: Prisma.ChatUserCreateOrConnectWithoutReadStatesInput;
    connect?: Prisma.ChatUserWhereUniqueInput;
};
export type ChatUserUpdateOneRequiredWithoutReadStatesNestedInput = {
    create?: Prisma.XOR<Prisma.ChatUserCreateWithoutReadStatesInput, Prisma.ChatUserUncheckedCreateWithoutReadStatesInput>;
    connectOrCreate?: Prisma.ChatUserCreateOrConnectWithoutReadStatesInput;
    upsert?: Prisma.ChatUserUpsertWithoutReadStatesInput;
    connect?: Prisma.ChatUserWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.ChatUserUpdateToOneWithWhereWithoutReadStatesInput, Prisma.ChatUserUpdateWithoutReadStatesInput>, Prisma.ChatUserUncheckedUpdateWithoutReadStatesInput>;
};
export type ChatUserCreateNestedOneWithoutMessagesInput = {
    create?: Prisma.XOR<Prisma.ChatUserCreateWithoutMessagesInput, Prisma.ChatUserUncheckedCreateWithoutMessagesInput>;
    connectOrCreate?: Prisma.ChatUserCreateOrConnectWithoutMessagesInput;
    connect?: Prisma.ChatUserWhereUniqueInput;
};
export type ChatUserUpdateOneRequiredWithoutMessagesNestedInput = {
    create?: Prisma.XOR<Prisma.ChatUserCreateWithoutMessagesInput, Prisma.ChatUserUncheckedCreateWithoutMessagesInput>;
    connectOrCreate?: Prisma.ChatUserCreateOrConnectWithoutMessagesInput;
    upsert?: Prisma.ChatUserUpsertWithoutMessagesInput;
    connect?: Prisma.ChatUserWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.ChatUserUpdateToOneWithWhereWithoutMessagesInput, Prisma.ChatUserUpdateWithoutMessagesInput>, Prisma.ChatUserUncheckedUpdateWithoutMessagesInput>;
};
export type ChatUserCreateNestedOneWithoutReactionsInput = {
    create?: Prisma.XOR<Prisma.ChatUserCreateWithoutReactionsInput, Prisma.ChatUserUncheckedCreateWithoutReactionsInput>;
    connectOrCreate?: Prisma.ChatUserCreateOrConnectWithoutReactionsInput;
    connect?: Prisma.ChatUserWhereUniqueInput;
};
export type ChatUserUpdateOneRequiredWithoutReactionsNestedInput = {
    create?: Prisma.XOR<Prisma.ChatUserCreateWithoutReactionsInput, Prisma.ChatUserUncheckedCreateWithoutReactionsInput>;
    connectOrCreate?: Prisma.ChatUserCreateOrConnectWithoutReactionsInput;
    upsert?: Prisma.ChatUserUpsertWithoutReactionsInput;
    connect?: Prisma.ChatUserWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.ChatUserUpdateToOneWithWhereWithoutReactionsInput, Prisma.ChatUserUpdateWithoutReactionsInput>, Prisma.ChatUserUncheckedUpdateWithoutReactionsInput>;
};
export type ChatUserCreateWithoutMembershipsInput = {
    id: string;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    sourceUpdatedAt: Date | string;
    deletedAt?: Date | string | null;
    dmsAsUserA?: Prisma.ConversationCreateNestedManyWithoutDmUserAInput;
    dmsAsUserB?: Prisma.ConversationCreateNestedManyWithoutDmUserBInput;
    messages?: Prisma.MessageCreateNestedManyWithoutAuthorInput;
    readStates?: Prisma.ConversationReadStateCreateNestedManyWithoutUserInput;
    reactions?: Prisma.ReactionCreateNestedManyWithoutUserInput;
};
export type ChatUserUncheckedCreateWithoutMembershipsInput = {
    id: string;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    sourceUpdatedAt: Date | string;
    deletedAt?: Date | string | null;
    dmsAsUserA?: Prisma.ConversationUncheckedCreateNestedManyWithoutDmUserAInput;
    dmsAsUserB?: Prisma.ConversationUncheckedCreateNestedManyWithoutDmUserBInput;
    messages?: Prisma.MessageUncheckedCreateNestedManyWithoutAuthorInput;
    readStates?: Prisma.ConversationReadStateUncheckedCreateNestedManyWithoutUserInput;
    reactions?: Prisma.ReactionUncheckedCreateNestedManyWithoutUserInput;
};
export type ChatUserCreateOrConnectWithoutMembershipsInput = {
    where: Prisma.ChatUserWhereUniqueInput;
    create: Prisma.XOR<Prisma.ChatUserCreateWithoutMembershipsInput, Prisma.ChatUserUncheckedCreateWithoutMembershipsInput>;
};
export type ChatUserUpsertWithoutMembershipsInput = {
    update: Prisma.XOR<Prisma.ChatUserUpdateWithoutMembershipsInput, Prisma.ChatUserUncheckedUpdateWithoutMembershipsInput>;
    create: Prisma.XOR<Prisma.ChatUserCreateWithoutMembershipsInput, Prisma.ChatUserUncheckedCreateWithoutMembershipsInput>;
    where?: Prisma.ChatUserWhereInput;
};
export type ChatUserUpdateToOneWithWhereWithoutMembershipsInput = {
    where?: Prisma.ChatUserWhereInput;
    data: Prisma.XOR<Prisma.ChatUserUpdateWithoutMembershipsInput, Prisma.ChatUserUncheckedUpdateWithoutMembershipsInput>;
};
export type ChatUserUpdateWithoutMembershipsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    username?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    displayName?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatarUrl?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    sourceUpdatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    dmsAsUserA?: Prisma.ConversationUpdateManyWithoutDmUserANestedInput;
    dmsAsUserB?: Prisma.ConversationUpdateManyWithoutDmUserBNestedInput;
    messages?: Prisma.MessageUpdateManyWithoutAuthorNestedInput;
    readStates?: Prisma.ConversationReadStateUpdateManyWithoutUserNestedInput;
    reactions?: Prisma.ReactionUpdateManyWithoutUserNestedInput;
};
export type ChatUserUncheckedUpdateWithoutMembershipsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    username?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    displayName?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatarUrl?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    sourceUpdatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    dmsAsUserA?: Prisma.ConversationUncheckedUpdateManyWithoutDmUserANestedInput;
    dmsAsUserB?: Prisma.ConversationUncheckedUpdateManyWithoutDmUserBNestedInput;
    messages?: Prisma.MessageUncheckedUpdateManyWithoutAuthorNestedInput;
    readStates?: Prisma.ConversationReadStateUncheckedUpdateManyWithoutUserNestedInput;
    reactions?: Prisma.ReactionUncheckedUpdateManyWithoutUserNestedInput;
};
export type ChatUserCreateWithoutDmsAsUserAInput = {
    id: string;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    sourceUpdatedAt: Date | string;
    deletedAt?: Date | string | null;
    memberships?: Prisma.GroupMemberCreateNestedManyWithoutUserInput;
    dmsAsUserB?: Prisma.ConversationCreateNestedManyWithoutDmUserBInput;
    messages?: Prisma.MessageCreateNestedManyWithoutAuthorInput;
    readStates?: Prisma.ConversationReadStateCreateNestedManyWithoutUserInput;
    reactions?: Prisma.ReactionCreateNestedManyWithoutUserInput;
};
export type ChatUserUncheckedCreateWithoutDmsAsUserAInput = {
    id: string;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    sourceUpdatedAt: Date | string;
    deletedAt?: Date | string | null;
    memberships?: Prisma.GroupMemberUncheckedCreateNestedManyWithoutUserInput;
    dmsAsUserB?: Prisma.ConversationUncheckedCreateNestedManyWithoutDmUserBInput;
    messages?: Prisma.MessageUncheckedCreateNestedManyWithoutAuthorInput;
    readStates?: Prisma.ConversationReadStateUncheckedCreateNestedManyWithoutUserInput;
    reactions?: Prisma.ReactionUncheckedCreateNestedManyWithoutUserInput;
};
export type ChatUserCreateOrConnectWithoutDmsAsUserAInput = {
    where: Prisma.ChatUserWhereUniqueInput;
    create: Prisma.XOR<Prisma.ChatUserCreateWithoutDmsAsUserAInput, Prisma.ChatUserUncheckedCreateWithoutDmsAsUserAInput>;
};
export type ChatUserCreateWithoutDmsAsUserBInput = {
    id: string;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    sourceUpdatedAt: Date | string;
    deletedAt?: Date | string | null;
    memberships?: Prisma.GroupMemberCreateNestedManyWithoutUserInput;
    dmsAsUserA?: Prisma.ConversationCreateNestedManyWithoutDmUserAInput;
    messages?: Prisma.MessageCreateNestedManyWithoutAuthorInput;
    readStates?: Prisma.ConversationReadStateCreateNestedManyWithoutUserInput;
    reactions?: Prisma.ReactionCreateNestedManyWithoutUserInput;
};
export type ChatUserUncheckedCreateWithoutDmsAsUserBInput = {
    id: string;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    sourceUpdatedAt: Date | string;
    deletedAt?: Date | string | null;
    memberships?: Prisma.GroupMemberUncheckedCreateNestedManyWithoutUserInput;
    dmsAsUserA?: Prisma.ConversationUncheckedCreateNestedManyWithoutDmUserAInput;
    messages?: Prisma.MessageUncheckedCreateNestedManyWithoutAuthorInput;
    readStates?: Prisma.ConversationReadStateUncheckedCreateNestedManyWithoutUserInput;
    reactions?: Prisma.ReactionUncheckedCreateNestedManyWithoutUserInput;
};
export type ChatUserCreateOrConnectWithoutDmsAsUserBInput = {
    where: Prisma.ChatUserWhereUniqueInput;
    create: Prisma.XOR<Prisma.ChatUserCreateWithoutDmsAsUserBInput, Prisma.ChatUserUncheckedCreateWithoutDmsAsUserBInput>;
};
export type ChatUserUpsertWithoutDmsAsUserAInput = {
    update: Prisma.XOR<Prisma.ChatUserUpdateWithoutDmsAsUserAInput, Prisma.ChatUserUncheckedUpdateWithoutDmsAsUserAInput>;
    create: Prisma.XOR<Prisma.ChatUserCreateWithoutDmsAsUserAInput, Prisma.ChatUserUncheckedCreateWithoutDmsAsUserAInput>;
    where?: Prisma.ChatUserWhereInput;
};
export type ChatUserUpdateToOneWithWhereWithoutDmsAsUserAInput = {
    where?: Prisma.ChatUserWhereInput;
    data: Prisma.XOR<Prisma.ChatUserUpdateWithoutDmsAsUserAInput, Prisma.ChatUserUncheckedUpdateWithoutDmsAsUserAInput>;
};
export type ChatUserUpdateWithoutDmsAsUserAInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    username?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    displayName?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatarUrl?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    sourceUpdatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    memberships?: Prisma.GroupMemberUpdateManyWithoutUserNestedInput;
    dmsAsUserB?: Prisma.ConversationUpdateManyWithoutDmUserBNestedInput;
    messages?: Prisma.MessageUpdateManyWithoutAuthorNestedInput;
    readStates?: Prisma.ConversationReadStateUpdateManyWithoutUserNestedInput;
    reactions?: Prisma.ReactionUpdateManyWithoutUserNestedInput;
};
export type ChatUserUncheckedUpdateWithoutDmsAsUserAInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    username?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    displayName?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatarUrl?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    sourceUpdatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    memberships?: Prisma.GroupMemberUncheckedUpdateManyWithoutUserNestedInput;
    dmsAsUserB?: Prisma.ConversationUncheckedUpdateManyWithoutDmUserBNestedInput;
    messages?: Prisma.MessageUncheckedUpdateManyWithoutAuthorNestedInput;
    readStates?: Prisma.ConversationReadStateUncheckedUpdateManyWithoutUserNestedInput;
    reactions?: Prisma.ReactionUncheckedUpdateManyWithoutUserNestedInput;
};
export type ChatUserUpsertWithoutDmsAsUserBInput = {
    update: Prisma.XOR<Prisma.ChatUserUpdateWithoutDmsAsUserBInput, Prisma.ChatUserUncheckedUpdateWithoutDmsAsUserBInput>;
    create: Prisma.XOR<Prisma.ChatUserCreateWithoutDmsAsUserBInput, Prisma.ChatUserUncheckedCreateWithoutDmsAsUserBInput>;
    where?: Prisma.ChatUserWhereInput;
};
export type ChatUserUpdateToOneWithWhereWithoutDmsAsUserBInput = {
    where?: Prisma.ChatUserWhereInput;
    data: Prisma.XOR<Prisma.ChatUserUpdateWithoutDmsAsUserBInput, Prisma.ChatUserUncheckedUpdateWithoutDmsAsUserBInput>;
};
export type ChatUserUpdateWithoutDmsAsUserBInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    username?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    displayName?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatarUrl?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    sourceUpdatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    memberships?: Prisma.GroupMemberUpdateManyWithoutUserNestedInput;
    dmsAsUserA?: Prisma.ConversationUpdateManyWithoutDmUserANestedInput;
    messages?: Prisma.MessageUpdateManyWithoutAuthorNestedInput;
    readStates?: Prisma.ConversationReadStateUpdateManyWithoutUserNestedInput;
    reactions?: Prisma.ReactionUpdateManyWithoutUserNestedInput;
};
export type ChatUserUncheckedUpdateWithoutDmsAsUserBInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    username?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    displayName?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatarUrl?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    sourceUpdatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    memberships?: Prisma.GroupMemberUncheckedUpdateManyWithoutUserNestedInput;
    dmsAsUserA?: Prisma.ConversationUncheckedUpdateManyWithoutDmUserANestedInput;
    messages?: Prisma.MessageUncheckedUpdateManyWithoutAuthorNestedInput;
    readStates?: Prisma.ConversationReadStateUncheckedUpdateManyWithoutUserNestedInput;
    reactions?: Prisma.ReactionUncheckedUpdateManyWithoutUserNestedInput;
};
export type ChatUserCreateWithoutReadStatesInput = {
    id: string;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    sourceUpdatedAt: Date | string;
    deletedAt?: Date | string | null;
    memberships?: Prisma.GroupMemberCreateNestedManyWithoutUserInput;
    dmsAsUserA?: Prisma.ConversationCreateNestedManyWithoutDmUserAInput;
    dmsAsUserB?: Prisma.ConversationCreateNestedManyWithoutDmUserBInput;
    messages?: Prisma.MessageCreateNestedManyWithoutAuthorInput;
    reactions?: Prisma.ReactionCreateNestedManyWithoutUserInput;
};
export type ChatUserUncheckedCreateWithoutReadStatesInput = {
    id: string;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    sourceUpdatedAt: Date | string;
    deletedAt?: Date | string | null;
    memberships?: Prisma.GroupMemberUncheckedCreateNestedManyWithoutUserInput;
    dmsAsUserA?: Prisma.ConversationUncheckedCreateNestedManyWithoutDmUserAInput;
    dmsAsUserB?: Prisma.ConversationUncheckedCreateNestedManyWithoutDmUserBInput;
    messages?: Prisma.MessageUncheckedCreateNestedManyWithoutAuthorInput;
    reactions?: Prisma.ReactionUncheckedCreateNestedManyWithoutUserInput;
};
export type ChatUserCreateOrConnectWithoutReadStatesInput = {
    where: Prisma.ChatUserWhereUniqueInput;
    create: Prisma.XOR<Prisma.ChatUserCreateWithoutReadStatesInput, Prisma.ChatUserUncheckedCreateWithoutReadStatesInput>;
};
export type ChatUserUpsertWithoutReadStatesInput = {
    update: Prisma.XOR<Prisma.ChatUserUpdateWithoutReadStatesInput, Prisma.ChatUserUncheckedUpdateWithoutReadStatesInput>;
    create: Prisma.XOR<Prisma.ChatUserCreateWithoutReadStatesInput, Prisma.ChatUserUncheckedCreateWithoutReadStatesInput>;
    where?: Prisma.ChatUserWhereInput;
};
export type ChatUserUpdateToOneWithWhereWithoutReadStatesInput = {
    where?: Prisma.ChatUserWhereInput;
    data: Prisma.XOR<Prisma.ChatUserUpdateWithoutReadStatesInput, Prisma.ChatUserUncheckedUpdateWithoutReadStatesInput>;
};
export type ChatUserUpdateWithoutReadStatesInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    username?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    displayName?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatarUrl?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    sourceUpdatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    memberships?: Prisma.GroupMemberUpdateManyWithoutUserNestedInput;
    dmsAsUserA?: Prisma.ConversationUpdateManyWithoutDmUserANestedInput;
    dmsAsUserB?: Prisma.ConversationUpdateManyWithoutDmUserBNestedInput;
    messages?: Prisma.MessageUpdateManyWithoutAuthorNestedInput;
    reactions?: Prisma.ReactionUpdateManyWithoutUserNestedInput;
};
export type ChatUserUncheckedUpdateWithoutReadStatesInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    username?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    displayName?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatarUrl?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    sourceUpdatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    memberships?: Prisma.GroupMemberUncheckedUpdateManyWithoutUserNestedInput;
    dmsAsUserA?: Prisma.ConversationUncheckedUpdateManyWithoutDmUserANestedInput;
    dmsAsUserB?: Prisma.ConversationUncheckedUpdateManyWithoutDmUserBNestedInput;
    messages?: Prisma.MessageUncheckedUpdateManyWithoutAuthorNestedInput;
    reactions?: Prisma.ReactionUncheckedUpdateManyWithoutUserNestedInput;
};
export type ChatUserCreateWithoutMessagesInput = {
    id: string;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    sourceUpdatedAt: Date | string;
    deletedAt?: Date | string | null;
    memberships?: Prisma.GroupMemberCreateNestedManyWithoutUserInput;
    dmsAsUserA?: Prisma.ConversationCreateNestedManyWithoutDmUserAInput;
    dmsAsUserB?: Prisma.ConversationCreateNestedManyWithoutDmUserBInput;
    readStates?: Prisma.ConversationReadStateCreateNestedManyWithoutUserInput;
    reactions?: Prisma.ReactionCreateNestedManyWithoutUserInput;
};
export type ChatUserUncheckedCreateWithoutMessagesInput = {
    id: string;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    sourceUpdatedAt: Date | string;
    deletedAt?: Date | string | null;
    memberships?: Prisma.GroupMemberUncheckedCreateNestedManyWithoutUserInput;
    dmsAsUserA?: Prisma.ConversationUncheckedCreateNestedManyWithoutDmUserAInput;
    dmsAsUserB?: Prisma.ConversationUncheckedCreateNestedManyWithoutDmUserBInput;
    readStates?: Prisma.ConversationReadStateUncheckedCreateNestedManyWithoutUserInput;
    reactions?: Prisma.ReactionUncheckedCreateNestedManyWithoutUserInput;
};
export type ChatUserCreateOrConnectWithoutMessagesInput = {
    where: Prisma.ChatUserWhereUniqueInput;
    create: Prisma.XOR<Prisma.ChatUserCreateWithoutMessagesInput, Prisma.ChatUserUncheckedCreateWithoutMessagesInput>;
};
export type ChatUserUpsertWithoutMessagesInput = {
    update: Prisma.XOR<Prisma.ChatUserUpdateWithoutMessagesInput, Prisma.ChatUserUncheckedUpdateWithoutMessagesInput>;
    create: Prisma.XOR<Prisma.ChatUserCreateWithoutMessagesInput, Prisma.ChatUserUncheckedCreateWithoutMessagesInput>;
    where?: Prisma.ChatUserWhereInput;
};
export type ChatUserUpdateToOneWithWhereWithoutMessagesInput = {
    where?: Prisma.ChatUserWhereInput;
    data: Prisma.XOR<Prisma.ChatUserUpdateWithoutMessagesInput, Prisma.ChatUserUncheckedUpdateWithoutMessagesInput>;
};
export type ChatUserUpdateWithoutMessagesInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    username?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    displayName?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatarUrl?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    sourceUpdatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    memberships?: Prisma.GroupMemberUpdateManyWithoutUserNestedInput;
    dmsAsUserA?: Prisma.ConversationUpdateManyWithoutDmUserANestedInput;
    dmsAsUserB?: Prisma.ConversationUpdateManyWithoutDmUserBNestedInput;
    readStates?: Prisma.ConversationReadStateUpdateManyWithoutUserNestedInput;
    reactions?: Prisma.ReactionUpdateManyWithoutUserNestedInput;
};
export type ChatUserUncheckedUpdateWithoutMessagesInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    username?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    displayName?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatarUrl?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    sourceUpdatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    memberships?: Prisma.GroupMemberUncheckedUpdateManyWithoutUserNestedInput;
    dmsAsUserA?: Prisma.ConversationUncheckedUpdateManyWithoutDmUserANestedInput;
    dmsAsUserB?: Prisma.ConversationUncheckedUpdateManyWithoutDmUserBNestedInput;
    readStates?: Prisma.ConversationReadStateUncheckedUpdateManyWithoutUserNestedInput;
    reactions?: Prisma.ReactionUncheckedUpdateManyWithoutUserNestedInput;
};
export type ChatUserCreateWithoutReactionsInput = {
    id: string;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    sourceUpdatedAt: Date | string;
    deletedAt?: Date | string | null;
    memberships?: Prisma.GroupMemberCreateNestedManyWithoutUserInput;
    dmsAsUserA?: Prisma.ConversationCreateNestedManyWithoutDmUserAInput;
    dmsAsUserB?: Prisma.ConversationCreateNestedManyWithoutDmUserBInput;
    messages?: Prisma.MessageCreateNestedManyWithoutAuthorInput;
    readStates?: Prisma.ConversationReadStateCreateNestedManyWithoutUserInput;
};
export type ChatUserUncheckedCreateWithoutReactionsInput = {
    id: string;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    sourceUpdatedAt: Date | string;
    deletedAt?: Date | string | null;
    memberships?: Prisma.GroupMemberUncheckedCreateNestedManyWithoutUserInput;
    dmsAsUserA?: Prisma.ConversationUncheckedCreateNestedManyWithoutDmUserAInput;
    dmsAsUserB?: Prisma.ConversationUncheckedCreateNestedManyWithoutDmUserBInput;
    messages?: Prisma.MessageUncheckedCreateNestedManyWithoutAuthorInput;
    readStates?: Prisma.ConversationReadStateUncheckedCreateNestedManyWithoutUserInput;
};
export type ChatUserCreateOrConnectWithoutReactionsInput = {
    where: Prisma.ChatUserWhereUniqueInput;
    create: Prisma.XOR<Prisma.ChatUserCreateWithoutReactionsInput, Prisma.ChatUserUncheckedCreateWithoutReactionsInput>;
};
export type ChatUserUpsertWithoutReactionsInput = {
    update: Prisma.XOR<Prisma.ChatUserUpdateWithoutReactionsInput, Prisma.ChatUserUncheckedUpdateWithoutReactionsInput>;
    create: Prisma.XOR<Prisma.ChatUserCreateWithoutReactionsInput, Prisma.ChatUserUncheckedCreateWithoutReactionsInput>;
    where?: Prisma.ChatUserWhereInput;
};
export type ChatUserUpdateToOneWithWhereWithoutReactionsInput = {
    where?: Prisma.ChatUserWhereInput;
    data: Prisma.XOR<Prisma.ChatUserUpdateWithoutReactionsInput, Prisma.ChatUserUncheckedUpdateWithoutReactionsInput>;
};
export type ChatUserUpdateWithoutReactionsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    username?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    displayName?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatarUrl?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    sourceUpdatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    memberships?: Prisma.GroupMemberUpdateManyWithoutUserNestedInput;
    dmsAsUserA?: Prisma.ConversationUpdateManyWithoutDmUserANestedInput;
    dmsAsUserB?: Prisma.ConversationUpdateManyWithoutDmUserBNestedInput;
    messages?: Prisma.MessageUpdateManyWithoutAuthorNestedInput;
    readStates?: Prisma.ConversationReadStateUpdateManyWithoutUserNestedInput;
};
export type ChatUserUncheckedUpdateWithoutReactionsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    username?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    displayName?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatarUrl?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    sourceUpdatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    memberships?: Prisma.GroupMemberUncheckedUpdateManyWithoutUserNestedInput;
    dmsAsUserA?: Prisma.ConversationUncheckedUpdateManyWithoutDmUserANestedInput;
    dmsAsUserB?: Prisma.ConversationUncheckedUpdateManyWithoutDmUserBNestedInput;
    messages?: Prisma.MessageUncheckedUpdateManyWithoutAuthorNestedInput;
    readStates?: Prisma.ConversationReadStateUncheckedUpdateManyWithoutUserNestedInput;
};
export type ChatUserCountOutputType = {
    memberships: number;
    dmsAsUserA: number;
    dmsAsUserB: number;
    messages: number;
    readStates: number;
    reactions: number;
};
export type ChatUserCountOutputTypeSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    memberships?: boolean | ChatUserCountOutputTypeCountMembershipsArgs;
    dmsAsUserA?: boolean | ChatUserCountOutputTypeCountDmsAsUserAArgs;
    dmsAsUserB?: boolean | ChatUserCountOutputTypeCountDmsAsUserBArgs;
    messages?: boolean | ChatUserCountOutputTypeCountMessagesArgs;
    readStates?: boolean | ChatUserCountOutputTypeCountReadStatesArgs;
    reactions?: boolean | ChatUserCountOutputTypeCountReactionsArgs;
};
export type ChatUserCountOutputTypeDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ChatUserCountOutputTypeSelect<ExtArgs> | null;
};
export type ChatUserCountOutputTypeCountMembershipsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.GroupMemberWhereInput;
};
export type ChatUserCountOutputTypeCountDmsAsUserAArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ConversationWhereInput;
};
export type ChatUserCountOutputTypeCountDmsAsUserBArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ConversationWhereInput;
};
export type ChatUserCountOutputTypeCountMessagesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.MessageWhereInput;
};
export type ChatUserCountOutputTypeCountReadStatesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ConversationReadStateWhereInput;
};
export type ChatUserCountOutputTypeCountReactionsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ReactionWhereInput;
};
export type ChatUserSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    username?: boolean;
    displayName?: boolean;
    avatarUrl?: boolean;
    sourceUpdatedAt?: boolean;
    deletedAt?: boolean;
    memberships?: boolean | Prisma.ChatUser$membershipsArgs<ExtArgs>;
    dmsAsUserA?: boolean | Prisma.ChatUser$dmsAsUserAArgs<ExtArgs>;
    dmsAsUserB?: boolean | Prisma.ChatUser$dmsAsUserBArgs<ExtArgs>;
    messages?: boolean | Prisma.ChatUser$messagesArgs<ExtArgs>;
    readStates?: boolean | Prisma.ChatUser$readStatesArgs<ExtArgs>;
    reactions?: boolean | Prisma.ChatUser$reactionsArgs<ExtArgs>;
    _count?: boolean | Prisma.ChatUserCountOutputTypeDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["chatUser"]>;
export type ChatUserSelectCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    username?: boolean;
    displayName?: boolean;
    avatarUrl?: boolean;
    sourceUpdatedAt?: boolean;
    deletedAt?: boolean;
}, ExtArgs["result"]["chatUser"]>;
export type ChatUserSelectUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    username?: boolean;
    displayName?: boolean;
    avatarUrl?: boolean;
    sourceUpdatedAt?: boolean;
    deletedAt?: boolean;
}, ExtArgs["result"]["chatUser"]>;
export type ChatUserSelectScalar = {
    id?: boolean;
    username?: boolean;
    displayName?: boolean;
    avatarUrl?: boolean;
    sourceUpdatedAt?: boolean;
    deletedAt?: boolean;
};
export type ChatUserOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "username" | "displayName" | "avatarUrl" | "sourceUpdatedAt" | "deletedAt", ExtArgs["result"]["chatUser"]>;
export type ChatUserInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    memberships?: boolean | Prisma.ChatUser$membershipsArgs<ExtArgs>;
    dmsAsUserA?: boolean | Prisma.ChatUser$dmsAsUserAArgs<ExtArgs>;
    dmsAsUserB?: boolean | Prisma.ChatUser$dmsAsUserBArgs<ExtArgs>;
    messages?: boolean | Prisma.ChatUser$messagesArgs<ExtArgs>;
    readStates?: boolean | Prisma.ChatUser$readStatesArgs<ExtArgs>;
    reactions?: boolean | Prisma.ChatUser$reactionsArgs<ExtArgs>;
    _count?: boolean | Prisma.ChatUserCountOutputTypeDefaultArgs<ExtArgs>;
};
export type ChatUserIncludeCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {};
export type ChatUserIncludeUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {};
export type $ChatUserPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "ChatUser";
    objects: {
        memberships: Prisma.$GroupMemberPayload<ExtArgs>[];
        dmsAsUserA: Prisma.$ConversationPayload<ExtArgs>[];
        dmsAsUserB: Prisma.$ConversationPayload<ExtArgs>[];
        messages: Prisma.$MessagePayload<ExtArgs>[];
        readStates: Prisma.$ConversationReadStatePayload<ExtArgs>[];
        reactions: Prisma.$ReactionPayload<ExtArgs>[];
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        username: string | null;
        displayName: string | null;
        avatarUrl: string | null;
        sourceUpdatedAt: Date;
        deletedAt: Date | null;
    }, ExtArgs["result"]["chatUser"]>;
    composites: {};
};
export type ChatUserGetPayload<S extends boolean | null | undefined | ChatUserDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$ChatUserPayload, S>;
export type ChatUserCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<ChatUserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: ChatUserCountAggregateInputType | true;
};
export interface ChatUserDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['ChatUser'];
        meta: {
            name: 'ChatUser';
        };
    };
    findUnique<T extends ChatUserFindUniqueArgs>(args: Prisma.SelectSubset<T, ChatUserFindUniqueArgs<ExtArgs>>): Prisma.Prisma__ChatUserClient<runtime.Types.Result.GetResult<Prisma.$ChatUserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends ChatUserFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, ChatUserFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__ChatUserClient<runtime.Types.Result.GetResult<Prisma.$ChatUserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends ChatUserFindFirstArgs>(args?: Prisma.SelectSubset<T, ChatUserFindFirstArgs<ExtArgs>>): Prisma.Prisma__ChatUserClient<runtime.Types.Result.GetResult<Prisma.$ChatUserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends ChatUserFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, ChatUserFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__ChatUserClient<runtime.Types.Result.GetResult<Prisma.$ChatUserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends ChatUserFindManyArgs>(args?: Prisma.SelectSubset<T, ChatUserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ChatUserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends ChatUserCreateArgs>(args: Prisma.SelectSubset<T, ChatUserCreateArgs<ExtArgs>>): Prisma.Prisma__ChatUserClient<runtime.Types.Result.GetResult<Prisma.$ChatUserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends ChatUserCreateManyArgs>(args?: Prisma.SelectSubset<T, ChatUserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    createManyAndReturn<T extends ChatUserCreateManyAndReturnArgs>(args?: Prisma.SelectSubset<T, ChatUserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ChatUserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>;
    delete<T extends ChatUserDeleteArgs>(args: Prisma.SelectSubset<T, ChatUserDeleteArgs<ExtArgs>>): Prisma.Prisma__ChatUserClient<runtime.Types.Result.GetResult<Prisma.$ChatUserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends ChatUserUpdateArgs>(args: Prisma.SelectSubset<T, ChatUserUpdateArgs<ExtArgs>>): Prisma.Prisma__ChatUserClient<runtime.Types.Result.GetResult<Prisma.$ChatUserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends ChatUserDeleteManyArgs>(args?: Prisma.SelectSubset<T, ChatUserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends ChatUserUpdateManyArgs>(args: Prisma.SelectSubset<T, ChatUserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateManyAndReturn<T extends ChatUserUpdateManyAndReturnArgs>(args: Prisma.SelectSubset<T, ChatUserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ChatUserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>;
    upsert<T extends ChatUserUpsertArgs>(args: Prisma.SelectSubset<T, ChatUserUpsertArgs<ExtArgs>>): Prisma.Prisma__ChatUserClient<runtime.Types.Result.GetResult<Prisma.$ChatUserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends ChatUserCountArgs>(args?: Prisma.Subset<T, ChatUserCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], ChatUserCountAggregateOutputType> : number>;
    aggregate<T extends ChatUserAggregateArgs>(args: Prisma.Subset<T, ChatUserAggregateArgs>): Prisma.PrismaPromise<GetChatUserAggregateType<T>>;
    groupBy<T extends ChatUserGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: ChatUserGroupByArgs['orderBy'];
    } : {
        orderBy?: ChatUserGroupByArgs['orderBy'];
    }, OrderFields extends Prisma.ExcludeUnderscoreKeys<Prisma.Keys<Prisma.MaybeTupleToUnion<T['orderBy']>>>, ByFields extends Prisma.MaybeTupleToUnion<T['by']>, ByValid extends Prisma.Has<ByFields, OrderFields>, HavingFields extends Prisma.GetHavingFields<T['having']>, HavingValid extends Prisma.Has<ByFields, HavingFields>, ByEmpty extends T['by'] extends never[] ? Prisma.True : Prisma.False, InputErrors extends ByEmpty extends Prisma.True ? `Error: "by" must not be empty.` : HavingValid extends Prisma.False ? {
        [P in HavingFields]: P extends ByFields ? never : P extends string ? `Error: Field "${P}" used in "having" needs to be provided in "by".` : [
            Error,
            'Field ',
            P,
            ` in "having" needs to be provided in "by"`
        ];
    }[HavingFields] : 'take' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "take", you also need to provide "orderBy"' : 'skip' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "skip", you also need to provide "orderBy"' : ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, ChatUserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetChatUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: ChatUserFieldRefs;
}
export interface Prisma__ChatUserClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    memberships<T extends Prisma.ChatUser$membershipsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.ChatUser$membershipsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$GroupMemberPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    dmsAsUserA<T extends Prisma.ChatUser$dmsAsUserAArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.ChatUser$dmsAsUserAArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    dmsAsUserB<T extends Prisma.ChatUser$dmsAsUserBArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.ChatUser$dmsAsUserBArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    messages<T extends Prisma.ChatUser$messagesArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.ChatUser$messagesArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    readStates<T extends Prisma.ChatUser$readStatesArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.ChatUser$readStatesArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ConversationReadStatePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    reactions<T extends Prisma.ChatUser$reactionsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.ChatUser$reactionsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ReactionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface ChatUserFieldRefs {
    readonly id: Prisma.FieldRef<"ChatUser", 'String'>;
    readonly username: Prisma.FieldRef<"ChatUser", 'String'>;
    readonly displayName: Prisma.FieldRef<"ChatUser", 'String'>;
    readonly avatarUrl: Prisma.FieldRef<"ChatUser", 'String'>;
    readonly sourceUpdatedAt: Prisma.FieldRef<"ChatUser", 'DateTime'>;
    readonly deletedAt: Prisma.FieldRef<"ChatUser", 'DateTime'>;
}
export type ChatUserFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ChatUserSelect<ExtArgs> | null;
    omit?: Prisma.ChatUserOmit<ExtArgs> | null;
    include?: Prisma.ChatUserInclude<ExtArgs> | null;
    where: Prisma.ChatUserWhereUniqueInput;
};
export type ChatUserFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ChatUserSelect<ExtArgs> | null;
    omit?: Prisma.ChatUserOmit<ExtArgs> | null;
    include?: Prisma.ChatUserInclude<ExtArgs> | null;
    where: Prisma.ChatUserWhereUniqueInput;
};
export type ChatUserFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ChatUserSelect<ExtArgs> | null;
    omit?: Prisma.ChatUserOmit<ExtArgs> | null;
    include?: Prisma.ChatUserInclude<ExtArgs> | null;
    where?: Prisma.ChatUserWhereInput;
    orderBy?: Prisma.ChatUserOrderByWithRelationInput | Prisma.ChatUserOrderByWithRelationInput[];
    cursor?: Prisma.ChatUserWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.ChatUserScalarFieldEnum | Prisma.ChatUserScalarFieldEnum[];
};
export type ChatUserFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ChatUserSelect<ExtArgs> | null;
    omit?: Prisma.ChatUserOmit<ExtArgs> | null;
    include?: Prisma.ChatUserInclude<ExtArgs> | null;
    where?: Prisma.ChatUserWhereInput;
    orderBy?: Prisma.ChatUserOrderByWithRelationInput | Prisma.ChatUserOrderByWithRelationInput[];
    cursor?: Prisma.ChatUserWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.ChatUserScalarFieldEnum | Prisma.ChatUserScalarFieldEnum[];
};
export type ChatUserFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ChatUserSelect<ExtArgs> | null;
    omit?: Prisma.ChatUserOmit<ExtArgs> | null;
    include?: Prisma.ChatUserInclude<ExtArgs> | null;
    where?: Prisma.ChatUserWhereInput;
    orderBy?: Prisma.ChatUserOrderByWithRelationInput | Prisma.ChatUserOrderByWithRelationInput[];
    cursor?: Prisma.ChatUserWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.ChatUserScalarFieldEnum | Prisma.ChatUserScalarFieldEnum[];
};
export type ChatUserCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ChatUserSelect<ExtArgs> | null;
    omit?: Prisma.ChatUserOmit<ExtArgs> | null;
    include?: Prisma.ChatUserInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.ChatUserCreateInput, Prisma.ChatUserUncheckedCreateInput>;
};
export type ChatUserCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.ChatUserCreateManyInput | Prisma.ChatUserCreateManyInput[];
    skipDuplicates?: boolean;
};
export type ChatUserCreateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ChatUserSelectCreateManyAndReturn<ExtArgs> | null;
    omit?: Prisma.ChatUserOmit<ExtArgs> | null;
    data: Prisma.ChatUserCreateManyInput | Prisma.ChatUserCreateManyInput[];
    skipDuplicates?: boolean;
};
export type ChatUserUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ChatUserSelect<ExtArgs> | null;
    omit?: Prisma.ChatUserOmit<ExtArgs> | null;
    include?: Prisma.ChatUserInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.ChatUserUpdateInput, Prisma.ChatUserUncheckedUpdateInput>;
    where: Prisma.ChatUserWhereUniqueInput;
};
export type ChatUserUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.ChatUserUpdateManyMutationInput, Prisma.ChatUserUncheckedUpdateManyInput>;
    where?: Prisma.ChatUserWhereInput;
    limit?: number;
};
export type ChatUserUpdateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ChatUserSelectUpdateManyAndReturn<ExtArgs> | null;
    omit?: Prisma.ChatUserOmit<ExtArgs> | null;
    data: Prisma.XOR<Prisma.ChatUserUpdateManyMutationInput, Prisma.ChatUserUncheckedUpdateManyInput>;
    where?: Prisma.ChatUserWhereInput;
    limit?: number;
};
export type ChatUserUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ChatUserSelect<ExtArgs> | null;
    omit?: Prisma.ChatUserOmit<ExtArgs> | null;
    include?: Prisma.ChatUserInclude<ExtArgs> | null;
    where: Prisma.ChatUserWhereUniqueInput;
    create: Prisma.XOR<Prisma.ChatUserCreateInput, Prisma.ChatUserUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.ChatUserUpdateInput, Prisma.ChatUserUncheckedUpdateInput>;
};
export type ChatUserDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ChatUserSelect<ExtArgs> | null;
    omit?: Prisma.ChatUserOmit<ExtArgs> | null;
    include?: Prisma.ChatUserInclude<ExtArgs> | null;
    where: Prisma.ChatUserWhereUniqueInput;
};
export type ChatUserDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ChatUserWhereInput;
    limit?: number;
};
export type ChatUser$membershipsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.GroupMemberSelect<ExtArgs> | null;
    omit?: Prisma.GroupMemberOmit<ExtArgs> | null;
    include?: Prisma.GroupMemberInclude<ExtArgs> | null;
    where?: Prisma.GroupMemberWhereInput;
    orderBy?: Prisma.GroupMemberOrderByWithRelationInput | Prisma.GroupMemberOrderByWithRelationInput[];
    cursor?: Prisma.GroupMemberWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.GroupMemberScalarFieldEnum | Prisma.GroupMemberScalarFieldEnum[];
};
export type ChatUser$dmsAsUserAArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationSelect<ExtArgs> | null;
    omit?: Prisma.ConversationOmit<ExtArgs> | null;
    include?: Prisma.ConversationInclude<ExtArgs> | null;
    where?: Prisma.ConversationWhereInput;
    orderBy?: Prisma.ConversationOrderByWithRelationInput | Prisma.ConversationOrderByWithRelationInput[];
    cursor?: Prisma.ConversationWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.ConversationScalarFieldEnum | Prisma.ConversationScalarFieldEnum[];
};
export type ChatUser$dmsAsUserBArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationSelect<ExtArgs> | null;
    omit?: Prisma.ConversationOmit<ExtArgs> | null;
    include?: Prisma.ConversationInclude<ExtArgs> | null;
    where?: Prisma.ConversationWhereInput;
    orderBy?: Prisma.ConversationOrderByWithRelationInput | Prisma.ConversationOrderByWithRelationInput[];
    cursor?: Prisma.ConversationWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.ConversationScalarFieldEnum | Prisma.ConversationScalarFieldEnum[];
};
export type ChatUser$messagesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.MessageSelect<ExtArgs> | null;
    omit?: Prisma.MessageOmit<ExtArgs> | null;
    include?: Prisma.MessageInclude<ExtArgs> | null;
    where?: Prisma.MessageWhereInput;
    orderBy?: Prisma.MessageOrderByWithRelationInput | Prisma.MessageOrderByWithRelationInput[];
    cursor?: Prisma.MessageWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.MessageScalarFieldEnum | Prisma.MessageScalarFieldEnum[];
};
export type ChatUser$readStatesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationReadStateSelect<ExtArgs> | null;
    omit?: Prisma.ConversationReadStateOmit<ExtArgs> | null;
    include?: Prisma.ConversationReadStateInclude<ExtArgs> | null;
    where?: Prisma.ConversationReadStateWhereInput;
    orderBy?: Prisma.ConversationReadStateOrderByWithRelationInput | Prisma.ConversationReadStateOrderByWithRelationInput[];
    cursor?: Prisma.ConversationReadStateWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.ConversationReadStateScalarFieldEnum | Prisma.ConversationReadStateScalarFieldEnum[];
};
export type ChatUser$reactionsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ReactionSelect<ExtArgs> | null;
    omit?: Prisma.ReactionOmit<ExtArgs> | null;
    include?: Prisma.ReactionInclude<ExtArgs> | null;
    where?: Prisma.ReactionWhereInput;
    orderBy?: Prisma.ReactionOrderByWithRelationInput | Prisma.ReactionOrderByWithRelationInput[];
    cursor?: Prisma.ReactionWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.ReactionScalarFieldEnum | Prisma.ReactionScalarFieldEnum[];
};
export type ChatUserDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ChatUserSelect<ExtArgs> | null;
    omit?: Prisma.ChatUserOmit<ExtArgs> | null;
    include?: Prisma.ChatUserInclude<ExtArgs> | null;
};
