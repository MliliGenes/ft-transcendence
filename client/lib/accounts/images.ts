import type { ImageKind } from "./client";

export const imageSettings = {
  avatar: { width: 256, height: 256, maxBytes: 1024 * 1024 },
  banner: { width: 1500, height: 500, maxBytes: 5 * 1024 * 1024 },
};

export function validateImageBytes(bytes: Uint8Array) {
  const text = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  const png = bytes.length >= 24 && text(1, 3) === "PNG" && bytes[0] === 137 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10;
  const webp = bytes.length >= 12 && text(0, 4) === "RIFF" && text(8, 4) === "WEBP";
  const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!png && !webp && !jpeg) throw new Error("Choose a valid JPEG, PNG, or WebP image.");
  // Reject animation before canvas can flatten it into a still image.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (png || webp) {
    for (let offset = png ? 8 : 12; offset + 8 <= bytes.length;) {
      const size = view.getUint32(offset + (png ? 0 : 4), !png);
      const kind = text(offset + (png ? 4 : 0), 4);
      if (kind === "acTL" || kind === "ANIM" || kind === "ANMF" || (kind === "VP8X" && size > 0 && offset + 8 < bytes.length && (bytes[offset + 8] & 2))) {
        throw new Error("Animated images aren't supported. Choose a still image.");
      }
      offset += png ? size + 12 : size + 8 + (size % 2);
    }
  }
}

async function loadImage(src: string) {
  const image = new Image();
  image.src = src;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 20_000_000) {
    throw new Error("Choose an image of at most 20 megapixels.");
  }
  return image;
}

export async function prepareImage(file: File, kind: ImageKind) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPEG, PNG, or WebP image.");
  if (file.size > imageSettings[kind].maxBytes) throw new Error(`Choose an image no larger than ${kind === "avatar" ? "1" : "5"} MiB.`);
  validateImageBytes(new Uint8Array(await file.arrayBuffer()));
  const src = URL.createObjectURL(file);
  try {
    await loadImage(src);
    return src;
  } catch (error) {
    URL.revokeObjectURL(src);
    throw error;
  }
}

export async function cropImage(src: string, area: { x: number; y: number; width: number; height: number }, kind: ImageKind) {
  const image = await loadImage(src);
  const settings = imageSettings[kind];
  const canvas = document.createElement("canvas");
  canvas.width = settings.width;
  canvas.height = settings.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image editing isn't available in this browser.");
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("Unable to resize this image.")), "image/webp", 0.85));
  if (blob.size > settings.maxBytes) throw new Error("The resized image is too large. Choose another image.");
  return new File([blob], `${kind}.webp`, { type: blob.type });
}
