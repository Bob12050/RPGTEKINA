import type { Rect } from './window';

export function createImageAsset(url: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  return image;
}

export function imageReady(image: HTMLImageElement | null): image is HTMLImageElement {
  return image !== null && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
}

/** Draw an image using object-fit: cover semantics. */
export function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rect: Rect,
  focusX = 0.5,
  focusY = 0.5,
): void {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const rectRatio = rect.w / rect.h;
  let sourceX = 0;
  let sourceY = 0;
  let sourceW = image.naturalWidth;
  let sourceH = image.naturalHeight;

  if (imageRatio > rectRatio) {
    sourceW = image.naturalHeight * rectRatio;
    sourceX = (image.naturalWidth - sourceW) * Math.max(0, Math.min(1, focusX));
  } else {
    sourceH = image.naturalWidth / rectRatio;
    sourceY = (image.naturalHeight - sourceH) * Math.max(0, Math.min(1, focusY));
  }

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Draw an image using object-fit: contain semantics. */
export function drawContainImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, rect: Rect): void {
  const scale = Math.min(rect.w / image.naturalWidth, rect.h / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, rect.x + (rect.w - width) / 2, rect.y + (rect.h - height) / 2, width, height);
  ctx.restore();
}
