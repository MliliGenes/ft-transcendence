export declare const USER_EVENT_TYPES: {
    readonly CREATED: "user.created";
    readonly UPDATED: "user.updated";
    readonly DELETED: "user.deleted";
};
type UserProfileData = {
    userId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
};
export type UserEvent = {
    eventId: string;
    eventType: typeof USER_EVENT_TYPES.CREATED | typeof USER_EVENT_TYPES.UPDATED;
    version: string;
    occurredAt: string;
    data: UserProfileData;
} | {
    eventId: string;
    eventType: typeof USER_EVENT_TYPES.DELETED;
    version: string;
    occurredAt: string;
    data: {
        userId: string;
    };
};
export declare function parseUserEvent(value: unknown): UserEvent | null;
export {};
