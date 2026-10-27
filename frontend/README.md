# Arena frontend

Documented 2026-10-27 from Aimane source `67fc6b0`; this is a bounded source review, not a passing test report.

## Overview

This workspace builds the React/Vite Arena browser application. Production play uses shared browser authentication and enters through Account's Play link; explicit development live and mock modes are fixtures with different identity boundaries.

## Interface

- [`src`](./src/README.md) contains the application entry point, Arena/Lobby clients, and screen/editor composition.
- [`package.json`](./package.json) exposes `dev`, `build`, `preview`, `test`, `test:e2e`, `typecheck`, and `lint` scripts for the `arena-frontend` workspace.
- [`vite.config.ts`](./vite.config.ts) configures React/Tailwind and the Vite server/build; [`index.html`](./index.html) loads the browser entry.
- [`playwright.config.ts`](./playwright.config.ts) configures the separate browser suite in `e2e` against an independently started server.

## Invariants

- Vite's configured development port is 5173 and no development proxy is declared.
- The unit script runs Vitest with `e2e` excluded; unit completion does not establish browser acceptance.
- Playwright runs with one worker. `E2E_WEB_URL` chooses the server target, defaulting to port 4173; no Playwright `webServer` launcher is configured.
- Production identity comes from the real authenticated profile. Development query identity and mock transports do not establish production authentication behavior.
- Package dependencies must use supported public entry points, as required by the repository's package boundary rules.

App URL selection and required BroadcastChannel/Web Locks support are specified
in the [application contract](./src/README.md#interface). A running Vite server
alone does not establish those production browser prerequisites.

## Side Effects

- `build` emits browser assets; `dev` and `preview` start web servers.
- The application and browser tests use the DOM, network clients, storage, collaboration state, and editor lifecycles through the source contracts.
- Browser suites can issue gameplay commands against their selected fixture; choose that environment explicitly before running them.

## Verification

Run these commands from the repository root with Node 22:

```sh
npm ci
npm run build:packages
npm test --workspace arena-frontend
npm run typecheck --workspace arena-frontend
npm run build --workspace arena-frontend
```

For browser tests, select the specific fixture, independently started server, and relevant test files using [manual game testing](../docs/manual-game-testing.md). The suite does not launch its own server; a blanket run is not a substitute for choosing compatible fixtures.

The direct build/browser configuration was fully reviewed; application, client, and component coverage is bounded as recorded in the child contracts. No runtime tests were run for this documentation.

The shared [TestSocket](./test/socket.ts) separates `server(...)` inbound events
from recorded outbound commands, provides manual acknowledgements and models
acknowledgement timeouts. Dispose tested clients and disconnect test sockets
when a fixture finishes so pending callbacks/timers do not leak. A TestSocket
result is not proof of delivery between real browser windows.
