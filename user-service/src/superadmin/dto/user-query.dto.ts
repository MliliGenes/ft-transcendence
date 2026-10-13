import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../accounts/dto/pagination.dto.js';
import { UserRole } from '../../generated/prisma/client.js';

export class UserQueryDto extends PaginationDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsDateString({ strict: true })
  createdFrom?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  createdTo?: string;

  @IsIn(['createdAt', 'updatedAt', 'username', 'email', 'role'])
  sortBy: 'createdAt' | 'updatedAt' | 'username' | 'email' | 'role' =
    'createdAt';

  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
