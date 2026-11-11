import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class GameChallengeDto {
  // Private-room invite code the message announces. The Chat service keeps the
  // link between this code and the conversation so later match events can be
  // announced here.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9]{6}$/)
  roomCode!: string;
}

export class SendMessageDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 2000)
  content!: string;

  @IsUUID()
  clientRequestId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  attachments?: string[];

  @IsOptional()
  @Type(() => GameChallengeDto)
  @ValidateNested()
  gameChallenge?: GameChallengeDto;
}
