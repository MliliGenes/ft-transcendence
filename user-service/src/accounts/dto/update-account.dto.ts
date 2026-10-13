import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';

export class UpdateAccountDto {
  // Omitted fields stay unchanged. Username and email cannot be null.
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString({ message: 'Username must be a text value.' })
  @Length(3, 30, {
    message: 'Username must be between 3 and 30 characters long.',
  })
  username?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEmail(
    {},
    { message: 'Enter a valid email address, such as name@example.com.' },
  )
  email?: string;

  // Nullable profile fields can be cleared by sending null.
  @IsOptional()
  @IsString({ message: 'First name must be a text value.' })
  @Length(1, 50, {
    message: 'First name must be between 1 and 50 characters long.',
  })
  firstName?: string | null;

  @IsOptional()
  @IsString({ message: 'Last name must be a text value.' })
  @Length(1, 50, {
    message: 'Last name must be between 1 and 50 characters long.',
  })
  lastName?: string | null;

  @IsOptional()
  @IsString({ message: 'Display name must be a text value.' })
  @Length(1, 50, {
    message: 'Display name must be between 1 and 50 characters long.',
  })
  displayName?: string | null;
}
