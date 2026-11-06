# Nook profile and user settings design specification

Status: execution approved; profile/settings implementation completed with fixed 3:1 banner cropping and existing square-corner tokens. Browser visual/interaction verification remains pending because browser automation is unavailable in this session.

Reviewed: 2026-11-06.

## Source and precedence

The current visual reference is [Nook User Settings Dark UI Grid.png](./NOOK_UI/profile/Nook%20User%20Settings%20Dark%20UI%20Grid.png). It supersedes the older settings screenshot in the parent `NOOK_UI` folder for the profile/settings work. The older public-profile image is supplementary context for `/profile`, not the source for this settings layout.

This image is a three-by-three presentation board of separate screens and dialogs. Build a single settings interface with selectable sections, not a page containing nine miniature screens. All measurements below are approximate visual observations or explicitly proposed implementation values; they are not original design-file measurements.

Use [NOOK_DESIGN_SYSTEM.json](./NOOK_DESIGN_SYSTEM.json) for shared tokens. The reference visibly uses small corner radii, subtle surface gradients, and dark text on orange actions. The saved design system specifies square controls and flat surfaces. Preserve the observed layout, hierarchy, and circular avatars; keep existing square/flat defaults for execution unless the user approves a local visual override. Do not silently change global tokens. This corrects the earlier plan's unconditional rounded-card recommendation.

## Board inventory

| Position | Screen | Visible content |
| --- | --- | --- |
| Top left | Edit Profile | Banner, overlapping avatar, image controls, five account fields, Cancel and Save Changes |
| Top middle | Account | Email with Verified badge, Username, Display Name, Name; each row has a trailing chevron |
| Top right | Security | Password, Two-Factor Authentication with Off badge, Recovery Codes |
| Middle left | Connections | GitHub, Discord, Google, 42; connection status and Connect action |
| Middle center | Notifications | Messages, Group Updates, Friend Requests, Mentions; four enabled switches |
| Middle right | Appearance | System, Light, Dark theme tiles; System is selected |
| Bottom left | Privacy | Profile Visibility and Friend Requests dropdowns set to Everyone; Blocked Users row |
| Bottom middle | Edit Banner dialog | Crop rectangle with handles and grid, aspect presets, Cancel and Save |
| Bottom right | Change Avatar dialog | Circular preview, Upload Image, Remove, square-image size hint |

These panels describe the intended settings family. Their presence in the reference does not authorize adding all seven feature areas or unsupported backend features in the profile implementation.

## Shared settings shell

- A contained, near-black window with a fine neutral border. A shallow title bar spans both columns: small orange Nook mark, Nook wordmark, vertical separator, User Settings label, and an X at the far right.
- Persistent left rail separated from content by a single vertical rule. The rail occupies roughly one quarter of the window width; the main area occupies the remaining three quarters.
- Account identity at the top of the rail: circular avatar, small green status dot at its lower right, username, and a muted Member label. Names, role labels, and status must reflect available data rather than the board's sample values.
- Navigation is grouped by muted captions and horizontal separators:
  - My Account: Profile, Account, Security.
  - Social: Connections.
  - App: Notifications, Appearance, Privacy.
  - Log Out beneath a final separator, with orange icon/text.
- Each navigation row has a small outline icon and left-aligned label. The selected row is a full-width orange rectangle with modest inset margins, a thin brighter edge, and high-contrast foreground. It is not merely a gray highlight or orange underline.
- Main heading and one short muted description align to the same left edge as the content below. The visual density is compact, with ample space around the overall window rather than very large gaps within forms.

Proposed desktop starting dimensions: maximum window width 1040-1120px, rail 232-248px, title bar 48px, main padding 28-32px, navigation rows 36-40px, and form controls at least 40px high. These scale the miniature board to readable UI sizes. Use at least 44px touch targets where needed.

For `/settings`, preserve this contained-window composition within the existing app layout; do not add another copy of the full application sidebar inside it. The top-right close action should return to `/profile`. Dialog close buttons dismiss only their dialog.

## Edit Profile panel

Heading: Edit Profile. Supporting text: Update your public information on Nook.

