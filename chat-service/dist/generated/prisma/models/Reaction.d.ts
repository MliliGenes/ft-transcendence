import type * as runtime from "@prisma/client/runtime/client";
import type * as $Enums from "../enums.js";
import type * as Prisma from "../internal/prismaNamespace.js";
export type ReactionModel = runtime.Types.Result.DefaultSelection<Prisma.$ReactionPayload>;
export type AggregateReaction = {
    _count: ReactionCountAggregateOutputType | null;
    _min: ReactionMinAggregateOutputType | null;
    _max: ReactionMaxAggregateOutputType | null;
};
export type ReactionMinAggregateOutputType = {
    messageId: string | null;
    userId: string | null;
    emoji: $Enums.ReactionEmoji | null;
    createdAt: Date | null;
};
export type ReactionMaxAggregateOutputType = {
    messageId: string | null;
    userId: string | null;
    emoji: $Enums.ReactionEmoji | null;
    createdAt: Date | null;
};
export type ReactionCountAggregateOutputType = {
    messageId: number;
    userId: number;
    emoji: number;
    createdAt: number;
    _all: number;
};
export type ReactionMinAggregateInputType = {
    messageId?: true;
    userId?: true;
    emoji?: true;
    createdAt?: true;
};
export type ReactionMaxAggregateInputType = {
    messageId?: true;
    userId?: true;
    emoji?: true;
    createdAt?: true;
};
export type ReactionCountAggregateInputType = {
    messageId?: true;
    userId?: true;
    emoji?: true;
    createdAt?: true;
    _all?: true;
};
export type ReactionAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ReactionWhereInput;
    orderBy?: Prisma.ReactionOrderByWithRelationInput | Prisma.ReactionOrderByWithRelationInput[];
    cursor?: Prisma.ReactionWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | ReactionCountAggregateInputType;
    _min?: ReactionMinAggregateInputType;
    _max?: ReactionMaxAggregateInputType;
};
export type GetReactionAggregateType<T extends ReactionAggregateArgs> = {
    [P in keyof T & keyof AggregateReaction]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateReaction[P]> : Prisma.GetScalarType<T[P], AggregateReaction[P]>;
};
export type ReactionGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ReactionWhereInput;
    orderBy?: Prisma.ReactionOrderByWithAggregationInput | Prisma.ReactionOrderByWithAggregationInput[];
    by: Prisma.ReactionScalarFieldEnum[] | Prisma.ReactionScalarFieldEnum;
    having?: Prisma.ReactionScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: ReactionCountAggregateInputType | true;
    _min?: ReactionMinAggregateInputType;
    _max?: ReactionMaxAggregateInputType;
};
export type ReactionGroupByOutputType = {
    messageId: string;
    userId: string;
    emoji: $Enums.ReactionEmoji;
    createdAt: Date;
    _count: ReactionCountAggregateOutputType | null;
    _min: ReactionMinAggregateOutputType | null;
    _max: ReactionMaxAggregateOutputType | null;
};
export type GetReactionGroupByPayload<T extends ReactionGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<ReactionGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof ReactionGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], ReactionGroupByOutputType[P]> : Prisma.GetScalarType<T[P], ReactionGroupByOutputType[P]>;
}>>;
export type ReactionWhereInput = {
    AND?: Prisma.ReactionWhereInput | Prisma.ReactionWhereInput[];
    OR?: Prisma.ReactionWhereInput[];
    NOT?: Prisma.ReactionWhereInput | Prisma.ReactionWhereInput[];
    messageId?: Prisma.UuidFilter<"Reaction"> | string;
    userId?: Prisma.UuidFilter<"Reaction"> | string;
    emoji?: Prisma.EnumReactionEmojiFilter<"Reaction"> | $Enums.ReactionEmoji;
    createdAt?: Prisma.DateTimeFilter<"Reaction"> | Date | string;
    message?: Prisma.XOR<Prisma.MessageScalarRelationFilter, Prisma.MessageWhereInput>;
    user?: Prisma.XOR<Prisma.ChatUserScalarRelationFilter, Prisma.ChatUserWhereInput>;
};
export type ReactionOrderByWithRelationInput = {
    messageId?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    emoji?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    message?: Prisma.MessageOrderByWithRelationInput;
    user?: Prisma.ChatUserOrderByWithRelationInput;
};
export type ReactionWhereUniqueInput = Prisma.AtLeast<{
    messageId_userId_emoji?: Prisma.ReactionMessageIdUserIdEmojiCompoundUniqueInput;
    AND?: Prisma.ReactionWhereInput | Prisma.ReactionWhereInput[];
    OR?: Prisma.ReactionWhereInput[];
    NOT?: Prisma.ReactionWhereInput | Prisma.ReactionWhereInput[];
    messageId?: Prisma.UuidFilter<"Reaction"> | string;
    userId?: Prisma.UuidFilter<"Reaction"> | string;
    emoji?: Prisma.EnumReactionEmojiFilter<"Reaction"> | $Enums.ReactionEmoji;
    createdAt?: Prisma.DateTimeFilter<"Reaction"> | Date | string;
    message?: Prisma.XOR<Prisma.MessageScalarRelationFilter, Prisma.MessageWhereInput>;
    user?: Prisma.XOR<Prisma.ChatUserScalarRelationFilter, Prisma.ChatUserWhereInput>;
}, "messageId_userId_emoji">;
export type ReactionOrderByWithAggregationInput = {
    messageId?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    emoji?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    _count?: Prisma.ReactionCountOrderByAggregateInput;
    _max?: Prisma.ReactionMaxOrderByAggregateInput;
    _min?: Prisma.ReactionMinOrderByAggregateInput;
};
export type ReactionScalarWhereWithAggregatesInput = {
    AND?: Prisma.ReactionScalarWhereWithAggregatesInput | Prisma.ReactionScalarWhereWithAggregatesInput[];
    OR?: Prisma.ReactionScalarWhereWithAggregatesInput[];
    NOT?: Prisma.ReactionScalarWhereWithAggregatesInput | Prisma.ReactionScalarWhereWithAggregatesInput[];
    messageId?: Prisma.UuidWithAggregatesFilter<"Reaction"> | string;
    userId?: Prisma.UuidWithAggregatesFilter<"Reaction"> | string;
    emoji?: Prisma.EnumReactionEmojiWithAggregatesFilter<"Reaction"> | $Enums.ReactionEmoji;
    createdAt?: Prisma.DateTimeWithAggregatesFilter<"Reaction"> | Date | string;
};
export type ReactionCreateInput = {
    emoji: $Enums.ReactionEmoji;
    createdAt?: Date | string;
    message: Prisma.MessageCreateNestedOneWithoutReactionsInput;
    user: Prisma.ChatUserCreateNestedOneWithoutReactionsInput;
};
export type ReactionUncheckedCreateInput = {
    messageId: string;
    userId: string;
    emoji: $Enums.ReactionEmoji;
    createdAt?: Date | string;
};
export type ReactionUpdateInput = {
    emoji?: Prisma.EnumReactionEmojiFieldUpdateOperationsInput | $Enums.ReactionEmoji;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    message?: Prisma.MessageUpdateOneRequiredWithoutReactionsNestedInput;
    user?: Prisma.ChatUserUpdateOneRequiredWithoutReactionsNestedInput;
};
export type ReactionUncheckedUpdateInput = {
    messageId?: Prisma.StringFieldUpdateOperationsInput | string;
    userId?: Prisma.StringFieldUpdateOperationsInput | string;
    emoji?: Prisma.EnumReactionEmojiFieldUpdateOperationsInput | $Enums.ReactionEmoji;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type ReactionCreateManyInput = {
    messageId: string;
    userId: string;
    emoji: $Enums.ReactionEmoji;
    createdAt?: Date | string;
};
export type ReactionUpdateManyMutationInput = {
    emoji?: Prisma.EnumReactionEmojiFieldUpdateOperationsInput | $Enums.ReactionEmoji;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type ReactionUncheckedUpdateManyInput = {
    messageId?: Prisma.StringFieldUpdateOperationsInput | string;
    userId?: Prisma.StringFieldUpdateOperationsInput | string;
    emoji?: Prisma.EnumReactionEmojiFieldUpdateOperationsInput | $Enums.ReactionEmoji;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type ReactionListRelationFilter = {
    every?: Prisma.ReactionWhereInput;
    some?: Prisma.ReactionWhereInput;
    none?: Prisma.ReactionWhereInput;
};
export type ReactionOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type ReactionMessageIdUserIdEmojiCompoundUniqueInput = {
    messageId: string;
    userId: string;
    emoji: $Enums.ReactionEmoji;
};
export type ReactionCountOrderByAggregateInput = {
    messageId?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    emoji?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
};
export type ReactionMaxOrderByAggregateInput = {
    messageId?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    emoji?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
};
export type ReactionMinOrderByAggregateInput = {
    messageId?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    emoji?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
};
export type ReactionCreateNestedManyWithoutUserInput = {
    create?: Prisma.XOR<Prisma.ReactionCreateWithoutUserInput, Prisma.ReactionUncheckedCreateWithoutUserInput> | Prisma.ReactionCreateWithoutUserInput[] | Prisma.ReactionUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.ReactionCreateOrConnectWithoutUserInput | Prisma.ReactionCreateOrConnectWithoutUserInput[];
    createMany?: Prisma.ReactionCreateManyUserInputEnvelope;
    connect?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
};
export type ReactionUncheckedCreateNestedManyWithoutUserInput = {
    create?: Prisma.XOR<Prisma.ReactionCreateWithoutUserInput, Prisma.ReactionUncheckedCreateWithoutUserInput> | Prisma.ReactionCreateWithoutUserInput[] | Prisma.ReactionUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.ReactionCreateOrConnectWithoutUserInput | Prisma.ReactionCreateOrConnectWithoutUserInput[];
    createMany?: Prisma.ReactionCreateManyUserInputEnvelope;
    connect?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
};
export type ReactionUpdateManyWithoutUserNestedInput = {
    create?: Prisma.XOR<Prisma.ReactionCreateWithoutUserInput, Prisma.ReactionUncheckedCreateWithoutUserInput> | Prisma.ReactionCreateWithoutUserInput[] | Prisma.ReactionUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.ReactionCreateOrConnectWithoutUserInput | Prisma.ReactionCreateOrConnectWithoutUserInput[];
    upsert?: Prisma.ReactionUpsertWithWhereUniqueWithoutUserInput | Prisma.ReactionUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: Prisma.ReactionCreateManyUserInputEnvelope;
    set?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
    disconnect?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
    delete?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
    connect?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
    update?: Prisma.ReactionUpdateWithWhereUniqueWithoutUserInput | Prisma.ReactionUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?: Prisma.ReactionUpdateManyWithWhereWithoutUserInput | Prisma.ReactionUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: Prisma.ReactionScalarWhereInput | Prisma.ReactionScalarWhereInput[];
};
export type ReactionUncheckedUpdateManyWithoutUserNestedInput = {
    create?: Prisma.XOR<Prisma.ReactionCreateWithoutUserInput, Prisma.ReactionUncheckedCreateWithoutUserInput> | Prisma.ReactionCreateWithoutUserInput[] | Prisma.ReactionUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.ReactionCreateOrConnectWithoutUserInput | Prisma.ReactionCreateOrConnectWithoutUserInput[];
    upsert?: Prisma.ReactionUpsertWithWhereUniqueWithoutUserInput | Prisma.ReactionUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: Prisma.ReactionCreateManyUserInputEnvelope;
    set?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
    disconnect?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
    delete?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
    connect?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
    update?: Prisma.ReactionUpdateWithWhereUniqueWithoutUserInput | Prisma.ReactionUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?: Prisma.ReactionUpdateManyWithWhereWithoutUserInput | Prisma.ReactionUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: Prisma.ReactionScalarWhereInput | Prisma.ReactionScalarWhereInput[];
};
export type ReactionCreateNestedManyWithoutMessageInput = {
    create?: Prisma.XOR<Prisma.ReactionCreateWithoutMessageInput, Prisma.ReactionUncheckedCreateWithoutMessageInput> | Prisma.ReactionCreateWithoutMessageInput[] | Prisma.ReactionUncheckedCreateWithoutMessageInput[];
    connectOrCreate?: Prisma.ReactionCreateOrConnectWithoutMessageInput | Prisma.ReactionCreateOrConnectWithoutMessageInput[];
    createMany?: Prisma.ReactionCreateManyMessageInputEnvelope;
    connect?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
};
export type ReactionUncheckedCreateNestedManyWithoutMessageInput = {
    create?: Prisma.XOR<Prisma.ReactionCreateWithoutMessageInput, Prisma.ReactionUncheckedCreateWithoutMessageInput> | Prisma.ReactionCreateWithoutMessageInput[] | Prisma.ReactionUncheckedCreateWithoutMessageInput[];
    connectOrCreate?: Prisma.ReactionCreateOrConnectWithoutMessageInput | Prisma.ReactionCreateOrConnectWithoutMessageInput[];
    createMany?: Prisma.ReactionCreateManyMessageInputEnvelope;
    connect?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
};
export type ReactionUpdateManyWithoutMessageNestedInput = {
    create?: Prisma.XOR<Prisma.ReactionCreateWithoutMessageInput, Prisma.ReactionUncheckedCreateWithoutMessageInput> | Prisma.ReactionCreateWithoutMessageInput[] | Prisma.ReactionUncheckedCreateWithoutMessageInput[];
    connectOrCreate?: Prisma.ReactionCreateOrConnectWithoutMessageInput | Prisma.ReactionCreateOrConnectWithoutMessageInput[];
    upsert?: Prisma.ReactionUpsertWithWhereUniqueWithoutMessageInput | Prisma.ReactionUpsertWithWhereUniqueWithoutMessageInput[];
    createMany?: Prisma.ReactionCreateManyMessageInputEnvelope;
    set?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
    disconnect?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
    delete?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
    connect?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
    update?: Prisma.ReactionUpdateWithWhereUniqueWithoutMessageInput | Prisma.ReactionUpdateWithWhereUniqueWithoutMessageInput[];
    updateMany?: Prisma.ReactionUpdateManyWithWhereWithoutMessageInput | Prisma.ReactionUpdateManyWithWhereWithoutMessageInput[];
    deleteMany?: Prisma.ReactionScalarWhereInput | Prisma.ReactionScalarWhereInput[];
};
export type ReactionUncheckedUpdateManyWithoutMessageNestedInput = {
    create?: Prisma.XOR<Prisma.ReactionCreateWithoutMessageInput, Prisma.ReactionUncheckedCreateWithoutMessageInput> | Prisma.ReactionCreateWithoutMessageInput[] | Prisma.ReactionUncheckedCreateWithoutMessageInput[];
    connectOrCreate?: Prisma.ReactionCreateOrConnectWithoutMessageInput | Prisma.ReactionCreateOrConnectWithoutMessageInput[];
    upsert?: Prisma.ReactionUpsertWithWhereUniqueWithoutMessageInput | Prisma.ReactionUpsertWithWhereUniqueWithoutMessageInput[];
    createMany?: Prisma.ReactionCreateManyMessageInputEnvelope;
    set?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
    disconnect?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
    delete?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
    connect?: Prisma.ReactionWhereUniqueInput | Prisma.ReactionWhereUniqueInput[];
    update?: Prisma.ReactionUpdateWithWhereUniqueWithoutMessageInput | Prisma.ReactionUpdateWithWhereUniqueWithoutMessageInput[];
    updateMany?: Prisma.ReactionUpdateManyWithWhereWithoutMessageInput | Prisma.ReactionUpdateManyWithWhereWithoutMessageInput[];
    deleteMany?: Prisma.ReactionScalarWhereInput | Prisma.ReactionScalarWhereInput[];
};
export type EnumReactionEmojiFieldUpdateOperationsInput = {
    set?: $Enums.ReactionEmoji;
};
export type ReactionCreateWithoutUserInput = {
    emoji: $Enums.ReactionEmoji;
    createdAt?: Date | string;
    message: Prisma.MessageCreateNestedOneWithoutReactionsInput;
};
export type ReactionUncheckedCreateWithoutUserInput = {
    messageId: string;
    emoji: $Enums.ReactionEmoji;
    createdAt?: Date | string;
};
export type ReactionCreateOrConnectWithoutUserInput = {
    where: Prisma.ReactionWhereUniqueInput;
    create: Prisma.XOR<Prisma.ReactionCreateWithoutUserInput, Prisma.ReactionUncheckedCreateWithoutUserInput>;
};
export type ReactionCreateManyUserInputEnvelope = {
    data: Prisma.ReactionCreateManyUserInput | Prisma.ReactionCreateManyUserInput[];
    skipDuplicates?: boolean;
};
export type ReactionUpsertWithWhereUniqueWithoutUserInput = {
    where: Prisma.ReactionWhereUniqueInput;
    update: Prisma.XOR<Prisma.ReactionUpdateWithoutUserInput, Prisma.ReactionUncheckedUpdateWithoutUserInput>;
    create: Prisma.XOR<Prisma.ReactionCreateWithoutUserInput, Prisma.ReactionUncheckedCreateWithoutUserInput>;
};
export type ReactionUpdateWithWhereUniqueWithoutUserInput = {
    where: Prisma.ReactionWhereUniqueInput;
    data: Prisma.XOR<Prisma.ReactionUpdateWithoutUserInput, Prisma.ReactionUncheckedUpdateWithoutUserInput>;
};
export type ReactionUpdateManyWithWhereWithoutUserInput = {
    where: Prisma.ReactionScalarWhereInput;
    data: Prisma.XOR<Prisma.ReactionUpdateManyMutationInput, Prisma.ReactionUncheckedUpdateManyWithoutUserInput>;
};
export type ReactionScalarWhereInput = {
    AND?: Prisma.ReactionScalarWhereInput | Prisma.ReactionScalarWhereInput[];
    OR?: Prisma.ReactionScalarWhereInput[];
    NOT?: Prisma.ReactionScalarWhereInput | Prisma.ReactionScalarWhereInput[];
    messageId?: Prisma.UuidFilter<"Reaction"> | string;
    userId?: Prisma.UuidFilter<"Reaction"> | string;
    emoji?: Prisma.EnumReactionEmojiFilter<"Reaction"> | $Enums.ReactionEmoji;
    createdAt?: Prisma.DateTimeFilter<"Reaction"> | Date | string;
};
export type ReactionCreateWithoutMessageInput = {
    emoji: $Enums.ReactionEmoji;
    createdAt?: Date | string;
    user: Prisma.ChatUserCreateNestedOneWithoutReactionsInput;
};
export type ReactionUncheckedCreateWithoutMessageInput = {
    userId: string;
    emoji: $Enums.ReactionEmoji;
    createdAt?: Date | string;
};
export type ReactionCreateOrConnectWithoutMessageInput = {
    where: Prisma.ReactionWhereUniqueInput;
    create: Prisma.XOR<Prisma.ReactionCreateWithoutMessageInput, Prisma.ReactionUncheckedCreateWithoutMessageInput>;
};
export type ReactionCreateManyMessageInputEnvelope = {
    data: Prisma.ReactionCreateManyMessageInput | Prisma.ReactionCreateManyMessageInput[];
    skipDuplicates?: boolean;
};
export type ReactionUpsertWithWhereUniqueWithoutMessageInput = {
    where: Prisma.ReactionWhereUniqueInput;
    update: Prisma.XOR<Prisma.ReactionUpdateWithoutMessageInput, Prisma.ReactionUncheckedUpdateWithoutMessageInput>;
    create: Prisma.XOR<Prisma.ReactionCreateWithoutMessageInput, Prisma.ReactionUncheckedCreateWithoutMessageInput>;
};
export type ReactionUpdateWithWhereUniqueWithoutMessageInput = {
    where: Prisma.ReactionWhereUniqueInput;
    data: Prisma.XOR<Prisma.ReactionUpdateWithoutMessageInput, Prisma.ReactionUncheckedUpdateWithoutMessageInput>;
};
export type ReactionUpdateManyWithWhereWithoutMessageInput = {
    where: Prisma.ReactionScalarWhereInput;
    data: Prisma.XOR<Prisma.ReactionUpdateManyMutationInput, Prisma.ReactionUncheckedUpdateManyWithoutMessageInput>;
};
export type ReactionCreateManyUserInput = {
    messageId: string;
    emoji: $Enums.ReactionEmoji;
    createdAt?: Date | string;
};
export type ReactionUpdateWithoutUserInput = {
    emoji?: Prisma.EnumReactionEmojiFieldUpdateOperationsInput | $Enums.ReactionEmoji;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    message?: Prisma.MessageUpdateOneRequiredWithoutReactionsNestedInput;
};
export type ReactionUncheckedUpdateWithoutUserInput = {
    messageId?: Prisma.StringFieldUpdateOperationsInput | string;
    emoji?: Prisma.EnumReactionEmojiFieldUpdateOperationsInput | $Enums.ReactionEmoji;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type ReactionUncheckedUpdateManyWithoutUserInput = {
    messageId?: Prisma.StringFieldUpdateOperationsInput | string;
    emoji?: Prisma.EnumReactionEmojiFieldUpdateOperationsInput | $Enums.ReactionEmoji;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type ReactionCreateManyMessageInput = {
    userId: string;
    emoji: $Enums.ReactionEmoji;
    createdAt?: Date | string;
};
export type ReactionUpdateWithoutMessageInput = {
    emoji?: Prisma.EnumReactionEmojiFieldUpdateOperationsInput | $Enums.ReactionEmoji;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    user?: Prisma.ChatUserUpdateOneRequiredWithoutReactionsNestedInput;
};
export type ReactionUncheckedUpdateWithoutMessageInput = {
    userId?: Prisma.StringFieldUpdateOperationsInput | string;
    emoji?: Prisma.EnumReactionEmojiFieldUpdateOperationsInput | $Enums.ReactionEmoji;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type ReactionUncheckedUpdateManyWithoutMessageInput = {
    userId?: Prisma.StringFieldUpdateOperationsInput | string;
    emoji?: Prisma.EnumReactionEmojiFieldUpdateOperationsInput | $Enums.ReactionEmoji;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type ReactionSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    messageId?: boolean;
    userId?: boolean;
    emoji?: boolean;
    createdAt?: boolean;
    message?: boolean | Prisma.MessageDefaultArgs<ExtArgs>;
    user?: boolean | Prisma.ChatUserDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["reaction"]>;
export type ReactionSelectCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    messageId?: boolean;
    userId?: boolean;
    emoji?: boolean;
    createdAt?: boolean;
    message?: boolean | Prisma.MessageDefaultArgs<ExtArgs>;
    user?: boolean | Prisma.ChatUserDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["reaction"]>;
export type ReactionSelectUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    messageId?: boolean;
    userId?: boolean;
    emoji?: boolean;
    createdAt?: boolean;
    message?: boolean | Prisma.MessageDefaultArgs<ExtArgs>;
    user?: boolean | Prisma.ChatUserDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["reaction"]>;
export type ReactionSelectScalar = {
    messageId?: boolean;
    userId?: boolean;
    emoji?: boolean;
    createdAt?: boolean;
};
export type ReactionOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"messageId" | "userId" | "emoji" | "createdAt", ExtArgs["result"]["reaction"]>;
export type ReactionInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    message?: boolean | Prisma.MessageDefaultArgs<ExtArgs>;
    user?: boolean | Prisma.ChatUserDefaultArgs<ExtArgs>;
};
export type ReactionIncludeCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    message?: boolean | Prisma.MessageDefaultArgs<ExtArgs>;
    user?: boolean | Prisma.ChatUserDefaultArgs<ExtArgs>;
};
export type ReactionIncludeUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    message?: boolean | Prisma.MessageDefaultArgs<ExtArgs>;
    user?: boolean | Prisma.ChatUserDefaultArgs<ExtArgs>;
};
export type $ReactionPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "Reaction";
    objects: {
        message: Prisma.$MessagePayload<ExtArgs>;
        user: Prisma.$ChatUserPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        messageId: string;
        userId: string;
        emoji: $Enums.ReactionEmoji;
        createdAt: Date;
    }, ExtArgs["result"]["reaction"]>;
    composites: {};
};
export type ReactionGetPayload<S extends boolean | null | undefined | ReactionDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$ReactionPayload, S>;
export type ReactionCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<ReactionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: ReactionCountAggregateInputType | true;
};
export interface ReactionDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['Reaction'];
        meta: {
            name: 'Reaction';
        };
    };
    findUnique<T extends ReactionFindUniqueArgs>(args: Prisma.SelectSubset<T, ReactionFindUniqueArgs<ExtArgs>>): Prisma.Prisma__ReactionClient<runtime.Types.Result.GetResult<Prisma.$ReactionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends ReactionFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, ReactionFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__ReactionClient<runtime.Types.Result.GetResult<Prisma.$ReactionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends ReactionFindFirstArgs>(args?: Prisma.SelectSubset<T, ReactionFindFirstArgs<ExtArgs>>): Prisma.Prisma__ReactionClient<runtime.Types.Result.GetResult<Prisma.$ReactionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends ReactionFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, ReactionFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__ReactionClient<runtime.Types.Result.GetResult<Prisma.$ReactionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends ReactionFindManyArgs>(args?: Prisma.SelectSubset<T, ReactionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ReactionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends ReactionCreateArgs>(args: Prisma.SelectSubset<T, ReactionCreateArgs<ExtArgs>>): Prisma.Prisma__ReactionClient<runtime.Types.Result.GetResult<Prisma.$ReactionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends ReactionCreateManyArgs>(args?: Prisma.SelectSubset<T, ReactionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    createManyAndReturn<T extends ReactionCreateManyAndReturnArgs>(args?: Prisma.SelectSubset<T, ReactionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ReactionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>;
    delete<T extends ReactionDeleteArgs>(args: Prisma.SelectSubset<T, ReactionDeleteArgs<ExtArgs>>): Prisma.Prisma__ReactionClient<runtime.Types.Result.GetResult<Prisma.$ReactionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends ReactionUpdateArgs>(args: Prisma.SelectSubset<T, ReactionUpdateArgs<ExtArgs>>): Prisma.Prisma__ReactionClient<runtime.Types.Result.GetResult<Prisma.$ReactionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends ReactionDeleteManyArgs>(args?: Prisma.SelectSubset<T, ReactionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends ReactionUpdateManyArgs>(args: Prisma.SelectSubset<T, ReactionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateManyAndReturn<T extends ReactionUpdateManyAndReturnArgs>(args: Prisma.SelectSubset<T, ReactionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ReactionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>;
    upsert<T extends ReactionUpsertArgs>(args: Prisma.SelectSubset<T, ReactionUpsertArgs<ExtArgs>>): Prisma.Prisma__ReactionClient<runtime.Types.Result.GetResult<Prisma.$ReactionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends ReactionCountArgs>(args?: Prisma.Subset<T, ReactionCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], ReactionCountAggregateOutputType> : number>;
    aggregate<T extends ReactionAggregateArgs>(args: Prisma.Subset<T, ReactionAggregateArgs>): Prisma.PrismaPromise<GetReactionAggregateType<T>>;
    groupBy<T extends ReactionGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: ReactionGroupByArgs['orderBy'];
    } : {
        orderBy?: ReactionGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, ReactionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetReactionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: ReactionFieldRefs;
}
export interface Prisma__ReactionClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    message<T extends Prisma.MessageDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.MessageDefaultArgs<ExtArgs>>): Prisma.Prisma__MessageClient<runtime.Types.Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    user<T extends Prisma.ChatUserDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.ChatUserDefaultArgs<ExtArgs>>): Prisma.Prisma__ChatUserClient<runtime.Types.Result.GetResult<Prisma.$ChatUserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface ReactionFieldRefs {
    readonly messageId: Prisma.FieldRef<"Reaction", 'String'>;
    readonly userId: Prisma.FieldRef<"Reaction", 'String'>;
    readonly emoji: Prisma.FieldRef<"Reaction", 'ReactionEmoji'>;
    readonly createdAt: Prisma.FieldRef<"Reaction", 'DateTime'>;
}
export type ReactionFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ReactionSelect<ExtArgs> | null;
    omit?: Prisma.ReactionOmit<ExtArgs> | null;
    include?: Prisma.ReactionInclude<ExtArgs> | null;
    where: Prisma.ReactionWhereUniqueInput;
};
export type ReactionFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ReactionSelect<ExtArgs> | null;
    omit?: Prisma.ReactionOmit<ExtArgs> | null;
    include?: Prisma.ReactionInclude<ExtArgs> | null;
    where: Prisma.ReactionWhereUniqueInput;
};
export type ReactionFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type ReactionFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type ReactionFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type ReactionCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ReactionSelect<ExtArgs> | null;
    omit?: Prisma.ReactionOmit<ExtArgs> | null;
    include?: Prisma.ReactionInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.ReactionCreateInput, Prisma.ReactionUncheckedCreateInput>;
};
export type ReactionCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.ReactionCreateManyInput | Prisma.ReactionCreateManyInput[];
    skipDuplicates?: boolean;
};
export type ReactionCreateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ReactionSelectCreateManyAndReturn<ExtArgs> | null;
    omit?: Prisma.ReactionOmit<ExtArgs> | null;
    data: Prisma.ReactionCreateManyInput | Prisma.ReactionCreateManyInput[];
    skipDuplicates?: boolean;
    include?: Prisma.ReactionIncludeCreateManyAndReturn<ExtArgs> | null;
};
export type ReactionUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ReactionSelect<ExtArgs> | null;
    omit?: Prisma.ReactionOmit<ExtArgs> | null;
    include?: Prisma.ReactionInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.ReactionUpdateInput, Prisma.ReactionUncheckedUpdateInput>;
    where: Prisma.ReactionWhereUniqueInput;
};
export type ReactionUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.ReactionUpdateManyMutationInput, Prisma.ReactionUncheckedUpdateManyInput>;
    where?: Prisma.ReactionWhereInput;
    limit?: number;
};
export type ReactionUpdateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ReactionSelectUpdateManyAndReturn<ExtArgs> | null;
    omit?: Prisma.ReactionOmit<ExtArgs> | null;
    data: Prisma.XOR<Prisma.ReactionUpdateManyMutationInput, Prisma.ReactionUncheckedUpdateManyInput>;
    where?: Prisma.ReactionWhereInput;
    limit?: number;
    include?: Prisma.ReactionIncludeUpdateManyAndReturn<ExtArgs> | null;
};
export type ReactionUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ReactionSelect<ExtArgs> | null;
    omit?: Prisma.ReactionOmit<ExtArgs> | null;
    include?: Prisma.ReactionInclude<ExtArgs> | null;
    where: Prisma.ReactionWhereUniqueInput;
    create: Prisma.XOR<Prisma.ReactionCreateInput, Prisma.ReactionUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.ReactionUpdateInput, Prisma.ReactionUncheckedUpdateInput>;
};
export type ReactionDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ReactionSelect<ExtArgs> | null;
    omit?: Prisma.ReactionOmit<ExtArgs> | null;
    include?: Prisma.ReactionInclude<ExtArgs> | null;
    where: Prisma.ReactionWhereUniqueInput;
};
export type ReactionDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ReactionWhereInput;
    limit?: number;
};
export type ReactionDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ReactionSelect<ExtArgs> | null;
    omit?: Prisma.ReactionOmit<ExtArgs> | null;
    include?: Prisma.ReactionInclude<ExtArgs> | null;
};
