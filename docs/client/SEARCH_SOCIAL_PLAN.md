# Search and Friend Requests

## Summary

Build a social discovery view at `/search` with backend-filtered people search and a dedicated incoming friend requests tab. Search remains public; friendship actions and requests require authentication.

## Backend search

- Update `GET /accounts/search` to match a trimmed, case-insensitive substring against username or display name.
- Keep `username` as the query parameter for compatibility; add `page` and `limit` with the account-list defaults and limits.
- Return the existing pagination envelope: `{ users, total, page, limit, totalPages }`.
- Keep search ordering stable by username, then account ID, and return only public profile fields.
- Update API.md, OpenAPI, and account tests for matching, validation, sorting, pagination, totals, and public field projection.

## Client experience

- Show the paginated public directory before a term is entered; use server-side search after a 300 ms debounce. Reset to page 1 when the term changes.
- Link each result to `/profile/[id]`, hide the signed-in user, and display public name, username, avatar, status, and bio.
- Reuse the shared friendship query and social API for add, accept, and reject actions. Show friends, sent, incoming, loading, empty, and error states; invalidate friendship data after mutations.
- Add a Requests tab with incoming requests and Accept/Reject actions. Signed-out visitors see a login prompt; no private request endpoint is called for them.

## Validation

- Test directory and filtered search, empty results, invalid terms, and pagination boundaries.
- Test signed-out search, self-filtering, add/pending/accepted states, incoming requests, accept/reject, conflict feedback, and expired-session refresh.
- Check keyboard access, focus visibility, responsive layout, and both themes.
- Run backend account tests, lint, and build; run client tests, lint, TypeScript, and production build.

## Assumptions

- The `username` parameter remains the search-term parameter and also matches display names.
- Search is public; friend actions and incoming requests require a session.
- No extra filters, sorting controls, or changes to friendship routes are included.
- Implement backend contract and tests first, then client integration; keep this plan as the feature’s reference.
