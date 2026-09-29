import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class PaginationDto {
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
