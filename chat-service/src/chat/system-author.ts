/**
 * The system account that publishes game lifecycle notifications.
 *
 * Chat stores one ChatUser row for it so notifications are ordinary,
 * persisted messages: they appear in history, count as unread and are
 * delivered live like any other message. It is not a User-service account
 * and it never authenticates.
 */
export const SYSTEM_AUTHOR_ID = '0000a11e-0000-4000-8000-000000000000';
export const SYSTEM_AUTHOR_USERNAME = 'code-arena';
export const SYSTEM_AUTHOR_DISPLAY_NAME = 'Code Arena';
