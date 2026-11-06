import type * as runtime from "@prisma/client/runtime/client";
import type * as $Enums from "../enums.js";
import type * as Prisma from "../internal/prismaNamespace.js";
export type ConversationModel = runtime.Types.Result.DefaultSelection<Prisma.$ConversationPayload>;
export type AggregateConversation = {
    _count: ConversationCountAggregateOutputType | null;
    _min: ConversationMinAggregateOutputType | null;
    _max: ConversationMaxAggregateOutputType | null;
};
export type ConversationMinAggregateOutputType = {
    id: string | null;
    kind: $Enums.ConversationKind | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    dmUserAId: string | null;
    dmUserBId: string | null;
    groupId: string | null;
    name: string | null;
    topic: string | null;
};
export type ConversationMaxAggregateOutputType = {
    id: string | null;
    kind: $Enums.ConversationKind | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    dmUserAId: string | null;
    dmUserBId: string | null;
    groupId: string | null;
    name: string | null;
    topic: string | null;
};
export type ConversationCountAggregateOutputType = {
    id: number;
    kind: number;
    createdAt: number;
    updatedAt: number;
    dmUserAId: number;
    dmUserBId: number;
    groupId: number;
    name: number;
    topic: number;
    _all: number;
};
export type ConversationMinAggregateInputType = {
    id?: true;
    kind?: true;
    createdAt?: true;
    updatedAt?: true;
    dmUserAId?: true;
    dmUserBId?: true;
    groupId?: true;
    name?: true;
    topic?: true;
};
export type ConversationMaxAggregateInputType = {
    id?: true;
    kind?: true;
    createdAt?: true;
    updatedAt?: true;
    dmUserAId?: true;
    dmUserBId?: true;
    groupId?: true;
    name?: true;
    topic?: true;
};
export type ConversationCountAggregateInputType = {
    id?: true;
    kind?: true;
    createdAt?: true;
    updatedAt?: true;
    dmUserAId?: true;
    dmUserBId?: true;
    groupId?: true;
    name?: true;
    topic?: true;
    _all?: true;
};
export type ConversationAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ConversationWhereInput;
    orderBy?: Prisma.ConversationOrderByWithRelationInput | Prisma.ConversationOrderByWithRelationInput[];
    cursor?: Prisma.ConversationWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | ConversationCountAggregateInputType;
    _min?: ConversationMinAggregateInputType;
    _max?: ConversationMaxAggregateInputType;
};
export type GetConversationAggregateType<T extends ConversationAggregateArgs> = {
    [P in keyof T & keyof AggregateConversation]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateConversation[P]> : Prisma.GetScalarType<T[P], AggregateConversation[P]>;
};
export type ConversationGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ConversationWhereInput;
    orderBy?: Prisma.ConversationOrderByWithAggregationInput | Prisma.ConversationOrderByWithAggregationInput[];
    by: Prisma.ConversationScalarFieldEnum[] | Prisma.ConversationScalarFieldEnum;
    having?: Prisma.ConversationScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: ConversationCountAggregateInputType | true;
    _min?: ConversationMinAggregateInputType;
    _max?: ConversationMaxAggregateInputType;
};
export type ConversationGroupByOutputType = {
    id: string;
    kind: $Enums.ConversationKind;
    createdAt: Date;
    updatedAt: Date;
    dmUserAId: string | null;
    dmUserBId: string | null;
    groupId: string | null;
    name: string | null;
    topic: string | null;
    _count: ConversationCountAggregateOutputType | null;
    _min: ConversationMinAggregateOutputType | null;
    _max: ConversationMaxAggregateOutputType | null;
};
export type GetConversationGroupByPayload<T extends ConversationGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<ConversationGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof ConversationGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], ConversationGroupByOutputType[P]> : Prisma.GetScalarType<T[P], ConversationGroupByOutputType[P]>;
}>>;
export type ConversationWhereInput = {
    AND?: Prisma.ConversationWhereInput | Prisma.ConversationWhereInput[];
    OR?: Prisma.ConversationWhereInput[];
    NOT?: Prisma.ConversationWhereInput | Prisma.ConversationWhereInput[];
    id?: Prisma.UuidFilter<"Conversation"> | string;
    kind?: Prisma.EnumConversationKindFilter<"Conversation"> | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFilter<"Conversation"> | Date | string;
    updatedAt?: Prisma.DateTimeFilter<"Conversation"> | Date | string;
    dmUserAId?: Prisma.UuidNullableFilter<"Conversation"> | string | null;
    dmUserBId?: Prisma.UuidNullableFilter<"Conversation"> | string | null;
    groupId?: Prisma.UuidNullableFilter<"Conversation"> | string | null;
    name?: Prisma.StringNullableFilter<"Conversation"> | string | null;
    topic?: Prisma.StringNullableFilter<"Conversation"> | string | null;
    dmUserA?: Prisma.XOR<Prisma.ChatUserNullableScalarRelationFilter, Prisma.ChatUserWhereInput> | null;
    dmUserB?: Prisma.XOR<Prisma.ChatUserNullableScalarRelationFilter, Prisma.ChatUserWhereInput> | null;
    group?: Prisma.XOR<Prisma.GroupNullableScalarRelationFilter, Prisma.GroupWhereInput> | null;
    messages?: Prisma.MessageListRelationFilter;
    readStates?: Prisma.ConversationReadStateListRelationFilter;
};
export type ConversationOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    kind?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    dmUserAId?: Prisma.SortOrderInput | Prisma.SortOrder;
    dmUserBId?: Prisma.SortOrderInput | Prisma.SortOrder;
    groupId?: Prisma.SortOrderInput | Prisma.SortOrder;
    name?: Prisma.SortOrderInput | Prisma.SortOrder;
    topic?: Prisma.SortOrderInput | Prisma.SortOrder;
    dmUserA?: Prisma.ChatUserOrderByWithRelationInput;
    dmUserB?: Prisma.ChatUserOrderByWithRelationInput;
    group?: Prisma.GroupOrderByWithRelationInput;
    messages?: Prisma.MessageOrderByRelationAggregateInput;
    readStates?: Prisma.ConversationReadStateOrderByRelationAggregateInput;
};
export type ConversationWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    dmUserAId_dmUserBId?: Prisma.ConversationDmUserAIdDmUserBIdCompoundUniqueInput;
    AND?: Prisma.ConversationWhereInput | Prisma.ConversationWhereInput[];
    OR?: Prisma.ConversationWhereInput[];
    NOT?: Prisma.ConversationWhereInput | Prisma.ConversationWhereInput[];
    kind?: Prisma.EnumConversationKindFilter<"Conversation"> | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFilter<"Conversation"> | Date | string;
    updatedAt?: Prisma.DateTimeFilter<"Conversation"> | Date | string;
    dmUserAId?: Prisma.UuidNullableFilter<"Conversation"> | string | null;
    dmUserBId?: Prisma.UuidNullableFilter<"Conversation"> | string | null;
    groupId?: Prisma.UuidNullableFilter<"Conversation"> | string | null;
    name?: Prisma.StringNullableFilter<"Conversation"> | string | null;
    topic?: Prisma.StringNullableFilter<"Conversation"> | string | null;
    dmUserA?: Prisma.XOR<Prisma.ChatUserNullableScalarRelationFilter, Prisma.ChatUserWhereInput> | null;
    dmUserB?: Prisma.XOR<Prisma.ChatUserNullableScalarRelationFilter, Prisma.ChatUserWhereInput> | null;
    group?: Prisma.XOR<Prisma.GroupNullableScalarRelationFilter, Prisma.GroupWhereInput> | null;
    messages?: Prisma.MessageListRelationFilter;
    readStates?: Prisma.ConversationReadStateListRelationFilter;
}, "id" | "dmUserAId_dmUserBId">;
export type ConversationOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    kind?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    dmUserAId?: Prisma.SortOrderInput | Prisma.SortOrder;
    dmUserBId?: Prisma.SortOrderInput | Prisma.SortOrder;
    groupId?: Prisma.SortOrderInput | Prisma.SortOrder;
    name?: Prisma.SortOrderInput | Prisma.SortOrder;
    topic?: Prisma.SortOrderInput | Prisma.SortOrder;
    _count?: Prisma.ConversationCountOrderByAggregateInput;
    _max?: Prisma.ConversationMaxOrderByAggregateInput;
    _min?: Prisma.ConversationMinOrderByAggregateInput;
};
export type ConversationScalarWhereWithAggregatesInput = {
    AND?: Prisma.ConversationScalarWhereWithAggregatesInput | Prisma.ConversationScalarWhereWithAggregatesInput[];
    OR?: Prisma.ConversationScalarWhereWithAggregatesInput[];
    NOT?: Prisma.ConversationScalarWhereWithAggregatesInput | Prisma.ConversationScalarWhereWithAggregatesInput[];
    id?: Prisma.UuidWithAggregatesFilter<"Conversation"> | string;
    kind?: Prisma.EnumConversationKindWithAggregatesFilter<"Conversation"> | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeWithAggregatesFilter<"Conversation"> | Date | string;
    updatedAt?: Prisma.DateTimeWithAggregatesFilter<"Conversation"> | Date | string;
    dmUserAId?: Prisma.UuidNullableWithAggregatesFilter<"Conversation"> | string | null;
    dmUserBId?: Prisma.UuidNullableWithAggregatesFilter<"Conversation"> | string | null;
    groupId?: Prisma.UuidNullableWithAggregatesFilter<"Conversation"> | string | null;
    name?: Prisma.StringNullableWithAggregatesFilter<"Conversation"> | string | null;
    topic?: Prisma.StringNullableWithAggregatesFilter<"Conversation"> | string | null;
};
export type ConversationCreateInput = {
    id?: string;
    kind: $Enums.ConversationKind;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    name?: string | null;
    topic?: string | null;
    dmUserA?: Prisma.ChatUserCreateNestedOneWithoutDmsAsUserAInput;
    dmUserB?: Prisma.ChatUserCreateNestedOneWithoutDmsAsUserBInput;
    group?: Prisma.GroupCreateNestedOneWithoutChannelsInput;
    messages?: Prisma.MessageCreateNestedManyWithoutConversationInput;
    readStates?: Prisma.ConversationReadStateCreateNestedManyWithoutConversationInput;
};
export type ConversationUncheckedCreateInput = {
    id?: string;
    kind: $Enums.ConversationKind;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    dmUserAId?: string | null;
    dmUserBId?: string | null;
    groupId?: string | null;
    name?: string | null;
    topic?: string | null;
    messages?: Prisma.MessageUncheckedCreateNestedManyWithoutConversationInput;
    readStates?: Prisma.ConversationReadStateUncheckedCreateNestedManyWithoutConversationInput;
};
export type ConversationUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    kind?: Prisma.EnumConversationKindFieldUpdateOperationsInput | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    topic?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    dmUserA?: Prisma.ChatUserUpdateOneWithoutDmsAsUserANestedInput;
    dmUserB?: Prisma.ChatUserUpdateOneWithoutDmsAsUserBNestedInput;
    group?: Prisma.GroupUpdateOneWithoutChannelsNestedInput;
    messages?: Prisma.MessageUpdateManyWithoutConversationNestedInput;
    readStates?: Prisma.ConversationReadStateUpdateManyWithoutConversationNestedInput;
};
export type ConversationUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    kind?: Prisma.EnumConversationKindFieldUpdateOperationsInput | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    dmUserAId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    dmUserBId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    groupId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    topic?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    messages?: Prisma.MessageUncheckedUpdateManyWithoutConversationNestedInput;
    readStates?: Prisma.ConversationReadStateUncheckedUpdateManyWithoutConversationNestedInput;
};
export type ConversationCreateManyInput = {
    id?: string;
    kind: $Enums.ConversationKind;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    dmUserAId?: string | null;
    dmUserBId?: string | null;
    groupId?: string | null;
    name?: string | null;
    topic?: string | null;
};
export type ConversationUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    kind?: Prisma.EnumConversationKindFieldUpdateOperationsInput | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    topic?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
};
export type ConversationUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    kind?: Prisma.EnumConversationKindFieldUpdateOperationsInput | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    dmUserAId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    dmUserBId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    groupId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    topic?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
};
export type ConversationListRelationFilter = {
    every?: Prisma.ConversationWhereInput;
    some?: Prisma.ConversationWhereInput;
    none?: Prisma.ConversationWhereInput;
};
export type ConversationOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type ConversationDmUserAIdDmUserBIdCompoundUniqueInput = {
    dmUserAId: string;
    dmUserBId: string;
};
export type ConversationCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    kind?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    dmUserAId?: Prisma.SortOrder;
    dmUserBId?: Prisma.SortOrder;
    groupId?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    topic?: Prisma.SortOrder;
};
export type ConversationMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    kind?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    dmUserAId?: Prisma.SortOrder;
    dmUserBId?: Prisma.SortOrder;
    groupId?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    topic?: Prisma.SortOrder;
};
export type ConversationMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    kind?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    dmUserAId?: Prisma.SortOrder;
    dmUserBId?: Prisma.SortOrder;
    groupId?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    topic?: Prisma.SortOrder;
};
export type ConversationScalarRelationFilter = {
    is?: Prisma.ConversationWhereInput;
    isNot?: Prisma.ConversationWhereInput;
};
export type ConversationCreateNestedManyWithoutDmUserAInput = {
    create?: Prisma.XOR<Prisma.ConversationCreateWithoutDmUserAInput, Prisma.ConversationUncheckedCreateWithoutDmUserAInput> | Prisma.ConversationCreateWithoutDmUserAInput[] | Prisma.ConversationUncheckedCreateWithoutDmUserAInput[];
    connectOrCreate?: Prisma.ConversationCreateOrConnectWithoutDmUserAInput | Prisma.ConversationCreateOrConnectWithoutDmUserAInput[];
    createMany?: Prisma.ConversationCreateManyDmUserAInputEnvelope;
    connect?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
};
export type ConversationCreateNestedManyWithoutDmUserBInput = {
    create?: Prisma.XOR<Prisma.ConversationCreateWithoutDmUserBInput, Prisma.ConversationUncheckedCreateWithoutDmUserBInput> | Prisma.ConversationCreateWithoutDmUserBInput[] | Prisma.ConversationUncheckedCreateWithoutDmUserBInput[];
    connectOrCreate?: Prisma.ConversationCreateOrConnectWithoutDmUserBInput | Prisma.ConversationCreateOrConnectWithoutDmUserBInput[];
    createMany?: Prisma.ConversationCreateManyDmUserBInputEnvelope;
    connect?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
};
export type ConversationUncheckedCreateNestedManyWithoutDmUserAInput = {
    create?: Prisma.XOR<Prisma.ConversationCreateWithoutDmUserAInput, Prisma.ConversationUncheckedCreateWithoutDmUserAInput> | Prisma.ConversationCreateWithoutDmUserAInput[] | Prisma.ConversationUncheckedCreateWithoutDmUserAInput[];
    connectOrCreate?: Prisma.ConversationCreateOrConnectWithoutDmUserAInput | Prisma.ConversationCreateOrConnectWithoutDmUserAInput[];
    createMany?: Prisma.ConversationCreateManyDmUserAInputEnvelope;
    connect?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
};
export type ConversationUncheckedCreateNestedManyWithoutDmUserBInput = {
    create?: Prisma.XOR<Prisma.ConversationCreateWithoutDmUserBInput, Prisma.ConversationUncheckedCreateWithoutDmUserBInput> | Prisma.ConversationCreateWithoutDmUserBInput[] | Prisma.ConversationUncheckedCreateWithoutDmUserBInput[];
    connectOrCreate?: Prisma.ConversationCreateOrConnectWithoutDmUserBInput | Prisma.ConversationCreateOrConnectWithoutDmUserBInput[];
    createMany?: Prisma.ConversationCreateManyDmUserBInputEnvelope;
    connect?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
};
export type ConversationUpdateManyWithoutDmUserANestedInput = {
    create?: Prisma.XOR<Prisma.ConversationCreateWithoutDmUserAInput, Prisma.ConversationUncheckedCreateWithoutDmUserAInput> | Prisma.ConversationCreateWithoutDmUserAInput[] | Prisma.ConversationUncheckedCreateWithoutDmUserAInput[];
    connectOrCreate?: Prisma.ConversationCreateOrConnectWithoutDmUserAInput | Prisma.ConversationCreateOrConnectWithoutDmUserAInput[];
    upsert?: Prisma.ConversationUpsertWithWhereUniqueWithoutDmUserAInput | Prisma.ConversationUpsertWithWhereUniqueWithoutDmUserAInput[];
    createMany?: Prisma.ConversationCreateManyDmUserAInputEnvelope;
    set?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    disconnect?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    delete?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    connect?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    update?: Prisma.ConversationUpdateWithWhereUniqueWithoutDmUserAInput | Prisma.ConversationUpdateWithWhereUniqueWithoutDmUserAInput[];
    updateMany?: Prisma.ConversationUpdateManyWithWhereWithoutDmUserAInput | Prisma.ConversationUpdateManyWithWhereWithoutDmUserAInput[];
    deleteMany?: Prisma.ConversationScalarWhereInput | Prisma.ConversationScalarWhereInput[];
};
export type ConversationUpdateManyWithoutDmUserBNestedInput = {
    create?: Prisma.XOR<Prisma.ConversationCreateWithoutDmUserBInput, Prisma.ConversationUncheckedCreateWithoutDmUserBInput> | Prisma.ConversationCreateWithoutDmUserBInput[] | Prisma.ConversationUncheckedCreateWithoutDmUserBInput[];
    connectOrCreate?: Prisma.ConversationCreateOrConnectWithoutDmUserBInput | Prisma.ConversationCreateOrConnectWithoutDmUserBInput[];
    upsert?: Prisma.ConversationUpsertWithWhereUniqueWithoutDmUserBInput | Prisma.ConversationUpsertWithWhereUniqueWithoutDmUserBInput[];
    createMany?: Prisma.ConversationCreateManyDmUserBInputEnvelope;
    set?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    disconnect?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    delete?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    connect?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    update?: Prisma.ConversationUpdateWithWhereUniqueWithoutDmUserBInput | Prisma.ConversationUpdateWithWhereUniqueWithoutDmUserBInput[];
    updateMany?: Prisma.ConversationUpdateManyWithWhereWithoutDmUserBInput | Prisma.ConversationUpdateManyWithWhereWithoutDmUserBInput[];
    deleteMany?: Prisma.ConversationScalarWhereInput | Prisma.ConversationScalarWhereInput[];
};
export type ConversationUncheckedUpdateManyWithoutDmUserANestedInput = {
    create?: Prisma.XOR<Prisma.ConversationCreateWithoutDmUserAInput, Prisma.ConversationUncheckedCreateWithoutDmUserAInput> | Prisma.ConversationCreateWithoutDmUserAInput[] | Prisma.ConversationUncheckedCreateWithoutDmUserAInput[];
    connectOrCreate?: Prisma.ConversationCreateOrConnectWithoutDmUserAInput | Prisma.ConversationCreateOrConnectWithoutDmUserAInput[];
    upsert?: Prisma.ConversationUpsertWithWhereUniqueWithoutDmUserAInput | Prisma.ConversationUpsertWithWhereUniqueWithoutDmUserAInput[];
    createMany?: Prisma.ConversationCreateManyDmUserAInputEnvelope;
    set?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    disconnect?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    delete?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    connect?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    update?: Prisma.ConversationUpdateWithWhereUniqueWithoutDmUserAInput | Prisma.ConversationUpdateWithWhereUniqueWithoutDmUserAInput[];
    updateMany?: Prisma.ConversationUpdateManyWithWhereWithoutDmUserAInput | Prisma.ConversationUpdateManyWithWhereWithoutDmUserAInput[];
    deleteMany?: Prisma.ConversationScalarWhereInput | Prisma.ConversationScalarWhereInput[];
};
export type ConversationUncheckedUpdateManyWithoutDmUserBNestedInput = {
    create?: Prisma.XOR<Prisma.ConversationCreateWithoutDmUserBInput, Prisma.ConversationUncheckedCreateWithoutDmUserBInput> | Prisma.ConversationCreateWithoutDmUserBInput[] | Prisma.ConversationUncheckedCreateWithoutDmUserBInput[];
    connectOrCreate?: Prisma.ConversationCreateOrConnectWithoutDmUserBInput | Prisma.ConversationCreateOrConnectWithoutDmUserBInput[];
    upsert?: Prisma.ConversationUpsertWithWhereUniqueWithoutDmUserBInput | Prisma.ConversationUpsertWithWhereUniqueWithoutDmUserBInput[];
    createMany?: Prisma.ConversationCreateManyDmUserBInputEnvelope;
    set?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    disconnect?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    delete?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    connect?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    update?: Prisma.ConversationUpdateWithWhereUniqueWithoutDmUserBInput | Prisma.ConversationUpdateWithWhereUniqueWithoutDmUserBInput[];
    updateMany?: Prisma.ConversationUpdateManyWithWhereWithoutDmUserBInput | Prisma.ConversationUpdateManyWithWhereWithoutDmUserBInput[];
    deleteMany?: Prisma.ConversationScalarWhereInput | Prisma.ConversationScalarWhereInput[];
};
export type ConversationCreateNestedManyWithoutGroupInput = {
    create?: Prisma.XOR<Prisma.ConversationCreateWithoutGroupInput, Prisma.ConversationUncheckedCreateWithoutGroupInput> | Prisma.ConversationCreateWithoutGroupInput[] | Prisma.ConversationUncheckedCreateWithoutGroupInput[];
    connectOrCreate?: Prisma.ConversationCreateOrConnectWithoutGroupInput | Prisma.ConversationCreateOrConnectWithoutGroupInput[];
    createMany?: Prisma.ConversationCreateManyGroupInputEnvelope;
    connect?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
};
export type ConversationUncheckedCreateNestedManyWithoutGroupInput = {
    create?: Prisma.XOR<Prisma.ConversationCreateWithoutGroupInput, Prisma.ConversationUncheckedCreateWithoutGroupInput> | Prisma.ConversationCreateWithoutGroupInput[] | Prisma.ConversationUncheckedCreateWithoutGroupInput[];
    connectOrCreate?: Prisma.ConversationCreateOrConnectWithoutGroupInput | Prisma.ConversationCreateOrConnectWithoutGroupInput[];
    createMany?: Prisma.ConversationCreateManyGroupInputEnvelope;
    connect?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
};
export type ConversationUpdateManyWithoutGroupNestedInput = {
    create?: Prisma.XOR<Prisma.ConversationCreateWithoutGroupInput, Prisma.ConversationUncheckedCreateWithoutGroupInput> | Prisma.ConversationCreateWithoutGroupInput[] | Prisma.ConversationUncheckedCreateWithoutGroupInput[];
    connectOrCreate?: Prisma.ConversationCreateOrConnectWithoutGroupInput | Prisma.ConversationCreateOrConnectWithoutGroupInput[];
    upsert?: Prisma.ConversationUpsertWithWhereUniqueWithoutGroupInput | Prisma.ConversationUpsertWithWhereUniqueWithoutGroupInput[];
    createMany?: Prisma.ConversationCreateManyGroupInputEnvelope;
    set?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    disconnect?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    delete?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    connect?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    update?: Prisma.ConversationUpdateWithWhereUniqueWithoutGroupInput | Prisma.ConversationUpdateWithWhereUniqueWithoutGroupInput[];
    updateMany?: Prisma.ConversationUpdateManyWithWhereWithoutGroupInput | Prisma.ConversationUpdateManyWithWhereWithoutGroupInput[];
    deleteMany?: Prisma.ConversationScalarWhereInput | Prisma.ConversationScalarWhereInput[];
};
export type ConversationUncheckedUpdateManyWithoutGroupNestedInput = {
    create?: Prisma.XOR<Prisma.ConversationCreateWithoutGroupInput, Prisma.ConversationUncheckedCreateWithoutGroupInput> | Prisma.ConversationCreateWithoutGroupInput[] | Prisma.ConversationUncheckedCreateWithoutGroupInput[];
    connectOrCreate?: Prisma.ConversationCreateOrConnectWithoutGroupInput | Prisma.ConversationCreateOrConnectWithoutGroupInput[];
    upsert?: Prisma.ConversationUpsertWithWhereUniqueWithoutGroupInput | Prisma.ConversationUpsertWithWhereUniqueWithoutGroupInput[];
    createMany?: Prisma.ConversationCreateManyGroupInputEnvelope;
    set?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    disconnect?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    delete?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    connect?: Prisma.ConversationWhereUniqueInput | Prisma.ConversationWhereUniqueInput[];
    update?: Prisma.ConversationUpdateWithWhereUniqueWithoutGroupInput | Prisma.ConversationUpdateWithWhereUniqueWithoutGroupInput[];
    updateMany?: Prisma.ConversationUpdateManyWithWhereWithoutGroupInput | Prisma.ConversationUpdateManyWithWhereWithoutGroupInput[];
    deleteMany?: Prisma.ConversationScalarWhereInput | Prisma.ConversationScalarWhereInput[];
};
export type EnumConversationKindFieldUpdateOperationsInput = {
    set?: $Enums.ConversationKind;
};
export type ConversationCreateNestedOneWithoutReadStatesInput = {
    create?: Prisma.XOR<Prisma.ConversationCreateWithoutReadStatesInput, Prisma.ConversationUncheckedCreateWithoutReadStatesInput>;
    connectOrCreate?: Prisma.ConversationCreateOrConnectWithoutReadStatesInput;
    connect?: Prisma.ConversationWhereUniqueInput;
};
export type ConversationUpdateOneRequiredWithoutReadStatesNestedInput = {
    create?: Prisma.XOR<Prisma.ConversationCreateWithoutReadStatesInput, Prisma.ConversationUncheckedCreateWithoutReadStatesInput>;
    connectOrCreate?: Prisma.ConversationCreateOrConnectWithoutReadStatesInput;
    upsert?: Prisma.ConversationUpsertWithoutReadStatesInput;
    connect?: Prisma.ConversationWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.ConversationUpdateToOneWithWhereWithoutReadStatesInput, Prisma.ConversationUpdateWithoutReadStatesInput>, Prisma.ConversationUncheckedUpdateWithoutReadStatesInput>;
};
export type ConversationCreateNestedOneWithoutMessagesInput = {
    create?: Prisma.XOR<Prisma.ConversationCreateWithoutMessagesInput, Prisma.ConversationUncheckedCreateWithoutMessagesInput>;
    connectOrCreate?: Prisma.ConversationCreateOrConnectWithoutMessagesInput;
    connect?: Prisma.ConversationWhereUniqueInput;
};
export type ConversationUpdateOneRequiredWithoutMessagesNestedInput = {
    create?: Prisma.XOR<Prisma.ConversationCreateWithoutMessagesInput, Prisma.ConversationUncheckedCreateWithoutMessagesInput>;
    connectOrCreate?: Prisma.ConversationCreateOrConnectWithoutMessagesInput;
    upsert?: Prisma.ConversationUpsertWithoutMessagesInput;
    connect?: Prisma.ConversationWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.ConversationUpdateToOneWithWhereWithoutMessagesInput, Prisma.ConversationUpdateWithoutMessagesInput>, Prisma.ConversationUncheckedUpdateWithoutMessagesInput>;
};
export type ConversationCreateWithoutDmUserAInput = {
    id?: string;
    kind: $Enums.ConversationKind;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    name?: string | null;
    topic?: string | null;
    dmUserB?: Prisma.ChatUserCreateNestedOneWithoutDmsAsUserBInput;
    group?: Prisma.GroupCreateNestedOneWithoutChannelsInput;
    messages?: Prisma.MessageCreateNestedManyWithoutConversationInput;
    readStates?: Prisma.ConversationReadStateCreateNestedManyWithoutConversationInput;
};
export type ConversationUncheckedCreateWithoutDmUserAInput = {
    id?: string;
    kind: $Enums.ConversationKind;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    dmUserBId?: string | null;
    groupId?: string | null;
    name?: string | null;
    topic?: string | null;
    messages?: Prisma.MessageUncheckedCreateNestedManyWithoutConversationInput;
    readStates?: Prisma.ConversationReadStateUncheckedCreateNestedManyWithoutConversationInput;
};
export type ConversationCreateOrConnectWithoutDmUserAInput = {
    where: Prisma.ConversationWhereUniqueInput;
    create: Prisma.XOR<Prisma.ConversationCreateWithoutDmUserAInput, Prisma.ConversationUncheckedCreateWithoutDmUserAInput>;
};
export type ConversationCreateManyDmUserAInputEnvelope = {
    data: Prisma.ConversationCreateManyDmUserAInput | Prisma.ConversationCreateManyDmUserAInput[];
    skipDuplicates?: boolean;
};
export type ConversationCreateWithoutDmUserBInput = {
    id?: string;
    kind: $Enums.ConversationKind;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    name?: string | null;
    topic?: string | null;
    dmUserA?: Prisma.ChatUserCreateNestedOneWithoutDmsAsUserAInput;
    group?: Prisma.GroupCreateNestedOneWithoutChannelsInput;
    messages?: Prisma.MessageCreateNestedManyWithoutConversationInput;
    readStates?: Prisma.ConversationReadStateCreateNestedManyWithoutConversationInput;
};
export type ConversationUncheckedCreateWithoutDmUserBInput = {
    id?: string;
    kind: $Enums.ConversationKind;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    dmUserAId?: string | null;
    groupId?: string | null;
    name?: string | null;
    topic?: string | null;
    messages?: Prisma.MessageUncheckedCreateNestedManyWithoutConversationInput;
    readStates?: Prisma.ConversationReadStateUncheckedCreateNestedManyWithoutConversationInput;
};
export type ConversationCreateOrConnectWithoutDmUserBInput = {
    where: Prisma.ConversationWhereUniqueInput;
    create: Prisma.XOR<Prisma.ConversationCreateWithoutDmUserBInput, Prisma.ConversationUncheckedCreateWithoutDmUserBInput>;
};
export type ConversationCreateManyDmUserBInputEnvelope = {
    data: Prisma.ConversationCreateManyDmUserBInput | Prisma.ConversationCreateManyDmUserBInput[];
    skipDuplicates?: boolean;
};
export type ConversationUpsertWithWhereUniqueWithoutDmUserAInput = {
    where: Prisma.ConversationWhereUniqueInput;
    update: Prisma.XOR<Prisma.ConversationUpdateWithoutDmUserAInput, Prisma.ConversationUncheckedUpdateWithoutDmUserAInput>;
    create: Prisma.XOR<Prisma.ConversationCreateWithoutDmUserAInput, Prisma.ConversationUncheckedCreateWithoutDmUserAInput>;
};
export type ConversationUpdateWithWhereUniqueWithoutDmUserAInput = {
    where: Prisma.ConversationWhereUniqueInput;
    data: Prisma.XOR<Prisma.ConversationUpdateWithoutDmUserAInput, Prisma.ConversationUncheckedUpdateWithoutDmUserAInput>;
};
export type ConversationUpdateManyWithWhereWithoutDmUserAInput = {
    where: Prisma.ConversationScalarWhereInput;
    data: Prisma.XOR<Prisma.ConversationUpdateManyMutationInput, Prisma.ConversationUncheckedUpdateManyWithoutDmUserAInput>;
};
export type ConversationScalarWhereInput = {
    AND?: Prisma.ConversationScalarWhereInput | Prisma.ConversationScalarWhereInput[];
    OR?: Prisma.ConversationScalarWhereInput[];
    NOT?: Prisma.ConversationScalarWhereInput | Prisma.ConversationScalarWhereInput[];
    id?: Prisma.UuidFilter<"Conversation"> | string;
    kind?: Prisma.EnumConversationKindFilter<"Conversation"> | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFilter<"Conversation"> | Date | string;
    updatedAt?: Prisma.DateTimeFilter<"Conversation"> | Date | string;
    dmUserAId?: Prisma.UuidNullableFilter<"Conversation"> | string | null;
    dmUserBId?: Prisma.UuidNullableFilter<"Conversation"> | string | null;
    groupId?: Prisma.UuidNullableFilter<"Conversation"> | string | null;
    name?: Prisma.StringNullableFilter<"Conversation"> | string | null;
    topic?: Prisma.StringNullableFilter<"Conversation"> | string | null;
};
export type ConversationUpsertWithWhereUniqueWithoutDmUserBInput = {
    where: Prisma.ConversationWhereUniqueInput;
    update: Prisma.XOR<Prisma.ConversationUpdateWithoutDmUserBInput, Prisma.ConversationUncheckedUpdateWithoutDmUserBInput>;
    create: Prisma.XOR<Prisma.ConversationCreateWithoutDmUserBInput, Prisma.ConversationUncheckedCreateWithoutDmUserBInput>;
};
export type ConversationUpdateWithWhereUniqueWithoutDmUserBInput = {
    where: Prisma.ConversationWhereUniqueInput;
    data: Prisma.XOR<Prisma.ConversationUpdateWithoutDmUserBInput, Prisma.ConversationUncheckedUpdateWithoutDmUserBInput>;
};
export type ConversationUpdateManyWithWhereWithoutDmUserBInput = {
    where: Prisma.ConversationScalarWhereInput;
    data: Prisma.XOR<Prisma.ConversationUpdateManyMutationInput, Prisma.ConversationUncheckedUpdateManyWithoutDmUserBInput>;
};
export type ConversationCreateWithoutGroupInput = {
    id?: string;
    kind: $Enums.ConversationKind;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    name?: string | null;
    topic?: string | null;
    dmUserA?: Prisma.ChatUserCreateNestedOneWithoutDmsAsUserAInput;
    dmUserB?: Prisma.ChatUserCreateNestedOneWithoutDmsAsUserBInput;
    messages?: Prisma.MessageCreateNestedManyWithoutConversationInput;
    readStates?: Prisma.ConversationReadStateCreateNestedManyWithoutConversationInput;
};
export type ConversationUncheckedCreateWithoutGroupInput = {
    id?: string;
    kind: $Enums.ConversationKind;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    dmUserAId?: string | null;
    dmUserBId?: string | null;
    name?: string | null;
    topic?: string | null;
    messages?: Prisma.MessageUncheckedCreateNestedManyWithoutConversationInput;
    readStates?: Prisma.ConversationReadStateUncheckedCreateNestedManyWithoutConversationInput;
};
export type ConversationCreateOrConnectWithoutGroupInput = {
    where: Prisma.ConversationWhereUniqueInput;
    create: Prisma.XOR<Prisma.ConversationCreateWithoutGroupInput, Prisma.ConversationUncheckedCreateWithoutGroupInput>;
};
export type ConversationCreateManyGroupInputEnvelope = {
    data: Prisma.ConversationCreateManyGroupInput | Prisma.ConversationCreateManyGroupInput[];
    skipDuplicates?: boolean;
};
export type ConversationUpsertWithWhereUniqueWithoutGroupInput = {
    where: Prisma.ConversationWhereUniqueInput;
    update: Prisma.XOR<Prisma.ConversationUpdateWithoutGroupInput, Prisma.ConversationUncheckedUpdateWithoutGroupInput>;
    create: Prisma.XOR<Prisma.ConversationCreateWithoutGroupInput, Prisma.ConversationUncheckedCreateWithoutGroupInput>;
};
export type ConversationUpdateWithWhereUniqueWithoutGroupInput = {
    where: Prisma.ConversationWhereUniqueInput;
    data: Prisma.XOR<Prisma.ConversationUpdateWithoutGroupInput, Prisma.ConversationUncheckedUpdateWithoutGroupInput>;
};
export type ConversationUpdateManyWithWhereWithoutGroupInput = {
    where: Prisma.ConversationScalarWhereInput;
    data: Prisma.XOR<Prisma.ConversationUpdateManyMutationInput, Prisma.ConversationUncheckedUpdateManyWithoutGroupInput>;
};
export type ConversationCreateWithoutReadStatesInput = {
    id?: string;
    kind: $Enums.ConversationKind;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    name?: string | null;
    topic?: string | null;
    dmUserA?: Prisma.ChatUserCreateNestedOneWithoutDmsAsUserAInput;
    dmUserB?: Prisma.ChatUserCreateNestedOneWithoutDmsAsUserBInput;
    group?: Prisma.GroupCreateNestedOneWithoutChannelsInput;
    messages?: Prisma.MessageCreateNestedManyWithoutConversationInput;
};
export type ConversationUncheckedCreateWithoutReadStatesInput = {
    id?: string;
    kind: $Enums.ConversationKind;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    dmUserAId?: string | null;
    dmUserBId?: string | null;
    groupId?: string | null;
    name?: string | null;
    topic?: string | null;
    messages?: Prisma.MessageUncheckedCreateNestedManyWithoutConversationInput;
};
export type ConversationCreateOrConnectWithoutReadStatesInput = {
    where: Prisma.ConversationWhereUniqueInput;
    create: Prisma.XOR<Prisma.ConversationCreateWithoutReadStatesInput, Prisma.ConversationUncheckedCreateWithoutReadStatesInput>;
};
export type ConversationUpsertWithoutReadStatesInput = {
    update: Prisma.XOR<Prisma.ConversationUpdateWithoutReadStatesInput, Prisma.ConversationUncheckedUpdateWithoutReadStatesInput>;
    create: Prisma.XOR<Prisma.ConversationCreateWithoutReadStatesInput, Prisma.ConversationUncheckedCreateWithoutReadStatesInput>;
    where?: Prisma.ConversationWhereInput;
};
export type ConversationUpdateToOneWithWhereWithoutReadStatesInput = {
    where?: Prisma.ConversationWhereInput;
    data: Prisma.XOR<Prisma.ConversationUpdateWithoutReadStatesInput, Prisma.ConversationUncheckedUpdateWithoutReadStatesInput>;
};
export type ConversationUpdateWithoutReadStatesInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    kind?: Prisma.EnumConversationKindFieldUpdateOperationsInput | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    topic?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    dmUserA?: Prisma.ChatUserUpdateOneWithoutDmsAsUserANestedInput;
    dmUserB?: Prisma.ChatUserUpdateOneWithoutDmsAsUserBNestedInput;
    group?: Prisma.GroupUpdateOneWithoutChannelsNestedInput;
    messages?: Prisma.MessageUpdateManyWithoutConversationNestedInput;
};
export type ConversationUncheckedUpdateWithoutReadStatesInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    kind?: Prisma.EnumConversationKindFieldUpdateOperationsInput | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    dmUserAId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    dmUserBId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    groupId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    topic?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    messages?: Prisma.MessageUncheckedUpdateManyWithoutConversationNestedInput;
};
export type ConversationCreateWithoutMessagesInput = {
    id?: string;
    kind: $Enums.ConversationKind;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    name?: string | null;
    topic?: string | null;
    dmUserA?: Prisma.ChatUserCreateNestedOneWithoutDmsAsUserAInput;
    dmUserB?: Prisma.ChatUserCreateNestedOneWithoutDmsAsUserBInput;
    group?: Prisma.GroupCreateNestedOneWithoutChannelsInput;
    readStates?: Prisma.ConversationReadStateCreateNestedManyWithoutConversationInput;
};
export type ConversationUncheckedCreateWithoutMessagesInput = {
    id?: string;
    kind: $Enums.ConversationKind;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    dmUserAId?: string | null;
    dmUserBId?: string | null;
    groupId?: string | null;
    name?: string | null;
    topic?: string | null;
    readStates?: Prisma.ConversationReadStateUncheckedCreateNestedManyWithoutConversationInput;
};
export type ConversationCreateOrConnectWithoutMessagesInput = {
    where: Prisma.ConversationWhereUniqueInput;
    create: Prisma.XOR<Prisma.ConversationCreateWithoutMessagesInput, Prisma.ConversationUncheckedCreateWithoutMessagesInput>;
};
export type ConversationUpsertWithoutMessagesInput = {
    update: Prisma.XOR<Prisma.ConversationUpdateWithoutMessagesInput, Prisma.ConversationUncheckedUpdateWithoutMessagesInput>;
    create: Prisma.XOR<Prisma.ConversationCreateWithoutMessagesInput, Prisma.ConversationUncheckedCreateWithoutMessagesInput>;
    where?: Prisma.ConversationWhereInput;
};
export type ConversationUpdateToOneWithWhereWithoutMessagesInput = {
    where?: Prisma.ConversationWhereInput;
    data: Prisma.XOR<Prisma.ConversationUpdateWithoutMessagesInput, Prisma.ConversationUncheckedUpdateWithoutMessagesInput>;
};
export type ConversationUpdateWithoutMessagesInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    kind?: Prisma.EnumConversationKindFieldUpdateOperationsInput | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    topic?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    dmUserA?: Prisma.ChatUserUpdateOneWithoutDmsAsUserANestedInput;
    dmUserB?: Prisma.ChatUserUpdateOneWithoutDmsAsUserBNestedInput;
    group?: Prisma.GroupUpdateOneWithoutChannelsNestedInput;
    readStates?: Prisma.ConversationReadStateUpdateManyWithoutConversationNestedInput;
};
export type ConversationUncheckedUpdateWithoutMessagesInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    kind?: Prisma.EnumConversationKindFieldUpdateOperationsInput | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    dmUserAId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    dmUserBId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    groupId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    topic?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    readStates?: Prisma.ConversationReadStateUncheckedUpdateManyWithoutConversationNestedInput;
};
export type ConversationCreateManyDmUserAInput = {
    id?: string;
    kind: $Enums.ConversationKind;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    dmUserBId?: string | null;
    groupId?: string | null;
    name?: string | null;
    topic?: string | null;
};
export type ConversationCreateManyDmUserBInput = {
    id?: string;
    kind: $Enums.ConversationKind;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    dmUserAId?: string | null;
    groupId?: string | null;
    name?: string | null;
    topic?: string | null;
};
export type ConversationUpdateWithoutDmUserAInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    kind?: Prisma.EnumConversationKindFieldUpdateOperationsInput | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    topic?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    dmUserB?: Prisma.ChatUserUpdateOneWithoutDmsAsUserBNestedInput;
    group?: Prisma.GroupUpdateOneWithoutChannelsNestedInput;
    messages?: Prisma.MessageUpdateManyWithoutConversationNestedInput;
    readStates?: Prisma.ConversationReadStateUpdateManyWithoutConversationNestedInput;
};
export type ConversationUncheckedUpdateWithoutDmUserAInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    kind?: Prisma.EnumConversationKindFieldUpdateOperationsInput | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    dmUserBId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    groupId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    topic?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    messages?: Prisma.MessageUncheckedUpdateManyWithoutConversationNestedInput;
    readStates?: Prisma.ConversationReadStateUncheckedUpdateManyWithoutConversationNestedInput;
};
export type ConversationUncheckedUpdateManyWithoutDmUserAInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    kind?: Prisma.EnumConversationKindFieldUpdateOperationsInput | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    dmUserBId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    groupId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    topic?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
};
export type ConversationUpdateWithoutDmUserBInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    kind?: Prisma.EnumConversationKindFieldUpdateOperationsInput | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    topic?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    dmUserA?: Prisma.ChatUserUpdateOneWithoutDmsAsUserANestedInput;
    group?: Prisma.GroupUpdateOneWithoutChannelsNestedInput;
    messages?: Prisma.MessageUpdateManyWithoutConversationNestedInput;
    readStates?: Prisma.ConversationReadStateUpdateManyWithoutConversationNestedInput;
};
export type ConversationUncheckedUpdateWithoutDmUserBInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    kind?: Prisma.EnumConversationKindFieldUpdateOperationsInput | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    dmUserAId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    groupId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    topic?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    messages?: Prisma.MessageUncheckedUpdateManyWithoutConversationNestedInput;
    readStates?: Prisma.ConversationReadStateUncheckedUpdateManyWithoutConversationNestedInput;
};
export type ConversationUncheckedUpdateManyWithoutDmUserBInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    kind?: Prisma.EnumConversationKindFieldUpdateOperationsInput | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    dmUserAId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    groupId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    topic?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
};
export type ConversationCreateManyGroupInput = {
    id?: string;
    kind: $Enums.ConversationKind;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    dmUserAId?: string | null;
    dmUserBId?: string | null;
    name?: string | null;
    topic?: string | null;
};
export type ConversationUpdateWithoutGroupInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    kind?: Prisma.EnumConversationKindFieldUpdateOperationsInput | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    topic?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    dmUserA?: Prisma.ChatUserUpdateOneWithoutDmsAsUserANestedInput;
    dmUserB?: Prisma.ChatUserUpdateOneWithoutDmsAsUserBNestedInput;
    messages?: Prisma.MessageUpdateManyWithoutConversationNestedInput;
    readStates?: Prisma.ConversationReadStateUpdateManyWithoutConversationNestedInput;
};
export type ConversationUncheckedUpdateWithoutGroupInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    kind?: Prisma.EnumConversationKindFieldUpdateOperationsInput | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    dmUserAId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    dmUserBId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    topic?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    messages?: Prisma.MessageUncheckedUpdateManyWithoutConversationNestedInput;
    readStates?: Prisma.ConversationReadStateUncheckedUpdateManyWithoutConversationNestedInput;
};
export type ConversationUncheckedUpdateManyWithoutGroupInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    kind?: Prisma.EnumConversationKindFieldUpdateOperationsInput | $Enums.ConversationKind;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    dmUserAId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    dmUserBId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    topic?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
};
export type ConversationCountOutputType = {
    messages: number;
    readStates: number;
};
export type ConversationCountOutputTypeSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    messages?: boolean | ConversationCountOutputTypeCountMessagesArgs;
    readStates?: boolean | ConversationCountOutputTypeCountReadStatesArgs;
};
export type ConversationCountOutputTypeDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationCountOutputTypeSelect<ExtArgs> | null;
};
export type ConversationCountOutputTypeCountMessagesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.MessageWhereInput;
};
export type ConversationCountOutputTypeCountReadStatesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ConversationReadStateWhereInput;
};
export type ConversationSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    kind?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    dmUserAId?: boolean;
    dmUserBId?: boolean;
    groupId?: boolean;
    name?: boolean;
    topic?: boolean;
    dmUserA?: boolean | Prisma.Conversation$dmUserAArgs<ExtArgs>;
    dmUserB?: boolean | Prisma.Conversation$dmUserBArgs<ExtArgs>;
    group?: boolean | Prisma.Conversation$groupArgs<ExtArgs>;
    messages?: boolean | Prisma.Conversation$messagesArgs<ExtArgs>;
    readStates?: boolean | Prisma.Conversation$readStatesArgs<ExtArgs>;
    _count?: boolean | Prisma.ConversationCountOutputTypeDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["conversation"]>;
