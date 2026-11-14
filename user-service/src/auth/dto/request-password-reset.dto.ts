import { IsEmail } from 'class-validator';

export class RequestPasswordResetDto {
  @IsEmail(
    {},
    {
      message: 'Enter a valid email address, such as name@example.com.',
    },
  )
  email: string;
}
