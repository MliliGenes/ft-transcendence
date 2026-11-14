# Nook — Project Context

Updated: 2026-09-20  
Purpose: Shared product context for teammates, backlog planning, design, and future implementation discussions.  
Stage: Product definition. Implementation status has not been audited in this conversation.

## 1. Nook in one paragraph

Nook is a social platform for the 1337/42 school community where students express themselves, follow people, publish ideas and resources, talk through DMs and groups, and play games together. It has four distinct spaces—Feed, Chat, Play, and Profile—connected by a shared identity, relationships, activity, and notifications. The immediate delivery priority is a complete ft_transcendence submission. The longer-term product includes multiple games and a richer social experience.

## 2. How to interpret this document

- **Confirmed direction:** explicitly chosen by the user, including the latest clarification answers.
- **Feature intent:** a desired capability; inclusion here does not assign it to the first release.
- **Proposal:** a suggested rule or delivery choice that still needs agreement.
- **Open:** an unresolved decision that must not be silently treated as settled.

This document consolidates product context. It does not replace the authoritative 42 subject, claim completed modules, or serve as a finalized technical specification.

## 3. Confirmed decisions

| Topic               | Decision                                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name                | **Nook**; selected after exploring alternatives                                                                                                          |
| First audience      | **1337/42 school community**                                                                                                                             |
| Delivery priority   | **42 submission first**                                                                                                                                  |
| Product structure   | Separate Feed, Chat, Play, and Profile spaces, each with a suitable layout                                                                               |
| Publishing          | Posts, articles, links, and supporting files; low emphasis on video                                                                                      |
| Chat direction      | Lightweight Discord with DMs and groups containing channels                                                                                              |
| Rich messaging      | File attachments and audio/voice notes are part of the desired experience                                                                                |
| Group identity      | Nicknames and titles alongside channels                                                                                                                  |
| Personal expression | Customizable profiles with avatar, banner, gradients, display-name fonts, and optional gaming interests                                                  |
| Game direction      | **Code Arena is the first playable game** in this repository. The current release has one playable game; adding more games is a future product decision. |
| Reuse               | Chat capabilities should later support multiple interfaces, including embedded in-game chat                                                              |
| Team planning       | Separate backlog cards for the major areas, with comments and proposals from teammates                                                                   |

Name/domain availability has not been checked. Earlier references to Lamma or an unnamed platform are historical proposals; Nook is the current chosen name.

## 4. Audience and reason to return

The initial audience is students in the school community. Their possible uses include sharing a project, publishing a technical explanation, finding useful resources, talking with classmates, keeping a group organized, and arranging games.

**Working product hypothesis:** the same people want a place to share their work, maintain social connections, and do something enjoyable together. Nook makes those activities easy to move between.

The first pilot should test whether students actually return for those connections. The main daily attraction—content, conversation, or games—has not been validated yet.

### Example journey

A student posts a project write-up. Another student follows them and comments. They become friends, continue in a DM, and join a group. Members organize a game through Chat, enter Play, then return to their conversation and optionally share the result.

Each space must also be useful independently. Reading a post does not require joining a game; a group does not need to be a gaming group.

## 5. Product spaces

### 5.1 Feed — publishing and following

**Purpose:** see what people you follow are sharing and join discussions.

Feature intent:

- Short posts, questions, updates, and images.
- Long-form articles with titles and formatted content.
- External links with personal commentary.
- Supporting documents, files, and code snippets where useful.
- Follow/unfollow authors, comments, reactions, and private bookmarks.
- Create, edit, and delete your own content; preserve unfinished drafts.
- Open an author's profile and share content into a conversation.

Proposed starting behavior: a chronological following feed. Recommendations, discovery algorithms, and a video feed are not established requirements. Heavy video hosting is outside the proposed initial scope.

Open: content audiences, public access without login, supported attachments, first-release article editor, and the experience when a new user follows nobody.

### 5.2 Chat — conversations and groups

**Purpose:** spend time with people in a dedicated messaging environment.

DM feature intent:

- Persistent private text conversations.
- Image/file attachments and previews.
- Audio uploads and recorded voice notes, with preview, discard, send, and playback.
- Replies, reactions, editing/deleting own messages, typing indicators, and unread state.
- Clear sending/failure feedback and retry behavior.
- Search, pinned messages, shared-file browsing, and draft preservation.

Group feature intent:

- Persistent groups with a name, icon, description, and optional banner.
- Separate text channels, including a default general channel.
- Invitations, membership management, leaving, and ownership transfer.
- Group-specific nicknames and cosmetic titles.
- Simple management permissions and channel notification preferences.

The group itself is the social container; there is no extra Discord-style server layer above it. Proposed initial rules: private groups, shared channel access for all members, and owner/moderator/member permissions. These defaults still need agreement.

Audio messages are separate from live voice calls. Calls, screen sharing, and streaming have not been selected for the initial release.

Chat also presents friends, permitted activity, and actionable game invitations. It remains useful outside gameplay.

### 5.3 Play — games and competition

**Purpose:** choose a game, gather participants, and play or compete.

Feature intent:

