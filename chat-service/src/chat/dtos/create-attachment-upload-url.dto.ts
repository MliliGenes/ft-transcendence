import { IsIn, IsString } from 'class-validator';

export const ATTACHMENT_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;

export class CreateAttachmentUploadUrlDto {
  @IsString()
  @IsIn(ATTACHMENT_CONTENT_TYPES)
  contentType!: (typeof ATTACHMENT_CONTENT_TYPES)[number];
}
