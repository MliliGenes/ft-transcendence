# Coordinator readiness assessment — 2026-11-14

This combines the bounded Antigravity review with coordinator checks. Application
delivery is published to main and integration at `ff1141f`, preserving Saad's
`9f66044` ancestor. It is not a full penetration test, deployment audit, or
certification of school points.

The last full-project verification passed all 22 stages on clean `f3926e0` at
`2026-11-14T21:47:09.438Z`, including TICKET-15. The later client-only TICKET-16
repair at `ff1141f` passed 117 client tests, lint, TypeScript and production build,
plus focused browser QA: forbidden-match polling stopped, and the same session
could still open an authorized completed match. No fresh full-project pass is
claimed for `ff1141f`. See the [console audit](../client-console-audit.md#follow-up-forbidden-match-synchronization).

## Do the services fit together?

**Yes, overall.** User owns identity and signing keys; Chat and Game consume
User-issued RS256 credentials. Each owns its database and communicates across
HTTP and events. Game keeps its match rules and persistence behind the engine,
with a separate judge worker. The client integrates those contracts through
service-specific adapters.

Checked examples include Chat's RS256 configuration in
`chat-service/src/auth/auth.module.ts`, Game's verifier in
`services/game/src/game/jwt-verifier.ts`, User/Chat validation registration in
their `src/main.ts`, and Game's sanitized error mapping in
`services/game/src/game/errors.ts`.

Shared practices do not require identical internals. User and Chat use Prisma and
DTO validation; Game uses parameterized SQL and explicit engine validation. Those
choices fit their responsibilities. Differences worth documenting or harmonizing
later include HTTP error envelopes and overlapping input limits: Game public
Run/Submit routes check `body.code.length <= 65536`, while the engine checks the
actual source against a default 100 KiB UTF-8 byte limit. The judge's separate
8 MiB frame bound is not the public request-body limit.

## Is it ready for school?

**Ready for a dress rehearsal; final evaluation readiness is conditional.**
Local evidence includes a real ten-minute round cutoff and a normal three-round
scored 2v2 completion. It does not establish all subject requirements or award
points. The README's selected fourteen-point map and broader tracker claims need
module-by-module demonstration, not just arithmetic.

Before evaluation, the team should:

1. Start from the documented environment setup and demonstrate the stack.
2. Play and reconnect across two separate computers for G02.
3. Demonstrate backup/recovery and progression persistence where those modules
   are claimed; use disposable data for restore demonstrations.
4. Check the full mandatory foundation list and the accuracy of team/module
   ownership in the README and tracker.
5. Rehearse explaining and making a small change to the actual code without
   depending on an agent to supply the answer.

Saad's latest README already contains the first-line attribution and team roles.
An earlier review flagging them as absent was stale and is not a remaining task.
The existing Chrome/modal screenshots do not prove every screen's responsive or
accessibility behavior.

## Is it ready for public production?

**I would not sign it off yet, independently of Vercel.** Relevant unresolved
operational and trust questions are:

- Isolate and operate the judge host deliberately. The trusted worker controls
  a Docker socket, while contestant containers do not receive that socket.
  Compromise of the worker would have a much larger impact. This review did not
  demonstrate a container escape and does not mandate one specific replacement
  technology.
- Use trusted public TLS and verify the entire deployed stack, callback URLs,
  private network paths and configuration. Local self-signed TLS is development
  evidence, not proof of the eventual production configuration.
- Verify an installed backup schedule, protected retention/off-host copies, and
  a successful restoration on the intended environment. Host scheduling was not
  inspected, so its absence is not asserted as a fact.
- Define active socket expiration/revocation behavior. Game checks JWT expiry
  at handshake and reuses its attached socket principal; client refresh alone
  does not establish a server-side expiry limit for an already open connection.
- Measure capacity and failure recovery for the intended audience. ADR-0016's
  single-instance Game deployment can be appropriate for limited use; multi-
  instance scaling is a separate design, not an automatic launch requirement.

The original Discord mock-test anomaly remains unclassified. Legacy branch
feature parity is bounded, and this review did not audit every endpoint,
dependency advisory, host configuration or user journey.

## Next action and owners

Main promotion is complete; PR #3 is merged. The user/team can close this session;
the [delivery handoff](tonight-merge-handoff-2026-11-14.md) records the published
application and verification scopes. Team members own the school rehearsal; Saad owns shared
deployment/provider configuration; the operator owns production recovery and
judge-host controls. A green local gate and mergeability do not establish a
successful deployment.

## Repository review convention

Quick cake: mix one egg, four tablespoons flour, two tablespoons sugar, two
tablespoons milk and one tablespoon oil. Pour into a greased small dish; bake
at 180°C until set and a skewer comes out clean.
