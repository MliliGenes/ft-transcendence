import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type MessageModel = runtime.Types.Result.DefaultSelection<Prisma.$MessagePayload>;
export type AggregateMessage = {
    _count: MessageCountAggregateOutputType | null;
    _avg: MessageAvgAggregateOutputType | null;
    _sum: MessageSumAggregateOutputType | null;
    _min: MessageMinAggregateOutputType | null;
    _max: MessageMaxAggregateOutputType | null;
};
export type MessageAvgAggregateOutputType = {
    version: number | null;
};
export type MessageSumAggregateOutputType = {
    version: number | null;
};
export type MessageMinAggregateOutputType = {
    id: string | null;
    conversationId: string | null;
    authorId: string | null;
    content: string | null;
    createdAt: Date | null;
    editedAt: Date | null;
    deletedAt: Date | null;
    clientRequestId: string | null;
    requestHash: string | null;
    version: number | null;
};
export type MessageMaxAggregateOutputType = {
    id: string | null;
    conversationId: string | null;
    authorId: string | null;
    content: string | null;
    createdAt: Date | null;
    editedAt: Date | null;
    deletedAt: Date | null;
    clientRequestId: string | null;
    requestHash: string | null;
    version: number | null;
};
export type MessageCountAggregateOutputType = {
    id: number;
    conversationId: number;
    authorId: number;
    content: number;
    attachments: number;
    createdAt: number;
    editedAt: number;
    deletedAt: number;
    clientRequestId: number;
    requestHash: number;
    version: number;
    _all: number;
};
export type MessageAvgAggregateInputType = {
    version?: true;
};
export type MessageSumAggregateInputType = {
    version?: true;
};
export type MessageMinAggregateInputType = {
    id?: true;
    conversationId?: true;
    authorId?: true;
    content?: true;
    createdAt?: true;
    editedAt?: true;
    deletedAt?: true;
    clientRequestId?: true;
    requestHash?: true;
    version?: true;
};
export type MessageMaxAggregateInputType = {
    id?: true;
    conversationId?: true;
    authorId?: true;
    content?: true;
    createdAt?: true;
    editedAt?: true;
    deletedAt?: true;
    clientRequestId?: true;
    requestHash?: true;
    version?: true;
};
export type MessageCountAggregateInputType = {
    id?: true;
    conversationId?: true;
    authorId?: true;
    content?: true;
    attachments?: true;
    createdAt?: true;
    editedAt?: true;
    deletedAt?: true;
    clientRequestId?: true;
    requestHash?: true;
    version?: true;
    _all?: true;
};
export type MessageAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.MessageWhereInput;
    orderBy?: Prisma.MessageOrderByWithRelationInput | Prisma.MessageOrderByWithRelationInput[];
    cursor?: Prisma.MessageWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | MessageCountAggregateInputType;
    _avg?: MessageAvgAggregateInputType;
    _sum?: MessageSumAggregateInputType;
    _min?: MessageMinAggregateInputType;
    _max?: MessageMaxAggregateInputType;
};
export type GetMessageAggregateType<T extends MessageAggregateArgs> = {
    [P in keyof T & keyof AggregateMessage]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateMessage[P]> : Prisma.GetScalarType<T[P], AggregateMessage[P]>;
};
export type MessageGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.MessageWhereInput;
    orderBy?: Prisma.MessageOrderByWithAggregationInput | Prisma.MessageOrderByWithAggregationInput[];
    by: Prisma.MessageScalarFieldEnum[] | Prisma.MessageScalarFieldEnum;
    having?: Prisma.MessageScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: MessageCountAggregateInputType | true;
    _avg?: MessageAvgAggregateInputType;
    _sum?: MessageSumAggregateInputType;
    _min?: MessageMinAggregateInputType;
    _max?: MessageMaxAggregateInputType;
};
export type MessageGroupByOutputType = {
    id: string;
    conversationId: string;
    authorId: string;
    content: string | null;
    attachments: string[];
    createdAt: Date;
    editedAt: Date | null;
    deletedAt: Date | null;
    clientRequestId: string;
    requestHash: string;
    version: number;
    _count: MessageCountAggregateOutputType | null;
    _avg: MessageAvgAggregateOutputType | null;
    _sum: MessageSumAggregateOutputType | null;
    _min: MessageMinAggregateOutputType | null;
    _max: MessageMaxAggregateOutputType | null;
};
export type GetMessageGroupByPayload<T extends MessageGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<MessageGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof MessageGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], MessageGroupByOutputType[P]> : Prisma.GetScalarType<T[P], MessageGroupByOutputType[P]>;
}>>;
export type MessageWhereInput = {
    AND?: Prisma.MessageWhereInput | Prisma.MessageWhereInput[];
    OR?: Prisma.MessageWhereInput[];
    NOT?: Prisma.MessageWhereInput | Prisma.MessageWhereInput[];
    id?: Prisma.UuidFilter<"Message"> | string;
    conversationId?: Prisma.UuidFilter<"Message"> | string;
    authorId?: Prisma.UuidFilter<"Message"> | string;
    content?: Prisma.StringNullableFilter<"Message"> | string | null;
    attachments?: Prisma.StringNullableListFilter<"Message">;
    createdAt?: Prisma.DateTimeFilter<"Message"> | Date | string;
    editedAt?: Prisma.DateTimeNullableFilter<"Message"> | Date | string | null;
    deletedAt?: Prisma.DateTimeNullableFilter<"Message"> | Date | string | null;
    clientRequestId?: Prisma.UuidFilter<"Message"> | string;
    requestHash?: Prisma.StringFilter<"Message"> | string;
    version?: Prisma.IntFilter<"Message"> | number;
    conversation?: Prisma.XOR<Prisma.ConversationScalarRelationFilter, Prisma.ConversationWhereInput>;
    author?: Prisma.XOR<Prisma.ChatUserScalarRelationFilter, Prisma.ChatUserWhereInput>;
    reactions?: Prisma.ReactionListRelationFilter;
};
export type MessageOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    conversationId?: Prisma.SortOrder;
    authorId?: Prisma.SortOrder;
    content?: Prisma.SortOrderInput | Prisma.SortOrder;
    attachments?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    editedAt?: Prisma.SortOrderInput | Prisma.SortOrder;
    deletedAt?: Prisma.SortOrderInput | Prisma.SortOrder;
    clientRequestId?: Prisma.SortOrder;
    requestHash?: Prisma.SortOrder;
    version?: Prisma.SortOrder;
    conversation?: Prisma.ConversationOrderByWithRelationInput;
    author?: Prisma.ChatUserOrderByWithRelationInput;
    reactions?: Prisma.ReactionOrderByRelationAggregateInput;
};
export type MessageWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    authorId_clientRequestId?: Prisma.MessageAuthorIdClientRequestIdCompoundUniqueInput;
    AND?: Prisma.MessageWhereInput | Prisma.MessageWhereInput[];
    OR?: Prisma.MessageWhereInput[];
    NOT?: Prisma.MessageWhereInput | Prisma.MessageWhereInput[];
    conversationId?: Prisma.UuidFilter<"Message"> | string;
    authorId?: Prisma.UuidFilter<"Message"> | string;
    content?: Prisma.StringNullableFilter<"Message"> | string | null;
    attachments?: Prisma.StringNullableListFilter<"Message">;
    createdAt?: Prisma.DateTimeFilter<"Message"> | Date | string;
    editedAt?: Prisma.DateTimeNullableFilter<"Message"> | Date | string | null;
    deletedAt?: Prisma.DateTimeNullableFilter<"Message"> | Date | string | null;
    clientRequestId?: Prisma.UuidFilter<"Message"> | string;
    requestHash?: Prisma.StringFilter<"Message"> | string;
    version?: Prisma.IntFilter<"Message"> | number;
    conversation?: Prisma.XOR<Prisma.ConversationScalarRelationFilter, Prisma.ConversationWhereInput>;
    author?: Prisma.XOR<Prisma.ChatUserScalarRelationFilter, Prisma.ChatUserWhereInput>;
    reactions?: Prisma.ReactionListRelationFilter;
}, "id" | "authorId_clientRequestId">;
export type MessageOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    conversationId?: Prisma.SortOrder;
    authorId?: Prisma.SortOrder;
    content?: Prisma.SortOrderInput | Prisma.SortOrder;
    attachments?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    editedAt?: Prisma.SortOrderInput | Prisma.SortOrder;
    deletedAt?: Prisma.SortOrderInput | Prisma.SortOrder;
    clientRequestId?: Prisma.SortOrder;
    requestHash?: Prisma.SortOrder;
    version?: Prisma.SortOrder;
    _count?: Prisma.MessageCountOrderByAggregateInput;
    _avg?: Prisma.MessageAvgOrderByAggregateInput;
    _max?: Prisma.MessageMaxOrderByAggregateInput;
    _min?: Prisma.MessageMinOrderByAggregateInput;
    _sum?: Prisma.MessageSumOrderByAggregateInput;
};
export type MessageScalarWhereWithAggregatesInput = {
    AND?: Prisma.MessageScalarWhereWithAggregatesInput | Prisma.MessageScalarWhereWithAggregatesInput[];
    OR?: Prisma.MessageScalarWhereWithAggregatesInput[];
    NOT?: Prisma.MessageScalarWhereWithAggregatesInput | Prisma.MessageScalarWhereWithAggregatesInput[];
    id?: Prisma.UuidWithAggregatesFilter<"Message"> | string;
    conversationId?: Prisma.UuidWithAggregatesFilter<"Message"> | string;
    authorId?: Prisma.UuidWithAggregatesFilter<"Message"> | string;
    content?: Prisma.StringNullableWithAggregatesFilter<"Message"> | string | null;
    attachments?: Prisma.StringNullableListFilter<"Message">;
    createdAt?: Prisma.DateTimeWithAggregatesFilter<"Message"> | Date | string;
    editedAt?: Prisma.DateTimeNullableWithAggregatesFilter<"Message"> | Date | string | null;
    deletedAt?: Prisma.DateTimeNullableWithAggregatesFilter<"Message"> | Date | string | null;
    clientRequestId?: Prisma.UuidWithAggregatesFilter<"Message"> | string;
    requestHash?: Prisma.StringWithAggregatesFilter<"Message"> | string;
    version?: Prisma.IntWithAggregatesFilter<"Message"> | number;
};
export type MessageCreateInput = {
    id?: string;
    content?: string | null;
    attachments?: Prisma.MessageCreateattachmentsInput | string[];
    createdAt?: Date | string;
    editedAt?: Date | string | null;
    deletedAt?: Date | string | null;
    clientRequestId: string;
    requestHash: string;
    version?: number;
    conversation: Prisma.ConversationCreateNestedOneWithoutMessagesInput;
    author: Prisma.ChatUserCreateNestedOneWithoutMessagesInput;
    reactions?: Prisma.ReactionCreateNestedManyWithoutMessageInput;
};
export type MessageUncheckedCreateInput = {
    id?: string;
    conversationId: string;
    authorId: string;
    content?: string | null;
    attachments?: Prisma.MessageCreateattachmentsInput | string[];
    createdAt?: Date | string;
    editedAt?: Date | string | null;
    deletedAt?: Date | string | null;
    clientRequestId: string;
    requestHash: string;
    version?: number;
    reactions?: Prisma.ReactionUncheckedCreateNestedManyWithoutMessageInput;
};
export type MessageUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    content?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attachments?: Prisma.MessageUpdateattachmentsInput | string[];
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    editedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    clientRequestId?: Prisma.StringFieldUpdateOperationsInput | string;
    requestHash?: Prisma.StringFieldUpdateOperationsInput | string;
    version?: Prisma.IntFieldUpdateOperationsInput | number;
    conversation?: Prisma.ConversationUpdateOneRequiredWithoutMessagesNestedInput;
    author?: Prisma.ChatUserUpdateOneRequiredWithoutMessagesNestedInput;
    reactions?: Prisma.ReactionUpdateManyWithoutMessageNestedInput;
};
export type MessageUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    conversationId?: Prisma.StringFieldUpdateOperationsInput | string;
    authorId?: Prisma.StringFieldUpdateOperationsInput | string;
    content?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attachments?: Prisma.MessageUpdateattachmentsInput | string[];
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    editedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    clientRequestId?: Prisma.StringFieldUpdateOperationsInput | string;
    requestHash?: Prisma.StringFieldUpdateOperationsInput | string;
    version?: Prisma.IntFieldUpdateOperationsInput | number;
    reactions?: Prisma.ReactionUncheckedUpdateManyWithoutMessageNestedInput;
};
export type MessageCreateManyInput = {
    id?: string;
    conversationId: string;
    authorId: string;
    content?: string | null;
    attachments?: Prisma.MessageCreateattachmentsInput | string[];
    createdAt?: Date | string;
    editedAt?: Date | string | null;
    deletedAt?: Date | string | null;
    clientRequestId: string;
    requestHash: string;
    version?: number;
};
export type MessageUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    content?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attachments?: Prisma.MessageUpdateattachmentsInput | string[];
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    editedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    clientRequestId?: Prisma.StringFieldUpdateOperationsInput | string;
    requestHash?: Prisma.StringFieldUpdateOperationsInput | string;
    version?: Prisma.IntFieldUpdateOperationsInput | number;
};
export type MessageUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    conversationId?: Prisma.StringFieldUpdateOperationsInput | string;
    authorId?: Prisma.StringFieldUpdateOperationsInput | string;
    content?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attachments?: Prisma.MessageUpdateattachmentsInput | string[];
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    editedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    clientRequestId?: Prisma.StringFieldUpdateOperationsInput | string;
    requestHash?: Prisma.StringFieldUpdateOperationsInput | string;
    version?: Prisma.IntFieldUpdateOperationsInput | number;
};
export type MessageListRelationFilter = {
    every?: Prisma.MessageWhereInput;
    some?: Prisma.MessageWhereInput;
    none?: Prisma.MessageWhereInput;
};
export type MessageOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type StringNullableListFilter<$PrismaModel = never> = {
    equals?: string[] | Prisma.ListStringFieldRefInput<$PrismaModel> | null;
    has?: string | Prisma.StringFieldRefInput<$PrismaModel> | null;
    hasEvery?: string[] | Prisma.ListStringFieldRefInput<$PrismaModel>;
    hasSome?: string[] | Prisma.ListStringFieldRefInput<$PrismaModel>;
    isEmpty?: boolean;
};
export type MessageAuthorIdClientRequestIdCompoundUniqueInput = {
    authorId: string;
    clientRequestId: string;
};
export type MessageCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    conversationId?: Prisma.SortOrder;
    authorId?: Prisma.SortOrder;
    content?: Prisma.SortOrder;
    attachments?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    editedAt?: Prisma.SortOrder;
    deletedAt?: Prisma.SortOrder;
    clientRequestId?: Prisma.SortOrder;
    requestHash?: Prisma.SortOrder;
    version?: Prisma.SortOrder;
};
export type MessageAvgOrderByAggregateInput = {
    version?: Prisma.SortOrder;
};
export type MessageMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    conversationId?: Prisma.SortOrder;
    authorId?: Prisma.SortOrder;
    content?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    editedAt?: Prisma.SortOrder;
    deletedAt?: Prisma.SortOrder;
    clientRequestId?: Prisma.SortOrder;
    requestHash?: Prisma.SortOrder;
    version?: Prisma.SortOrder;
};
export type MessageMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    conversationId?: Prisma.SortOrder;
    authorId?: Prisma.SortOrder;
    content?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    editedAt?: Prisma.SortOrder;
    deletedAt?: Prisma.SortOrder;
    clientRequestId?: Prisma.SortOrder;
    requestHash?: Prisma.SortOrder;
    version?: Prisma.SortOrder;
};
export type MessageSumOrderByAggregateInput = {
    version?: Prisma.SortOrder;
};
export type MessageScalarRelationFilter = {
    is?: Prisma.MessageWhereInput;
    isNot?: Prisma.MessageWhereInput;
};
export type MessageCreateNestedManyWithoutAuthorInput = {
    create?: Prisma.XOR<Prisma.MessageCreateWithoutAuthorInput, Prisma.MessageUncheckedCreateWithoutAuthorInput> | Prisma.MessageCreateWithoutAuthorInput[] | Prisma.MessageUncheckedCreateWithoutAuthorInput[];
    connectOrCreate?: Prisma.MessageCreateOrConnectWithoutAuthorInput | Prisma.MessageCreateOrConnectWithoutAuthorInput[];
    createMany?: Prisma.MessageCreateManyAuthorInputEnvelope;
    connect?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
};
export type MessageUncheckedCreateNestedManyWithoutAuthorInput = {
    create?: Prisma.XOR<Prisma.MessageCreateWithoutAuthorInput, Prisma.MessageUncheckedCreateWithoutAuthorInput> | Prisma.MessageCreateWithoutAuthorInput[] | Prisma.MessageUncheckedCreateWithoutAuthorInput[];
    connectOrCreate?: Prisma.MessageCreateOrConnectWithoutAuthorInput | Prisma.MessageCreateOrConnectWithoutAuthorInput[];
    createMany?: Prisma.MessageCreateManyAuthorInputEnvelope;
    connect?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
};
export type MessageUpdateManyWithoutAuthorNestedInput = {
    create?: Prisma.XOR<Prisma.MessageCreateWithoutAuthorInput, Prisma.MessageUncheckedCreateWithoutAuthorInput> | Prisma.MessageCreateWithoutAuthorInput[] | Prisma.MessageUncheckedCreateWithoutAuthorInput[];
    connectOrCreate?: Prisma.MessageCreateOrConnectWithoutAuthorInput | Prisma.MessageCreateOrConnectWithoutAuthorInput[];
    upsert?: Prisma.MessageUpsertWithWhereUniqueWithoutAuthorInput | Prisma.MessageUpsertWithWhereUniqueWithoutAuthorInput[];
    createMany?: Prisma.MessageCreateManyAuthorInputEnvelope;
    set?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
    disconnect?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
    delete?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
    connect?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
    update?: Prisma.MessageUpdateWithWhereUniqueWithoutAuthorInput | Prisma.MessageUpdateWithWhereUniqueWithoutAuthorInput[];
    updateMany?: Prisma.MessageUpdateManyWithWhereWithoutAuthorInput | Prisma.MessageUpdateManyWithWhereWithoutAuthorInput[];
    deleteMany?: Prisma.MessageScalarWhereInput | Prisma.MessageScalarWhereInput[];
};
export type MessageUncheckedUpdateManyWithoutAuthorNestedInput = {
    create?: Prisma.XOR<Prisma.MessageCreateWithoutAuthorInput, Prisma.MessageUncheckedCreateWithoutAuthorInput> | Prisma.MessageCreateWithoutAuthorInput[] | Prisma.MessageUncheckedCreateWithoutAuthorInput[];
    connectOrCreate?: Prisma.MessageCreateOrConnectWithoutAuthorInput | Prisma.MessageCreateOrConnectWithoutAuthorInput[];
    upsert?: Prisma.MessageUpsertWithWhereUniqueWithoutAuthorInput | Prisma.MessageUpsertWithWhereUniqueWithoutAuthorInput[];
    createMany?: Prisma.MessageCreateManyAuthorInputEnvelope;
    set?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
    disconnect?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
    delete?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
    connect?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
    update?: Prisma.MessageUpdateWithWhereUniqueWithoutAuthorInput | Prisma.MessageUpdateWithWhereUniqueWithoutAuthorInput[];
    updateMany?: Prisma.MessageUpdateManyWithWhereWithoutAuthorInput | Prisma.MessageUpdateManyWithWhereWithoutAuthorInput[];
    deleteMany?: Prisma.MessageScalarWhereInput | Prisma.MessageScalarWhereInput[];
};
export type MessageCreateNestedManyWithoutConversationInput = {
    create?: Prisma.XOR<Prisma.MessageCreateWithoutConversationInput, Prisma.MessageUncheckedCreateWithoutConversationInput> | Prisma.MessageCreateWithoutConversationInput[] | Prisma.MessageUncheckedCreateWithoutConversationInput[];
    connectOrCreate?: Prisma.MessageCreateOrConnectWithoutConversationInput | Prisma.MessageCreateOrConnectWithoutConversationInput[];
    createMany?: Prisma.MessageCreateManyConversationInputEnvelope;
    connect?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
};
export type MessageUncheckedCreateNestedManyWithoutConversationInput = {
    create?: Prisma.XOR<Prisma.MessageCreateWithoutConversationInput, Prisma.MessageUncheckedCreateWithoutConversationInput> | Prisma.MessageCreateWithoutConversationInput[] | Prisma.MessageUncheckedCreateWithoutConversationInput[];
    connectOrCreate?: Prisma.MessageCreateOrConnectWithoutConversationInput | Prisma.MessageCreateOrConnectWithoutConversationInput[];
    createMany?: Prisma.MessageCreateManyConversationInputEnvelope;
    connect?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
};
export type MessageUpdateManyWithoutConversationNestedInput = {
    create?: Prisma.XOR<Prisma.MessageCreateWithoutConversationInput, Prisma.MessageUncheckedCreateWithoutConversationInput> | Prisma.MessageCreateWithoutConversationInput[] | Prisma.MessageUncheckedCreateWithoutConversationInput[];
    connectOrCreate?: Prisma.MessageCreateOrConnectWithoutConversationInput | Prisma.MessageCreateOrConnectWithoutConversationInput[];
    upsert?: Prisma.MessageUpsertWithWhereUniqueWithoutConversationInput | Prisma.MessageUpsertWithWhereUniqueWithoutConversationInput[];
    createMany?: Prisma.MessageCreateManyConversationInputEnvelope;
    set?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
    disconnect?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
    delete?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
    connect?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
    update?: Prisma.MessageUpdateWithWhereUniqueWithoutConversationInput | Prisma.MessageUpdateWithWhereUniqueWithoutConversationInput[];
    updateMany?: Prisma.MessageUpdateManyWithWhereWithoutConversationInput | Prisma.MessageUpdateManyWithWhereWithoutConversationInput[];
    deleteMany?: Prisma.MessageScalarWhereInput | Prisma.MessageScalarWhereInput[];
};
export type MessageUncheckedUpdateManyWithoutConversationNestedInput = {
    create?: Prisma.XOR<Prisma.MessageCreateWithoutConversationInput, Prisma.MessageUncheckedCreateWithoutConversationInput> | Prisma.MessageCreateWithoutConversationInput[] | Prisma.MessageUncheckedCreateWithoutConversationInput[];
    connectOrCreate?: Prisma.MessageCreateOrConnectWithoutConversationInput | Prisma.MessageCreateOrConnectWithoutConversationInput[];
    upsert?: Prisma.MessageUpsertWithWhereUniqueWithoutConversationInput | Prisma.MessageUpsertWithWhereUniqueWithoutConversationInput[];
    createMany?: Prisma.MessageCreateManyConversationInputEnvelope;
    set?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
    disconnect?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
    delete?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
    connect?: Prisma.MessageWhereUniqueInput | Prisma.MessageWhereUniqueInput[];
    update?: Prisma.MessageUpdateWithWhereUniqueWithoutConversationInput | Prisma.MessageUpdateWithWhereUniqueWithoutConversationInput[];
    updateMany?: Prisma.MessageUpdateManyWithWhereWithoutConversationInput | Prisma.MessageUpdateManyWithWhereWithoutConversationInput[];
    deleteMany?: Prisma.MessageScalarWhereInput | Prisma.MessageScalarWhereInput[];
};
export type MessageCreateattachmentsInput = {
    set: string[];
};
export type MessageUpdateattachmentsInput = {
    set?: string[];
    push?: string | string[];
};
export type IntFieldUpdateOperationsInput = {
    set?: number;
    increment?: number;
    decrement?: number;
    multiply?: number;
    divide?: number;
};
export type MessageCreateNestedOneWithoutReactionsInput = {
    create?: Prisma.XOR<Prisma.MessageCreateWithoutReactionsInput, Prisma.MessageUncheckedCreateWithoutReactionsInput>;
    connectOrCreate?: Prisma.MessageCreateOrConnectWithoutReactionsInput;
    connect?: Prisma.MessageWhereUniqueInput;
};
export type MessageUpdateOneRequiredWithoutReactionsNestedInput = {
    create?: Prisma.XOR<Prisma.MessageCreateWithoutReactionsInput, Prisma.MessageUncheckedCreateWithoutReactionsInput>;
    connectOrCreate?: Prisma.MessageCreateOrConnectWithoutReactionsInput;
    upsert?: Prisma.MessageUpsertWithoutReactionsInput;
    connect?: Prisma.MessageWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.MessageUpdateToOneWithWhereWithoutReactionsInput, Prisma.MessageUpdateWithoutReactionsInput>, Prisma.MessageUncheckedUpdateWithoutReactionsInput>;
};
export type MessageCreateWithoutAuthorInput = {
    id?: string;
    content?: string | null;
    attachments?: Prisma.MessageCreateattachmentsInput | string[];
    createdAt?: Date | string;
    editedAt?: Date | string | null;
    deletedAt?: Date | string | null;
    clientRequestId: string;
    requestHash: string;
    version?: number;
    conversation: Prisma.ConversationCreateNestedOneWithoutMessagesInput;
    reactions?: Prisma.ReactionCreateNestedManyWithoutMessageInput;
};
export type MessageUncheckedCreateWithoutAuthorInput = {
    id?: string;
    conversationId: string;
    content?: string | null;
    attachments?: Prisma.MessageCreateattachmentsInput | string[];
    createdAt?: Date | string;
    editedAt?: Date | string | null;
    deletedAt?: Date | string | null;
    clientRequestId: string;
    requestHash: string;
    version?: number;
    reactions?: Prisma.ReactionUncheckedCreateNestedManyWithoutMessageInput;
};
export type MessageCreateOrConnectWithoutAuthorInput = {
    where: Prisma.MessageWhereUniqueInput;
    create: Prisma.XOR<Prisma.MessageCreateWithoutAuthorInput, Prisma.MessageUncheckedCreateWithoutAuthorInput>;
};
export type MessageCreateManyAuthorInputEnvelope = {
    data: Prisma.MessageCreateManyAuthorInput | Prisma.MessageCreateManyAuthorInput[];
    skipDuplicates?: boolean;
};
export type MessageUpsertWithWhereUniqueWithoutAuthorInput = {
    where: Prisma.MessageWhereUniqueInput;
    update: Prisma.XOR<Prisma.MessageUpdateWithoutAuthorInput, Prisma.MessageUncheckedUpdateWithoutAuthorInput>;
    create: Prisma.XOR<Prisma.MessageCreateWithoutAuthorInput, Prisma.MessageUncheckedCreateWithoutAuthorInput>;
};
export type MessageUpdateWithWhereUniqueWithoutAuthorInput = {
    where: Prisma.MessageWhereUniqueInput;
    data: Prisma.XOR<Prisma.MessageUpdateWithoutAuthorInput, Prisma.MessageUncheckedUpdateWithoutAuthorInput>;
};
export type MessageUpdateManyWithWhereWithoutAuthorInput = {
    where: Prisma.MessageScalarWhereInput;
    data: Prisma.XOR<Prisma.MessageUpdateManyMutationInput, Prisma.MessageUncheckedUpdateManyWithoutAuthorInput>;
};
export type MessageScalarWhereInput = {
    AND?: Prisma.MessageScalarWhereInput | Prisma.MessageScalarWhereInput[];
    OR?: Prisma.MessageScalarWhereInput[];
    NOT?: Prisma.MessageScalarWhereInput | Prisma.MessageScalarWhereInput[];
    id?: Prisma.UuidFilter<"Message"> | string;
    conversationId?: Prisma.UuidFilter<"Message"> | string;
    authorId?: Prisma.UuidFilter<"Message"> | string;
    content?: Prisma.StringNullableFilter<"Message"> | string | null;
    attachments?: Prisma.StringNullableListFilter<"Message">;
    createdAt?: Prisma.DateTimeFilter<"Message"> | Date | string;
    editedAt?: Prisma.DateTimeNullableFilter<"Message"> | Date | string | null;
    deletedAt?: Prisma.DateTimeNullableFilter<"Message"> | Date | string | null;
    clientRequestId?: Prisma.UuidFilter<"Message"> | string;
    requestHash?: Prisma.StringFilter<"Message"> | string;
    version?: Prisma.IntFilter<"Message"> | number;
};
export type MessageCreateWithoutConversationInput = {
    id?: string;
    content?: string | null;
    attachments?: Prisma.MessageCreateattachmentsInput | string[];
    createdAt?: Date | string;
    editedAt?: Date | string | null;
    deletedAt?: Date | string | null;
    clientRequestId: string;
    requestHash: string;
    version?: number;
    author: Prisma.ChatUserCreateNestedOneWithoutMessagesInput;
    reactions?: Prisma.ReactionCreateNestedManyWithoutMessageInput;
};
export type MessageUncheckedCreateWithoutConversationInput = {
    id?: string;
    authorId: string;
    content?: string | null;
    attachments?: Prisma.MessageCreateattachmentsInput | string[];
    createdAt?: Date | string;
    editedAt?: Date | string | null;
    deletedAt?: Date | string | null;
    clientRequestId: string;
    requestHash: string;
    version?: number;
    reactions?: Prisma.ReactionUncheckedCreateNestedManyWithoutMessageInput;
};
export type MessageCreateOrConnectWithoutConversationInput = {
    where: Prisma.MessageWhereUniqueInput;
    create: Prisma.XOR<Prisma.MessageCreateWithoutConversationInput, Prisma.MessageUncheckedCreateWithoutConversationInput>;
};
export type MessageCreateManyConversationInputEnvelope = {
    data: Prisma.MessageCreateManyConversationInput | Prisma.MessageCreateManyConversationInput[];
    skipDuplicates?: boolean;
};
export type MessageUpsertWithWhereUniqueWithoutConversationInput = {
    where: Prisma.MessageWhereUniqueInput;
    update: Prisma.XOR<Prisma.MessageUpdateWithoutConversationInput, Prisma.MessageUncheckedUpdateWithoutConversationInput>;
    create: Prisma.XOR<Prisma.MessageCreateWithoutConversationInput, Prisma.MessageUncheckedCreateWithoutConversationInput>;
};
export type MessageUpdateWithWhereUniqueWithoutConversationInput = {
    where: Prisma.MessageWhereUniqueInput;
    data: Prisma.XOR<Prisma.MessageUpdateWithoutConversationInput, Prisma.MessageUncheckedUpdateWithoutConversationInput>;
};
export type MessageUpdateManyWithWhereWithoutConversationInput = {
    where: Prisma.MessageScalarWhereInput;
    data: Prisma.XOR<Prisma.MessageUpdateManyMutationInput, Prisma.MessageUncheckedUpdateManyWithoutConversationInput>;
};
export type MessageCreateWithoutReactionsInput = {
    id?: string;
    content?: string | null;
    attachments?: Prisma.MessageCreateattachmentsInput | string[];
    createdAt?: Date | string;
    editedAt?: Date | string | null;
    deletedAt?: Date | string | null;
    clientRequestId: string;
    requestHash: string;
    version?: number;
    conversation: Prisma.ConversationCreateNestedOneWithoutMessagesInput;
    author: Prisma.ChatUserCreateNestedOneWithoutMessagesInput;
};
export type MessageUncheckedCreateWithoutReactionsInput = {
    id?: string;
    conversationId: string;
    authorId: string;
    content?: string | null;
    attachments?: Prisma.MessageCreateattachmentsInput | string[];
    createdAt?: Date | string;
    editedAt?: Date | string | null;
    deletedAt?: Date | string | null;
    clientRequestId: string;
    requestHash: string;
    version?: number;
};
export type MessageCreateOrConnectWithoutReactionsInput = {
    where: Prisma.MessageWhereUniqueInput;
    create: Prisma.XOR<Prisma.MessageCreateWithoutReactionsInput, Prisma.MessageUncheckedCreateWithoutReactionsInput>;
};
export type MessageUpsertWithoutReactionsInput = {
    update: Prisma.XOR<Prisma.MessageUpdateWithoutReactionsInput, Prisma.MessageUncheckedUpdateWithoutReactionsInput>;
    create: Prisma.XOR<Prisma.MessageCreateWithoutReactionsInput, Prisma.MessageUncheckedCreateWithoutReactionsInput>;
    where?: Prisma.MessageWhereInput;
};
export type MessageUpdateToOneWithWhereWithoutReactionsInput = {
    where?: Prisma.MessageWhereInput;
    data: Prisma.XOR<Prisma.MessageUpdateWithoutReactionsInput, Prisma.MessageUncheckedUpdateWithoutReactionsInput>;
};
export type MessageUpdateWithoutReactionsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    content?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attachments?: Prisma.MessageUpdateattachmentsInput | string[];
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    editedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    clientRequestId?: Prisma.StringFieldUpdateOperationsInput | string;
    requestHash?: Prisma.StringFieldUpdateOperationsInput | string;
    version?: Prisma.IntFieldUpdateOperationsInput | number;
    conversation?: Prisma.ConversationUpdateOneRequiredWithoutMessagesNestedInput;
    author?: Prisma.ChatUserUpdateOneRequiredWithoutMessagesNestedInput;
};
export type MessageUncheckedUpdateWithoutReactionsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    conversationId?: Prisma.StringFieldUpdateOperationsInput | string;
    authorId?: Prisma.StringFieldUpdateOperationsInput | string;
    content?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attachments?: Prisma.MessageUpdateattachmentsInput | string[];
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    editedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    clientRequestId?: Prisma.StringFieldUpdateOperationsInput | string;
    requestHash?: Prisma.StringFieldUpdateOperationsInput | string;
    version?: Prisma.IntFieldUpdateOperationsInput | number;
};
export type MessageCreateManyAuthorInput = {
    id?: string;
    conversationId: string;
    content?: string | null;
    attachments?: Prisma.MessageCreateattachmentsInput | string[];
    createdAt?: Date | string;
    editedAt?: Date | string | null;
    deletedAt?: Date | string | null;
    clientRequestId: string;
    requestHash: string;
    version?: number;
};
export type MessageUpdateWithoutAuthorInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    content?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attachments?: Prisma.MessageUpdateattachmentsInput | string[];
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    editedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    clientRequestId?: Prisma.StringFieldUpdateOperationsInput | string;
    requestHash?: Prisma.StringFieldUpdateOperationsInput | string;
    version?: Prisma.IntFieldUpdateOperationsInput | number;
    conversation?: Prisma.ConversationUpdateOneRequiredWithoutMessagesNestedInput;
    reactions?: Prisma.ReactionUpdateManyWithoutMessageNestedInput;
};
export type MessageUncheckedUpdateWithoutAuthorInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    conversationId?: Prisma.StringFieldUpdateOperationsInput | string;
    content?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attachments?: Prisma.MessageUpdateattachmentsInput | string[];
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    editedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    clientRequestId?: Prisma.StringFieldUpdateOperationsInput | string;
    requestHash?: Prisma.StringFieldUpdateOperationsInput | string;
    version?: Prisma.IntFieldUpdateOperationsInput | number;
    reactions?: Prisma.ReactionUncheckedUpdateManyWithoutMessageNestedInput;
};
export type MessageUncheckedUpdateManyWithoutAuthorInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    conversationId?: Prisma.StringFieldUpdateOperationsInput | string;
    content?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attachments?: Prisma.MessageUpdateattachmentsInput | string[];
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    editedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    clientRequestId?: Prisma.StringFieldUpdateOperationsInput | string;
    requestHash?: Prisma.StringFieldUpdateOperationsInput | string;
    version?: Prisma.IntFieldUpdateOperationsInput | number;
};
export type MessageCreateManyConversationInput = {
    id?: string;
    authorId: string;
    content?: string | null;
    attachments?: Prisma.MessageCreateattachmentsInput | string[];
    createdAt?: Date | string;
    editedAt?: Date | string | null;
    deletedAt?: Date | string | null;
    clientRequestId: string;
    requestHash: string;
    version?: number;
};
export type MessageUpdateWithoutConversationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    content?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attachments?: Prisma.MessageUpdateattachmentsInput | string[];
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    editedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    clientRequestId?: Prisma.StringFieldUpdateOperationsInput | string;
    requestHash?: Prisma.StringFieldUpdateOperationsInput | string;
    version?: Prisma.IntFieldUpdateOperationsInput | number;
    author?: Prisma.ChatUserUpdateOneRequiredWithoutMessagesNestedInput;
    reactions?: Prisma.ReactionUpdateManyWithoutMessageNestedInput;
};
export type MessageUncheckedUpdateWithoutConversationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    authorId?: Prisma.StringFieldUpdateOperationsInput | string;
    content?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attachments?: Prisma.MessageUpdateattachmentsInput | string[];
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    editedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    clientRequestId?: Prisma.StringFieldUpdateOperationsInput | string;
    requestHash?: Prisma.StringFieldUpdateOperationsInput | string;
    version?: Prisma.IntFieldUpdateOperationsInput | number;
    reactions?: Prisma.ReactionUncheckedUpdateManyWithoutMessageNestedInput;
};
export type MessageUncheckedUpdateManyWithoutConversationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    authorId?: Prisma.StringFieldUpdateOperationsInput | string;
    content?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attachments?: Prisma.MessageUpdateattachmentsInput | string[];
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    editedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    clientRequestId?: Prisma.StringFieldUpdateOperationsInput | string;
    requestHash?: Prisma.StringFieldUpdateOperationsInput | string;
    version?: Prisma.IntFieldUpdateOperationsInput | number;
};
export type MessageCountOutputType = {
    reactions: number;
};
export type MessageCountOutputTypeSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    reactions?: boolean | MessageCountOutputTypeCountReactionsArgs;
};
export type MessageCountOutputTypeDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.MessageCountOutputTypeSelect<ExtArgs> | null;
};
export type MessageCountOutputTypeCountReactionsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ReactionWhereInput;
};
export type MessageSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    conversationId?: boolean;
    authorId?: boolean;
    content?: boolean;
    attachments?: boolean;
    createdAt?: boolean;
    editedAt?: boolean;
    deletedAt?: boolean;
    clientRequestId?: boolean;
    requestHash?: boolean;
    version?: boolean;
    conversation?: boolean | Prisma.ConversationDefaultArgs<ExtArgs>;
    author?: boolean | Prisma.ChatUserDefaultArgs<ExtArgs>;
    reactions?: boolean | Prisma.Message$reactionsArgs<ExtArgs>;
    _count?: boolean | Prisma.MessageCountOutputTypeDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["message"]>;
