import { IsEmail } from 'class-validator';

export class RequestEmailVerificationDto {
  @IsEmail({}, {
    message: 'Enter a valid email address, such as name@example.com.',
  })
  email: string;
}
