export type PresenceStatus = 'ONLINE' | 'AWAY' | 'OFFLINE';
export type PresenceChange = {
    userId: string;
    status: PresenceStatus;
};
export declare class PresenceService {
    private readonly socketsByUser;
    private readonly statusByUser;
    connect(userId: string, socketId: string): PresenceChange | null;
    recordActivity(userId: string, socketId: string): PresenceChange | null;
    disconnect(userId: string, socketId: string): PresenceChange | null;
    expireIdleUsers(): PresenceChange[];
    getStatuses(userIds: string[]): {
        userId: string;
        status: PresenceStatus;
    }[];
    private updateStatus;
}
