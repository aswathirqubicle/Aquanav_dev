/**
 * Downscale and re-encode photos in the browser before they are uploaded.
 *
 * Photo groups previously sent whatever the camera or screenshot tool
 * produced — 4 MB PNGs were common — and those same bytes were then served
 * back to paint 128px thumbnails. Shrinking on the client cuts the upload
 * over site Wi-Fi as well as the stored size, so it happens here rather than
 * on the server.
 *
 * Every failure path returns the original File. Compression is an
 * optimisation; it must never be the reason an upload does not happen.
 */

// Phone cameras shoot 3000-4000px wide. Nothing in the app shows a photo
// larger than a full-screen preview, so 2000px on the long edge is already
// more than any view consumes.
const MAX_EDGE = 2000;

// The usual knee of the JPEG quality curve: hard to distinguish from the
// original by eye, a fraction of the bytes of an equivalent PNG.
const JPEG_QUALITY = 0.82;

// Below this, re-encoding costs CPU and regularly produces a *larger* file.
const MIN_SIZE_TO_COMPRESS = 300 * 1024;

// GIF is excluded deliberately: re-encoding one through a canvas keeps only
// the first frame and silently destroys an animation.
const COMPRESSIBLE_TYPES = ["image/jpeg", "image/png"];

/**
 * Decode via HTMLImageElement rather than createImageBitmap.
 *
 * Current browsers treat `image-orientation: from-image` as the default, so
 * an <img> reports EXIF-corrected naturalWidth/naturalHeight and draws
 * upright onto a canvas. createImageBitmap needs an explicit
 * `imageOrientation: "from-image"` that older Safari ignores without
 * erroring, which would upload sideways photos on those browsers.
 */
const decodeImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not decode ${file.name}`));
    };
    image.src = url;
  });

const toJpegBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", JPEG_QUALITY);
  });

const withJpegExtension = (name: string) =>
  `${name.replace(/\.[^./\\]+$/, "")}.jpg`;

/**
 * Returns a downscaled JPEG copy of `file`, or `file` itself when
 * compressing it would not help or did not work.
 */
export async function compressImage(file: File): Promise<File> {
  if (!COMPRESSIBLE_TYPES.includes(file.type)) return file;
  if (file.size < MIN_SIZE_TO_COMPRESS) return file;

  try {
    const image = await decodeImage(file);
    const { naturalWidth: width, naturalHeight: height } = image;
    if (!width || !height) return file;

    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));

    // An already-small JPEG has nothing left to gain, and re-encoding it only
    // adds generation loss. A PNG is still worth converting at any size.
    if (scale === 1 && file.type === "image/jpeg") return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const context = canvas.getContext("2d");
    if (!context) return file;

    // JPEG has no alpha channel: without this, transparent regions of a PNG
    // screenshot come out black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await toJpegBlob(canvas);
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], withJpegExtension(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    // Decoding can fail on a corrupt file, or run out of memory on a very
    // large one on mobile. Upload the original and let the server decide.
    return file;
  }
}

/** Compresses each file in turn, keeping the given order. */
export async function compressImages(files: File[]): Promise<File[]> {
  const compressed: File[] = [];
  // Sequential on purpose: decoding several multi-megapixel images at once is
  // what pushes a phone browser into an out-of-memory kill.
  for (const file of files) {
    compressed.push(await compressImage(file));
  }
  return compressed;
}
