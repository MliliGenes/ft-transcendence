import {
  IsEmail,
  IsIn,
  IsString,
  MaxLength,
  IsOptional,
  Length,
  ValidateIf,
} from 'class-validator';

export const STATUS_ICON_NAMES = [
  'IconCode',
  'IconCoffee',
  'IconMoon',
  'IconMusic',
  'IconDeviceGamepad2',
] as const;

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

  @IsOptional()
  @IsString({ message: 'Bio must be a text value.' })
  @MaxLength(190, { message: 'Bio must be at most 190 characters long.' })
  bio?: string | null;

  @IsOptional()
  @IsString({ message: 'Status must be a text value.' })
  @MaxLength(100, { message: 'Status must be at most 100 characters long.' })
  statusText?: string | null;

  @IsOptional()
  @IsString({ message: 'Status icon must be a text value.' })
  @IsIn(STATUS_ICON_NAMES, {
    message: 'Status icon must be an approved Tabler icon name.',
  })
  statusIcon?: string | null;
}
