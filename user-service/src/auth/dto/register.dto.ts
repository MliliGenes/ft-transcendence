import { IsByteLength, IsEmail, IsString, Length } from 'class-validator';

export class RegisterDto {
  @IsString({ message: 'Username is required and must be a text value.' })
  @Length(3, 30, {
    message: 'Username must be between 3 and 30 characters long.',
  })
  username: string;

  @IsEmail(
    {},
    {
      message: 'Enter a valid email address, such as name@example.com.',
    },
  )
  email: string;

  @IsString({ message: 'Password is required and must be a text value.' })
  @Length(8, 32, {
    message: 'Password must be between 8 and 32 characters long.',
  })
  @IsByteLength(0, 72, {
    message:
      'Password must not exceed 72 UTF-8 bytes. Emojis and some other characters use multiple bytes; try a shorter password.',
  })
  password: string;
}