1. A shallow banner spans the main content width. The monochrome eye artwork is sample user content, not application branding or a mandatory default asset. Use the signed-in user's image or a restrained empty state.
2. Change Banner is an outlined dark overlay button at the banner's top right, with an image icon.
3. The circular avatar overlaps the banner near its lower-left corner, with roughly half its height below the banner. Give it a thin light outline. A small camera button overlays the avatar's lower-right edge and opens Change Avatar. Allow overflow for the avatar; clip the banner image in its own wrapper.
4. Leave sufficient clearance below the avatar before the first field row. Avatar and banner are integrated into the form, not placed in a separate Photos tab.
5. Fields use this desktop order:

| Row | Left column | Right column |
| --- | --- | --- |
| 1 | Display Name | Username, with leading @ |
| 2 | First Name | Last Name |
| 3 | Email, with leading envelope icon | Remaining footer space |

6. Labels are small and bright; input surfaces are dark gray, with fine borders and compact internal padding. Use a roughly 16-24px column gap and 16-20px between rows at desktop implementation scale.
7. Cancel and Save Changes sit together at the lower right; Cancel is a dark secondary action and Save Changes is orange with dark text. On narrow screens, put the footer below the full-width Email row.
8. Cancel discards unsaved text edits. Save Changes submits supported changed fields. Show pending, success, validation, and failure states without shifting the layout substantially.

Proposed avatar display diameter: 112-128px on desktop. Banner display height: approximately 160-190px depending on panel width. These are display dimensions, not upload dimensions.

The correct reference includes Email and first/last names. It does not show a Bio field in this panel. This supersedes the earlier settings plan derived from the older image.

## Account and secondary sections

- Account rows are separate horizontal dark cards. Left icon, stacked label/value, optional status badge near the right, and trailing chevron. The Email badge is green and says Verified only when the real account is verified.
- Security rows use a left lock/shield/key icon, title, one-line explanation, and trailing chevron. Two-factor authentication also has a compact Off badge. The board shows the menu, not the setup flows.
- Connection rows contain provider mark, provider name, muted Not connected state, and a compact right-aligned Connect button. The screenshot's providers are visual requirements only; actual controls need supported integrations.
- Notification rows use a title and short explanation with a right-aligned orange switch and white thumb. The screenshot depicts all four as enabled; these are not account defaults.
- Appearance has a Theme label followed by three equal-width tiles with monitor/sun/moon icons. Selection uses an orange outline and small orange check indicator at the top right. It does not change the rest of the board into a light theme.
- Privacy uses title/description rows, compact dropdowns for visibility and requests, and a chevron for Blocked Users. Everyone is illustrative, not an inferred security policy.

## Change Avatar dialog

- Centered foreground dialog over a dimmed settings view. The reference also blurs the background lightly; blur is optional and must not compromise legibility or dialog focus behavior.
- Header: Change Avatar, with right-aligned X and a subtle separator below.
- Large centered circular current-avatar preview with a thin pale outline.
- Action row below: orange Upload Image with upload icon, then dark outlined Remove with trash icon.
- Muted centered hint: Use a square image (max 1 MiB).
- Remove is available when an avatar exists; on success the preview becomes the existing generated fallback. Keep the dialog open with an inline error if removal fails.
- Upload opens a local file picker followed by square crop/zoom editing. Crop/zoom is an addition needed for the requested resizing flow; its detailed controls are not shown in this avatar panel.

## Edit Banner dialog

- Header: Edit Banner and X. Body contains a large rectangular image editing viewport, subtle rule-of-thirds grid, and visible crop boundary/handles in the reference.
- The illustrated lower-left camera control opens image selection/replacement.
- Below the viewport are three aspect options: 16:9, 4:1, Custom. Selected 16:9 has an orange outline; the others have neutral borders.
- Bottom-right footer: Cancel, then orange Save. Closing or cancelling must not upload the staged crop.
- The server currently normalizes every banner to 1500x500 (3:1). The screenshot's aspect options cannot all produce a matching saved preview under that contract. Proposed implementation: use a 3:1 crop and accurate final preview for this pass. Preserving 16:9/4:1/Custom output requires an explicit API/storage decision before implementation.
- `react-easy-crop` can supply image pan/zoom with fixed aspect. The screenshot's draggable crop handles and arbitrary Custom rectangle are a separate interaction requirement; do not claim a fixed-viewport cropper reproduces them. If exact handles/custom resizing are approved requirements, reassess the package before installing.

