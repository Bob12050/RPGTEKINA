import type { Family, SpeciesDef } from '../core/types';
import { createImageAsset, drawCoverImage, imageReady } from './media';
import { drawMonster } from './sprites';
import type { Rect } from './window';

const FAMILY_ATLAS_A = createImageAsset(new URL('../assets/gacha/family-atlas-a.webp', import.meta.url).href);
const FAMILY_ATLAS_B = createImageAsset(new URL('../assets/gacha/family-atlas-b.webp', import.meta.url).href);
const RABBIT_PORTRAIT = createImageAsset(new URL('../assets/monster/rabbit-portrait.webp', import.meta.url).href);

const FAMILY_PORTRAITS: Record<Family, { image: HTMLImageElement | null; column: 0 | 1; row: 0 | 1 }> = {
  slime: { image: FAMILY_ATLAS_A, column: 0, row: 0 },
  dragon: { image: FAMILY_ATLAS_A, column: 1, row: 0 },
  beast: { image: FAMILY_ATLAS_A, column: 0, row: 1 },
  nature: { image: FAMILY_ATLAS_A, column: 1, row: 1 },
  demon: { image: FAMILY_ATLAS_B, column: 0, row: 0 },
  zombie: { image: FAMILY_ATLAS_B, column: 1, row: 0 },
  material: { image: FAMILY_ATLAS_B, column: 0, row: 1 },
  mystic: { image: FAMILY_ATLAS_B, column: 1, row: 1 },
};

/** ガチャと同じ高精細ファミリー肖像を、カード枠へ切り出して描く。 */
export function drawFamilyPortrait(
  ctx: CanvasRenderingContext2D,
  family: Family,
  rect: Rect,
  alpha = 1,
): boolean {
  const portrait = FAMILY_PORTRAITS[family];
  if (!imageReady(portrait.image)) return false;

  const gutter = portrait.image.naturalWidth * 0.046;
  const cellW = (portrait.image.naturalWidth - gutter) / 2;
  const cellH = (portrait.image.naturalHeight - gutter) / 2;
  const sourceX = portrait.column * (cellW + gutter);
  const sourceY = portrait.row * (cellH + gutter);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(portrait.image, sourceX, sourceY, cellW, cellH, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  return true;
}

/**
 * 管理画面用の種族固有肖像。
 * 専用絵がない種族で別種族のファミリー絵を流用せず、呼び出し側の
 * パレット対応スプライトへ安全にフォールバックできるよう false を返す。
 */
export function drawSpeciesPortrait(
  ctx: CanvasRenderingContext2D,
  species: SpeciesDef,
  rect: Rect,
  alpha = 1,
): boolean {
  if (species.id === 'rabbit' && imageReady(RABBIT_PORTRAIT)) {
    ctx.save();
    ctx.globalAlpha = alpha;
    drawCoverImage(ctx, RABBIT_PORTRAIT, rect, 0.5, 0.48);
    ctx.restore();
    return true;
  }
  // 現在のアトラス絵と種族シルエットが一致する代表種のみを利用する。
  if (species.id === 'puni') return drawFamilyPortrait(ctx, species.family, rect, alpha);
  if (species.id === 'wolf') return drawFamilyPortrait(ctx, species.family, rect, alpha);
  return false;
}

/** 高精細アートが共通でも個体を見分けられる、種族固有のピクセル紋章。 */
export function drawSpeciesBadge(ctx: CanvasRenderingContext2D, species: SpeciesDef, rect: Rect): void {
  ctx.save();
  rounded(ctx, rect.x, rect.y, rect.w, rect.h, Math.min(9, rect.w * 0.24));
  ctx.fillStyle = 'rgba(4,9,27,0.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(234,205,116,0.8)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const scale = Math.max(1, Math.floor((Math.min(rect.w, rect.h) - 6) / 16));
  const size = 16 * scale;
  drawMonster(
    ctx,
    species.family,
    species.palette,
    rect.x + (rect.w - size) / 2,
    rect.y + (rect.h - size) / 2,
    scale,
  );
  ctx.restore();
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}
