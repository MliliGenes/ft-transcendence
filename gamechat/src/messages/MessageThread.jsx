import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Info, Plus, Reply, Send, X } from "lucide-react";
import { getThemeStyle } from "./conversationThemes";
import { formatMessageTime, formatMessageDay } from "./mockMessages";

function Avatar({ person, size = "normal", status = false }) {
    const column = person.avatar % 3;
    const row = Math.floor(person.avatar / 3);

    return (
        <span
            className={`messages-avatar messages-avatar-${size}`}
            role="img"
            aria-label={person.name}
            style={{ backgroundPosition: `${column * 50}% ${row * 50}%` }}
        >
            {status && <span className={`messages-presence ${person.online ? "is-online" : ""}`} />}
        </span>
    );
}

function MessageThread({
    conversation,
    typing,
    onSend,
    onBack,
    onPreviewImage,
    detailsOpen,
    onToggleDetails,
    theme,
    searchOpen,
    onCloseSearch
}) {
    const [draft, setDraft] = useState("");
    const [reply, setReply] = useState(null);
    const [attachment, setAttachment] = useState(null);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [matchIndex, setMatchIndex] = useState(0);
    const searchInputRef = useRef(null);
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const matches = normalizedQuery
        ? conversation.messages.filter(message =>
              `${message.text || ""} ${message.image?.name || ""}`
                  .toLowerCase()
                  .includes(normalizedQuery)
          )
        : [];
    const activeMatch = searchOpen ? matches[matchIndex % (matches.length || 1)] : null;
    const activeMatchId = activeMatch?.id;
    const historyRef = useRef(null);
    const inputRef = useRef(null);
    const fileRef = useRef(null);
    const shouldScroll = useRef(true);

    useEffect(() => {
        if (shouldScroll.current && historyRef.current) {
            historyRef.current.scrollTop = historyRef.current.scrollHeight;
        }
    }, [conversation.messages, typing]);

    useEffect(() => {
        if (searchOpen) searchInputRef.current?.focus();
    }, [searchOpen]);

    useEffect(() => {
        if (!activeMatchId) return;
        shouldScroll.current = false;
        const message = historyRef.current?.querySelector(`[data-message-id="${activeMatchId}"]`);
        message?.scrollIntoView({ block: "center", behavior: "instant" });
    }, [activeMatchId]);

    function closeSearch() {
        setSearchQuery("");
        setMatchIndex(0);
        onCloseSearch();
    }

    function moveSearchMatch(direction) {
        setMatchIndex(previous => (previous + direction + matches.length) % matches.length);
    }

    function handleScroll() {
        const history = historyRef.current;
        const distance = history.scrollHeight - history.scrollTop - history.clientHeight;

        shouldScroll.current = distance < 80;
    }

    function handleReply(message) {
        setReply({ name: message.sender.name, text: message.text || "Image" });
        inputRef.current.focus();
    }

    function handleSubmit(event) {
        event.preventDefault();
        const text = draft.trim();

        if (!text && !attachment) {
            return;
        }

        if (text.length > 2000) {
            setError("Messages can contain up to 2,000 characters.");
            return;
        }

        shouldScroll.current = true;
        onSend(text, reply, attachment);
        setDraft("");
        setReply(null);
        setAttachment(null);
        setError("");
        inputRef.current.focus();
    }

    function handleKeyDown(event) {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.form.requestSubmit();
        }
    }

    function handleAttachment(event) {
        const file = event.target.files[0];
        event.target.value = "";

        if (!file) return;

        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            setError("Choose a JPEG, PNG, or WebP image.");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError("Choose an image smaller than 5 MB.");
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            setAttachment({ url: reader.result, name: file.name });
            setError("");
        };

        reader.onerror = () => setError("The image could not be opened.");
        reader.readAsDataURL(file);
    }

    return (
        <section
            className="messages-thread"
            data-theme-effect={theme.effect}
            style={getThemeStyle(theme)}
            aria-label={`Conversation with ${conversation.name}`}
        >
            <header className="messages-thread-header">
                <button
                    className="messages-icon-button messages-back"
                    onClick={onBack}
                    aria-label="Back to conversations"
                >
                    <ArrowLeft size={20} />
                </button>
                <Avatar person={conversation} status />
                <div className="messages-heading-person">
                    <h2>{conversation.name}</h2>
                    <span>{conversation.online ? "Online" : "Offline"}</span>
                </div>
                <button
                    type="button"
                    className="messages-icon-button"
                    onClick={onToggleDetails}
                    aria-label={
                        detailsOpen ? "Hide conversation details" : "Show conversation details"
                    }
                    aria-expanded={detailsOpen}
                    aria-controls="conversation-details"
                    title={detailsOpen ? "Hide conversation details" : "Show conversation details"}
                >
                    <Info size={22} />
                </button>
            </header>

            {searchOpen && (
                <div
                    className="messages-thread-search"
                    role="search"
                    aria-label="Search this conversation"
                >
                    <input
                        ref={searchInputRef}
                        value={searchQuery}
                        onChange={event => {
                            setSearchQuery(event.target.value);
                            setMatchIndex(0);
                        }}
                        onKeyDown={event => {
                            if (event.key === "Escape") closeSearch();
                            if (event.key === "Enter" && matches.length)
                                moveSearchMatch(event.shiftKey ? -1 : 1);
                        }}
                        aria-label="Search messages"
                        placeholder="Search in this conversation…"
                    />
                    <span role="status">
                        {normalizedQuery
                            ? matches.length
                                ? `${(matchIndex % matches.length) + 1} of ${matches.length}`
                                : "No results"
                            : ""}
                    </span>
                    <button
                        className="messages-icon-button"
                        onClick={() => moveSearchMatch(-1)}
                        disabled={!matches.length}
                        aria-label="Previous match"
                    >
                        <ChevronUp size={17} />
                    </button>
                    <button
                        className="messages-icon-button"
                        onClick={() => moveSearchMatch(1)}
                        disabled={!matches.length}
                        aria-label="Next match"
                    >
                        <ChevronDown size={17} />
                    </button>
                    <button
                        className="messages-icon-button"
                        onClick={closeSearch}
                        aria-label="Close message search"
                    >
                        <X size={17} />
                    </button>
                </div>
            )}

            <div
                className="messages-history"
                ref={historyRef}
                onScroll={handleScroll}
                role="log"
                aria-live="polite"
                aria-relevant="additions"
            >
                {conversation.messages.map((message, index) => (
                    <Fragment key={message.id}>
                        {(index === 0 ||
                            new Date(message.createdAt).toDateString() !==
                                new Date(
                                    conversation.messages[index - 1].createdAt
                                ).toDateString()) && (
                            <div className="messages-day-divider">
                                <span>{formatMessageDay(message.createdAt)}</span>
                            </div>
                        )}
                        {message.kind === "system" ? (
                            <p
                                data-message-id={message.id}
                                className={`messages-system-event ${activeMatchId === message.id ? "messages-search-match" : ""}`}
                            >
                                {message.text}
                            </p>
                        ) : (
                            <article
                                data-message-id={message.id}
                                className={`messages-row ${activeMatchId === message.id ? "messages-search-match" : ""}`}
                                key={message.id}
                            >
                                <Avatar person={message.sender} size="small" />
                                <div className="messages-row-content">
                                    {message.reply && (
                                        <div className="messages-reply-quote">
                                            <Reply size={13} />
                                            <strong>{message.reply.name}</strong>
                                            <span>{message.reply.text}</span>
                                        </div>
                                    )}
                                    <div className="messages-row-heading">
                                        <strong>{message.sender.name}</strong>
                                        <time dateTime={message.createdAt}>
                                            {formatMessageTime(message.createdAt)}
                                        </time>
                                    </div>
                                    {message.text && (
                                        <p className="messages-text">{message.text}</p>
                                    )}
                                    {message.image && (
                                        <button
                                            className="messages-image-button"
                                            onClick={() => onPreviewImage(message.image)}
                                        >
                                            <img src={message.image.url} alt={message.image.name} />
                                        </button>
                                    )}
                                </div>
                                <button
                                    className="messages-reply-button"
                                    onClick={() => handleReply(message)}
                                    aria-label={`Reply to ${message.sender.name}`}
                                >
                                    <Reply size={15} />
                                </button>
                            </article>
                        )}
                    </Fragment>
                ))}
            </div>

            <div className="messages-compose-area">
                {typing && (
                    <div className="messages-typing" role="status" aria-live="polite">
                        <span className="messages-typing-dots" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                        </span>
                        <span>
                            <strong>{conversation.name}</strong> is typing…
                        </span>
                    </div>
                )}
                {error && (
                    <p className="messages-error" role="alert">
                        {error}
                    </p>
                )}
                {reply && (
                    <div className="messages-compose-reply">
                        <span>
                            Replying to <strong>{reply.name}</strong>
                        </span>
                        <button
                            className="messages-icon-button"
                            onClick={() => setReply(null)}
                            aria-label="Cancel reply"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}
                {attachment && (
                    <div className="messages-attachment-preview">
                        <img src={attachment.url} alt={attachment.name} />
                        <span>{attachment.name}</span>
                        <button
                            className="messages-icon-button"
                            onClick={() => setAttachment(null)}
                            aria-label="Remove attachment"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}
                <form className="messages-composer" onSubmit={handleSubmit}>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        onChange={handleAttachment}
                    />
                    <button
                        type="button"
                        className="messages-attach-button"
                        onClick={() => fileRef.current.click()}
                        aria-label="Attach an image"
                    >
                        <Plus size={23} />
                    </button>
                    <textarea
                        ref={inputRef}
                        aria-label={`Message ${conversation.name}`}
                        placeholder="Write a message…"
                        rows={1}
                        maxLength={2000}
                        value={draft}
                        onChange={event => setDraft(event.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <button
                        type="submit"
                        className="messages-send-button"
                        disabled={!draft.trim() && !attachment}
                        aria-label="Send message"
                    >
                        <Send size={24} fill="currentColor" />
                    </button>
                </form>
            </div>
        </section>
    );
}

export default MessageThread;
export { Avatar };
