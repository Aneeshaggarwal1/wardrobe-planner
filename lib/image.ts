/**
 * Resize a photo in the browser before upload: keeps uploads small and fast on
 * mobile data, and strips EXIF (including location) since the canvas only
 * carries pixels. Honours the camera's rotation.
 */
export async function resizeToJpeg(file: Blob, maxEdge: number, quality = 0.8): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This browser can't read that image format. Try a JPEG or PNG.");
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process the image");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process the image"))), "image/jpeg", quality),
  );
}

/** Run `task` over `inputs` with at most `limit` in flight. */
export async function mapLimit<T>(inputs: readonly T[], limit: number, task: (input: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < inputs.length) {
      const index = next++;
      await task(inputs[index] as T, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, inputs.length) }, worker));
}

/** A blob as a data: URL (used to keep thumbnails inside the saved wardrobe). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the image"));
    reader.readAsDataURL(blob);
  });
}

/** A blob as bare base64 (no data: prefix), for sending to the tagging endpoint. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const url = await blobToDataUrl(blob);
  return url.slice(url.indexOf(",") + 1);
}
