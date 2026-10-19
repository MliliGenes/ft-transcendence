# Messages page

Open `/messages`. This is a frontend preview using mock conversations. No messages, theme changes, or mute preferences are sent to another real user yet.

## Conversation themes

Open the info button, then **Chat theme**. Pick Default, Terminal, or Glass, inspect the preview, then Apply theme. Cancel leaves the current theme alone. Terminal affects only the message history: solid black background, green sender names, and white monospace messages. The header, composer, inbox, and profile keep their existing appearance.

Settings are saved per conversation in this browser. Reloading restores theme and mute preferences; sample messages, theme-change notices, and uploaded photos still reset. Browser storage failure falls back to in-memory settings for the current visit.

To add a theme, add an entry to `conversationThemes` in `conversationThemes.js` with a unique `id`, `name`, `description`, `background`, `accent`, `text`, `font`, and `wallpaper`. Set wallpaper to `none` or a CSS `url(...)` for an included asset. The picker automatically displays the entry. Use `font: "inherit"` to keep the usual font. Terminal uses a solid black background without wallpaper.

## Details actions

- Profile opens the selected person's profile dialog.
- Search opens search within this conversation. Type text or an attachment filename. Up/down buttons navigate matches; Enter goes forward, Shift+Enter backward, Escape closes search.
- Mute suppresses this conversation's unread badge and excludes it from the Unread filter, while messages still arrive. Unmute restores its unread indicator. There are no push notifications or notification sounds connected yet.

The theme picker, dialogs, and action buttons use shadcn/ui components adapted to JavaScript from the official new-york-v4 registry (MIT), with Radix primitives for focus management, keyboard navigation, and dismissal. UI wrappers live in `src/components/ui`; shared class merging is in `src/lib/utils.js`. Conversation-specific behavior remains in the existing page and thread components.

## Backend integration later

Store `themeId` on the shared conversation record and authorize changes for conversation members. The server should broadcast the saved theme and a theme-change event to both participants; offline users read the saved theme when loading the conversation. Apply server-confirmed values and handle rejected changes. This frontend currently demonstrates that flow locally only.

Mute is a personal per-user preference, not shared with the other participant. Replace browser settings storage with the authenticated user preference endpoint when available. The current browser storage key is scoped to the mock user Eva.

## Other behavior

Messages use their timestamps for sorting the inbox and local date/time labels. Sending a message simulates the other person's typing and reply. Opening a chat clears unread counts. Reply quotes and JPEG/PNG/WebP attachments up to 5 MB work locally. Shared media comes from attachments in the selected conversation, newest first. No Seen/Sent label is displayed.

On medium screens, opening details hides the inbox temporarily and gives the chat and details separate columns. Close details with the info button to restore the inbox. On phones, details replace the message history below the header; the info button restores messages. Phones use separate inbox and conversation views with a back button. Existing game chat is at `/`, admin at `/admin`.

## Checks

```sh
npm run lint
npm run build
```

Glass uses a subtle blue-violet backdrop, frosted header and composer, fine translucent borders, and a soft glow when the composer is focused. It keeps the compact message rows. The glass effect uses CSS and falls back to translucent surfaces when backdrop blur is unsupported. Set `effect: "glass"` on another theme to reuse these surfaces.
