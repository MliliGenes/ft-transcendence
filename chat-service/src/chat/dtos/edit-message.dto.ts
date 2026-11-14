import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class EditMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 2000)
  content!: string;
}
