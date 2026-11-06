export declare const GroupRole: {
    readonly ADMIN: "ADMIN";
    readonly MEMBER: "MEMBER";
};
export type GroupRole = (typeof GroupRole)[keyof typeof GroupRole];
export declare const ConversationKind: {
    readonly DM: "DM";
    readonly CHANNEL: "CHANNEL";
};
export type ConversationKind = (typeof ConversationKind)[keyof typeof ConversationKind];
export declare const ReactionEmoji: {
    readonly THUMBS_UP: "THUMBS_UP";
    readonly HEART: "HEART";
    readonly LAUGH: "LAUGH";
    readonly SURPRISED: "SURPRISED";
    readonly SAD: "SAD";
    readonly FIRE: "FIRE";
};
export type ReactionEmoji = (typeof ReactionEmoji)[keyof typeof ReactionEmoji];
