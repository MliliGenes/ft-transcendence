import { useState } from "react";

function ChatInput({ onSendMessage }) {
    const [message, setMessage] = useState("");

	function handleSubmit(event) {
		event.preventDefault();

		if (message.trim() === "") {
			return;
		}

		onSendMessage(message.trim());

		setMessage("");
	}
    return (
        <form className="chat-input"
			  onSubmit={handleSubmit}>
			<input
    			type="text"
    			placeholder="Type a message..."
    			value={message}
    			onChange={(event) => setMessage(event.target.value)}
				autoFocus
			/>
			<button type="submit" aria-label="Send message">
    			➤
			</button>
        </form>
    );
}

export default ChatInput;