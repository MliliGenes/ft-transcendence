import { IsString, Matches } from 'class-validator';

// UUID record ID followed by the 43-character base64url secret.
export const REFRESH_TOKEN_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

export class RefreshDto {
  @IsString({ message: 'Refresh token is required and must be a text value.' })
  @Matches(REFRESH_TOKEN_PATTERN, {
    message:
      'Refresh token must contain its record ID and secret, separated by a dot.',
  })
  refreshToken: string;
}
