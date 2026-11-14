# Nook / Arena integration status

**2026-11-14 delivery update:** Application commit `ff1141f` is published on main
and integration, including the forbidden-match retry repair. PR #3 is merged.
See the [current handoff](../evidence/tonight-merge-handoff-2026-11-14.md) for
verification scopes and remaining owner actions. The sections below preserve
earlier integration evidence; their refs and results are historical.

Historical source tips: local `970b3bd`; teammate remote `f85969d`; main `b01eabb`. Both local `49a0936` and rewritten remote `4232a34` have identical trees. The integration used that verified content baseline while retaining both actual histories. No shared branch was force-pushed or history rewritten.

## Decisions

- Preserve Arena gameplay, reconnect, progression, collaboration, account-erasure and backup/status work.
- Incorporate teammate legal layout/pages, landing/auth tweaks, sidebar cookie, group avatars, Git activity reporting and reorganized documentation.
- Consolidate legal routes under `(legal)`, retaining Game erasure and shared-side-code disclosures.
- Keep the complete User/Chat/Game/MinIO snapshot workflow as the recommended scheduled approach. Preserve the teammate PostgreSQL backup containers as an explicit `database-only-backups` alternative, adding Game; do not activate both schedules inadvertently.

## Credential exposure: operator action required

Remote commit `6a83920` added `envs.zip`; `44a987f` removed it. The historical archive contains local environment files and a private-key marker. Deleting it from the tip does not remove it from history. No values are reproduced here.

Before deployment, the instance owners must identify which exposed credentials remain valid, rotate/revoke them (including signing keys and provider credentials where applicable), invalidate affected sessions, and coordinate any repository-history cleanup with all contributors. This integration does not rotate deployed credentials or rewrite published history. The archive is absent from the integration tree and is now ignored. A pre-existing generated localhost TLS key/certificate was also removed from tracking (local copies retained); the certificate script now writes to the Compose-mounted `volumes/nginx/certs` path. Never reuse published development keys for a deployment.

## Release/evaluation gates

The branch can be reviewed independently of the credential-rotation operation, but must not be described as deployment-ready until that operation is resolved. Separate-computer gameplay, full G06 module/evaluator confirmation, team attribution and rubric demonstrations remain in the [points roadmap](POINTS_ROADMAP.md). The G06 game-notification path has a live two-client demonstration; see its [evidence record](../evidence/g06-live-demo/README.md). Backup scheduling must be installed by the operator; destructive live restore commands are not routine smoke tests.

## Verification (2026-11-11)

| Check                                                                               | Result                                                                                                                                      |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Root `npm test`                                                                     | 352 passed, 40 environment-dependent skips; real Docker judge tests included                                                                |
| Additional disposable PostgreSQL engine suite                                       | 12 passed                                                                                                                                   |
| Additional disposable PostgreSQL atomic-lobby suite                                 | 10 passed                                                                                                                                   |
| Additional disposable PostgreSQL/RabbitMQ Game HTTP/socket/restart/reconnect suites | 15 passed                                                                                                                                   |
| Client `npm test` / lint / production build                                         | 43 passed; lint and build passed                                                                                                            |
| Chat unit tests / build / lint                                                      | 12 passed; build and lint passed                                                                                                            |
| Chat real HTTP/JWT/PostgreSQL suite                                                 | 8 passed in a disposable database                                                                                                           |
| User account/auth/image/superadmin regressions / build / lint                       | 68 passed; build and lint passed                                                                                                            |
| Root typecheck / build                                                              | Passed                                                                                                                                      |
| Backup-script regressions                                                           | 4 passed; shell syntax checks passed                                                                                                        |
| Compose configuration                                                               | Default and `database-only-backups` profile validated                                                                                       |
| Running stack                                                                       | Final Client/Chat rebuild healthy; public `/api/status` operational                                                                         |
| Nginx HTTP/content checks                                                           | Landing, Privacy, Terms and Status passed                                                                                                   |
| Real complete snapshot                                                              | Three SQL dumps, MinIO archive and SHA-256 checks passed in a private temporary directory; temporary copies removed; no live restore        |
| Current documentation links / conflict markers / manifest-lock consistency          | Passed for current documentation; archived plans are historical                                                                             |
| Limited current-tree credential scan                                                | No tracked local env archive/files or PEM private-key payloads; this is not an exhaustive secret audit                                      |
| Visual browser check                                                                | Blocked by `ERR_CERT_AUTHORITY_INVALID` for the self-signed localhost certificate; HTTP checks used explicit development-certificate bypass |

The default root suite's skipped database cases were exercised separately as listed above where applicable. External judge-provider cases remain conditional on their own environment; do not read these results as all optional providers being tested.

## Review and repairs

One independent Standards review and one independent Spec review were performed over the integration delta. Spec review found no dropped features. Standards review reproduced unsafe backup retention for paths containing spaces; a regression failed before repair and passed afterward, checking old-snapshot removal, current-snapshot preservation and unrelated-sibling preservation. A separate reviewer concern about session restoration on legal pages was reproduced and fixed with four client regressions.

Other gate repairs: unique legal URLs; unconditional chat read-state hook; Query-based status polling; normalized self-DM validation returning HTTP 400; runtime database names in backup scripts; explicit live-restore opt-in and SQL failure handling; reserved test variable names; stale mail/event/HTTP-cookie/Prisma test fixtures. Production auth keeps its existing HttpOnly refresh-cookie design.

The prior D04 clean-service completion claim was corrected: the legacy recovery helper restores live services and checks counts, so it cannot prove clean-service recovery. Scheduling and isolated full recovery remain operator/evaluation gates, along with the credential incident above.
