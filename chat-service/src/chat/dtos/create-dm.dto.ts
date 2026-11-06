import { IsUUID } from 'class-validator';

export class CreateDmDto {
  @IsUUID()
  userId!: string;
}
