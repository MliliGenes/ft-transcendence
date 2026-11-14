import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const ACCOUNT_SORT_FIELDS = [
  'username',
  'displayName',
  'createdAt',
] as const;
export const JOINED_WITHIN_VALUES = ['7d', '30d', '365d'] as const;

export type AccountSortField = (typeof ACCOUNT_SORT_FIELDS)[number];
export type JoinedWithin = (typeof JOINED_WITHIN_VALUES)[number];

// Query strings only carry text, so map "true"/"false" to booleans and keep
// anything else as-is for the validator to reject.
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class AccountSearchDto {
  // Optional: an empty term browses every member with the same filters.
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100, { message: 'Search query must not exceed 100 characters.' })
  username?: string;

  @IsOptional()
  @IsIn(ACCOUNT_SORT_FIELDS, {
    message: 'Sort must be username, displayName, or createdAt.',
  })
  sortBy: AccountSortField = 'username';

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'Order must be asc or desc.' })
  sortOrder: 'asc' | 'desc' = 'asc';

  @IsOptional()
  @IsIn(JOINED_WITHIN_VALUES, {
    message: 'Joined filter must be 7d, 30d, or 365d.',
  })
  joinedWithin?: JoinedWithin;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'hasStatus must be true or false.' })
  hasStatus?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'hasBio must be true or false.' })
  hasBio?: boolean;

  @Type(() => Number)
  @IsInt({ message: 'Page must be a whole number.' })
  @Min(1, { message: 'Page must be at least 1.' })
  @Max(1_000_000, { message: 'Page must not exceed 1000000.' })
  page: number = 1;

  @Type(() => Number)
  @IsInt({ message: 'Limit must be a whole number.' })
  @Min(1, { message: 'Limit must be at least 1.' })
  @Max(100, { message: 'Limit must not exceed 100 users per page.' })
  limit: number = 10;
}
