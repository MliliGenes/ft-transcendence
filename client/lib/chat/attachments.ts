const MB = 1024 * 1024;
const videoTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const allowedTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  ...videoTypes,
]);

export const MAX_ATTACHMENTS = 5;
export const attachmentAccept = [...allowedTypes].join(',');

export const isVideo = (file: File) => videoTypes.has(file.type);

/** Returns a user-facing error for the first unusable file, or null when all are fine. */
export function validateAttachments(files: File[]): string | null {
  if (files.length > MAX_ATTACHMENTS)
    return `You can attach up to ${MAX_ATTACHMENTS} files per post.`;
  for (const file of files) {
    if (!allowedTypes.has(file.type) || file.size === 0)
      return `${file.name} must be an image, PDF, or MP4/WebM/MOV video.`;
    const limit = isVideo(file) ? 50 * MB : 10 * MB;
    if (file.size > limit)
      return `${file.name} must be under ${limit / MB} MB.`;
  }
  return null;
}
