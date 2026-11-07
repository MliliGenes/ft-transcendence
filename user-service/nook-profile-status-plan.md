# Nook — Profile Bio & Custom Status

## Goal
Add a lightweight profile bio and a custom text status with a monochrome Tabler icon. Store only the icon's exported name, not SVG or emoji data.

The custom status is a persistent note. It remains visible until the user edits or clears it; it has no expiry time or automatic cleanup.

## 1. Database
Add three nullable fields to the existing Prisma `User` model:

```prisma
bio        String? @db.VarChar(190)
statusText String? @db.VarChar(100)
statusIcon String? @db.VarChar(50)
```

Create and apply a Prisma migration. Existing users retain `null` values.

## 2. User service
- Extend the existing owner profile-update endpoint/DTO to accept `bio`, `statusText`, and `statusIcon`.
- Validate bio/status lengths and validate `statusIcon` against a fixed allowlist of Tabler export names (e.g., `IconCode`, `IconCoffee`, `IconMoon`, `IconMusic`, `IconDeviceGamepad2`).
- Accept `null` to clear each field; omit fields to leave them unchanged.
- Expose these fields in the public user profile response. Never expose private account data through that response.

## 3. Frontend
- Add a **Bio** textarea (190-character limit) to Edit Profile.
- Add a **Custom status** text input (100-character limit) and a compact icon picker showing only approved `@tabler/icons-react` icons.
- Keep a shared mapping from saved icon names to statically imported React components; render unknown/null names safely with no icon.
- Display the bio on the full profile, and the icon + status text in the profile card and chat user popover.
- Follow Nook styling: dark neutral surfaces, orange selection/focus, square controls, 16px monochrome icons.

## 4. Acceptance checks
- Users can save, edit, and clear bio, status, and icon independently.
- Invalid icon names and overly long text are rejected server-side.
- Existing profiles render correctly when all three fields are `null`.
- Frontend displays the right Tabler icon after reload; no emoji or SVG is persisted.

**Out of scope:** emoji statuses, expiry times, profile themes, presence/availability indicators, and private notes.
