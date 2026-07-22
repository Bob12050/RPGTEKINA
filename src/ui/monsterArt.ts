import type { Family, SpeciesDef } from '../core/types';
import { createImageAsset, drawCoverImage, imageReady } from './media';
import { drawMonster } from './sprites';
import type { Rect } from './window';

const FAMILY_ATLAS_A = createImageAsset(new URL('../assets/gacha/family-atlas-a.webp', import.meta.url).href);
const FAMILY_ATLAS_B = createImageAsset(new URL('../assets/gacha/family-atlas-b.webp', import.meta.url).href);
const RABBIT_PORTRAIT = createImageAsset(new URL('../assets/monster/rabbit-portrait.webp', import.meta.url).href);
const PUNI_COMBAT = createImageAsset(new URL('../assets/battle/puni-combat-v1.webp', import.meta.url).href);
const RABBIT_COMBAT = createImageAsset(new URL('../assets/battle/rabbit-combat-v1.webp', import.meta.url).href);
const MANDRA_COMBAT = createImageAsset(new URL('../assets/battle/mandra-combat-v1.webp', import.meta.url).href);
const GHOST_COMBAT = createImageAsset(new URL('../assets/battle/ghost-combat-v1.webp', import.meta.url).href);
const GOBLIN_COMBAT = createImageAsset(new URL('../assets/battle/goblin-combat-v1.webp', import.meta.url).href);

interface BattleSpeciesArtDef {
  image: HTMLImageElement | null;
  /** 地面から浮く種族だけ、戦場の枠高に対する割合で持ち上げる。 */
  groundLift?: number;
}

const BATTLE_SPECIES_ART: Partial<Record<string, BattleSpeciesArtDef>> = {
  puni: { image: PUNI_COMBAT },
  rabbit: { image: RABBIT_COMBAT },
  mandra: { image: MANDRA_COMBAT },
  ghost: { image: GHOST_COMBAT, groundLift: 0.08 },
  goblin: { image: GOBLIN_COMBAT },
};

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
  if (drawBattleSpeciesArt(ctx, species, rect, alpha)) return true;
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

/** 専用の透過立ち絵が用意されている種族か。読込前でもレイアウト判定に使える。 */
export function supportsBattleSpeciesArt(speciesId: string): boolean {
  return Object.prototype.hasOwnProperty.call(BATTLE_SPECIES_ART, speciesId);
}

/** 戦場とHUDで共用する、種族固有の高精細な透過立ち絵。 */
export function drawBattleSpeciesArt(
  ctx: CanvasRenderingContext2D,
  species: SpeciesDef,
  rect: Rect,
  alpha = 1,
  flipX = false,
  alignY: 'center' | 'bottom' = 'center',
): boolean {
  const art = BATTLE_SPECIES_ART[species.id];
  const image = art?.image ?? null;
  if (!imageReady(image)) return false;

  ctx.save();
  ctx.globalAlpha = alpha;
  if (flipX) {
    const centerX = rect.x + rect.w / 2;
    ctx.translate(centerX, 0);
    ctx.scale(-1, 1);
    ctx.translate(-centerX, 0);
  }
  const scale = Math.min(rect.w / image.naturalWidth, rect.h / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const drawX = rect.x + (rect.w - width) / 2;
  const groundLift = alignY === 'bottom' ? rect.h * (art?.groundLift ?? 0) : 0;
  const drawY = alignY === 'bottom'
    ? rect.y + rect.h - height - groundLift
    : rect.y + (rect.h - height) / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, drawX, drawY, width, height);
  ctx.restore();
  return true;
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
