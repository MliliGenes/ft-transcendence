import { IsByteLength, IsString, Length, Matches } from 'class-validator';
import { AUTH_TOKEN_PATTERN } from '../auth.service.js';

export class ConfirmPasswordResetDto {
  @IsString({ message: 'Reset token is required and must be a text value.' })
  @Matches(AUTH_TOKEN_PATTERN, {
    message:
      'Reset token must contain its record ID and secret, separated by a dot.',
  })
  token: string;

  @IsString({ message: 'Password is required and must be a text value.' })
  @Length(8, 32, {
    message: 'Password must be between 8 and 32 characters long.',
  })
  @IsByteLength(0, 72, {
    message:
      'Password must not exceed 72 UTF-8 bytes. Emojis and some other characters use multiple bytes; try a shorter password.',
  })
  newPassword: string;
}
