import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { drawIcon } from './icon';
import { drawText, isPortrait, view, type Rect } from './window';

const UI_FONT = '"Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Yu Gothic", sans-serif';

export function premiumBackRect(): Rect {
  return isPortrait()
    ? { x: 14, y: 14, w: 60, h: 44 }
    : { x: 14, y: 14, w: 64, h: 50 };
}

export function drawPremiumSceneHeader(ctx: CanvasRenderingContext2D, title: string): void {
  const p = isPortrait();
  const backRect = premiumBackRect();

  ctx.save();
  ctx.shadowColor = 'rgba(255,194,55,0.42)';
  ctx.shadowBlur = 8;
  plaquePath(ctx, backRect, 0);
  const fill = ctx.createLinearGradient(0, backRect.y, 0, backRect.y + backRect.h);
  fill.addColorStop(0, '#4d3618');
  fill.addColorStop(1, '#151329');
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#f2c95d';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  plaquePath(ctx, backRect, 5);
  ctx.strokeStyle = 'rgba(255,239,157,0.72)';
  ctx.lineWidth = 1;
  ctx.stroke();
  drawIcon(ctx, faArrowLeft, backRect.x + 16, backRect.y + (p ? 10 : 13), 26, '#ffe277');
  ctx.restore();

  const titleY = p ? 16 : 18;
  drawText(ctx, title, view.w / 2, titleY, {
    align: 'center',
    color: '#ffe28a',
    font: `bold ${p ? 27 : 29}px ${UI_FONT}`,
    shadow: true,
  });

  ctx.save();
  ctx.strokeStyle = 'rgba(239,194,78,0.78)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(view.w / 2 - 146, p ? 39 : 43);
  ctx.lineTo(view.w / 2 - 74, p ? 39 : 43);
  ctx.moveTo(view.w / 2 + 74, p ? 39 : 43);
  ctx.lineTo(view.w / 2 + 146, p ? 39 : 43);
  ctx.stroke();
  ctx.restore();
}

function plaquePath(ctx: CanvasRenderingContext2D, rect: Rect, inset: number): void {
  const x = rect.x + inset;
  const y = rect.y + inset;
  const w = rect.w - inset * 2;
  const h = rect.h - inset * 2;
  const cut = Math.min(12, h * 0.28);
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
}
