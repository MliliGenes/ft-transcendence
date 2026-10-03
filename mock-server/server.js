require("dotenv").config();
const { findPlayerByUsername } = require("./players");
const { verifyAccessToken } = require("./auth");
const AUTH_MODE = process.env.CHAT_AUTH_MODE || "mock";
if (!["mock", "jwt"].includes(AUTH_MODE)) {
    throw new Error("Invalid CHAT_AUTH_MODE configuration");
}
const WebSocket = require("ws");
const server = new WebSocket.Server({
    port: 9090,
    maxPayload: 16 * 1024
});
const connectedPlayers = new Map();
const endedMatches = new Set();

function canReceiveMessage(sender, recipient, channel) {
    if (sender.matchId !== recipient.matchId) {
        return false;
    }

    if (channel === "team") {
        return sender.team === recipient.team;
    }

    return channel === "all";
}

function isValidMessage(message) {
    if (!message || typeof message !== "object") {
        return false;
    }

    if (message.type !== "team" && message.type !== "all") {
        return false;
    }

    if (typeof message.message !== "string") {
        return false;
    }

    const text = message.message.trim();

    return text.length > 0 && text.length <= 500;
}

function broadcast(message, senderSocket) {
    const sender = connectedPlayers.get(senderSocket);
    if (!sender)
        return;
	const messageId = crypto.randomUUID();
    connectedPlayers.forEach((recipient, clientSocket) => {
        if (clientSocket === senderSocket) {
            return;
        }

        if (clientSocket.readyState !== WebSocket.OPEN) {
            return;
        }

        if (canReceiveMessage(sender, recipient, message.type)) {
			clientSocket.send(JSON.stringify({
				id: messageId,
				type: message.type,
				username: sender.username,
				message: message.message.trim()
			}));
		}
    });
}

function endMatch(matchId) {
    endedMatches.add(matchId);

    connectedPlayers.forEach((player, socket) => {
        if (player.matchId !== matchId) return;

        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                event: "match_end"
            }));
        }

        connectedPlayers.delete(socket);
    });

    console.log(`Match ${matchId} ended`);
}

server.on("connection", (socket) => {
    console.log("A player connected!");
	socket.authenticatedUserId = null;

    socket.on("message", async data => {
        let message;

		try {
			message = JSON.parse(data.toString());
		} catch (error) {
			console.log("Rejected malformed JSON");

			socket.send(JSON.stringify({
				event: "error",
				message: "Invalid message format."
			}));

			return;
		}

		if (
			message === null ||
			typeof message !== "object" ||
			Array.isArray(message)
		) {
			console.log("Rejected invalid message structure");

			socket.send(JSON.stringify({
				event: "error",
				message: "Invalid message structure."
			}));

			return;
		}

		if (message.event === "join") {
			if (connectedPlayers.has(socket)) {
				console.log("Rejected join: player already registered");

				socket.send(JSON.stringify({
					event: "error",
					message: "You have already joined."
				}));

				return;
			}
			let player;

			if (AUTH_MODE === "jwt") {
				try {
					const identity = await verifyAccessToken(message.accessToken);
					socket.authenticatedUserId = identity.userId;
					console.log(`Authenticated user: ${identity.userId}`);

					// Authentication succeeded, but the chat still needs
					// trusted match/team information from the Game Service.
					socket.send(JSON.stringify({
						event: "error",
						message: "Match assignment is not configured yet."
					}));

					return;
				} catch (error) {
					console.log("Authentication failed:", error.message);

					socket.send(JSON.stringify({
						event: "error",
						message: "Authentication failed."
					}));

					socket.close(1008, "Authentication failed");
					return;
				}
			}

			if (AUTH_MODE !== "mock") {
				console.log("Rejected username-based registration outside mock mode");
				return;
			}
			// Username lookup is allowed ONLY in development mock mode.
			player = findPlayerByUsername(message.username);
			if (!player) {
				console.log("Unknown player:", message.username);
				return;
			}

			if (endedMatches.has(player.matchId)) {
				console.log(`Rejected join: match ${player.matchId} has ended`);

				socket.send(JSON.stringify({
					event: "match_end"
				}));

				socket.close(1000, "Match has ended");
				return;
			}

			const alreadyConnected = [...connectedPlayers.values()].some(
				connectedPlayer => connectedPlayer.id === player.id
			);

			if (alreadyConnected) {
				console.log(`Rejected duplicate connection: ${player.username}`);

				socket.send(JSON.stringify({
					event: "error",
					message: "This player is already connected."
				}));

				socket.close(1008, "Duplicate player connection");
				return;
			}

			connectedPlayers.set(socket, player);
						socket.send(JSON.stringify({
				event: "join_success"
			}));

			console.log(`${player.username} joined Team ${player.team}`);

			// Tell this player they've joined.
			socket.send(JSON.stringify({
				event: "system",
				message: `You have joined the team.`
			}));

			// Tell their teammates they've joined.
			connectedPlayers.forEach((recipient, clientSocket) => {
				if (clientSocket === socket) return;

				if (
					recipient.matchId === player.matchId &&
					recipient.team === player.team &&
					clientSocket.readyState === WebSocket.OPEN
				) {
					clientSocket.send(JSON.stringify({
						event: "system",
						message: `${player.username} has joined the team.`
					}));
				}
			});

			return;
		}

		if (message.event === "end_match") {
			console.log("Rejected unauthorized match-end request");
			return;
		}

        console.log("Received:", message);
		if (!connectedPlayers.has(socket)) {
			console.log("Rejected message: player not registered");
			return;
		}

		if (!isValidMessage(message)) {
			console.log("Rejected invalid chat message");
			return;
		}

		broadcast(message, socket);
    });

    socket.on("close", () => {
		const player = connectedPlayers.get(socket);
		if (!player)
			return;

		console.log(`${player.username} disconnected`);
		connectedPlayers.delete(socket);
		connectedPlayers.forEach((recipient, clientSocket) => {
			if (
				recipient.matchId === player.matchId &&
				recipient.team === player.team &&
				clientSocket.readyState === WebSocket.OPEN
			) {
				clientSocket.send(JSON.stringify({
					event: "system",
					message: `${player.username} has left the team.`
				}));
			}
		});
	});
});

console.log("WebSocket server running on port 9090");