import ChatMessage from "./ChatMessage";
import ChatHistory from "./ChatHistory";
import ChatInput from "./ChatInput";
import { useState } from "react";
import "../styles/GameChat.css";
import { MessageCircle, X } from "lucide-react";

function GameChat() { /* is a React component. */ 
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            id: 1,
            type: "all",
            username: "Magnus",
            message: "hello"
        },
        {
            id: 2,
            type: "all",
            username: "Ben300",
            message: "glhf"
        },
        {
            id: 3,
            type: "all",
            username: "Hector",
            message: "lets go"
        },
        {
            id: 4,
            type: "system",
            username: "Eva",
            message: "Eva joined the match"
        }
    ]);

    function toggleChat() {
        setIsOpen(previous => !previous);
    }

    function sendMessage(text) {
        const newMessage = {
            id: crypto.randomUUID(),
            type: "all",
            username: "Eva",
            message: text
        };

        setMessages(previousMessages => [
            ...previousMessages,
            newMessage
        ]);
    }

    return (
        <div className="chat-widget">

            {isOpen && (
                <div className="game-chat">
                    <ChatHistory messages={messages} />
                    <ChatInput onSendMessage={sendMessage} />
                </div>
            )}

            <button
                className="chat-bubble"
                onClick={toggleChat}
                aria-label={isOpen ? "Close chat" : "Open chat"}
                aria-expanded={isOpen}
            >
                {isOpen ? <X size={26} /> : <MessageCircle size={28} fill="white" stroke="#7477e5" />}
            </button>

        </div>
    );
}

export default GameChat;
/* allows other files to import it. */ 