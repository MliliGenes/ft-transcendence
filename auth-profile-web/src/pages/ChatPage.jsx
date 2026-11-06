import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { chatRequest, connectChatSocket } from '../lib/chat.js';
import { sessionStore } from '../lib/runtime.js';
import { Loading, Notice } from '../components/Notice.jsx';
import { ProfileImage } from '../components/ProfileImage.jsx';

function upsertMessage(messages, message) {
  const next = messages.filter(
    (item) =>
      item.id !== message.id &&
      item.clientRequestId !== message.clientRequestId,
  );
  return [...next, message].sort(
    (a, b) =>
      new Date(a.createdAt) - new Date(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
}

function PresenceDot({ status = 'OFFLINE', label }) {
  return (
    <i
      className={`presence-dot presence-dot-${status.toLowerCase()}`}
      role="img"
      aria-label={`${label} ${status.toLowerCase()}`}
      title={`${label}: ${status.toLowerCase()}`}
    />
  );
}

function MessageAttachment({ conversationId, objectKey, index, setError }) {
  const item = useRef(null);
  const [details, setDetails] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadPreview = async () => {
      try {
        const query = new URLSearchParams({ objectKey });
        const attachment = await chatRequest(
          `/chat/conversations/${conversationId}/attachments/preview-url?${query}`,
          { signal: controller.signal },
        );
        setDetails(attachment);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure);
      }
    };

    if (typeof IntersectionObserver === 'undefined' || !item.current) {
      void loadPreview();
      return () => controller.abort();
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        void loadPreview();
      },
      { rootMargin: '200px' },
    );
    observer.observe(item.current);
    return () => {
      observer.disconnect();
      controller.abort();
    };
  }, [conversationId, objectKey, setError]);

  async function downloadAttachment() {
    try {
      const query = new URLSearchParams({ objectKey });
      const { url } = await chatRequest(
        `/chat/conversations/${conversationId}/attachments/download-url?${query}`,
      );
      window.location.assign(url);
    } catch (failure) {
      setError(failure);
    }
  }

  return (
    <li ref={item}>
      {details?.previewUrl && (
        <img
          className="message-attachment-image"
          src={details.previewUrl}
          alt={`Image attachment ${index + 1}`}
          loading="lazy"
        />
      )}
      {details ? (
        <button
          type="button"
          className="button button-secondary button-small"
          onClick={() => void downloadAttachment()}
        >
          Download attachment {index + 1}
        </button>
      ) : (
        <span className="muted">Attachment {index + 1}</span>
      )}
    </li>
  );
}

function trackPresenceActivity(socket) {
  let lastSentAt = 0;
  const sendActivity = () => {
    if (!socket.connected || document.visibilityState !== 'visible') return;
    const now = Date.now();
    if (now - lastSentAt < 30_000) return;
    lastSentAt = now;
    socket.emit('presence:activity');
  };
  const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'focus'];
  activityEvents.forEach((eventName) =>
    document.addEventListener(eventName, sendActivity, { passive: true }),
  );
  document.addEventListener('visibilitychange', sendActivity);
  socket.on('connect', sendActivity);
  return () => {
    activityEvents.forEach((eventName) =>
      document.removeEventListener(eventName, sendActivity),
    );
    document.removeEventListener('visibilitychange', sendActivity);
    socket.off('connect', sendActivity);
  };
}

