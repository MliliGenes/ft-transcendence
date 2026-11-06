export declare const ATTACHMENT_CONTENT_TYPES: readonly ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
export declare class CreateAttachmentUploadUrlDto {
    contentType: (typeof ATTACHMENT_CONTENT_TYPES)[number];
}
