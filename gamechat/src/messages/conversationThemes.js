// Add another entry here to make a new theme available in the picker.
// Wallpaper URLs should point to assets you include with the frontend.
export const conversationThemes = [
    {
        id: "default",
        name: "Default",
        description: "Your classic dark conversation",
        background: "#101112",
        accent: "#f4f4f4",
        text: "#f0f0f2",
        font: "inherit",
        wallpaper: "none"
    },
    {
        id: "terminal",
        name: "Terminal",
        description: "Green names, white text, monospace",
        background: "#000000",
        accent: "#63ff31",
        text: "#ffffff",
        font: 'Consolas, "Liberation Mono", ui-monospace, monospace',
        wallpaper: "none"
    },
    {
        id: "glass",
        name: "Glass",
        description: "Frosted glass with a violet glow",
        background: "#05050c",
        accent: "#c5c5ff",
        text: "#f5f5ff",
        font: "inherit",
        wallpaper: "radial-gradient(ellipse at 65% 90%, #5554c530, transparent 55%), radial-gradient(ellipse at 15% 20%, #353b791f, transparent 50%)",
        effect: "glass"
    }
];

export function getConversationTheme(themeId) {
    return conversationThemes.find(theme => theme.id === themeId) || conversationThemes[0];
}

export function getThemeStyle(theme) {
    return {
        "--chat-background": theme.background,
        "--chat-accent": theme.accent,
        "--chat-text": theme.text,
        "--chat-font": theme.font,
        "--chat-wallpaper": theme.wallpaper
    };
}

const settingsKey = "nook:eva:conversation-settings:v1";

export function readConversationSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(settingsKey) || "{}");
        if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};

        const settings = {};
        for (const [id, value] of Object.entries(saved)) {
            if (!value || typeof value !== "object") continue;
            settings[id] = {
                themeId: getConversationTheme(value.themeId).id,
                muted: value.muted === true
            };
        }
        return settings;
    } catch {
        return {};
    }
}

export function saveConversationSettings(settings) {
    try {
        localStorage.setItem(settingsKey, JSON.stringify(settings));
    } catch {
        // Keep the controls working for this visit if browser storage is unavailable.
    }
}
