import { AuthRequestError } from "@/lib/auth/client";

const API = "/api/chat";

export type ChatUser = { id: string; username: string; displayName: string | null; avatarUrl: string | null };
export type ChatMessage = {
  id: string;
  conversationId: string;
  authorId: string;
  author: ChatUser;
  content: string | null;
  attachments: string[];
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  clientRequestId: string;
  version: number;
};
export type AttachmentUpload = {
  objectKey: string;
  uploadUrl: string;
  method: "POST";
  fields: Record<string, string>;
  expiresInSeconds: number;
  maxBytes: number;
};
export type AttachmentPreview = { contentType: string; previewUrl: string | null };
export type DirectConversation = {
  id: string;
  kind: "DM";
  updatedAt: string;
  dmUserA: ChatUser;
  dmUserB: ChatUser;
  unreadCount: number;
};
export type ChatChannel = { id: string; name: string; topic: string | null; lastReadMessageId: string | null; unreadCount: number };
export type ChatGroup = {
  id: string;
  name: string;
  description: string | null;
  rules: string | null;
  updatedAt?: string;
  members: { role: "ADMIN" | "MEMBER" }[];
  channels: ChatChannel[];
};
export type GroupMember = { role: "ADMIN" | "MEMBER"; joinedAt: string; user: ChatUser };

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...init,
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new AuthRequestError("Unable to reach chat. Check your connection and try again.", 0);
  }
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json() as { message?: string | string[] };
      detail = Array.isArray(body.message) ? body.message[0] ?? "" : body.message ?? "";
    } catch { /* Use a safe status fallback. */ }
    const message = response.status === 401 ? "Your session expired. Please sign in again."
      : response.status === 403 ? "You do not have permission to do that."
        : response.status === 404 ? "This conversation is no longer available."
          : response.status === 409 ? "That action conflicts with the latest chat state. Refresh and try again."
            : response.status === 503 ? "Chat is temporarily unavailable. Please try again."
              : response.status === 400 && detail ? detail
                : "Unable to complete that chat action. Please try again.";
    throw new AuthRequestError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return text ? JSON.parse(text) as T : undefined as T;
}

const json = (body: object): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

function requireSecureStorageUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new AuthRequestError("The attachment service did not return a secure URL.", 502);
  }
  return url.href;
}

async function uploadFile(upload: AttachmentUpload, file: File) {
  const body = new FormData();
  for (const [key, value] of Object.entries(upload.fields)) body.append(key, value);
  body.append("file", file);
  let response: Response;
  try {
    response = await fetch(requireSecureStorageUrl(upload.uploadUrl), { method: upload.method, body, cache: "no-store" });
  } catch {
    throw new AuthRequestError("Unable to upload this file. Check the connection and try again.", 0);
  }
  if (!response.ok) throw new AuthRequestError(`File upload failed (${response.status}).`, response.status);
}

export const chatApi = {
  conversations: (token: string) => request<DirectConversation[]>("/conversations", token),
  openDm: (userId: string, token: string) => request<DirectConversation>("/conversations/dm", token, json({ userId })),
  messages: (conversationId: string, token: string, before?: string) => request<ChatMessage[]>(`/conversations/${encodeURIComponent(conversationId)}/messages?limit=50${before ? `&before=${encodeURIComponent(before)}` : ""}`, token),
  send: (conversationId: string, content: string, clientRequestId: string, token: string, attachments: string[] = []) => request<ChatMessage>(`/conversations/${encodeURIComponent(conversationId)}/messages`, token, json({ content, clientRequestId, ...(attachments.length ? { attachments } : {}) })),
  createAttachmentUpload: (conversationId: string, contentType: string, token: string) => request<AttachmentUpload>(`/conversations/${encodeURIComponent(conversationId)}/attachments/upload-url`, token, json({ contentType })),
  uploadFile,
  previewAttachment: (conversationId: string, objectKey: string, token: string) => request<AttachmentPreview>(`/conversations/${encodeURIComponent(conversationId)}/attachments/preview-url?${new URLSearchParams({ objectKey })}`, token),
  downloadAttachment: (conversationId: string, objectKey: string, token: string) => request<{ url: string }>(`/conversations/${encodeURIComponent(conversationId)}/attachments/download-url?${new URLSearchParams({ objectKey })}`, token),
  markRead: (conversationId: string, messageId: string, token: string) => request<void>(`/conversations/${encodeURIComponent(conversationId)}/read-state`, token, { method: "PATCH", body: JSON.stringify({ messageId }) }),
  groups: (token: string) => request<ChatGroup[]>("/groups", token),
  group: (groupId: string, token: string) => request<ChatGroup>(`/groups/${encodeURIComponent(groupId)}`, token),
  createGroup: (name: string, token: string, rules?: string) => request<ChatGroup>("/groups", token, json({ name, ...(rules?.trim() ? { rules: rules.trim() } : {}) })),
  groupMembers: (groupId: string, token: string) => request<GroupMember[]>(`/groups/${encodeURIComponent(groupId)}/members`, token),
  addGroupMember: (groupId: string, userId: string, token: string) => request<void>(`/groups/${encodeURIComponent(groupId)}/members`, token, json({ userId })),
  removeGroupMember: (groupId: string, userId: string, token: string) => request<void>(`/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`, token, { method: "DELETE" }),
  leaveGroup: (groupId: string, token: string) => request<void>(`/groups/${encodeURIComponent(groupId)}/members/me`, token, { method: "DELETE" }),
  updateGroup: (groupId: string, values: { name?: string; rules?: string }, token: string) => request<ChatGroup>(`/groups/${encodeURIComponent(groupId)}`, token, { method: "PATCH", body: JSON.stringify(values) }),
  createChannel: (groupId: string, values: { name: string; topic?: string }, token: string) => request<ChatChannel>(`/groups/${encodeURIComponent(groupId)}/channels`, token, json(values)),
  updateChannel: (groupId: string, channelId: string, values: { name?: string; topic?: string }, token: string) => request<ChatChannel>(`/groups/${encodeURIComponent(groupId)}/channels/${encodeURIComponent(channelId)}`, token, { method: "PATCH", body: JSON.stringify(values) }),
  deleteChannel: (groupId: string, channelId: string, token: string) => request<void>(`/groups/${encodeURIComponent(groupId)}/channels/${encodeURIComponent(channelId)}`, token, { method: "DELETE" }),
  groupChannels: (groupId: string, token: string) => request<ChatChannel[]>(`/groups/${encodeURIComponent(groupId)}/channels`, token),
};