export function ChatPage() {
  const { profile, revision } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [channels, setChannels] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedKind, setSelectedKind] = useState('');
  const selectedIdRef = useRef('');
  const [messages, setMessages] = useState([]);
  const [targetId, setTargetId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [memberId, setMemberId] = useState('');
  const [channelName, setChannelName] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const fileInput = useRef(null);
  const uploadedObjectKeys = useRef(new Map());
  const pendingRequest = useRef(null);
  const lastMarkedMessage = useRef(new Map());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [socketState, setSocketState] = useState('connecting');
  const [presenceStatus, setPresenceStatus] = useState('OFFLINE');
  const [presenceByUserId, setPresenceByUserId] = useState({});

  const loadConversations = useCallback(async (signal) => {
    const data = await chatRequest('/chat/conversations', { signal });
    setConversations(data);
    return data;
  }, []);

  const loadGroups = useCallback(async (signal) => {
    const data = await chatRequest('/chat/groups', { signal });
    setGroups(data);
    return data;
  }, []);

  const loadGroupMembers = useCallback(async (groupId, signal) => {
    const data = await chatRequest(`/chat/groups/${groupId}/members`, { signal });
    setMembers(data);
    return data;
  }, []);

  const loadGroupChannels = useCallback(async (groupId, signal) => {
    const data = await chatRequest(`/chat/groups/${groupId}/channels`, { signal });
    setChannels(data);
    return data;
  }, []);

  const markRead = useCallback(async (conversationId, messageId) => {
    if (lastMarkedMessage.current.get(conversationId) === messageId) return;
    lastMarkedMessage.current.set(conversationId, messageId);
    try {
      await chatRequest(`/chat/conversations/${conversationId}/read-state`, {
        method: 'PATCH',
        json: { messageId },
      });
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, lastReadMessageId: messageId, unreadCount: 0 }
            : conversation,
        ),
      );
      setChannels((current) =>
        current.map((channel) =>
          channel.id === conversationId
            ? { ...channel, lastReadMessageId: messageId, unreadCount: 0 }
            : channel,
        ),
      );
    } catch (failure) {
      if (lastMarkedMessage.current.get(conversationId) === messageId)
        lastMarkedMessage.current.delete(conversationId);
      throw failure;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    loadConversations(controller.signal)
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loadConversations]);

  useEffect(() => {
    const controller = new AbortController();
    loadGroups(controller.signal).catch((failure) => {
      if (!controller.signal.aborted) setError(failure);
    });
    return () => controller.abort();
  }, [loadGroups]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    setFiles([]);
    uploadedObjectKeys.current.clear();
    pendingRequest.current = null;
    if (fileInput.current) fileInput.current.value = '';
    if (!selectedId) {
      setMessages([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    chatRequest(`/chat/conversations/${selectedId}/messages?limit=50`, {
      signal: controller.signal,
    })
      .then(async (data) => {
        setMessages([...data].reverse());
        if (selectedKind === 'CHANNEL' && data.length > 0)
          await markRead(selectedId, data[0].id);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [markRead, selectedId, selectedKind]);

  useEffect(() => {
    if (selectedKind !== 'DM' || !selectedId || messages.length === 0) return;
    const newestMessage = messages[messages.length - 1];
    if (newestMessage.conversationId !== selectedId) return;
    const markVisibleMessages = () => {
      if (document.visibilityState === 'visible')
        void markRead(selectedId, newestMessage.id).catch(setError);
    };
    markVisibleMessages();
    document.addEventListener('visibilitychange', markVisibleMessages);
    return () =>
      document.removeEventListener('visibilitychange', markVisibleMessages);
  }, [markRead, messages, selectedId, selectedKind]);

  useEffect(() => {
    let socket;
    let stopTrackingPresence = () => {};
    const connect = (session) => {
      stopTrackingPresence();
      socket?.disconnect();
      if (!session) {
        setSocketState('disconnected');
        setPresenceStatus('OFFLINE');
        setPresenceByUserId({});
        return;
      }
      setSocketState('connecting');
      socket = connectChatSocket(session.accessToken);
      stopTrackingPresence = trackPresenceActivity(socket);
      socket.on('connect', () => setSocketState('connected'));
      socket.on('disconnect', () => {
        setSocketState('disconnected');
        setPresenceStatus('OFFLINE');
        setPresenceByUserId({});
      });
      socket.on('connect_error', (failure) => {
        setSocketState('error');
        setError(failure);
      });
      socket.on('presence:snapshot', ({ users = [] }) => {
        const statuses = Object.fromEntries(
          users.map(({ userId, status }) => [userId, status]),
        );
        setPresenceByUserId(statuses);
        setPresenceStatus(statuses[profile?.id] || 'OFFLINE');
      });
      socket.on('presence:changed', ({ userId, status }) => {
        setPresenceByUserId((current) => ({ ...current, [userId]: status }));
        if (userId === profile?.id) setPresenceStatus(status);
      });
      socket.on('message:created', (message) => {
        if (selectedIdRef.current === message.conversationId)
          setMessages((current) => upsertMessage(current, message));
        void loadConversations().catch(setError);
      });
    };
    connect(sessionStore.read());
    const unsubscribe = sessionStore.subscribe(connect);
    return () => {
      unsubscribe();
      stopTrackingPresence();
      socket?.disconnect();
    };
  }, [loadConversations, profile?.id]);

  async function createDm(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const conversation = await chatRequest('/chat/conversations/dm', {
        method: 'POST',
        json: { userId: targetId.trim() },
      });
      await loadConversations();
      setSelectedId(conversation.id);
      setSelectedKind('DM');
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  async function createGroup(event) {
    event.preventDefault();
    if (busy || !groupName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const group = await chatRequest('/chat/groups', {
        method: 'POST',
        json: { name: groupName.trim() },
      });
      const updatedGroups = await loadGroups();
      setSelectedGroupId(group.id);
      setChannels(group.channels);
      await loadGroupMembers(group.id);
      setSelectedId('');
      setSelectedKind('');
      setGroupName('');
      if (!updatedGroups.some((item) => item.id === group.id))
        setGroups((current) => [group, ...current]);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  async function selectGroup(groupId) {
    setSelectedGroupId(groupId);
    setSelectedId('');
    setSelectedKind('');
    setChannels([]);
    setMembers([]);
    if (!groupId) return;
    try {
      await Promise.all([
        loadGroupChannels(groupId),
        loadGroupMembers(groupId),
      ]);
    } catch (failure) {
      setError(failure);
    }
  }

  async function addGroupMember(event) {
    event.preventDefault();
    if (busy || !selectedGroupId || !memberId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await chatRequest(`/chat/groups/${selectedGroupId}/members`, {
        method: 'POST',
        json: { userId: memberId.trim() },
      });
      setMemberId('');
      await loadGroups();
      await loadGroupMembers(selectedGroupId);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  async function createChannel(event) {
    event.preventDefault();
    if (busy || !selectedGroupId || !channelName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const channel = await chatRequest(
        `/chat/groups/${selectedGroupId}/channels`,
        { method: 'POST', json: { name: channelName.trim() } },
      );
      setChannels((current) => [...current, channel]);
      setChannelName('');
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const text = content.trim();
    if (!text || !selectedId || busy) return;
    const conversationId = selectedId;
    const clientRequestId = pendingRequest.current || crypto.randomUUID();
    pendingRequest.current = clientRequestId;
    setBusy(true);
    setError(null);
    try {
      const attachments = [];
      for (const file of files) {
        let objectKey = uploadedObjectKeys.current.get(file);
        if (!objectKey) {
          const upload = await chatRequest(
            `/chat/conversations/${conversationId}/attachments/upload-url`,
            { method: 'POST', json: { contentType: file.type } },
          );
          const form = new FormData();
          Object.entries(upload.fields).forEach(([key, value]) =>
            form.append(key, value),
          );
          form.append('file', file);
          const response = await fetch(upload.uploadUrl, {
            method: 'POST',
            body: form,
          });
          if (!response.ok)
            throw new Error(`File upload failed (${response.status}).`);
          objectKey = upload.objectKey;
          uploadedObjectKeys.current.set(file, objectKey);
        }
        attachments.push(objectKey);
      }
      const message = await chatRequest(
        `/chat/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          json: { content: text, clientRequestId, attachments },
        },
      );
      setMessages((current) => upsertMessage(current, message));
      pendingRequest.current = null;
      setContent('');
      setFiles([]);
      if (fileInput.current) fileInput.current.value = '';
      uploadedObjectKeys.current.clear();
      await loadConversations();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="card settings-card chat-tester"
      aria-labelledby="chat-heading"
    >
      <div className="section-heading">
        <div>
          <h2 id="chat-heading">Chat tester</h2>
          <p className="muted">
            Socket: <strong>{socketState}</strong> · Presence:{' '}
            <span className="presence-indicator" role="status" aria-live="polite">
              <span
                className={`presence-dot presence-dot-${presenceStatus.toLowerCase()}`}
                aria-hidden="true"
              />
              <strong>{presenceStatus.toLowerCase()}</strong>
            </span>
          </p>
        </div>
        <button
          className="button button-secondary button-small"
          onClick={() =>
            Promise.all([loadConversations(), loadGroups()]).catch(setError)
          }
          disabled={busy}
        >
          Refresh
        </button>
      </div>
      <Notice error={error} />
      <form onSubmit={createDm}>
        <fieldset disabled={busy}>
          <label>
            Target user UUID
            <input
              required
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              placeholder="Copy an ID from People here"
            />
          </label>
          <button className="button button-primary">Open direct message</button>
        </fieldset>
      </form>
      <details className="group-chat-tester" open>
        <summary>Group channel tester</summary>
        <form onSubmit={createGroup}>
          <fieldset disabled={busy}>
            <label>
              New group name
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                maxLength={100}
              />
            </label>
            <button className="button button-secondary">Create group</button>
          </fieldset>
        </form>
        <label>
          Your groups
          <select
            value={selectedGroupId}
            onChange={(event) => void selectGroup(event.target.value)}
          >
            <option value="">Select a group</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        {selectedGroupId && (
          <>
            <form onSubmit={addGroupMember}>
              <fieldset disabled={busy}>
                <label>
                  Add member by user UUID
                  <input
                    value={memberId}
                    onChange={(event) => setMemberId(event.target.value)}
                  />
                </label>
                <button className="button button-secondary">Add member</button>
              </fieldset>
            </form>
            <form onSubmit={createChannel}>
              <fieldset disabled={busy}>
                <label>
                  New channel name
                  <input
                    value={channelName}
                    onChange={(event) => setChannelName(event.target.value)}
                    maxLength={80}
                  />
                </label>
                <button className="button button-secondary">Create channel</button>
              </fieldset>
            </form>
          </>
        )}
      </details>
      <div className="chat-layout">
        <nav className="conversation-list" aria-label="Direct conversations">
          <h3>Conversations</h3>
          {conversations.length === 0 ? (
            <p className="muted">No conversations yet.</p>
          ) : (
            conversations.map((conversation) => {
              const otherUser =
                conversation.dmUserAId === profile.id
                  ? conversation.dmUserB
                  : conversation.dmUserA;
              const displayName =
                otherUser?.displayName || otherUser?.username || 'Unknown user';
              return (
                <button
                  key={conversation.id}
                  className={
                    conversation.id === selectedId ? 'conversation-active' : ''
                  }
                  onClick={() => {
                    setSelectedId(conversation.id);
                    setSelectedKind('DM');
                  }}
                >
                  <ProfileImage
                    user={otherUser || { username: displayName }}
                    small
                    revision={revision}
                  />
                  <PresenceDot
                    status={presenceByUserId[otherUser?.id]}
                    label={displayName}
                  />
                  <span>
                    {displayName}
                    {otherUser?.username && <small>@{otherUser.username}</small>}
                  </span>
                  {conversation.unreadCount > 0 && (
                    <strong>{conversation.unreadCount}</strong>
                  )}
                </button>
              );
            })
          )}
          <h3>Group channels</h3>
          {channels.map((channel) => (
            <button
              key={channel.id}
              className={channel.id === selectedId ? 'conversation-active' : ''}
              onClick={() => {
                setSelectedId(channel.id);
                setSelectedKind('CHANNEL');
              }}
            >
              # {channel.name}
              {channel.unreadCount > 0 && <strong>{channel.unreadCount}</strong>}
            </button>
          ))}
          {members.length > 0 && (
            <div className="group-member-list">
              <h3>Members</h3>
              {members.map(({ user }) => (
                <div className="group-member-row" key={user.id}>
                  <ProfileImage user={user} small revision={revision} />
                  <PresenceDot
                    status={presenceByUserId[user.id]}
                    label={user.displayName || user.username || 'User'}
                  />
                  <span>
                    {user.displayName || user.username || 'Unknown user'}
                    {user.username && <small>@{user.username}</small>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </nav>
        <div className="message-panel">
          {!selectedId ? (
            <p className="muted empty-state">Open or select a conversation or group channel.</p>
          ) : loading ? (
            <Loading text="Loading messages…" />
          ) : (
            <ol className="message-list" aria-live="polite">
              {messages.map((message) => {
                const author =
                  message.author ||
                  (message.authorId === profile.id
                    ? profile
                    : { username: 'Unknown user' });
                const displayName =
                  message.authorId === profile.id
                    ? 'You'
                    : author.displayName || author.username || 'Unknown user';
                return (
                  <li
                    key={message.id}
                    className={
                      message.authorId === profile.id ? 'message-mine' : ''
                    }
                  >
                    <div className="message-author">
                      <ProfileImage user={author} small revision={revision} />
                      <span>{displayName}</span>
                    </div>
                    <p>{message.deletedAt ? 'Message deleted' : message.content}</p>
                    {!message.deletedAt && message.attachments?.length > 0 && (
                      <ul className="message-attachments">
                        {message.attachments.map((objectKey, index) => (
                          <MessageAttachment
                            key={objectKey}
                            conversationId={message.conversationId}
                            objectKey={objectKey}
                            index={index}
                            setError={setError}
                          />
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          <form className="message-form" onSubmit={sendMessage}>
            <label>
              Message
              <textarea
                maxLength={2000}
                disabled={!selectedId || busy}
                value={content}
                onChange={(event) => {
                  setContent(event.target.value);
                  pendingRequest.current = null;
                }}
                placeholder="Write a test message"
              />
            </label>
            <label>
              Attach files (up to 5, 10 MB each)
              <input
                ref={fileInput}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                disabled={!selectedId || busy}
                onChange={(event) => {
                  const selected = Array.from(event.target.files || []);
                  const allowedTypes = new Set([
                    'image/jpeg',
                    'image/png',
                    'image/webp',
                    'image/gif',
                    'application/pdf',
                  ]);
                  if (
                    selected.length > 5 ||
                    selected.some(
                      (file) => !allowedTypes.has(file.type) || file.size > 10 * 1024 * 1024,
                    )
                  ) {
                    setError(new Error('Choose up to 5 supported files, each 10 MB or smaller.'));
                    event.target.value = '';
                    return;
                  }
                  setError(null);
                  setFiles(selected);
                  uploadedObjectKeys.current.clear();
                  pendingRequest.current = null;
                }}
              />
            </label>
            {files.length > 0 && (
              <ul className="selected-attachments">
                {files.map((file) => (
                  <li key={`${file.name}-${file.lastModified}`}>
                    {file.name} ({Math.ceil(file.size / 1024)} KB)
                  </li>
                ))}
              </ul>
            )}
            <button
              className="button button-primary"
              disabled={!selectedId || !content.trim() || busy}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