- A game selection area as the catalog grows.
- Game-specific mode selection, lobbies, invitations, readiness, and teams.
- Focused gameplay with relevant in-game chat.
- Results and match history.
- Tournaments with registration, brackets, match progression, and outcomes.
- Explicit sharing of an invitation or result into other spaces.

Desired formats discussed: solo practice, solo vs AI, 1v1, 2v2, 3v3, and tournaments. These are candidates across the platform, not a promise that every game supports all formats.

**Existing game concept:** the supplied compliance matrix describes Campus Puzzle Race, a team game with three ordered stages, role-specific information/controls, equal 2v2 or 3v3 teams, authoritative outcomes, and recovery behavior.

**Latest direction:** multiple games are planned. Campus Puzzle Race remains the documented candidate, not a newly confirmed exclusive choice. Solo/AI/1v1 would require suitable rules rather than simply changing a player-count setting.

Open: first game, number of games for submission, final rules, allowed team sizes, AI behavior, tournament format, scheduling, no-shows, ties, disconnects, and result disputes.

### 5.4 Profile — identity and self-expression

**Purpose:** give each user a personal space that carries their identity across Nook.

Feature intent:

- Avatar/default avatar, banner, gradient background, and accents.
- A curated display-name font choice alongside a stable account handle.
- Bio, personal title, custom status, and profile preview from other spaces.
- Published content and selected pinned items.
- Optional favorite games, wishlist, and currently-playing shelves.
- Optional achievements/results selected for display.

**Working interpretation of “private personal space”:** only the owner edits the profile; visitors see permitted profile content. Drafts, saved items, account controls, and editing are private. Confirm whether this matches the intended visibility model before implementation.

Manual game shelves are different from live platform activity. External game detection has not been selected. Customization must preserve readable text and usable controls.

## 6. Shared concepts and rules

| Concept         | Meaning across Nook                                      |
| --------------- | -------------------------------------------------------- |
| Account         | One stable identity across all spaces                    |
| Display name    | Customizable presentation of that identity               |
| Follow          | One-way subscription to someone's content                |
| Friendship      | Mutual social relationship                               |
| Group           | Persistent social space with members and channels        |
| Channel         | A conversation area within a group                       |
| Match team      | Players assigned together for one match                  |
| Cosmetic title  | Appearance/personality; grants no permissions            |
| Permission role | Determines management actions                            |
| Post/article    | Published content with an audience and discussion        |
| Message         | Content within a particular conversation                 |
| Activity        | Presence or session information with visibility controls |
| Notification    | An event linking to its relevant destination             |

Cross-space proposals to preserve coherence:

- Following someone does not automatically establish friendship or reveal private activity.
- Group membership does not grant access to either team's private match chat.
- Sharing a link does not override the underlying content's access rules.
- Appear-offline behavior should also suppress activity that would reveal presence.
- Invitations show their current availability; opening one still checks whether joining is allowed.
- A nickname never prevents identifying the underlying account through its profile.
- Published results require an explicit action; playing does not silently create a feed post.
- A consistent block/privacy policy must apply across Feed, Chat, invitations, and activity.

Blocking in shared groups and competitive games remains unresolved; do not assume that blocking removes somebody from an ongoing match.

## 7. Notifications

One notification experience connects replies, mentions, friend requests, group invitations, game invites, and tournament updates to the correct destination.

Feature intent:

- In-app inbox with read/unread state and relevant links.
- Category preferences and conversation/channel muting.
- Privacy-aware previews.
- Activity and invitation updates that reflect their current state.

Proposed default: messaging unread indicators remain useful without turning every chat message into a duplicate notification-inbox entry. Define which events create inbox entries before implementation.

A notification service is part of the discussed system direction. Its boundaries and delivery mechanisms are not finalized. Browser push, email, and mobile push have not been committed.

## 8. Modularity and technical context

The product is modular: the same chat capabilities should support the full Chat interface and embedded game interfaces. The game service may coordinate chat lifecycle/access through a defined interface. Whether player messages connect directly to Chat or are proxied through Game is an implementation decision still to make.

Existing planned stack from the compliance matrix:

- React/Vite frontend and Tailwind styling.
- NestJS core, game, and chat services.
- PostgreSQL, with separate core/game/chat data ownership.
- Docker Compose and Nginx; HTTPS/WSS externally.

These are inherited plans, not evidence of a running implementation. Feed and notifications broaden the earlier scope; their service placement is open. A UI route does not automatically require its own microservice. Global profiles should have one owner even when displayed inside Chat.

Do not infer settled endpoints, database schemas, event names, message brokers, storage providers, or additional infrastructure from this context document.

## 9. Delivery priority and 42 constraints

**Confirmed priority: complete the 42 submission before expanding the full vision.**

The supplied `42-subject-compliance.md` references ft_transcendence v21.2 as authoritative. The PDF itself was not supplied here; subject statements below are inherited from that matrix.

### Existing planned module set

| Planned module                          | Matrix points |
| --------------------------------------- | ------------: |
| Frontend/backend frameworks             |             2 |
| Real-time features                      |             2 |
| User interaction                        |             2 |
| Standard user management/authentication |             2 |
| Complete web-based game                 |             2 |
| Remote players                          |             2 |
| More-than-two-player multiplayer        |             2 |
| Backend microservices                   |             2 |
| OAuth 2.0                               |             1 |
| Total planned                           |            17 |

