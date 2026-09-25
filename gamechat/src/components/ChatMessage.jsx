function ChatMessage({ username, message, type }) {
    return (
        <div className={`chat-message ${type}`}>
			<span className="type">
				({type})
			</span>
			{type !== "system" && (
				<span className="username">
					{username}:
				</span>
			)}
            <span className="message">
                {message}
            </span>
        </div>
    );
}

export default ChatMessage;