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
      eventType: 'user.created' | 'user.updated';
      version: string;
      occurredAt: string;
      data: UserProfileData;
    }
  | {
      eventId: string;
      eventType: 'user.deleted';
      version: string;
      occurredAt: string;
      data: { userId: string };
    };
