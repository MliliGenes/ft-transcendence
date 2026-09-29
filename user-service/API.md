# User Service API

Base URL: `http://localhost:3000`

Request bodies use JSON, except image uploads which use multipart/form-data. The service rejects unknown body fields and returns `400 Bad Request` for invalid input.

## Authentication

Successful registration, login, and refresh responses return an access/refresh token pair:

```json
{
  "user": {
    "id": "2f1c2d1e-3c5a-4d6a-8b1c-123456789abc",
    "email": "user@example.com",
    "username": "player1"
  },
  "accessToken": "<JWT>",
  "refreshToken": "<refresh-id>.<refresh-secret>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "refreshExpiresIn": 604800
}
```

- Access tokens are RS256 JWTs and expire after 15 minutes.
- Send access tokens as `Authorization: Bearer <accessToken>`.
- Refresh tokens expire after 7 days and are rotated after every successful refresh.
- The client must replace both stored tokens after refresh.
- Logout revokes all refresh tokens in the submitted token's login session. The current access token remains valid until it expires.

## Endpoints

### Register

`POST /auth/register`

Request:

```json
{
  "username": "player1",
  "email": "user@example.com",
  "password": "correct horse battery staple"
}
```

Validation:

- `username`: 3-30 characters
- `email`: valid email address
- `password`: 8-32 characters and no more than 72 UTF-8 bytes

Responses:

- `201 Created`: user and token pair
- `400 Bad Request`: invalid body
- `409 Conflict`: email or username is already in use

### Login

`POST /auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "correct horse battery staple"
}
```

Responses:

- `200 OK`: user and token pair
- `400 Bad Request`: invalid body
- `401 Unauthorized`: invalid credentials

### Refresh Tokens

`POST /auth/refresh`

No access token is required. Send the refresh token in the body:

```json
{
  "refreshToken": "2f1c2d1e-3c5a-4d6a-8b1c-123456789abc.<43-character-base64url-secret>"
}
```

A successful request revokes the submitted refresh token, creates a new refresh token, and returns a new token pair.

Responses:

- `200 OK`: new user and token pair
- `400 Bad Request`: malformed body or token
- `401 Unauthorized`: unknown, expired, revoked, or incorrect refresh token

### Logout

`POST /auth/logout`

Send the refresh token that should be revoked:

```json
{
  "refreshToken": "2f1c2d1e-3c5a-4d6a-8b1c-123456789abc.<43-character-base64url-secret>"
}
```

The endpoint returns success without revealing whether the token was already invalid. The client should discard both the access and refresh tokens locally.

Responses:

- `204 No Content`: logout request accepted
- `400 Bad Request`: malformed body or token

### List Users

`GET /accounts?page=1&limit=10`

Public endpoint; no access token required.

Pagination parameters:

- `page`: integer from 1 to 1,000,000; defaults to `1`
- `limit`: integer from 1 to 100; defaults to `10`

Response (`200 OK`):

