# Authentication Security Workplan

## Goal

Finish the user-management authentication flows so the project can defend the current
`9/14` estimate and move to `10/14` after a complete 2FA implementation.

Current repository facts:

- `User.emailVerifiedAt` already exists.
- `TwoFactorAuth` and `RecoveryCode` Prisma models already exist.
- Passwords use bcrypt.
- Refresh tokens are opaque, hashed, rotated, and revocable.
- There is no mail module, email verification flow, password reset flow, or working 2FA flow yet.

## 1. Mail foundation

- [ ] Choose the development mail transport: local SMTP/MailHog or a real SMTP provider.
- [ ] Add mail configuration to `.env.example` without storing secrets in the repository.
- [ ] Add the smallest mail service needed to send text/HTML messages.
- [ ] Keep provider details behind the service; auth code should only request a message.
- [ ] Add a development-safe log or local inbox option so flows can be tested without real email.

Suggested configuration:

```text
MAIL_HOST=
MAIL_PORT=
MAIL_USER=
MAIL_PASSWORD=
MAIL_FROM=
AUTH_FRONTEND_URL=http://localhost:5173
```

## 2. One-time auth tokens

Add a database model for verification and password-reset challenges, or one shared model
with a clear purpose field.

Required fields:

- random token hash as the identifier
- user id
- purpose: `VERIFY_EMAIL` or `RESET_PASSWORD`
- expiry timestamp
- consumed timestamp, or delete the row on successful use
- created timestamp

Rules:

- Generate a cryptographically random raw token.
- Email the raw token only in the link.
- Store only a SHA-256 hash of the token.
- Tokens expire and are single-use.
- Never put passwords or password hashes in email links.
- Rate-limit or invalidate older active tokens for the same user and purpose.

## 3. Email verification

Backend endpoints:

- [ ] Send verification after local registration.
- [ ] `POST /auth/email/verify` with the one-time token.
- [ ] `POST /auth/email/verify/resend` for an authenticated user or controlled anonymous flow.
- [ ] Mark `User.emailVerifiedAt` only after consuming a valid token.
- [ ] Return generic responses where the email address could reveal account existence.
- [ ] Decide whether OAuth-created accounts are already verified; current OAuth code sets verification for verified provider emails.

Frontend:

- [ ] Show whether the current email is verified.
- [ ] Add a resend action and success/error notice.
- [ ] Handle the verification callback/link once and remove token data from the visible URL.

Tests:

- [ ] Valid token verifies the account.
- [ ] Expired token fails.
- [ ] Reused token fails.
- [ ] Wrong-purpose token fails.
- [ ] Resend invalidates or supersedes the previous token.
- [ ] No password or raw token is persisted.

Unverified-account retention:

- [ ] Add a scheduled cleanup job that deletes local users where `emailVerifiedAt IS NULL` and `createdAt <= now() - 1 hour`.
- [ ] This simple rule treats the one-hour window as starting at account creation; add a dedicated expiry field later if email changes or resend actions need a fresh window.
- [ ] Delete dependent refresh tokens and auth records in the same transaction or rely on verified cascade behavior.
- [ ] Never delete OAuth accounts whose provider email was already verified.
- [ ] Make cleanup idempotent and test it against verified, unverified, expired, and recently resent accounts.
- [ ] Do not rely on a PostgreSQL trigger to wait an hour; time-based cleanup needs a scheduler/worker or a maintenance job.

## 4. Forgot-password and reset flow

Backend endpoints:

- [ ] `POST /auth/password/forgot` accepts an email address.
- [ ] Always return the same public response whether the account exists or not.
- [ ] Create a short-lived, single-use reset token for an existing account.
- [ ] Send the reset link through the mail service.
- [ ] `POST /auth/password/reset` accepts the token and a new password.
- [ ] Hash the new password with the existing bcrypt settings.
- [ ] Revoke existing refresh-token sessions after a successful reset.
- [ ] Consume all matching reset tokens after success.
- [ ] Do not reveal whether a supplied email belongs to a user.

Frontend:

- [ ] Add a forgot-password page/form.
- [ ] Add a reset-password page/form opened from the email link.
- [ ] Validate password length and UTF-8 byte limits using the existing helpers.
- [ ] Show a generic success message for the forgot-password request.
- [ ] Redirect to login after a successful reset.

Tests:

- [ ] Unknown email returns the same response as a known email.
- [ ] Valid reset changes the password.
- [ ] Old password no longer works.
- [ ] Existing refresh sessions are revoked.
- [ ] Expired, reused, malformed, and wrong-purpose tokens fail.
- [ ] Password hashes and reset tokens never appear in responses or logs.

## 5. Real 2FA for U06 (+1 point)

The Prisma tables exist, but the feature is not complete until the whole flow works.

Backend endpoints:

- [ ] Start setup and return a TOTP secret/provisioning URI only to the authenticated user.
- [ ] Confirm setup with a valid current TOTP code before enabling 2FA.
- [ ] Store the secret encrypted at rest.
- [ ] Generate hashed recovery codes once during setup.
- [ ] Require a second factor during password login when 2FA is enabled.
- [ ] Add a short-lived pending-login challenge instead of issuing full tokens early.
- [ ] Allow one recovery code to replace a TOTP code; consume it atomically.
- [ ] Allow authenticated users to disable 2FA after verifying the password and/or current factor.
- [ ] Prevent replay of the same TOTP step if `lastUsedStep` is used for replay protection.

Tests:

- [ ] Setup cannot be enabled without a valid confirmation code.
- [ ] Login without 2FA still returns the normal token pair.
- [ ] Login with 2FA stops before issuing tokens until the second factor succeeds.
- [ ] Invalid and expired codes fail.
- [ ] A recovery code works once and then fails.
- [ ] Disabling 2FA removes active recovery codes and secret data.
- [ ] Concurrent recovery-code use allows only one successful consumer.

## Suggested order for tomorrow

1. Choose local mail transport and add configuration.
2. Add the one-time token model and migration.
3. Implement password forgot/reset first because it has a clean security boundary.
4. Implement email verification using the same token pattern.
5. Add frontend forms and callback handling.
6. Implement TOTP setup, login challenge, recovery codes, and disable flow.
7. Run focused auth tests, the full backend build, and the frontend build.

## Score checkpoint

- Current working estimate: `9/14`.
- Completed 2FA: `U06 = +1`, giving `10/14`.
- Email verification and password recovery strengthen the mandatory authentication foundation; they are not a separate point by themselves.

## Completion rule

Do not mark email verification, password recovery, or U06 complete because an endpoint exists.
Mark each complete only after the happy path, invalid/expired/replay cases, database migration,
frontend path, and focused tests all work.
