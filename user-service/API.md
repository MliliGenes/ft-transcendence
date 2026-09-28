# User Service API

Base URL: `http://localhost:3000`

All request bodies must be JSON. The service rejects unknown body fields and returns `400 Bad Request` for invalid input.

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
- Logout revokes the submitted refresh token. The current access token remains valid until it expires.

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

`GET /auth/users?page=1&limit=10`

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

### Current User

`GET /auth/user/me`

Requires an access token:

```http
Authorization: Bearer <accessToken>
```

Response (`200 OK`):

```json
{
  "id": "2f1c2d1e-3c5a-4d6a-8b1c-123456789abc",
  "email": "user@example.com",
  "username": "player1"
}
```

Other responses:

- `401 Unauthorized`: missing, invalid, or expired access token
- `404 Not Found`: authenticated user no longer exists

### User by ID

`GET /auth/user/:id`

`:id` must be a UUID.

Response (`200 OK`): same profile shape as `/auth/user/me`.

Other responses:

- `400 Bad Request`: invalid UUID
- `404 Not Found`: user does not exist

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
curl http://localhost:3000/auth/user/me \
  -H "Authorization: Bearer <accessToken>"

# Logout using the current refresh token.
curl -i -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh-id>.<refresh-secret>"}'
```
