import { IsByteLength, IsNotEmpty, IsString, Length } from 'class-validator';

export class UpdatePasswordDto {
  @IsString({ message: 'Old password must be a text value.' })
  @IsNotEmpty({ message: 'Enter your current password.' })
  @IsByteLength(1, 72, {
    message: 'Old password must not exceed 72 UTF-8 bytes.',
  })
  oldPassword: string;

  @IsString({ message: 'New password must be a text value.' })
  @Length(8, 32, {
    message: 'New password must be between 8 and 32 characters long.',
  })
  @IsByteLength(0, 72, {
    message:
      'New password must not exceed 72 UTF-8 bytes. Emojis and some other characters use multiple bytes.',
  })
  newPassword: string;
}

export class SetPasswordDto {
  @IsString({ message: 'New password must be a text value.' })
  @Length(8, 32, {
    message: 'New password must be between 8 and 32 characters long.',
  })
  @IsByteLength(0, 72, {
    message:
      'New password must not exceed 72 UTF-8 bytes. Emojis and some other characters use multiple bytes.',
  })
  newPassword: string;
}