export type ConversationSelectCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    kind?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    dmUserAId?: boolean;
    dmUserBId?: boolean;
    groupId?: boolean;
    name?: boolean;
    topic?: boolean;
    dmUserA?: boolean | Prisma.Conversation$dmUserAArgs<ExtArgs>;
    dmUserB?: boolean | Prisma.Conversation$dmUserBArgs<ExtArgs>;
    group?: boolean | Prisma.Conversation$groupArgs<ExtArgs>;
}, ExtArgs["result"]["conversation"]>;
export type ConversationSelectUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    kind?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    dmUserAId?: boolean;
    dmUserBId?: boolean;
    groupId?: boolean;
    name?: boolean;
    topic?: boolean;
    dmUserA?: boolean | Prisma.Conversation$dmUserAArgs<ExtArgs>;
    dmUserB?: boolean | Prisma.Conversation$dmUserBArgs<ExtArgs>;
    group?: boolean | Prisma.Conversation$groupArgs<ExtArgs>;
}, ExtArgs["result"]["conversation"]>;
export type ConversationSelectScalar = {
    id?: boolean;
    kind?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    dmUserAId?: boolean;
    dmUserBId?: boolean;
    groupId?: boolean;
    name?: boolean;
    topic?: boolean;
};
export type ConversationOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "kind" | "createdAt" | "updatedAt" | "dmUserAId" | "dmUserBId" | "groupId" | "name" | "topic", ExtArgs["result"]["conversation"]>;
export type ConversationInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    dmUserA?: boolean | Prisma.Conversation$dmUserAArgs<ExtArgs>;
    dmUserB?: boolean | Prisma.Conversation$dmUserBArgs<ExtArgs>;
    group?: boolean | Prisma.Conversation$groupArgs<ExtArgs>;
    messages?: boolean | Prisma.Conversation$messagesArgs<ExtArgs>;
    readStates?: boolean | Prisma.Conversation$readStatesArgs<ExtArgs>;
    _count?: boolean | Prisma.ConversationCountOutputTypeDefaultArgs<ExtArgs>;
};
export type ConversationIncludeCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    dmUserA?: boolean | Prisma.Conversation$dmUserAArgs<ExtArgs>;
    dmUserB?: boolean | Prisma.Conversation$dmUserBArgs<ExtArgs>;
    group?: boolean | Prisma.Conversation$groupArgs<ExtArgs>;
};
export type ConversationIncludeUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    dmUserA?: boolean | Prisma.Conversation$dmUserAArgs<ExtArgs>;
    dmUserB?: boolean | Prisma.Conversation$dmUserBArgs<ExtArgs>;
    group?: boolean | Prisma.Conversation$groupArgs<ExtArgs>;
};
export type $ConversationPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "Conversation";
    objects: {
        dmUserA: Prisma.$ChatUserPayload<ExtArgs> | null;
        dmUserB: Prisma.$ChatUserPayload<ExtArgs> | null;
        group: Prisma.$GroupPayload<ExtArgs> | null;
        messages: Prisma.$MessagePayload<ExtArgs>[];
        readStates: Prisma.$ConversationReadStatePayload<ExtArgs>[];
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        kind: $Enums.ConversationKind;
        createdAt: Date;
        updatedAt: Date;
        dmUserAId: string | null;
        dmUserBId: string | null;
        groupId: string | null;
        name: string | null;
        topic: string | null;
    }, ExtArgs["result"]["conversation"]>;
    composites: {};
};
export type ConversationGetPayload<S extends boolean | null | undefined | ConversationDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$ConversationPayload, S>;
export type ConversationCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<ConversationFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: ConversationCountAggregateInputType | true;
};
export interface ConversationDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['Conversation'];
        meta: {
            name: 'Conversation';
        };
    };
    findUnique<T extends ConversationFindUniqueArgs>(args: Prisma.SelectSubset<T, ConversationFindUniqueArgs<ExtArgs>>): Prisma.Prisma__ConversationClient<runtime.Types.Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends ConversationFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, ConversationFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__ConversationClient<runtime.Types.Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends ConversationFindFirstArgs>(args?: Prisma.SelectSubset<T, ConversationFindFirstArgs<ExtArgs>>): Prisma.Prisma__ConversationClient<runtime.Types.Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends ConversationFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, ConversationFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__ConversationClient<runtime.Types.Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends ConversationFindManyArgs>(args?: Prisma.SelectSubset<T, ConversationFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends ConversationCreateArgs>(args: Prisma.SelectSubset<T, ConversationCreateArgs<ExtArgs>>): Prisma.Prisma__ConversationClient<runtime.Types.Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends ConversationCreateManyArgs>(args?: Prisma.SelectSubset<T, ConversationCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    createManyAndReturn<T extends ConversationCreateManyAndReturnArgs>(args?: Prisma.SelectSubset<T, ConversationCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>;
    delete<T extends ConversationDeleteArgs>(args: Prisma.SelectSubset<T, ConversationDeleteArgs<ExtArgs>>): Prisma.Prisma__ConversationClient<runtime.Types.Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends ConversationUpdateArgs>(args: Prisma.SelectSubset<T, ConversationUpdateArgs<ExtArgs>>): Prisma.Prisma__ConversationClient<runtime.Types.Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends ConversationDeleteManyArgs>(args?: Prisma.SelectSubset<T, ConversationDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends ConversationUpdateManyArgs>(args: Prisma.SelectSubset<T, ConversationUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateManyAndReturn<T extends ConversationUpdateManyAndReturnArgs>(args: Prisma.SelectSubset<T, ConversationUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>;
    upsert<T extends ConversationUpsertArgs>(args: Prisma.SelectSubset<T, ConversationUpsertArgs<ExtArgs>>): Prisma.Prisma__ConversationClient<runtime.Types.Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends ConversationCountArgs>(args?: Prisma.Subset<T, ConversationCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], ConversationCountAggregateOutputType> : number>;
    aggregate<T extends ConversationAggregateArgs>(args: Prisma.Subset<T, ConversationAggregateArgs>): Prisma.PrismaPromise<GetConversationAggregateType<T>>;
    groupBy<T extends ConversationGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: ConversationGroupByArgs['orderBy'];
    } : {
        orderBy?: ConversationGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, ConversationGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetConversationGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: ConversationFieldRefs;
}
export interface Prisma__ConversationClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    dmUserA<T extends Prisma.Conversation$dmUserAArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.Conversation$dmUserAArgs<ExtArgs>>): Prisma.Prisma__ChatUserClient<runtime.Types.Result.GetResult<Prisma.$ChatUserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    dmUserB<T extends Prisma.Conversation$dmUserBArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.Conversation$dmUserBArgs<ExtArgs>>): Prisma.Prisma__ChatUserClient<runtime.Types.Result.GetResult<Prisma.$ChatUserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    group<T extends Prisma.Conversation$groupArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.Conversation$groupArgs<ExtArgs>>): Prisma.Prisma__GroupClient<runtime.Types.Result.GetResult<Prisma.$GroupPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    messages<T extends Prisma.Conversation$messagesArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.Conversation$messagesArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    readStates<T extends Prisma.Conversation$readStatesArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.Conversation$readStatesArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ConversationReadStatePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface ConversationFieldRefs {
    readonly id: Prisma.FieldRef<"Conversation", 'String'>;
    readonly kind: Prisma.FieldRef<"Conversation", 'ConversationKind'>;
    readonly createdAt: Prisma.FieldRef<"Conversation", 'DateTime'>;
    readonly updatedAt: Prisma.FieldRef<"Conversation", 'DateTime'>;
    readonly dmUserAId: Prisma.FieldRef<"Conversation", 'String'>;
    readonly dmUserBId: Prisma.FieldRef<"Conversation", 'String'>;
    readonly groupId: Prisma.FieldRef<"Conversation", 'String'>;
    readonly name: Prisma.FieldRef<"Conversation", 'String'>;
    readonly topic: Prisma.FieldRef<"Conversation", 'String'>;
}
export type ConversationFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationSelect<ExtArgs> | null;
    omit?: Prisma.ConversationOmit<ExtArgs> | null;
    include?: Prisma.ConversationInclude<ExtArgs> | null;
    where: Prisma.ConversationWhereUniqueInput;
};
export type ConversationFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationSelect<ExtArgs> | null;
    omit?: Prisma.ConversationOmit<ExtArgs> | null;
    include?: Prisma.ConversationInclude<ExtArgs> | null;
    where: Prisma.ConversationWhereUniqueInput;
};
export type ConversationFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type ConversationFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type ConversationFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type ConversationCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationSelect<ExtArgs> | null;
    omit?: Prisma.ConversationOmit<ExtArgs> | null;
    include?: Prisma.ConversationInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.ConversationCreateInput, Prisma.ConversationUncheckedCreateInput>;
};
export type ConversationCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.ConversationCreateManyInput | Prisma.ConversationCreateManyInput[];
    skipDuplicates?: boolean;
};
export type ConversationCreateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationSelectCreateManyAndReturn<ExtArgs> | null;
    omit?: Prisma.ConversationOmit<ExtArgs> | null;
    data: Prisma.ConversationCreateManyInput | Prisma.ConversationCreateManyInput[];
    skipDuplicates?: boolean;
    include?: Prisma.ConversationIncludeCreateManyAndReturn<ExtArgs> | null;
};
export type ConversationUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationSelect<ExtArgs> | null;
    omit?: Prisma.ConversationOmit<ExtArgs> | null;
    include?: Prisma.ConversationInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.ConversationUpdateInput, Prisma.ConversationUncheckedUpdateInput>;
    where: Prisma.ConversationWhereUniqueInput;
};
export type ConversationUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.ConversationUpdateManyMutationInput, Prisma.ConversationUncheckedUpdateManyInput>;
    where?: Prisma.ConversationWhereInput;
    limit?: number;
};
export type ConversationUpdateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationSelectUpdateManyAndReturn<ExtArgs> | null;
    omit?: Prisma.ConversationOmit<ExtArgs> | null;
    data: Prisma.XOR<Prisma.ConversationUpdateManyMutationInput, Prisma.ConversationUncheckedUpdateManyInput>;
    where?: Prisma.ConversationWhereInput;
    limit?: number;
    include?: Prisma.ConversationIncludeUpdateManyAndReturn<ExtArgs> | null;
};
export type ConversationUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationSelect<ExtArgs> | null;
    omit?: Prisma.ConversationOmit<ExtArgs> | null;
    include?: Prisma.ConversationInclude<ExtArgs> | null;
    where: Prisma.ConversationWhereUniqueInput;
    create: Prisma.XOR<Prisma.ConversationCreateInput, Prisma.ConversationUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.ConversationUpdateInput, Prisma.ConversationUncheckedUpdateInput>;
};
export type ConversationDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationSelect<ExtArgs> | null;
    omit?: Prisma.ConversationOmit<ExtArgs> | null;
    include?: Prisma.ConversationInclude<ExtArgs> | null;
    where: Prisma.ConversationWhereUniqueInput;
};
export type ConversationDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ConversationWhereInput;
    limit?: number;
};
export type Conversation$dmUserAArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ChatUserSelect<ExtArgs> | null;
    omit?: Prisma.ChatUserOmit<ExtArgs> | null;
    include?: Prisma.ChatUserInclude<ExtArgs> | null;
    where?: Prisma.ChatUserWhereInput;
};
export type Conversation$dmUserBArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ChatUserSelect<ExtArgs> | null;
    omit?: Prisma.ChatUserOmit<ExtArgs> | null;
    include?: Prisma.ChatUserInclude<ExtArgs> | null;
    where?: Prisma.ChatUserWhereInput;
};
export type Conversation$groupArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.GroupSelect<ExtArgs> | null;
    omit?: Prisma.GroupOmit<ExtArgs> | null;
    include?: Prisma.GroupInclude<ExtArgs> | null;
    where?: Prisma.GroupWhereInput;
};
export type Conversation$messagesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type Conversation$readStatesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type ConversationDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ConversationSelect<ExtArgs> | null;
    omit?: Prisma.ConversationOmit<ExtArgs> | null;
    include?: Prisma.ConversationInclude<ExtArgs> | null;
};