The matrix states a 14-point minimum and that only completed modules count. It does not prove these modules are implemented. Feed, richer profiles, audio, AI opponents, and tournaments must not be assigned extra points without checking the original subject.

Mandatory foundation in that matrix includes frontend/backend/database, meaningful team contributions, single-command container deployment, modern Chrome support, accessible/responsive interfaces, policy pages, secure authentication, frontend/backend validation, concurrency correctness, ignored secrets with an example environment, database documentation, and secure external connections. Submission also needs the specified README, ownership/contribution records, and AI-use disclosure.

A release with only 1v1 cannot demonstrate the planned more-than-two-player module. Changing the game or architecture requires revisiting the module plan.

### Proposed release approach

1. Confirm the first game, first supported mode, module evidence, owners, and deadline.
2. Complete an end-to-end path: account/profile → friend/DM → invitation → multiplayer match → result → return to conversation.
3. Add a minimal publishing/following path to establish the four-space identity if delivery capacity allows.
4. Expand attachments, voice notes, articles, customization, tournaments, and additional games in an explicit priority order.

This order is a proposal. Group/channel scope and Feed depth for submission still require a team decision. The feature inventory is not a commitment to ship everything together.

## 10. Backlog organization

The team has split the story into these cards:

| Card                          | Main responsibility                                                  |
| ----------------------------- | -------------------------------------------------------------------- |
| Product Idea                  | Audience, purpose, scope, and overall experience                     |
| Feed                          | Publishing, following, and discussions                               |
| Chat                          | DMs, groups, channels, and rich messaging                            |
| Play                          | Games, lobbies, matches, and tournaments                             |
| Profile                       | Personal identity, expression, and visibility                        |
| Shared platform behavior      | Relationships, permissions, navigation, and cross-space interactions |
| Notifications                 | Events, preferences, inbox behavior, and destinations                |
| Additional feature candidates | Optional ideas awaiting prioritization                               |

For implementation tasks, record the user outcome, release priority, owner, dependencies, unresolved rules, and observable completion criteria. Assign cross-space behavior to one primary owner with a named collaborating area.

The older matrix mentions four contributors; the current team roster, roles, and availability have not been reconfirmed. No schedule or effort estimates have been agreed here.

## 11. Design context

Nook's generated concept covers use dark charcoal backgrounds, violet/cyan accents, floating rounded panels, and expressive profile imagery. The selected name has a rounded typographic cover treatment.

These images are mood and presentation references. Their decorative text, statistics, features, and layouts are not product requirements. The earlier Operations Console/Team Bays prototypes relate to the puzzle game; they do not establish the final visual system for all of Nook.

## 12. Questions to settle next

| Priority | Decision                                                                    | Why it matters                                                 |
| -------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1        | What is the first game, and what is its smallest complete multiplayer mode? | Determines gameplay work and module evidence                   |
| 1        | What is the submission date, who is building, and what already works?       | Determines an achievable release boundary                      |
| 1        | Which social features must ship for submission?                             | Prevents the product wishlist from becoming the deadline scope |
| 2        | Is access school-only, or is the school merely the first audience?          | Changes signup, discovery, and visibility                      |
| 2        | What does a new student see with no follows, friends, or groups?            | Determines whether the first visit is useful                   |
| 2        | What are the default audiences for profiles and posts?                      | Shapes data access and sharing                                 |
| 2        | What group powers/history access do new members receive?                    | Shapes membership and channel behavior                         |
| 2        | How do blocking, deletion, and content retention work?                      | Avoids contradictory behavior across spaces                    |
| 3        | Which uploads, size limits, and recording durations are supported?          | Defines rich-message scope                                     |
| 3        | How do tournament registration, no-shows, and disconnections resolve?       | Required before implementing brackets as a complete feature    |

### Questions that challenge the concept

- What useful thing can the first student do before inviting anyone else?
- What specific school need would make students choose Nook alongside tools they already use?
- If the deadline tightened tomorrow, which feature would be cut first?
- Can the first game be enjoyable and fully demonstrable before the second one starts?
- Which student behavior would show the pilot is useful: returning conversations, useful posts, completed games, or something else?

These are open questions, not reasons to stall work that is already well defined.

## 13. Source and decision history

- `42-subject-compliance.md`: inherited requirements mapping and prototype evidence, reviewed there on 2026-09-18. Its PDF reference remains authoritative for compliance.
- `social-platform-ideas.md`: standalone chat brainstorm; profiles there are product surfaces, not a confirmed backend ownership assignment.
- `platform-concept.md`: prior global concept. Its Lamma naming proposal is superseded by the user's explicit Nook choice.
- This conversation: confirmed four-space direction, name, desired features, and intent for modular reuse.
- Clarifications on 2026-09-20: school community first, 42 submission first, multiple games planned.

When a decision changes, update its status and affected backlog cards. When scope or evidence changes, also review the compliance matrix as required by that project's documented maintenance rule.
