import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type ConversationReadStateModel = runtime.Types.Result.DefaultSelection<Prisma.$ConversationReadStatePayload>;
export type AggregateConversationReadState = {
    _count: ConversationReadStateCountAggregateOutputType | null;
    _min: ConversationReadStateMinAggregateOutputType | null;
    _max: ConversationReadStateMaxAggregateOutputType | null;
};
export type ConversationReadStateMinAggregateOutputType = {
    conversationId: string | null;
    userId: string | null;
    lastReadMessageId: string | null;
    updatedAt: Date | null;
};
export type ConversationReadStateMaxAggregateOutputType = {
    conversationId: string | null;
    userId: string | null;
    lastReadMessageId: string | null;
    updatedAt: Date | null;
};
export type ConversationReadStateCountAggregateOutputType = {
    conversationId: number;
    userId: number;
    lastReadMessageId: number;
    updatedAt: number;
    _all: number;
};
export type ConversationReadStateMinAggregateInputType = {
    conversationId?: true;
    userId?: true;
    lastReadMessageId?: true;
    updatedAt?: true;
};
export type ConversationReadStateMaxAggregateInputType = {
    conversationId?: true;
    userId?: true;
    lastReadMessageId?: true;
    updatedAt?: true;
};
export type ConversationReadStateCountAggregateInputType = {
    conversationId?: true;
    userId?: true;
    lastReadMessageId?: true;
    updatedAt?: true;
    _all?: true;
};
export type ConversationReadStateAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ConversationReadStateWhereInput;
    orderBy?: Prisma.ConversationReadStateOrderByWithRelationInput | Prisma.ConversationReadStateOrderByWithRelationInput[];
    cursor?: Prisma.ConversationReadStateWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | ConversationReadStateCountAggregateInputType;
    _min?: ConversationReadStateMinAggregateInputType;
    _max?: ConversationReadStateMaxAggregateInputType;
};
export type GetConversationReadStateAggregateType<T extends ConversationReadStateAggregateArgs> = {
    [P in keyof T & keyof AggregateConversationReadState]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateConversationReadState[P]> : Prisma.GetScalarType<T[P], AggregateConversationReadState[P]>;
};
export type ConversationReadStateGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ConversationReadStateWhereInput;
    orderBy?: Prisma.ConversationReadStateOrderByWithAggregationInput | Prisma.ConversationReadStateOrderByWithAggregationInput[];
    by: Prisma.ConversationReadStateScalarFieldEnum[] | Prisma.ConversationReadStateScalarFieldEnum;
    having?: Prisma.ConversationReadStateScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: ConversationReadStateCountAggregateInputType | true;
    _min?: ConversationReadStateMinAggregateInputType;
    _max?: ConversationReadStateMaxAggregateInputType;
};
export type ConversationReadStateGroupByOutputType = {
    conversationId: string;
    userId: string;
    lastReadMessageId: string | null;
    updatedAt: Date;
    _count: ConversationReadStateCountAggregateOutputType | null;
    _min: ConversationReadStateMinAggregateOutputType | null;
    _max: ConversationReadStateMaxAggregateOutputType | null;
};
export type GetConversationReadStateGroupByPayload<T extends ConversationReadStateGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<ConversationReadStateGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof ConversationReadStateGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], ConversationReadStateGroupByOutputType[P]> : Prisma.GetScalarType<T[P], ConversationReadStateGroupByOutputType[P]>;
}>>;
export type ConversationReadStateWhereInput = {
    AND?: Prisma.ConversationReadStateWhereInput | Prisma.ConversationReadStateWhereInput[];
    OR?: Prisma.ConversationReadStateWhereInput[];
    NOT?: Prisma.ConversationReadStateWhereInput | Prisma.ConversationReadStateWhereInput[];
    conversationId?: Prisma.UuidFilter<"ConversationReadState"> | string;
    userId?: Prisma.UuidFilter<"ConversationReadState"> | string;
    lastReadMessageId?: Prisma.UuidNullableFilter<"ConversationReadState"> | string | null;
    updatedAt?: Prisma.DateTimeFilter<"ConversationReadState"> | Date | string;
    conversation?: Prisma.XOR<Prisma.ConversationScalarRelationFilter, Prisma.ConversationWhereInput>;
    user?: Prisma.XOR<Prisma.ChatUserScalarRelationFilter, Prisma.ChatUserWhereInput>;
};
export type ConversationReadStateOrderByWithRelationInput = {
    conversationId?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    lastReadMessageId?: Prisma.SortOrderInput | Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    conversation?: Prisma.ConversationOrderByWithRelationInput;
    user?: Prisma.ChatUserOrderByWithRelationInput;
};
export type ConversationReadStateWhereUniqueInput = Prisma.AtLeast<{
    conversationId_userId?: Prisma.ConversationReadStateConversationIdUserIdCompoundUniqueInput;
    AND?: Prisma.ConversationReadStateWhereInput | Prisma.ConversationReadStateWhereInput[];
    OR?: Prisma.ConversationReadStateWhereInput[];
    NOT?: Prisma.ConversationReadStateWhereInput | Prisma.ConversationReadStateWhereInput[];
    conversationId?: Prisma.UuidFilter<"ConversationReadState"> | string;
    userId?: Prisma.UuidFilter<"ConversationReadState"> | string;
    lastReadMessageId?: Prisma.UuidNullableFilter<"ConversationReadState"> | string | null;
    updatedAt?: Prisma.DateTimeFilter<"ConversationReadState"> | Date | string;
    conversation?: Prisma.XOR<Prisma.ConversationScalarRelationFilter, Prisma.ConversationWhereInput>;
    user?: Prisma.XOR<Prisma.ChatUserScalarRelationFilter, Prisma.ChatUserWhereInput>;
}, "conversationId_userId">;
export type ConversationReadStateOrderByWithAggregationInput = {
    conversationId?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    lastReadMessageId?: Prisma.SortOrderInput | Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    _count?: Prisma.ConversationReadStateCountOrderByAggregateInput;
    _max?: Prisma.ConversationReadStateMaxOrderByAggregateInput;
    _min?: Prisma.ConversationReadStateMinOrderByAggregateInput;
};
export type ConversationReadStateScalarWhereWithAggregatesInput = {
    AND?: Prisma.ConversationReadStateScalarWhereWithAggregatesInput | Prisma.ConversationReadStateScalarWhereWithAggregatesInput[];
    OR?: Prisma.ConversationReadStateScalarWhereWithAggregatesInput[];
    NOT?: Prisma.ConversationReadStateScalarWhereWithAggregatesInput | Prisma.ConversationReadStateScalarWhereWithAggregatesInput[];
    conversationId?: Prisma.UuidWithAggregatesFilter<"ConversationReadState"> | string;
    userId?: Prisma.UuidWithAggregatesFilter<"ConversationReadState"> | string;
    lastReadMessageId?: Prisma.UuidNullableWithAggregatesFilter<"ConversationReadState"> | string | null;
    updatedAt?: Prisma.DateTimeWithAggregatesFilter<"ConversationReadState"> | Date | string;
};
export type ConversationReadStateCreateInput = {
    lastReadMessageId?: string | null;
    updatedAt?: Date | string;
    conversation: Prisma.ConversationCreateNestedOneWithoutReadStatesInput;
    user: Prisma.ChatUserCreateNestedOneWithoutReadStatesInput;
};
export type ConversationReadStateUncheckedCreateInput = {
    conversationId: string;
    userId: string;
    lastReadMessageId?: string | null;
    updatedAt?: Date | string;
};
export type ConversationReadStateUpdateInput = {
    lastReadMessageId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    conversation?: Prisma.ConversationUpdateOneRequiredWithoutReadStatesNestedInput;
    user?: Prisma.ChatUserUpdateOneRequiredWithoutReadStatesNestedInput;
};
export type ConversationReadStateUncheckedUpdateInput = {
    conversationId?: Prisma.StringFieldUpdateOperationsInput | string;
    userId?: Prisma.StringFieldUpdateOperationsInput | string;
    lastReadMessageId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type ConversationReadStateCreateManyInput = {
    conversationId: string;
    userId: string;
    lastReadMessageId?: string | null;
    updatedAt?: Date | string;
};
export type ConversationReadStateUpdateManyMutationInput = {
    lastReadMessageId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type ConversationReadStateUncheckedUpdateManyInput = {
    conversationId?: Prisma.StringFieldUpdateOperationsInput | string;
    userId?: Prisma.StringFieldUpdateOperationsInput | string;
    lastReadMessageId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type ConversationReadStateListRelationFilter = {
    every?: Prisma.ConversationReadStateWhereInput;
    some?: Prisma.ConversationReadStateWhereInput;
    none?: Prisma.ConversationReadStateWhereInput;
};
export type ConversationReadStateOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type ConversationReadStateConversationIdUserIdCompoundUniqueInput = {
    conversationId: string;
    userId: string;
};
export type ConversationReadStateCountOrderByAggregateInput = {
    conversationId?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    lastReadMessageId?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
};
export type ConversationReadStateMaxOrderByAggregateInput = {
    conversationId?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    lastReadMessageId?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
};
export type ConversationReadStateMinOrderByAggregateInput = {
    conversationId?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    lastReadMessageId?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
};
export type ConversationReadStateCreateNestedManyWithoutUserInput = {
    create?: Prisma.XOR<Prisma.ConversationReadStateCreateWithoutUserInput, Prisma.ConversationReadStateUncheckedCreateWithoutUserInput> | Prisma.ConversationReadStateCreateWithoutUserInput[] | Prisma.ConversationReadStateUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.ConversationReadStateCreateOrConnectWithoutUserInput | Prisma.ConversationReadStateCreateOrConnectWithoutUserInput[];
    createMany?: Prisma.ConversationReadStateCreateManyUserInputEnvelope;
    connect?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
};
export type ConversationReadStateUncheckedCreateNestedManyWithoutUserInput = {
    create?: Prisma.XOR<Prisma.ConversationReadStateCreateWithoutUserInput, Prisma.ConversationReadStateUncheckedCreateWithoutUserInput> | Prisma.ConversationReadStateCreateWithoutUserInput[] | Prisma.ConversationReadStateUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.ConversationReadStateCreateOrConnectWithoutUserInput | Prisma.ConversationReadStateCreateOrConnectWithoutUserInput[];
    createMany?: Prisma.ConversationReadStateCreateManyUserInputEnvelope;
    connect?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
};
export type ConversationReadStateUpdateManyWithoutUserNestedInput = {
    create?: Prisma.XOR<Prisma.ConversationReadStateCreateWithoutUserInput, Prisma.ConversationReadStateUncheckedCreateWithoutUserInput> | Prisma.ConversationReadStateCreateWithoutUserInput[] | Prisma.ConversationReadStateUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.ConversationReadStateCreateOrConnectWithoutUserInput | Prisma.ConversationReadStateCreateOrConnectWithoutUserInput[];
    upsert?: Prisma.ConversationReadStateUpsertWithWhereUniqueWithoutUserInput | Prisma.ConversationReadStateUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: Prisma.ConversationReadStateCreateManyUserInputEnvelope;
    set?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
    disconnect?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
    delete?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
    connect?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
    update?: Prisma.ConversationReadStateUpdateWithWhereUniqueWithoutUserInput | Prisma.ConversationReadStateUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?: Prisma.ConversationReadStateUpdateManyWithWhereWithoutUserInput | Prisma.ConversationReadStateUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: Prisma.ConversationReadStateScalarWhereInput | Prisma.ConversationReadStateScalarWhereInput[];
};
export type ConversationReadStateUncheckedUpdateManyWithoutUserNestedInput = {
    create?: Prisma.XOR<Prisma.ConversationReadStateCreateWithoutUserInput, Prisma.ConversationReadStateUncheckedCreateWithoutUserInput> | Prisma.ConversationReadStateCreateWithoutUserInput[] | Prisma.ConversationReadStateUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.ConversationReadStateCreateOrConnectWithoutUserInput | Prisma.ConversationReadStateCreateOrConnectWithoutUserInput[];
    upsert?: Prisma.ConversationReadStateUpsertWithWhereUniqueWithoutUserInput | Prisma.ConversationReadStateUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: Prisma.ConversationReadStateCreateManyUserInputEnvelope;
    set?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
    disconnect?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
    delete?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
    connect?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
    update?: Prisma.ConversationReadStateUpdateWithWhereUniqueWithoutUserInput | Prisma.ConversationReadStateUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?: Prisma.ConversationReadStateUpdateManyWithWhereWithoutUserInput | Prisma.ConversationReadStateUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: Prisma.ConversationReadStateScalarWhereInput | Prisma.ConversationReadStateScalarWhereInput[];
};
export type ConversationReadStateCreateNestedManyWithoutConversationInput = {
    create?: Prisma.XOR<Prisma.ConversationReadStateCreateWithoutConversationInput, Prisma.ConversationReadStateUncheckedCreateWithoutConversationInput> | Prisma.ConversationReadStateCreateWithoutConversationInput[] | Prisma.ConversationReadStateUncheckedCreateWithoutConversationInput[];
    connectOrCreate?: Prisma.ConversationReadStateCreateOrConnectWithoutConversationInput | Prisma.ConversationReadStateCreateOrConnectWithoutConversationInput[];
    createMany?: Prisma.ConversationReadStateCreateManyConversationInputEnvelope;
    connect?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
};
export type ConversationReadStateUncheckedCreateNestedManyWithoutConversationInput = {
    create?: Prisma.XOR<Prisma.ConversationReadStateCreateWithoutConversationInput, Prisma.ConversationReadStateUncheckedCreateWithoutConversationInput> | Prisma.ConversationReadStateCreateWithoutConversationInput[] | Prisma.ConversationReadStateUncheckedCreateWithoutConversationInput[];
    connectOrCreate?: Prisma.ConversationReadStateCreateOrConnectWithoutConversationInput | Prisma.ConversationReadStateCreateOrConnectWithoutConversationInput[];
    createMany?: Prisma.ConversationReadStateCreateManyConversationInputEnvelope;
    connect?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
};
export type ConversationReadStateUpdateManyWithoutConversationNestedInput = {
    create?: Prisma.XOR<Prisma.ConversationReadStateCreateWithoutConversationInput, Prisma.ConversationReadStateUncheckedCreateWithoutConversationInput> | Prisma.ConversationReadStateCreateWithoutConversationInput[] | Prisma.ConversationReadStateUncheckedCreateWithoutConversationInput[];
    connectOrCreate?: Prisma.ConversationReadStateCreateOrConnectWithoutConversationInput | Prisma.ConversationReadStateCreateOrConnectWithoutConversationInput[];
    upsert?: Prisma.ConversationReadStateUpsertWithWhereUniqueWithoutConversationInput | Prisma.ConversationReadStateUpsertWithWhereUniqueWithoutConversationInput[];
    createMany?: Prisma.ConversationReadStateCreateManyConversationInputEnvelope;
    set?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
    disconnect?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
    delete?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
    connect?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
    update?: Prisma.ConversationReadStateUpdateWithWhereUniqueWithoutConversationInput | Prisma.ConversationReadStateUpdateWithWhereUniqueWithoutConversationInput[];
    updateMany?: Prisma.ConversationReadStateUpdateManyWithWhereWithoutConversationInput | Prisma.ConversationReadStateUpdateManyWithWhereWithoutConversationInput[];
    deleteMany?: Prisma.ConversationReadStateScalarWhereInput | Prisma.ConversationReadStateScalarWhereInput[];
};
export type ConversationReadStateUncheckedUpdateManyWithoutConversationNestedInput = {
    create?: Prisma.XOR<Prisma.ConversationReadStateCreateWithoutConversationInput, Prisma.ConversationReadStateUncheckedCreateWithoutConversationInput> | Prisma.ConversationReadStateCreateWithoutConversationInput[] | Prisma.ConversationReadStateUncheckedCreateWithoutConversationInput[];
    connectOrCreate?: Prisma.ConversationReadStateCreateOrConnectWithoutConversationInput | Prisma.ConversationReadStateCreateOrConnectWithoutConversationInput[];
    upsert?: Prisma.ConversationReadStateUpsertWithWhereUniqueWithoutConversationInput | Prisma.ConversationReadStateUpsertWithWhereUniqueWithoutConversationInput[];
    createMany?: Prisma.ConversationReadStateCreateManyConversationInputEnvelope;
    set?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
    disconnect?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
    delete?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
    connect?: Prisma.ConversationReadStateWhereUniqueInput | Prisma.ConversationReadStateWhereUniqueInput[];
    update?: Prisma.ConversationReadStateUpdateWithWhereUniqueWithoutConversationInput | Prisma.ConversationReadStateUpdateWithWhereUniqueWithoutConversationInput[];
    updateMany?: Prisma.ConversationReadStateUpdateManyWithWhereWithoutConversationInput | Prisma.ConversationReadStateUpdateManyWithWhereWithoutConversationInput[];
    deleteMany?: Prisma.ConversationReadStateScalarWhereInput | Prisma.ConversationReadStateScalarWhereInput[];
};
export type ConversationReadStateCreateWithoutUserInput = {
    lastReadMessageId?: string | null;
    updatedAt?: Date | string;
    conversation: Prisma.ConversationCreateNestedOneWithoutReadStatesInput;
};
export type ConversationReadStateUncheckedCreateWithoutUserInput = {
    conversationId: string;
    lastReadMessageId?: string | null;
    updatedAt?: Date | string;
};
export type ConversationReadStateCreateOrConnectWithoutUserInput = {
    where: Prisma.ConversationReadStateWhereUniqueInput;
    create: Prisma.XOR<Prisma.ConversationReadStateCreateWithoutUserInput, Prisma.ConversationReadStateUncheckedCreateWithoutUserInput>;
};
export type ConversationReadStateCreateManyUserInputEnvelope = {
    data: Prisma.ConversationReadStateCreateManyUserInput | Prisma.ConversationReadStateCreateManyUserInput[];
    skipDuplicates?: boolean;
};
export type ConversationReadStateUpsertWithWhereUniqueWithoutUserInput = {
    where: Prisma.ConversationReadStateWhereUniqueInput;
    update: Prisma.XOR<Prisma.ConversationReadStateUpdateWithoutUserInput, Prisma.ConversationReadStateUncheckedUpdateWithoutUserInput>;
    create: Prisma.XOR<Prisma.ConversationReadStateCreateWithoutUserInput, Prisma.ConversationReadStateUncheckedCreateWithoutUserInput>;
};
export type ConversationReadStateUpdateWithWhereUniqueWithoutUserInput = {
    where: Prisma.ConversationReadStateWhereUniqueInput;
    data: Prisma.XOR<Prisma.ConversationReadStateUpdateWithoutUserInput, Prisma.ConversationReadStateUncheckedUpdateWithoutUserInput>;
};
export type ConversationReadStateUpdateManyWithWhereWithoutUserInput = {
    where: Prisma.ConversationReadStateScalarWhereInput;
    data: Prisma.XOR<Prisma.ConversationReadStateUpdateManyMutationInput, Prisma.ConversationReadStateUncheckedUpdateManyWithoutUserInput>;
};
export type ConversationReadStateScalarWhereInput = {
    AND?: Prisma.ConversationReadStateScalarWhereInput | Prisma.ConversationReadStateScalarWhereInput[];
    OR?: Prisma.ConversationReadStateScalarWhereInput[];
    NOT?: Prisma.ConversationReadStateScalarWhereInput | Prisma.ConversationReadStateScalarWhereInput[];
    conversationId?: Prisma.UuidFilter<"ConversationReadState"> | string;
    userId?: Prisma.UuidFilter<"ConversationReadState"> | string;
    lastReadMessageId?: Prisma.UuidNullableFilter<"ConversationReadState"> | string | null;
    updatedAt?: Prisma.DateTimeFilter<"ConversationReadState"> | Date | string;
};
export type ConversationReadStateCreateWithoutConversationInput = {
    lastReadMessageId?: string | null;
    updatedAt?: Date | string;
    user: Prisma.ChatUserCreateNestedOneWithoutReadStatesInput;
};
export type ConversationReadStateUncheckedCreateWithoutConversationInput = {
    userId: string;
    lastReadMessageId?: string | null;
    updatedAt?: Date | string;
};
export type ConversationReadStateCreateOrConnectWithoutConversationInput = {
    where: Prisma.ConversationReadStateWhereUniqueInput;
    create: Prisma.XOR<Prisma.ConversationReadStateCreateWithoutConversationInput, Prisma.ConversationReadStateUncheckedCreateWithoutConversationInput>;
};
export type ConversationReadStateCreateManyConversationInputEnvelope = {
    data: Prisma.ConversationReadStateCreateManyConversationInput | Prisma.ConversationReadStateCreateManyConversationInput[];
    skipDuplicates?: boolean;
};
export type ConversationReadStateUpsertWithWhereUniqueWithoutConversationInput = {
    where: Prisma.ConversationReadStateWhereUniqueInput;
    update: Prisma.XOR<Prisma.ConversationReadStateUpdateWithoutConversationInput, Prisma.ConversationReadStateUncheckedUpdateWithoutConversationInput>;
    create: Prisma.XOR<Prisma.ConversationReadStateCreateWithoutConversationInput, Prisma.ConversationReadStateUncheckedCreateWithoutConversationInput>;
};
export type ConversationReadStateUpdateWithWhereUniqueWithoutConversationInput = {
    where: Prisma.ConversationReadStateWhereUniqueInput;
    data: Prisma.XOR<Prisma.ConversationReadStateUpdateWithoutConversationInput, Prisma.ConversationReadStateUncheckedUpdateWithoutConversationInput>;
};
export type ConversationReadStateUpdateManyWithWhereWithoutConversationInput = {
    where: Prisma.ConversationReadStateScalarWhereInput;
    data: Prisma.XOR<Prisma.ConversationReadStateUpdateManyMutationInput, Prisma.ConversationReadStateUncheckedUpdateManyWithoutConversationInput>;
};
export type ConversationReadStateCreateManyUserInput = {
    conversationId: string;
    lastReadMessageId?: string | null;
    updatedAt?: Date | string;
};
export type ConversationReadStateUpdateWithoutUserInput = {
    lastReadMessageId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    conversation?: Prisma.ConversationUpdateOneRequiredWithoutReadStatesNestedInput;
};
export type ConversationReadStateUncheckedUpdateWithoutUserInput = {
    conversationId?: Prisma.StringFieldUpdateOperationsInput | string;
    lastReadMessageId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type ConversationReadStateUncheckedUpdateManyWithoutUserInput = {
    conversationId?: Prisma.StringFieldUpdateOperationsInput | string;
    lastReadMessageId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type ConversationReadStateCreateManyConversationInput = {
    userId: string;
    lastReadMessageId?: string | null;
    updatedAt?: Date | string;
};
export type ConversationReadStateUpdateWithoutConversationInput = {
    lastReadMessageId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    user?: Prisma.ChatUserUpdateOneRequiredWithoutReadStatesNestedInput;
};
export type ConversationReadStateUncheckedUpdateWithoutConversationInput = {
    userId?: Prisma.StringFieldUpdateOperationsInput | string;
    lastReadMessageId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type ConversationReadStateUncheckedUpdateManyWithoutConversationInput = {
    userId?: Prisma.StringFieldUpdateOperationsInput | string;
    lastReadMessageId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type ConversationReadStateSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    conversationId?: boolean;
    userId?: boolean;
    lastReadMessageId?: boolean;
    updatedAt?: boolean;
    conversation?: boolean | Prisma.ConversationDefaultArgs<ExtArgs>;
    user?: boolean | Prisma.ChatUserDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["conversationReadState"]>;
export type ConversationReadStateSelectCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    conversationId?: boolean;
    userId?: boolean;
    lastReadMessageId?: boolean;
    updatedAt?: boolean;
    conversation?: boolean | Prisma.ConversationDefaultArgs<ExtArgs>;
    user?: boolean | Prisma.ChatUserDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["conversationReadState"]>;
export type ConversationReadStateSelectUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    conversationId?: boolean;
    userId?: boolean;
    lastReadMessageId?: boolean;
    updatedAt?: boolean;
    conversation?: boolean | Prisma.ConversationDefaultArgs<ExtArgs>;
    user?: boolean | Prisma.ChatUserDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["conversationReadState"]>;
export type ConversationReadStateSelectScalar = {
    conversationId?: boolean;
    userId?: boolean;
    lastReadMessageId?: boolean;
    updatedAt?: boolean;
};
export type ConversationReadStateOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"conversationId" | "userId" | "lastReadMessageId" | "updatedAt", ExtArgs["result"]["conversationReadState"]>;
export type ConversationReadStateInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    conversation?: boolean | Prisma.ConversationDefaultArgs<ExtArgs>;
    user?: boolean | Prisma.ChatUserDefaultArgs<ExtArgs>;
};
export type ConversationReadStateIncludeCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    conversation?: boolean | Prisma.ConversationDefaultArgs<ExtArgs>;
    user?: boolean | Prisma.ChatUserDefaultArgs<ExtArgs>;
};
export type ConversationReadStateIncludeUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    conversation?: boolean | Prisma.ConversationDefaultArgs<ExtArgs>;
    user?: boolean | Prisma.ChatUserDefaultArgs<ExtArgs>;
};
export type $ConversationReadStatePayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "ConversationReadState";
    objects: {
        conversation: Prisma.$ConversationPayload<ExtArgs>;
        user: Prisma.$ChatUserPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        conversationId: string;
        userId: string;
        lastReadMessageId: string | null;
        updatedAt: Date;
    }, ExtArgs["result"]["conversationReadState"]>;
    composites: {};
};
export type ConversationReadStateGetPayload<S extends boolean | null | undefined | ConversationReadStateDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$ConversationReadStatePayload, S>;
export type ConversationReadStateCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<ConversationReadStateFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: ConversationReadStateCountAggregateInputType | true;
};
export interface ConversationReadStateDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['ConversationReadState'];
        meta: {
            name: 'ConversationReadState';
        };
    };
    findUnique<T extends ConversationReadStateFindUniqueArgs>(args: Prisma.SelectSubset<T, ConversationReadStateFindUniqueArgs<ExtArgs>>): Prisma.Prisma__ConversationReadStateClient<runtime.Types.Result.GetResult<Prisma.$ConversationReadStatePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends ConversationReadStateFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, ConversationReadStateFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__ConversationReadStateClient<runtime.Types.Result.GetResult<Prisma.$ConversationReadStatePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends ConversationReadStateFindFirstArgs>(args?: Prisma.SelectSubset<T, ConversationReadStateFindFirstArgs<ExtArgs>>): Prisma.Prisma__ConversationReadStateClient<runtime.Types.Result.GetResult<Prisma.$ConversationReadStatePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends ConversationReadStateFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, ConversationReadStateFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__ConversationReadStateClient<runtime.Types.Result.GetResult<Prisma.$ConversationReadStatePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends ConversationReadStateFindManyArgs>(args?: Prisma.SelectSubset<T, ConversationReadStateFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ConversationReadStatePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends ConversationReadStateCreateArgs>(args: Prisma.SelectSubset<T, ConversationReadStateCreateArgs<ExtArgs>>): Prisma.Prisma__ConversationReadStateClient<runtime.Types.Result.GetResult<Prisma.$ConversationReadStatePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends ConversationReadStateCreateManyArgs>(args?: Prisma.SelectSubset<T, ConversationReadStateCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    createManyAndReturn<T extends ConversationReadStateCreateManyAndReturnArgs>(args?: Prisma.SelectSubset<T, ConversationReadStateCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ConversationReadStatePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>;
    delete<T extends ConversationReadStateDeleteArgs>(args: Prisma.SelectSubset<T, ConversationReadStateDeleteArgs<ExtArgs>>): Prisma.Prisma__ConversationReadStateClient<runtime.Types.Result.GetResult<Prisma.$ConversationReadStatePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends ConversationReadStateUpdateArgs>(args: Prisma.SelectSubset<T, ConversationReadStateUpdateArgs<ExtArgs>>): Prisma.Prisma__ConversationReadStateClient<runtime.Types.Result.GetResult<Prisma.$ConversationReadStatePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends ConversationReadStateDeleteManyArgs>(args?: Prisma.SelectSubset<T, ConversationReadStateDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends ConversationReadStateUpdateManyArgs>(args: Prisma.SelectSubset<T, ConversationReadStateUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateManyAndReturn<T extends ConversationReadStateUpdateManyAndReturnArgs>(args: Prisma.SelectSubset<T, ConversationReadStateUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ConversationReadStatePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>;
    upsert<T extends ConversationReadStateUpsertArgs>(args: Prisma.SelectSubset<T, ConversationReadStateUpsertArgs<ExtArgs>>): Prisma.Prisma__ConversationReadStateClient<runtime.Types.Result.GetResult<Prisma.$ConversationReadStatePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends ConversationReadStateCountArgs>(args?: Prisma.Subset<T, ConversationReadStateCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], ConversationReadStateCountAggregateOutputType> : number>;
    aggregate<T extends ConversationReadStateAggregateArgs>(args: Prisma.Subset<T, ConversationReadStateAggregateArgs>): Prisma.PrismaPromise<GetConversationReadStateAggregateType<T>>;
    groupBy<T extends ConversationReadStateGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: ConversationReadStateGroupByArgs['orderBy'];
    } : {
        orderBy?: ConversationReadStateGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, ConversationReadStateGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetConversationReadStateGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: ConversationReadStateFieldRefs;
}
export interface Prisma__ConversationReadStateClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    conversation<T extends Prisma.ConversationDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.ConversationDefaultArgs<ExtArgs>>): Prisma.Prisma__ConversationClient<runtime.Types.Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    user<T extends Prisma.ChatUserDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.ChatUserDefaultArgs<ExtArgs>>): Prisma.Prisma__ChatUserClient<runtime.Types.Result.GetResult<Prisma.$ChatUserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface ConversationReadStateFieldRefs {
    readonly conversationId: Prisma.FieldRef<"ConversationReadState", 'String'>;
    readonly userId: Prisma.FieldRef<"ConversationReadState", 'String'>;
    readonly lastReadMessageId: Prisma.FieldRef<"ConversationReadState", 'String'>;
    readonly updatedAt: Prisma.FieldRef<"ConversationReadState", 'DateTime'>;
}
export type ConversationReadStateFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationReadStateSelect<ExtArgs> | null;
    omit?: Prisma.ConversationReadStateOmit<ExtArgs> | null;
    include?: Prisma.ConversationReadStateInclude<ExtArgs> | null;
    where: Prisma.ConversationReadStateWhereUniqueInput;
};
export type ConversationReadStateFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationReadStateSelect<ExtArgs> | null;
    omit?: Prisma.ConversationReadStateOmit<ExtArgs> | null;
    include?: Prisma.ConversationReadStateInclude<ExtArgs> | null;
    where: Prisma.ConversationReadStateWhereUniqueInput;
};
export type ConversationReadStateFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type ConversationReadStateFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type ConversationReadStateFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type ConversationReadStateCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationReadStateSelect<ExtArgs> | null;
    omit?: Prisma.ConversationReadStateOmit<ExtArgs> | null;
    include?: Prisma.ConversationReadStateInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.ConversationReadStateCreateInput, Prisma.ConversationReadStateUncheckedCreateInput>;
};
export type ConversationReadStateCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.ConversationReadStateCreateManyInput | Prisma.ConversationReadStateCreateManyInput[];
    skipDuplicates?: boolean;
};
export type ConversationReadStateCreateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationReadStateSelectCreateManyAndReturn<ExtArgs> | null;
    omit?: Prisma.ConversationReadStateOmit<ExtArgs> | null;
    data: Prisma.ConversationReadStateCreateManyInput | Prisma.ConversationReadStateCreateManyInput[];
    skipDuplicates?: boolean;
    include?: Prisma.ConversationReadStateIncludeCreateManyAndReturn<ExtArgs> | null;
};
export type ConversationReadStateUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationReadStateSelect<ExtArgs> | null;
    omit?: Prisma.ConversationReadStateOmit<ExtArgs> | null;
    include?: Prisma.ConversationReadStateInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.ConversationReadStateUpdateInput, Prisma.ConversationReadStateUncheckedUpdateInput>;
    where: Prisma.ConversationReadStateWhereUniqueInput;
};
export type ConversationReadStateUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.ConversationReadStateUpdateManyMutationInput, Prisma.ConversationReadStateUncheckedUpdateManyInput>;
    where?: Prisma.ConversationReadStateWhereInput;
    limit?: number;
};
export type ConversationReadStateUpdateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationReadStateSelectUpdateManyAndReturn<ExtArgs> | null;
    omit?: Prisma.ConversationReadStateOmit<ExtArgs> | null;
    data: Prisma.XOR<Prisma.ConversationReadStateUpdateManyMutationInput, Prisma.ConversationReadStateUncheckedUpdateManyInput>;
    where?: Prisma.ConversationReadStateWhereInput;
    limit?: number;
    include?: Prisma.ConversationReadStateIncludeUpdateManyAndReturn<ExtArgs> | null;
};
export type ConversationReadStateUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationReadStateSelect<ExtArgs> | null;
    omit?: Prisma.ConversationReadStateOmit<ExtArgs> | null;
    include?: Prisma.ConversationReadStateInclude<ExtArgs> | null;
    where: Prisma.ConversationReadStateWhereUniqueInput;
    create: Prisma.XOR<Prisma.ConversationReadStateCreateInput, Prisma.ConversationReadStateUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.ConversationReadStateUpdateInput, Prisma.ConversationReadStateUncheckedUpdateInput>;
};
export type ConversationReadStateDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationReadStateSelect<ExtArgs> | null;
    omit?: Prisma.ConversationReadStateOmit<ExtArgs> | null;
    include?: Prisma.ConversationReadStateInclude<ExtArgs> | null;
    where: Prisma.ConversationReadStateWhereUniqueInput;
};
export type ConversationReadStateDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ConversationReadStateWhereInput;
    limit?: number;
};
export type ConversationReadStateDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationReadStateSelect<ExtArgs> | null;
    omit?: Prisma.ConversationReadStateOmit<ExtArgs> | null;
    include?: Prisma.ConversationReadStateInclude<ExtArgs> | null;
};
