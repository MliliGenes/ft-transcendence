import { IsByteLength, IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail(
    {},
    { message: 'Enter a valid email address, such as name@example.com.' },
  )
  email: string;

  @IsString({ message: 'Password is required and must be a text value.' })
  @IsByteLength(1, 72, {
    message: 'Password is required and must not exceed 72 UTF-8 bytes.',
  })
  password: string;
}
