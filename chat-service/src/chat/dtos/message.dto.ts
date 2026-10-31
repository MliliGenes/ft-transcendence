import { Transform } from 'class-transformer';
import { IsString, IsUUID, Length } from 'class-validator';

export class SendMessageDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 2000)
  content!: string;

  @IsUUID()
  clientRequestId!: string;
}