## Tokens and typography

Reuse existing tokens rather than estimating colors from the generated image:

| Role | Existing value |
| --- | --- |
| Canvas | `#000000` |
| Surface / raised / hover | `#121212` / `#1C1C1C` / `#262626` |
| Primary / secondary / muted text | `#F5F5F5` / `#B3B3B3` / `#999999` |
| Accent / hover | `#F16B3A` / `#FF8052` |
| Text on accent | `#000000` |
| Subtle / input border | `#292929` / `#767676` |
| Success / error | `#63C58B` / `#F08080` |

Use Inter and existing Tabler icons. Proposed readable desktop scale: panel headings 22-24px semibold, body and input text 14-16px, field labels and supporting text 12-14px, sidebar text 14px. Avoid uppercase display headings, oversized page titles inside the panel, heavy shadows, and decorative artwork unrelated to user images.

## API and state contract

Source: [user-service API.md](../user-service/API.md) and the account DTO/image settings inspected during planning.

| Action | Route | UI consequence |
| --- | --- | --- |
| Load account | `GET /accounts/me` | Populate private settings fields and image state |
| Save fields | `PATCH /accounts/me` | Allow username, email, firstName, lastName, displayName; send changed fields only |
| Upload avatar/banner | `PUT /accounts/me/avatar` or `/banner` | Multipart `file`; receives updated private account |
| Remove avatar/banner | `DELETE /accounts/me/avatar` or `/banner` | 204 empty response; reload/update account state and image previews |

- Use the existing same-origin `/api` prefix and verified access-token flow; account identity comes from the token.
- Image removal is immediate and independent of Save Changes. Cancelling text edits does not undo an already completed image operation; make that behavior clear near the image controls.
- Accept JPEG, PNG, WebP. API limits: avatar 1 MiB, banner 5 MiB, maximum input 20 megapixels, animated images rejected. Final outputs: 256x256 avatar, 1500x500 banner, WebP. Client processing must not silently turn an unsupported animated input into an accepted still without a deliberate policy decision.
- Repeated image deletion succeeds. Do not parse a JSON body from a 204 response. Disable conflicting operations while an image mutation is pending, and refresh image URLs/previews after successful replacement.
- Username: 3-30 characters. Display/first/last names: 1-50 characters when non-null; nullable names may be cleared. Email requires a valid address, and a changed address clears verification.
- Private email/name details belong in the owner's settings, not another user's public profile.
- Bio/location/website fields are not part of the current account update contract. Notification preferences, theme persistence, privacy controls, and provider actions require separate capability checks before any functional implementation. Displaying this board is not evidence these APIs exist.

## Responsive and accessibility behavior

The board contains desktop references only. Proposed adaptations: stack paired form inputs on narrow screens; collapse the settings rail into a compact section selector; allow the form and dialogs to scroll within viewport bounds; keep primary actions reachable. Do not shrink the miniature board wholesale to fit a phone.

Use labeled inputs and icon-button names, visible focus rings, accessible dialog titles, focus trapping/restoration, Escape dismissal, keyboard-operable crop controls, descriptive errors, and announced pending/success states. Do not depend on orange or green alone to convey selection, verification, or activity.

## Execution record

- The reference used is the file in `NOOK_UI/profile/`, not the older standalone settings image.
- A compact settings window, grouped rail, orange selected row, integrated banner/avatar, and paired profile fields drive the implementation.
- Installed `react-easy-crop`; added settings, profile, image dialogs, API-client removal methods, shared account state, and regression checks. Shared design tokens and server image dimensions remain unchanged.
- Built the approved profile/account/connection-status scope. Other settings sections are visibly marked Soon. Connection management and variable banner crop presets remain deferred.
- Production build, TypeScript, lint, and Node regression tests verify the implementation contract. Real browser visual/interaction checks and live gateway checks remain pending.
