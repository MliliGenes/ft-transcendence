import { IsEnum, ValidateIf } from 'class-validator';
import { RegisterDto } from '../../auth/dto/register.dto.js';
import { UserRole } from '../../generated/prisma/client.js';

export class CreateUserDto extends RegisterDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(UserRole)
  role?: UserRole;
}
