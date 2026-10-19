import { useEffect, useRef, useState } from "react";
import {
    ArrowUpRight,
    Bell,
    BellOff,
    Check,
    ChevronRight,
    Plus,
    Search,
    UserRound
} from "lucide-react";
import { Button } from "../components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from "../components/ui/dialog";
import {
    conversationThemes,
    getConversationTheme,
    getThemeStyle,
    readConversationSettings,
    saveConversationSettings
} from "./conversationThemes";
import MessageThread, { Avatar } from "./MessageThread";
import {
    createConversations,
    createMessage,
    currentUser,
    people,
    formatConversationTime,
    getLatestMessage,
    sortConversations
} from "./mockMessages";
import "./messages.css";

function MessageDialog({ title, onClose, children }) {
    return (
        <Dialog
            open
            onOpenChange={open => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="messages-ui messages-modal">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="sr-only">
                        Conversation options and details.
                    </DialogDescription>
                </DialogHeader>
                <div className="messages-dialog-content">{children}</div>
            </DialogContent>
        </Dialog>
    );
}

function MessagesPage() {
    const [conversations, setConversations] = useState(createConversations);
    const [selectedId, setSelectedId] = useState("alex");
    const [search, setSearch] = useState("");
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [typing, setTyping] = useState({});
    const [mobileConversation, setMobileConversation] = useState(false);
    const [dialog, setDialog] = useState(null);
    const [detailsOpen, setDetailsOpen] = useState(() => window.innerWidth > 1150);
    const [newMessageSearch, setNewMessageSearch] = useState("");
    const [settings, setSettings] = useState(readConversationSettings);
    const [themeDraft, setThemeDraft] = useState("default");
    const [messageSearchOpen, setMessageSearchOpen] = useState(false);
    const selectedSettings = settings[selectedId] || {};
    const selectedTheme = getConversationTheme(selectedSettings.themeId);
    const previewTheme = getConversationTheme(themeDraft);

    useEffect(() => {
        saveConversationSettings(settings);
    }, [settings]);
    const timersRef = useRef({});
    const currentConversationRef = useRef("alex");
    const selected = conversations.find(conversation => conversation.id === selectedId);
    const sharedImages = selected.messages
        .filter(message => message.image)
        .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
        .map(message => ({ ...message.image, id: message.id }));

    useEffect(() => {
        const timers = timersRef.current;

        return () => {
            Object.values(timers).forEach(group => group.forEach(clearTimeout));
        };
    }, []);

    const visibleConversations = sortConversations(conversations).filter(conversation => {
        const matchesSearch = conversation.name.toLowerCase().includes(search.toLowerCase());
        const matchesUnread =
            !unreadOnly || (conversation.unread > 0 && !settings[conversation.id]?.muted);

        return matchesSearch && matchesUnread;
    });

    function selectConversation(personId) {
        currentConversationRef.current = personId;
        setSelectedId(personId);
        setMessageSearchOpen(false);
        setMobileConversation(true);
        setConversations(previous =>
            previous.map(conversation => {
                if (conversation.id === personId) return { ...conversation, unread: 0 };
                return conversation;
            })
        );
        setDialog(null);
    }

    function startNewMessage(personId) {
        const person = people.find(item => item.id === personId);
        if (!conversations.some(conversation => conversation.id === person.id)) {
            setConversations(previous => [
                ...previous,
                { ...person, unread: 0, messages: [], preview: "Start a conversation" }
            ]);
        }

        selectConversation(person.id);
    }

    function handleNewMessageClick(event) {
        startNewMessage(event.currentTarget.dataset.personId);
    }

    function simulateReply(personId, person) {
        const previousTimers = timersRef.current[personId] || [];
        previousTimers.forEach(clearTimeout);

        const onlineTimer = setTimeout(() => {
            setConversations(previous =>
                previous.map(conversation => {
                    if (conversation.id !== personId) return conversation;
                    return { ...conversation, online: true };
                })
            );
        }, 900);

        const typingTimer = setTimeout(() => {
            setTyping(previous => ({ ...previous, [personId]: true }));
        }, 1300);

        const replyTimer = setTimeout(() => {
            const response = createMessage(person, "Sounds good! I’ll see you in the lobby.");
            setTyping(previous => ({ ...previous, [personId]: false }));
            setConversations(previous =>
                previous.map(conversation => {
                    if (conversation.id !== personId) return conversation;

                    return {
                        ...conversation,
                        messages: [...conversation.messages, response],
                        preview: response.text,
                        unread:
                            currentConversationRef.current === personId
                                ? 0
                                : conversation.unread + 1
                    };
                })
            );
            delete timersRef.current[personId];
        }, 3500);

        timersRef.current[personId] = [onlineTimer, typingTimer, replyTimer];
    }

    function sendMessage(text, reply, image) {
        const message = createMessage(currentUser, text, { reply, image });

        setConversations(previous =>
            previous.map(conversation => {
                if (conversation.id !== selectedId) return conversation;

                return {
                    ...conversation,
                    messages: [...conversation.messages, message],
                    preview: text || "Image"
                };
            })
        );

        simulateReply(selectedId, selected);
    }

    function toggleDetails() {
        setDetailsOpen(previous => !previous);
    }

    function returnToInbox() {
        setDetailsOpen(false);
        currentConversationRef.current = null;
        setMobileConversation(false);
    }

    function openNewMessage() {
        setNewMessageSearch("");
        setDialog({ kind: "new" });
    }

    function openThemes() {
        setThemeDraft(selectedTheme.id);
        setDialog({ kind: "theme" });
    }

    function applyTheme() {
        if (themeDraft !== selectedTheme.id) {
            setSettings(previous => ({
                ...previous,
                [selectedId]: { ...previous[selectedId], themeId: themeDraft }
            }));
            const message = createMessage(
                currentUser,
                `Eva changed the theme to ${previewTheme.name}.`,
                { kind: "system" }
            );
            setConversations(previous =>
                previous.map(conversation => {
                    if (conversation.id !== selectedId) return conversation;
                    return {
                        ...conversation,
                        messages: [...conversation.messages, message],
                        preview: message.text
                    };
                })
            );
        }
        setDialog(null);
    }

    function toggleMute() {
        setSettings(previous => ({
            ...previous,
            [selectedId]: { ...previous[selectedId], muted: !previous[selectedId]?.muted }
        }));
    }

    function openMessageSearch() {
        setMessageSearchOpen(true);
        if (window.innerWidth <= 1150) setDetailsOpen(false);
    }

    function openProfile() {
        setDialog({ kind: "profile" });
    }

    function openImage(image) {
        setDialog({ kind: "image", image });
    }

    function closeDialog() {
        setDialog(null);
    }

    function renderDialogContent() {
        if (dialog.kind === "theme") {
            return (
                <div className="messages-theme-picker">
                    <div className="messages-theme-options" aria-label="Available themes">
                        {conversationThemes.map(theme => (
                            <Button
                                key={theme.id}
                                variant="outline"
                                className="messages-theme-option"
                                aria-pressed={themeDraft === theme.id}
                                onClick={() => setThemeDraft(theme.id)}
                            >
                                <span
                                    className="messages-theme-sample"
                                    data-theme-effect={theme.effect}
                                    style={getThemeStyle(theme)}
                                >
                                    <strong>Maya</strong>
                                    <span>See you in the lobby!</span>
                                    {themeDraft === theme.id && <Check size={16} />}
                                </span>
                                <strong>{theme.name}</strong>
                                <small>{theme.description}</small>
                            </Button>
                        ))}
                    </div>
                    <div
                        className="messages-theme-preview"
                        data-theme-effect={previewTheme.effect}
                        style={getThemeStyle(previewTheme)}
                    >
                        <small>Preview</small>
                        <strong>{selected.name}</strong>
                        <p>Ready for another match?</p>
                        <strong>Eva</strong>
                        <p>Yes! See you in the lobby.</p>
                    </div>
                    <div className="messages-theme-footer">
                        <Button variant="outline" onClick={closeDialog}>
                            Cancel
                        </Button>
                        <Button onClick={applyTheme}>Apply theme</Button>
                    </div>
                </div>
            );
        }

        if (dialog.kind === "new") {
            const matchingPeople = people.filter(person =>
                person.fullName.toLowerCase().includes(newMessageSearch.toLowerCase())
            );

            return (
                <>
                    <label className="messages-search">
                        <Search size={18} />
                        <input
                            aria-label="Find a person"
                            placeholder="Search people…"
                            value={newMessageSearch}
                            onChange={event => setNewMessageSearch(event.target.value)}
                            autoFocus
                        />
                    </label>
                    <div className="messages-people-list">
                        {matchingPeople.map(person => (
                            <button
                                key={person.id}
                                data-person-id={person.id}
                                onClick={handleNewMessageClick}
                            >
                                <Avatar person={person} />
                                <span>{person.fullName}</span>
                                <ArrowUpRight size={18} />
                            </button>
                        ))}
                        {!matchingPeople.length && <p>No people found.</p>}
                    </div>
                </>
            );
        }

        if (dialog.kind === "profile") {
            return (
                <div className="messages-profile-details">
                    <Avatar person={selected} size="large" status />
                    <h3>{selected.fullName}</h3>
                    <p>@{selected.username}</p>
                    <p>Code Arena player. Always up for a friendly challenge.</p>
                    <button
                        className="messages-button messages-button-primary"
                        onClick={closeDialog}
                    >
                        Back to conversation
                    </button>
                </div>
            );
        }

        if (dialog.kind === "image") {
            return (
                <img
                    className="messages-full-image"
                    src={dialog.image.url}
                    alt={dialog.image.name}
                />
            );
        }

        return renderSharedMedia();
    }

    function renderSharedMedia(limit = sharedImages.length) {
        if (!sharedImages.length) {
            return (
                <p className="messages-media-empty">
                    Photos shared in this conversation will appear here.
                </p>
            );
        }

        return (
            <div className="messages-media-grid">
                {sharedImages.slice(0, limit).map(image => (
                    <button
                        key={image.id}
                        className="messages-shared-image"
                        onClick={() => openImage(image)}
                        aria-label={`Open ${image.name}`}
                    >
                        <img src={image.url} alt={image.name} />
                    </button>
                ))}
            </div>
        );
    }

    let dialogTitle = "Shared media";

    if (dialog?.kind === "theme") dialogTitle = "Choose a theme";
    if (dialog?.kind === "new") dialogTitle = "New message";
    if (dialog?.kind === "profile") dialogTitle = "Profile";
    if (dialog?.kind === "image") dialogTitle = "Shared image";

    return (
        <div
            className={`messages-page ${mobileConversation ? "messages-show-thread" : ""} ${detailsOpen ? "" : "messages-hide-details"}`}
        >
            <aside className="messages-inbox" aria-label="Conversations">
                <header className="messages-inbox-header">
                    <h1>Messages</h1>
                    <button
                        className="messages-button messages-button-primary"
                        onClick={openNewMessage}
                    >
                        <Plus size={16} />
                        New message
                    </button>
                </header>
                <label className="messages-search">
                    <Search size={18} />
                    <input
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        placeholder="Search conversations…"
                        aria-label="Search conversations"
                    />
                </label>
                <div className="messages-filters" aria-label="Conversation filters">
                    <button
                        className={!unreadOnly ? "is-selected" : ""}
                        aria-pressed={!unreadOnly}
                        onClick={() => setUnreadOnly(false)}
                    >
                        All
                    </button>
                    <button
                        className={unreadOnly ? "is-selected" : ""}
                        aria-pressed={unreadOnly}
                        onClick={() => setUnreadOnly(true)}
                    >
                        Unread
                    </button>
                </div>
                <nav className="messages-conversations" aria-label="Choose a conversation">
                    {visibleConversations.map(conversation => {
                        const lastMessage = getLatestMessage(conversation);

                        return (
                            <button
                                className={`messages-contact ${selectedId === conversation.id ? "is-selected" : ""}`}
                                key={conversation.id}
                                onClick={() => selectConversation(conversation.id)}
                                aria-current={selectedId === conversation.id ? "true" : undefined}
                            >
                                <Avatar person={conversation} status />
                                <span className="messages-contact-content">
                                    <span className="messages-contact-heading">
                                        <strong>
                                            {conversation.name}{" "}
                                            {settings[conversation.id]?.muted && (
                                                <BellOff size={12} aria-label="Muted" />
                                            )}
                                        </strong>
                                        <time
                                            dateTime={lastMessage?.createdAt}
                                            title={
                                                lastMessage
                                                    ? new Date(
                                                          lastMessage.createdAt
                                                      ).toLocaleString()
                                                    : undefined
                                            }
                                        >
                                            {lastMessage
                                                ? formatConversationTime(lastMessage.createdAt)
                                                : ""}
                                        </time>
                                    </span>
                                    <span className="messages-contact-preview">
                                        {conversation.preview}
                                    </span>
                                </span>
                                {conversation.unread > 0 && !settings[conversation.id]?.muted && (
                                    <span
                                        className="messages-unread-badge"
                                        aria-label={`${conversation.unread} unread messages`}
                                    >
                                        {conversation.unread > 99 ? "99+" : conversation.unread}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                    {!visibleConversations.length && (
                        <p className="messages-empty">
                            {unreadOnly ? "You’re all caught up." : "No conversations found."}
                        </p>
                    )}
                </nav>
                <div className="messages-your-profile">
                    <Avatar person={currentUser} size="small" />
                    <span>
                        Eva<span className="messages-your-profile-label">Nook</span>
                    </span>
                    <a href="/admin" className="messages-icon-button" aria-label="Open admin panel">
                        <ArrowUpRight size={17} />
                    </a>
                </div>
            </aside>

            <MessageThread
                key={selected.id}
                conversation={selected}
                typing={typing[selected.id]}
                onSend={sendMessage}
                onBack={returnToInbox}
                onPreviewImage={openImage}
                detailsOpen={detailsOpen}
                onToggleDetails={toggleDetails}
                theme={selectedTheme}
                searchOpen={messageSearchOpen}
                onCloseSearch={() => setMessageSearchOpen(false)}
            />

            <aside
                id="conversation-details"
                className="messages-profile"
                aria-label="Conversation details"
                hidden={!detailsOpen}
            >
                <div className="messages-profile-top">
                    <Avatar person={selected} size="large" status />
                    <h2>{selected.fullName}</h2>
                    <p>@{selected.username}</p>
                </div>
                <div className="messages-quick-actions">
                    <Button variant="ghost" className="messages-quick-action" onClick={openProfile}>
                        <span>
                            <UserRound size={19} />
                        </span>
                        Profile
                    </Button>
                    <Button
                        variant="ghost"
                        className="messages-quick-action"
                        onClick={openMessageSearch}
                    >
                        <span>
                            <Search size={19} />
                        </span>
                        Search
                    </Button>
                    <Button
                        variant="ghost"
                        className="messages-quick-action"
                        onClick={toggleMute}
                        aria-pressed={Boolean(selectedSettings.muted)}
                    >
                        <span>
                            {selectedSettings.muted ? <Bell size={19} /> : <BellOff size={19} />}
                        </span>
                        {selectedSettings.muted ? "Unmute" : "Mute"}
                    </Button>
                </div>
                {selectedSettings.muted && (
                    <p className="messages-muted-note" role="status">
                        Unread alerts muted for this conversation.
                    </p>
                )}
                <Button variant="outline" className="messages-theme-setting" onClick={openThemes}>
                    <span
                        className="messages-theme-swatch"
                        style={{ background: selectedTheme.accent }}
                    />
                    <span>
                        Chat theme<small>{selectedTheme.name}</small>
                    </span>
                    <ChevronRight size={17} />
                </Button>
                <div className="messages-shared-heading">
                    <h3>Shared media</h3>
                    <button
                        onClick={() => setDialog({ kind: "media" })}
                        disabled={!sharedImages.length}
                    >
                        See all
                    </button>
                </div>
                {renderSharedMedia(4)}
                <p className="messages-profile-caption">A little space for good conversations.</p>
            </aside>

            {dialog && (
                <MessageDialog title={dialogTitle} onClose={closeDialog}>
                    {renderDialogContent()}
                </MessageDialog>
            )}
        </div>
    );
}

export default MessagesPage;
