export const USER_EVENT_TYPES = {
  CREATED: 'user.created',
  UPDATED: 'user.updated',
  DELETED: 'user.deleted',
} as const;

export type UserProfileSnapshot = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  updatedAt: Date;
};

type UserProfileData = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type UserEvent =
  | {
      eventId: string;
      eventType:
        | typeof USER_EVENT_TYPES.CREATED
        | typeof USER_EVENT_TYPES.UPDATED;
      version: string;
      occurredAt: string;
      data: UserProfileData;
    }
  | {
      eventId: string;
      eventType: typeof USER_EVENT_TYPES.DELETED;
      version: string;
      occurredAt: string;
      data: { userId: string };
    };
