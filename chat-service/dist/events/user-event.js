import { isUUID } from 'class-validator';
export const USER_EVENT_TYPES = {
    CREATED: 'user.created',
    UPDATED: 'user.updated',
    DELETED: 'user.deleted',
};
function isDate(value) {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}
export function parseUserEvent(value) {
    if (!value || typeof value !== 'object')
        return null;
    const event = value;
    if (!isUUID(event.eventId, '4') ||
        !isDate(event.version) ||
        !isDate(event.occurredAt) ||
        !event.data ||
        typeof event.data !== 'object')
        return null;
    const data = event.data;
    if (!isUUID(data.userId, '4'))
        return null;
    if (event.eventType === USER_EVENT_TYPES.DELETED)
        return event;
    if ((event.eventType !== USER_EVENT_TYPES.CREATED &&
        event.eventType !== USER_EVENT_TYPES.UPDATED) ||
        typeof data.username !== 'string' ||
        (data.displayName !== null && typeof data.displayName !== 'string') ||
        (data.avatarUrl !== null && typeof data.avatarUrl !== 'string'))
        return null;
    return event;
}
//# sourceMappingURL=user-event.js.map