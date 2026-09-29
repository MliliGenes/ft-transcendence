import ChatHistory from "./ChatHistory";
import ChatInput from "./ChatInput";
import { useState, useEffect, useRef } from "react";
import "../styles/GameChat.css";
import { MessageCircle, X } from "lucide-react";

function GameChat() { /* is a React component. */ 
    const [isOpen, setIsOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const [messages, setMessages] = useState([]);
    const socketRef = useRef(null);
    const isRegisteredRef = useRef(false);
    const reconnectTimerRef = useRef(null);
    const shouldReconnectRef = useRef(true);
    const isOpenRef = useRef(false);
    const [matchEnded, setMatchEnded] = useState(false);
    const [username] = useState(() => {
        return sessionStorage.getItem("chatUsername") || "Eva";
    });

    useEffect(() => {
        shouldReconnectRef.current = true;
        let isActive = true;

        function connect() {
            if (!isActive || !shouldReconnectRef.current) return;

            const socket = new WebSocket("ws://localhost:9090");
            isRegisteredRef.current = false;
            socketRef.current = socket;

            socket.onopen = () => {
                if (!isActive || socketRef.current !== socket) {
                    socket.close();
                    return;
                }

                console.log("Connected to chat");

                socket.send(JSON.stringify({
                    event: "join",
                    username
                }));
            };

            socket.onmessage = event => {
                const data = JSON.parse(event.data);
                if (!isActive || socketRef.current !== socket) {
                        return;
                    }

                if (data.event === "error") {
                    console.error("Chat server:", data.message);

                    if (data.message === "This player is already connected.") {
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

                setMessages(previous => [...previous, data]);

                if (!isOpenRef.current) {
                    setHasUnread(true);
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
    }, [username]);

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

        socketRef.current.send(JSON.stringify(newMessage));

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