import ChatHistory from "./ChatHistory";
import ChatInput from "./ChatInput";
import { useState, useEffect, useRef } from "react";
import "../styles/GameChat.css";
import { MessageCircle, X } from "lucide-react";

function GameChat({ currentUser, accessToken }) {/* is a React component. */ 
    const [isOpen, setIsOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const [messages, setMessages] = useState([]);
    const socketRef = useRef(null);
    const isRegisteredRef = useRef(false);
    const reconnectTimerRef = useRef(null);
    const shouldReconnectRef = useRef(true);
    const isOpenRef = useRef(false);
    const [matchEnded, setMatchEnded] = useState(false);
    const username = currentUser?.username;

    useEffect(() => {
        shouldReconnectRef.current = true;
        let isActive = true;

        function connect() {
            if (!isActive || !shouldReconnectRef.current) return;

            const wsUrl = import.meta.env.VITE_CHAT_WS_URL;
            const socket = new WebSocket(wsUrl);
            isRegisteredRef.current = false;
            socketRef.current = socket;

            socket.onopen = () => {
                if (!isActive || socketRef.current !== socket) {
                    socket.close();
                    return;
                }

                console.log("Connected to chat");

                const joinMessage = accessToken
                ? {
                    event: "join",
                    accessToken
                }
                : {
                    event: "join",
                    username
                };

            socket.send(JSON.stringify(joinMessage));
                        };

            socket.onmessage = event => {
                let data;
                try{
                    data = JSON.parse(event.data);
                } catch {
                    console.error("Recieved invalid data from chat server");
                    return;
                }
                if (!isActive || socketRef.current !== socket) return;
                if (data.event === "error") {
                    console.error("Chat server:", data.message);

                    const fatalErrors = [
                        "This player is already connected.",
                        "Authentication failed.",
                        "Match assignment is not configured yet."
                    ];

                    if (fatalErrors.includes(data.message)) {
                        shouldReconnectRef.current = false;
                        socket.close();
                    }

                    return;
                }

                if (data.event === "join_success") {
                    isRegisteredRef.current = true;
                    console.log("Player successfully registered");
                    return;
                }

                if (data.event === "match_end") {
                    shouldReconnectRef.current = false;
                    isRegisteredRef.current = false;

                    setMatchEnded(true);
                    setMessages([]);
                    setIsOpen(false);
                    isOpenRef.current = false;
                    setHasUnread(false);

                    socket.close();
                    return;
                }

                if (data.event === "system") {
                    setMessages(previous => [
                        ...previous,
                        {
                            id: crypto.randomUUID(),
                            type: "system",
                            message: data.message
                        }
                    ]);

                    return;
                }

                if (data.type === "team" || data.type === "all") {
                    setMessages(previous => [...previous, data]);

                    if (!isOpenRef.current) {
                        setHasUnread(true);
                    }
                }
            };

            socket.onerror = error => {
                console.error("WebSocket error:", error);
            };

            socket.onclose = () => {
                isRegisteredRef.current = false;
                console.log("Disconnected from chat");

                if (isActive && shouldReconnectRef.current) {
                    reconnectTimerRef.current = setTimeout(() => {
                        if (isActive) {
                            connect();
                        }
                    }, 3000);
                }
            };
        }

        connect();

        return () => {
            isActive = false;
            shouldReconnectRef.current = false;

            clearTimeout(reconnectTimerRef.current);

            socketRef.current?.close();
        };
    }, [username, accessToken]);

    function toggleChat() {
        const nextIsOpen = !isOpenRef.current;

        isOpenRef.current = nextIsOpen;
        setIsOpen(nextIsOpen);

        if (nextIsOpen) {
            setHasUnread(false);
        }
    }

    function sendMessage(text) {
        if (matchEnded) return;
        const input = text.trim();

        if (!input) return;

        const isAll = /^\/all(?:\s|$)/i.test(input);

        const messageText = isAll
            ? input.replace(/^\/all(?:\s|$)/i, "").trim()
            : input;

        if (!messageText) return;

        if (messageText.length > 500) {
            console.log("Message cannot exceed 500 characters");
            return;
        }

        const newMessage = {
            id: crypto.randomUUID(),
            type: isAll ? "all" : "team",
            username: username,
            message: messageText
        };

        if (
            socketRef.current?.readyState !== WebSocket.OPEN ||
            !isRegisteredRef.current
        ) {
            console.log("Cannot send: chat is not ready");
            return;
        }

        socketRef.current.send(JSON.stringify({
            type: newMessage.type,
            message: newMessage.message
        }));;
        setMessages(previous => [...previous, newMessage]);
    }

    return (
        <div className="chat-widget">
            {!matchEnded && (
                <>
                    {isOpen && (
                        <div className={`game-chat ${isOpen ? "open" : "closed"}`}>
                            <ChatHistory messages={messages} />
                            <ChatInput onSendMessage={sendMessage} />
                        </div>
                    )}

                    <div className="chat-bubble-wrapper">
                        <button
                            className="chat-bubble"
                            onClick={toggleChat}
                            aria-label={isOpen ? "Close chat" : "Open chat"}
                            aria-expanded={isOpen}
                        >
                            {isOpen
                                ? <X size={20} />
                                : <MessageCircle size={20} />
                            }
                        </button>

                        {!isOpen && hasUnread && (
                            <span className="notification-dot" />
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default GameChat;
/* allows other files to import it. */ 