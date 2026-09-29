function ChatMessage({ username, message, type }) {
	if (type === "system") {
		return (
			<div className="chat-message system-message">
				<span className="system-label">(System)</span>
				<span className="message-text"> {message}</span>
			</div>
		);
	}
    return (
        <div className={`chat-message ${type}`}>
			<span className="message-type">
				({type})
			</span>
			<span className="username">
				{username}:
			</span>
            <span className="message">
                {message}
            </span>
        </div>
    );
}

export default ChatMessage;