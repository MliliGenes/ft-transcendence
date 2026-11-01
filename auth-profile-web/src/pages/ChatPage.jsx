import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { chatRequest, connectChatSocket } from '../lib/chat.js';
import { sessionStore } from '../lib/runtime.js';
import { Loading, Notice } from '../components/Notice.jsx';

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

export function ChatPage() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const selectedIdRef = useRef('');
  const [messages, setMessages] = useState([]);
  const [targetId, setTargetId] = useState('');
  const [content, setContent] = useState('');
  const pendingRequest = useRef(null);
  const lastMarkedMessage = useRef(new Map());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [socketState, setSocketState] = useState('connecting');

  const loadConversations = useCallback(async (signal) => {
    const data = await chatRequest('/chat/conversations', { signal });
    setConversations(data);
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
    selectedIdRef.current = selectedId;
    if (!selectedId) {
      setMessages([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    chatRequest(`/chat/conversations/${selectedId}/messages?limit=50`, {
      signal: controller.signal,
    })
      .then((data) => setMessages([...data].reverse()))
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || messages.length === 0) return;
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
  }, [markRead, messages, selectedId]);

  useEffect(() => {
    let socket;
    const connect = (session) => {
      socket?.disconnect();
      if (!session) {
        setSocketState('disconnected');
        return;
      }
      setSocketState('connecting');
      socket = connectChatSocket(session.accessToken);
      socket.on('connect', () => setSocketState('connected'));
      socket.on('disconnect', () => setSocketState('disconnected'));
      socket.on('connect_error', (failure) => {
        setSocketState('error');
        setError(failure);
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
      socket?.disconnect();
    };
  }, [loadConversations]);

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
    const clientRequestId = pendingRequest.current || crypto.randomUUID();
    pendingRequest.current = clientRequestId;
    setBusy(true);
    setError(null);
    try {
      const message = await chatRequest(
        `/chat/conversations/${selectedId}/messages`,
        {
          method: 'POST',
          json: { content: text, clientRequestId },
        },
      );
      setMessages((current) => upsertMessage(current, message));
      pendingRequest.current = null;
      setContent('');
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
          <h2 id="chat-heading">Direct-message tester</h2>
          <p className="muted">
            Socket: <strong>{socketState}</strong>
          </p>
        </div>
        <button
          className="button button-secondary button-small"
          onClick={() => loadConversations().catch(setError)}
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
      <div className="chat-layout">
        <nav className="conversation-list" aria-label="Direct conversations">
          <h3>Conversations</h3>
          {conversations.length === 0 ? (
            <p className="muted">No conversations yet.</p>
          ) : (
            conversations.map((conversation) => {
              const otherId =
                conversation.dmUserAId === profile.id
                  ? conversation.dmUserBId
                  : conversation.dmUserAId;
              return (
                <button
                  key={conversation.id}
                  className={
                    conversation.id === selectedId ? 'conversation-active' : ''
                  }
                  onClick={() => setSelectedId(conversation.id)}
                >
                  <span>{otherId}</span>
                  {conversation.unreadCount > 0 && (
                    <strong>{conversation.unreadCount}</strong>
                  )}
                </button>
              );
            })
          )}
        </nav>
        <div className="message-panel">
          {!selectedId ? (
            <p className="muted empty-state">Open or select a conversation.</p>
          ) : loading ? (
            <Loading text="Loading messages…" />
          ) : (
            <ol className="message-list" aria-live="polite">
              {messages.map((message) => (
                <li
                  key={message.id}
                  className={
                    message.authorId === profile.id ? 'message-mine' : ''
                  }
                >
                  <span>
                    {message.authorId === profile.id ? 'You' : 'Them'}
                  </span>
                  <p>{message.deletedAt ? 'Message deleted' : message.content}</p>
                </li>
              ))}
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
