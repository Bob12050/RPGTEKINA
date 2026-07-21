import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';

/** Draw a Font Awesome icon definition onto the game canvas. */
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  icon: IconDefinition,
  x: number,
  y: number,
  size: number,
  color = '#ffffff',
  alpha = 1,
): void {
  const [sourceWidth, sourceHeight, , , pathData] = icon.icon;
  const scale = size / Math.max(sourceWidth, sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const paths = Array.isArray(pathData) ? pathData : [pathData];

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + (size - drawWidth) / 2, y + (size - drawHeight) / 2);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  for (const path of paths) ctx.fill(new Path2D(path));
  ctx.restore();
}
