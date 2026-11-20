/**
 * Shrinks an image in the browser before it is uploaded. Vercel turns away
 * request bodies over 4.5 MB before the upload route even runs, and a photo
 * straight off a phone is often bigger than that.
 */

/** The upload route's own limit, kept under Vercel's. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const MAX_SIDE = 2000;
const QUALITY = 0.85;

/**
 * JPEG, PNG and WebP come back with the longest side at most 2000 px and
 * re-encoded; anything else, GIF included, comes back as it was. Redrawing a
 * GIF would keep only its first frame.
 */
export async function compressImage(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;

  let image: HTMLImageElement;
  try {
    image = await loadImage(file);
  } catch {
    // The size check after this still stops a file that is too big.
    return file;
  }

  const { naturalWidth, naturalHeight } = image;
  const size = fitWithin(naturalWidth, naturalHeight, MAX_SIDE);
  const resized = size.width !== naturalWidth || size.height !== naturalHeight;
  if (!resized && file.size <= MAX_UPLOAD_BYTES) return file;

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, size.width, size.height);

  // JPEG has no transparency, so only what was JPEG is written as JPEG. A
  // browser that cannot write WebP hands back a PNG, which keeps it too.
  const type = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, QUALITY)
  );
  if (!blob || (!resized && blob.size >= file.size)) return file;

  return new File([blob], renamed(file.name, blob.type), {
    type: blob.type,
    lastModified: file.lastModified,
  });
}

function fitWithin(
  width: number,
  height: number,
  maxSide: number
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  return image
    .decode()
    .then(() => image)
    .finally(() => URL.revokeObjectURL(url));
}

/** The upload route takes the extension from the name, so it has to match. */
function renamed(name: string, type: string): string {
  const extension = type === "image/jpeg" ? "jpg" : type.split("/")[1] || "img";
  const base = name.replace(/\.[^./]+$/, "") || "bilde";
  return `${base}.${extension}`;
}
