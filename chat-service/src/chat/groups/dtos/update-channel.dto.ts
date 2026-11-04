import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, MaxLength, ValidateIf } from 'class-validator';

export class UpdateChannelDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 80)
  name?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  topic?: string | null;
}