```json
{
  "users": [
    {
      "id": "2f1c2d1e-3c5a-4d6a-8b1c-123456789abc",
      "username": "player1"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

Invalid query parameters return `400 Bad Request`.

### Current Account

`GET /accounts/me`

Requires an access token:

```http
Authorization: Bearer <accessToken>
```

Response (`200 OK`):

```json
{
  "id": "2f1c2d1e-3c5a-4d6a-8b1c-123456789abc",
  "email": "user@example.com",
  "username": "player1",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "displayName": "Ada",
  "avatarUrl": "/accounts/2f1c2d1e-3c5a-4d6a-8b1c-123456789abc/avatar",
  "bannerUrl": null,
  "status": "OFFLINE",
  "emailVerifiedAt": null,
  "createdAt": "2026-09-29T12:00:00.000Z",
  "updatedAt": "2026-09-29T12:00:00.000Z"
}
```

Other responses:

- `401 Unauthorized`: missing, invalid, or expired access token
- `404 Not Found`: authenticated user no longer exists

### Update Current Account

`PATCH /accounts/me`

Requires an access token. Send only the fields to change; omitted fields remain unchanged. `firstName`, `lastName`, and `displayName` can be cleared with `null`.

Request:

```json
{
  "username": "new-player-name",
  "email": "new@example.com",
  "firstName": "Ada",
  "lastName": null,
  "displayName": "Ada"
}
```

Validation:

- `username`: optional, 3-30 characters
- `email`: optional, valid email address
- `firstName`, `lastName`, `displayName`: optional string or `null`, 1-50 characters when present
- At least one field must be provided.
- Image URLs, password, status, verification fields, and IDs cannot be changed here.

An email update clears `emailVerifiedAt` and requires verification again.

Responses:

- `200 OK`: updated private account
- `400 Bad Request`: invalid, empty, or protected-field body
- `401 Unauthorized`: missing, invalid, or expired access token
- `404 Not Found`: account does not exist
- `409 Conflict`: email or username is already in use

### Delete Current Account

`DELETE /accounts/me`

Requires an access token. Deletes the account and its refresh tokens and linked authentication providers.

Responses:

- `204 No Content`: account deleted
- `401 Unauthorized`: missing, invalid, or expired access token
- `404 Not Found`: account does not exist

### Upload Avatar

`PUT /accounts/me/avatar`

Requires an access token. Use `multipart/form-data` with exactly one file field named `file`.

```bash
curl -X PUT http://localhost:3000/accounts/me/avatar \
  -H "Authorization: Bearer <accessToken>" \
  -F "file=@avatar.png"
```

Accepted input formats are JPEG, PNG, and WebP. Animated images are rejected. Images are auto-oriented, resized to `256x256`, converted to WebP, and stored at no more than 1 MiB and 20 megapixels.

Response (`200 OK`): updated private account.

Other responses:

- `400 Bad Request`: missing, malformed, unsupported, animated, or over-pixel-limit image
- `401 Unauthorized`: missing, invalid, or expired access token
- `404 Not Found`: account does not exist
- `413 Payload Too Large`: upload or processed image exceeds 1 MiB

### Upload Banner

`PUT /accounts/me/banner`

Requires an access token. Use the same multipart format as avatar upload, with a file field named `file`.

Images are resized to `1500x500`, converted to WebP, and stored at no more than 5 MiB and 20 megapixels.

Response (`200 OK`): updated private account.

Other responses are the same as avatar upload, with `413 Payload Too Large` applying to the 5 MiB banner limit.

### Public Avatar Image

`GET /accounts/:id/avatar`

Public endpoint; no access token is required. `:id` must be a UUID.

Returns the stored image bytes with `Content-Type: image/webp`, `Content-Disposition: inline`, `Cache-Control: no-store`, and `X-Content-Type-Options: nosniff`.

Responses:

- `200 OK`: image bytes
- `400 Bad Request`: invalid UUID
- `404 Not Found`: image does not exist

### Public Banner Image

`GET /accounts/:id/banner`

Public endpoint with the same behavior and response headers as the avatar route.

Responses:

- `200 OK`: image bytes
- `400 Bad Request`: invalid UUID
- `404 Not Found`: image does not exist

### User by ID

`GET /accounts/:id`

`:id` must be a UUID.

Public endpoint. Response (`200 OK`): the same public profile fields as each entry in `GET /accounts`: `id`, `username`, `displayName`, `avatarUrl`, `bannerUrl`, `status`, and `createdAt`. Email, first/last names, verification fields, timestamps other than `createdAt`, and authentication data are excluded.

Other responses:

- `400 Bad Request`: invalid UUID
- `404 Not Found`: user does not exist

The former `/auth/users`, `/auth/user/:id`, and `/auth/user/me` routes have been removed. Auth now exposes only register, login, refresh, and logout.

## Example Flow

```bash
# Register or login and save the returned accessToken and refreshToken.
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"correct horse battery staple"}'

# Refresh. Replace both tokens with the pair returned by this request.
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh-id>.<refresh-secret>"}'

# Access a protected endpoint.
curl http://localhost:3000/accounts/me \
  -H "Authorization: Bearer <accessToken>"

# Upload an avatar.
curl -X PUT http://localhost:3000/accounts/me/avatar \
  -H "Authorization: Bearer <accessToken>" \
  -F "file=@avatar.png"

# Logout using the current refresh token.
curl -i -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh-id>.<refresh-secret>"}'
```
