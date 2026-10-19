export const currentUser = {
    id: "eva",
    name: "Eva",
    fullName: "Eva Martin",
    username: "eva",
    avatar: 2,
    color: "lavender"
};

export const people = [
    {
        id: "alex",
        name: "Alex",
        fullName: "Alex Morgan",
        username: "alex_42",
        avatar: 0,
        online: true
    },
    {
        id: "maya",
        name: "Maya",
        fullName: "Maya Chen",
        username: "maya_codes",
        avatar: 1,
        online: false
    },
    {
        id: "riley",
        name: "Riley",
        fullName: "Riley Haddad",
        username: "riley_dev",
        avatar: 3,
        online: false
    },
    {
        id: "jordan",
        name: "Jordan",
        fullName: "Jordan Parker",
        username: "jordan",
        avatar: 5,
        online: false
    },
    {
        id: "casey",
        name: "Casey",
        fullName: "Casey Costa",
        username: "casey",
        avatar: 4,
        online: false
    },
    {
        id: "taylor",
        name: "Taylor",
        fullName: "Taylor Wilson",
        username: "taylor",
        avatar: 6,
        online: false
    },
    {
        id: "sam",
        name: "Sam",
        fullName: "Sam Bernard",
        username: "sam_codes",
        avatar: 7,
        online: false
    },
    {
        id: "priya",
        name: "Priya",
        fullName: "Priya Rao",
        username: "priya",
        avatar: 8,
        online: false
    }
];

export function formatMessageTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
}

export function getLatestMessage(conversation) {
    let latestMessage = null;

    for (const message of conversation.messages) {
        if (!latestMessage || new Date(message.createdAt) >= new Date(latestMessage.createdAt)) {
            latestMessage = message;
        }
    }

    return latestMessage;
}

export function sortConversations(conversations) {
    const sorted = [...conversations];

    sorted.sort((first, second) => {
        const firstMessage = getLatestMessage(first);
        const secondMessage = getLatestMessage(second);
        const firstTime = firstMessage ? new Date(firstMessage.createdAt).getTime() : 0;
        const secondTime = secondMessage ? new Date(secondMessage.createdAt).getTime() : 0;

        return secondTime - firstTime;
    });

    return sorted;
}

export function formatMessageDay(timestamp, now = new Date()) {
    const date = new Date(timestamp);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === now.toDateString()) {
        return "Today";
    }

    if (date.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
    }

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: date.getFullYear() === now.getFullYear() ? undefined : "numeric"
    });
}

export function formatConversationTime(timestamp, now = new Date()) {
    if (formatMessageDay(timestamp, now) === "Today") {
        return formatMessageTime(timestamp);
    }

    return formatMessageDay(timestamp, now);
}

export function createMessage(sender, text, options = {}) {
    return {
        id: crypto.randomUUID(),
        sender: sender,
        text: text,
        createdAt: new Date().toISOString(),
        reply: null,
        image: null,
        ...options
    };
}

export function createConversations(now = new Date()) {
    const minutesAgo = [3, 22, 47, 130, 1560, 2880, 4320, 7200];
    const nowMilliseconds = now.getTime();
    const previews = [
        "Perfect. See you in the lobby!",
        "That was such a good match!",
        "Want to queue later?",
        "I’ll share the strategy notes.",
        "Let’s try a few tomorrow.",
        "Good luck today!",
        "That match was crazy",
        "Same, I’m in!"
    ];

    return people.map((person, index) => {
        const latestTime = nowMilliseconds - minutesAgo[index] * 60000;
        const messages = [
            createMessage(person, previews[index], {
                createdAt: new Date(latestTime).toISOString()
            })
        ];

        if (person.id === "alex") {
            const firstMessage = createMessage(
                person,
                "Anyone up for a 2v2 Code Arena match tonight?",
                { createdAt: new Date(latestTime - 9 * 60000).toISOString() }
            );

            messages.splice(
                0,
                1,
                firstMessage,
                createMessage(currentUser, "I’m in! What time?", {
                    createdAt: new Date(latestTime - 6 * 60000).toISOString()
                }),
                createMessage(person, "Around 8? We can start from the lobby.", {
                    createdAt: new Date(latestTime - 3 * 60000).toISOString()
                }),
                createMessage(currentUser, "Around 8 works for me.", {
                    createdAt: new Date(latestTime).toISOString(),
                    reply: { name: person.name, text: firstMessage.text }
                })
            );
        }

        return {
            ...person,
            unread: person.id === "maya" || person.id === "riley" ? 1 : 0,
            messages: messages,
            preview: messages[messages.length - 1].text
        };
    });
}