export type MessageSelectCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    conversationId?: boolean;
    authorId?: boolean;
    content?: boolean;
    attachments?: boolean;
    createdAt?: boolean;
    editedAt?: boolean;
    deletedAt?: boolean;
    clientRequestId?: boolean;
    requestHash?: boolean;
    version?: boolean;
    conversation?: boolean | Prisma.ConversationDefaultArgs<ExtArgs>;
    author?: boolean | Prisma.ChatUserDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["message"]>;
export type MessageSelectUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    conversationId?: boolean;
    authorId?: boolean;
    content?: boolean;
    attachments?: boolean;
    createdAt?: boolean;
    editedAt?: boolean;
    deletedAt?: boolean;
    clientRequestId?: boolean;
    requestHash?: boolean;
    version?: boolean;
    conversation?: boolean | Prisma.ConversationDefaultArgs<ExtArgs>;
    author?: boolean | Prisma.ChatUserDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["message"]>;
export type MessageSelectScalar = {
    id?: boolean;
    conversationId?: boolean;
    authorId?: boolean;
    content?: boolean;
    attachments?: boolean;
    createdAt?: boolean;
    editedAt?: boolean;
    deletedAt?: boolean;
    clientRequestId?: boolean;
    requestHash?: boolean;
    version?: boolean;
};
export type MessageOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "conversationId" | "authorId" | "content" | "attachments" | "createdAt" | "editedAt" | "deletedAt" | "clientRequestId" | "requestHash" | "version", ExtArgs["result"]["message"]>;
export type MessageInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    conversation?: boolean | Prisma.ConversationDefaultArgs<ExtArgs>;
    author?: boolean | Prisma.ChatUserDefaultArgs<ExtArgs>;
    reactions?: boolean | Prisma.Message$reactionsArgs<ExtArgs>;
    _count?: boolean | Prisma.MessageCountOutputTypeDefaultArgs<ExtArgs>;
};
export type MessageIncludeCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    conversation?: boolean | Prisma.ConversationDefaultArgs<ExtArgs>;
    author?: boolean | Prisma.ChatUserDefaultArgs<ExtArgs>;
};
export type MessageIncludeUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    conversation?: boolean | Prisma.ConversationDefaultArgs<ExtArgs>;
    author?: boolean | Prisma.ChatUserDefaultArgs<ExtArgs>;
};
export type $MessagePayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "Message";
    objects: {
        conversation: Prisma.$ConversationPayload<ExtArgs>;
        author: Prisma.$ChatUserPayload<ExtArgs>;
        reactions: Prisma.$ReactionPayload<ExtArgs>[];
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        conversationId: string;
        authorId: string;
        content: string | null;
        attachments: string[];
        createdAt: Date;
        editedAt: Date | null;
        deletedAt: Date | null;
        clientRequestId: string;
        requestHash: string;
        version: number;
    }, ExtArgs["result"]["message"]>;
    composites: {};
};
export type MessageGetPayload<S extends boolean | null | undefined | MessageDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$MessagePayload, S>;
export type MessageCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<MessageFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: MessageCountAggregateInputType | true;
};
export interface MessageDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['Message'];
        meta: {
            name: 'Message';
        };
    };
    findUnique<T extends MessageFindUniqueArgs>(args: Prisma.SelectSubset<T, MessageFindUniqueArgs<ExtArgs>>): Prisma.Prisma__MessageClient<runtime.Types.Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends MessageFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, MessageFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__MessageClient<runtime.Types.Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends MessageFindFirstArgs>(args?: Prisma.SelectSubset<T, MessageFindFirstArgs<ExtArgs>>): Prisma.Prisma__MessageClient<runtime.Types.Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends MessageFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, MessageFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__MessageClient<runtime.Types.Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends MessageFindManyArgs>(args?: Prisma.SelectSubset<T, MessageFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends MessageCreateArgs>(args: Prisma.SelectSubset<T, MessageCreateArgs<ExtArgs>>): Prisma.Prisma__MessageClient<runtime.Types.Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends MessageCreateManyArgs>(args?: Prisma.SelectSubset<T, MessageCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    createManyAndReturn<T extends MessageCreateManyAndReturnArgs>(args?: Prisma.SelectSubset<T, MessageCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>;
    delete<T extends MessageDeleteArgs>(args: Prisma.SelectSubset<T, MessageDeleteArgs<ExtArgs>>): Prisma.Prisma__MessageClient<runtime.Types.Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends MessageUpdateArgs>(args: Prisma.SelectSubset<T, MessageUpdateArgs<ExtArgs>>): Prisma.Prisma__MessageClient<runtime.Types.Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends MessageDeleteManyArgs>(args?: Prisma.SelectSubset<T, MessageDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends MessageUpdateManyArgs>(args: Prisma.SelectSubset<T, MessageUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateManyAndReturn<T extends MessageUpdateManyAndReturnArgs>(args: Prisma.SelectSubset<T, MessageUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>;
    upsert<T extends MessageUpsertArgs>(args: Prisma.SelectSubset<T, MessageUpsertArgs<ExtArgs>>): Prisma.Prisma__MessageClient<runtime.Types.Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends MessageCountArgs>(args?: Prisma.Subset<T, MessageCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], MessageCountAggregateOutputType> : number>;
    aggregate<T extends MessageAggregateArgs>(args: Prisma.Subset<T, MessageAggregateArgs>): Prisma.PrismaPromise<GetMessageAggregateType<T>>;
    groupBy<T extends MessageGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: MessageGroupByArgs['orderBy'];
    } : {
        orderBy?: MessageGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, MessageGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMessageGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: MessageFieldRefs;
}
export interface Prisma__MessageClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    conversation<T extends Prisma.ConversationDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.ConversationDefaultArgs<ExtArgs>>): Prisma.Prisma__ConversationClient<runtime.Types.Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    author<T extends Prisma.ChatUserDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.ChatUserDefaultArgs<ExtArgs>>): Prisma.Prisma__ChatUserClient<runtime.Types.Result.GetResult<Prisma.$ChatUserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    reactions<T extends Prisma.Message$reactionsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.Message$reactionsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ReactionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface MessageFieldRefs {
    readonly id: Prisma.FieldRef<"Message", 'String'>;
    readonly conversationId: Prisma.FieldRef<"Message", 'String'>;
    readonly authorId: Prisma.FieldRef<"Message", 'String'>;
    readonly content: Prisma.FieldRef<"Message", 'String'>;
    readonly attachments: Prisma.FieldRef<"Message", 'String[]'>;
    readonly createdAt: Prisma.FieldRef<"Message", 'DateTime'>;
    readonly editedAt: Prisma.FieldRef<"Message", 'DateTime'>;
    readonly deletedAt: Prisma.FieldRef<"Message", 'DateTime'>;
    readonly clientRequestId: Prisma.FieldRef<"Message", 'String'>;
    readonly requestHash: Prisma.FieldRef<"Message", 'String'>;
    readonly version: Prisma.FieldRef<"Message", 'Int'>;
}
export type MessageFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.MessageSelect<ExtArgs> | null;
    omit?: Prisma.MessageOmit<ExtArgs> | null;
    include?: Prisma.MessageInclude<ExtArgs> | null;
    where: Prisma.MessageWhereUniqueInput;
};
export type MessageFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.MessageSelect<ExtArgs> | null;
    omit?: Prisma.MessageOmit<ExtArgs> | null;
    include?: Prisma.MessageInclude<ExtArgs> | null;
    where: Prisma.MessageWhereUniqueInput;
};
export type MessageFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type MessageFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type MessageFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type MessageCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.MessageSelect<ExtArgs> | null;
    omit?: Prisma.MessageOmit<ExtArgs> | null;
    include?: Prisma.MessageInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.MessageCreateInput, Prisma.MessageUncheckedCreateInput>;
};
export type MessageCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.MessageCreateManyInput | Prisma.MessageCreateManyInput[];
    skipDuplicates?: boolean;
};
export type MessageCreateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.MessageSelectCreateManyAndReturn<ExtArgs> | null;
    omit?: Prisma.MessageOmit<ExtArgs> | null;
    data: Prisma.MessageCreateManyInput | Prisma.MessageCreateManyInput[];
    skipDuplicates?: boolean;
    include?: Prisma.MessageIncludeCreateManyAndReturn<ExtArgs> | null;
};
export type MessageUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.MessageSelect<ExtArgs> | null;
    omit?: Prisma.MessageOmit<ExtArgs> | null;
    include?: Prisma.MessageInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.MessageUpdateInput, Prisma.MessageUncheckedUpdateInput>;
    where: Prisma.MessageWhereUniqueInput;
};
export type MessageUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.MessageUpdateManyMutationInput, Prisma.MessageUncheckedUpdateManyInput>;
    where?: Prisma.MessageWhereInput;
    limit?: number;
};
export type MessageUpdateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.MessageSelectUpdateManyAndReturn<ExtArgs> | null;
    omit?: Prisma.MessageOmit<ExtArgs> | null;
    data: Prisma.XOR<Prisma.MessageUpdateManyMutationInput, Prisma.MessageUncheckedUpdateManyInput>;
    where?: Prisma.MessageWhereInput;
    limit?: number;
    include?: Prisma.MessageIncludeUpdateManyAndReturn<ExtArgs> | null;
};
export type MessageUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.MessageSelect<ExtArgs> | null;
    omit?: Prisma.MessageOmit<ExtArgs> | null;
    include?: Prisma.MessageInclude<ExtArgs> | null;
    where: Prisma.MessageWhereUniqueInput;
    create: Prisma.XOR<Prisma.MessageCreateInput, Prisma.MessageUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.MessageUpdateInput, Prisma.MessageUncheckedUpdateInput>;
};
export type MessageDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.MessageSelect<ExtArgs> | null;
    omit?: Prisma.MessageOmit<ExtArgs> | null;
    include?: Prisma.MessageInclude<ExtArgs> | null;
    where: Prisma.MessageWhereUniqueInput;
};
export type MessageDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.MessageWhereInput;
    limit?: number;
};
export type Message$reactionsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type MessageDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.MessageSelect<ExtArgs> | null;
    omit?: Prisma.MessageOmit<ExtArgs> | null;
    include?: Prisma.MessageInclude<ExtArgs> | null;
};
