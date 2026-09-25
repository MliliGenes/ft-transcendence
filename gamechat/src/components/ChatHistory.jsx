import ChatMessage from "./ChatMessage";
import { useRef, useLayoutEffect } from "react";

function ChatHistory({ messages }) {
	const historyRef = useRef(null);
	const shouldAutoScroll = useRef(true);

	function handleScroll() {
		const history = historyRef.current;

		if (!history) return;

		const distanceFromBottom =
			history.scrollHeight -
			history.scrollTop -
			history.clientHeight;

		shouldAutoScroll.current = distanceFromBottom < 50;
	}

	useLayoutEffect(() => {
		const history = historyRef.current;

		if (history && shouldAutoScroll.current) {
			history.scrollTop = history.scrollHeight;
		}
	}, [messages]);

    return (
        <div className="chat-history" ref={historyRef}
			onScroll={handleScroll}>
			{messages.map((msg) => (
				<ChatMessage
					key={msg.id}
					type={msg.type}
					username={msg.username}
					message={msg.message}
					/>
			))}
        </div>
    );
}

export default ChatHistory;