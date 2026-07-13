// ============================================================
// DQ風ウィンドウ・テキスト・メニューの描画部品
// ============================================================
import type { GameKey } from '../core/input';

/**
 * 現在の画面(キャンバス内部)サイズ。
 * 横持ち: 960x624 / 縦持ち: 480x800 に main.ts が切り替える。
 * シーンは毎フレーム view.w / view.h を参照してレイアウトする。
 */
export const view = { w: 960, h: 624 };

export const LANDSCAPE_W = 960;
export const LANDSCAPE_H = 624;
export const PORTRAIT_W = 480;
export const PORTRAIT_H = 800;

export function isPortrait(): boolean {
  return view.h > view.w;
}

export const FONT = '20px "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Yu Gothic", sans-serif';
export const FONT_SMALL = '16px "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Yu Gothic", sans-serif';
export const FONT_BIG = 'bold 34px "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Yu Gothic", sans-serif';

/** 黒地+白二重枠の DQ風ウィンドウ */
export function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(8, 8, 24, 0.92)';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  roundRect(ctx, x + 3, y + 3, w - 6, h - 6, 6);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  roundRect(ctx, x + 7, y + 7, w - 14, h - 14, 4);
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: { color?: string; font?: string; align?: CanvasTextAlign } = {},
): void {
  ctx.save();
  ctx.font = options.font ?? FONT;
  ctx.fillStyle = options.color ?? '#ffffff';
  ctx.textAlign = options.align ?? 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** テキストをウィンドウ幅で折り返す */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font = FONT): string[] {
  ctx.save();
  ctx.font = font;
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    if (ch === '\n') {
      lines.push(line);
      line = '';
      continue;
    }
    if (ctx.measureText(line + ch).width > maxWidth) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line.length > 0) lines.push(line);
  ctx.restore();
  return lines;
}

/** HP/MPゲージ */
export function drawGauge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  color: string,
): void {
  ctx.save();
  ctx.fillStyle = '#333344';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, ratio)) * w, h);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}

export function hpColor(ratio: number): string {
  if (ratio <= 0.25) return '#f05a3d';
  if (ratio <= 0.5) return '#f0c23d';
  return '#5ecf5e';
}

// ---- メニューウィジェット ----
export interface MenuItem {
  label: string;
  disabled?: boolean;
  /** 右寄せで表示する補足(価格・個数など) */
  note?: string;
}

export class Menu {
  items: MenuItem[];
  cursor = 0;
  scroll = 0;
  visibleCount: number;

  constructor(items: MenuItem[], visibleCount = 8) {
    this.items = items;
    this.visibleCount = visibleCount;
  }

  get selected(): MenuItem | undefined {
    return this.items[this.cursor];
  }

  setItems(items: MenuItem[]): void {
    this.items = items;
    this.cursor = Math.min(this.cursor, Math.max(0, items.length - 1));
    this.fixScroll();
  }

  /** カーソルとスクロールを先頭に戻す(リストを作り直したときに使う) */
  reset(): void {
    this.cursor = 0;
    this.scroll = 0;
  }

  /** カーソルを指定位置へ移動し、スクロールも追従させる */
  setCursor(index: number): void {
    this.cursor = Math.max(0, Math.min(index, this.items.length - 1));
    this.fixScroll();
  }

  /** 戻り値: 'select' | 'cancel' | null */
  handleKey(key: GameKey): 'select' | 'cancel' | null {
    if (this.items.length === 0) {
      if (key === 'cancel') return 'cancel';
      return null;
    }
    switch (key) {
      case 'up':
        this.cursor = (this.cursor - 1 + this.items.length) % this.items.length;
        this.fixScroll();
        return null;
      case 'down':
        this.cursor = (this.cursor + 1) % this.items.length;
        this.fixScroll();
        return null;
      case 'confirm':
        return this.selected?.disabled ? null : 'select';
      case 'cancel':
        return 'cancel';
      default:
        return null;
    }
  }

  private fixScroll(): void {
    if (this.cursor < this.scroll) this.scroll = this.cursor;
    if (this.cursor >= this.scroll + this.visibleCount) this.scroll = this.cursor - this.visibleCount + 1;
  }

  /** ウィンドウ込みで描画する。高さを返す */
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, title?: string): number {
    const lineH = 30;
    const pad = 18;
    const titleH = title ? 30 : 0;
    const count = Math.min(this.items.length, this.visibleCount);
    const h = pad * 2 + titleH + Math.max(count, 1) * lineH;
    drawWindow(ctx, x, y, w, h);
    if (title) drawText(ctx, title, x + pad + 8, y + pad - 4, { color: '#ffd94a' });
    const end = Math.min(this.items.length, this.scroll + this.visibleCount);
    for (let i = this.scroll; i < end; i++) {
      const item = this.items[i]!;
      const ly = y + pad + titleH + (i - this.scroll) * lineH;
      const color = item.disabled ? '#777788' : '#ffffff';
      if (i === this.cursor) drawText(ctx, '▶', x + pad, ly, { color: '#ffd94a' });
      drawText(ctx, item.label, x + pad + 28, ly, { color });
      if (item.note) drawText(ctx, item.note, x + w - pad, ly, { color, align: 'right' });
    }
    // スクロールインジケータ
    if (this.scroll > 0) drawText(ctx, '▲', x + w - 26, y + 8, { font: FONT_SMALL });
    if (end < this.items.length) drawText(ctx, '▼', x + w - 26, y + h - 26, { font: FONT_SMALL });
    return h;
  }
}

// ---- メッセージボックス(タイプライター式) ----
export class MessageBox {
  private pages: string[] = [];
  private pageIndex = 0;
  private shown = 0; // 表示済み文字数
  private speed = 80; // 文字/秒
  done = true;

  setPages(pages: string[]): void {
    this.pages = pages.filter((p) => p.length > 0);
    this.pageIndex = 0;
    this.shown = 0;
    this.done = this.pages.length === 0;
  }

  get currentPageComplete(): boolean {
    const page = this.pages[this.pageIndex];
    return page !== undefined && this.shown >= page.length;
  }

  update(dt: number): void {
    if (this.done) return;
    this.shown += this.speed * dt;
  }

  /** 決定キー: ページ送り。戻り値 true = 全ページ表示し終えた */
  advance(): boolean {
    if (this.done) return true;
    const page = this.pages[this.pageIndex]!;
    if (this.shown < page.length) {
      this.shown = page.length; // 表示を即完了
      return false;
    }
    this.pageIndex += 1;
    this.shown = 0;
    if (this.pageIndex >= this.pages.length) {
      this.done = true;
      return true;
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    if (this.done) return; // 全ページ表示し終えたら何も描かない
    drawWindow(ctx, x, y, w, h);
    const page = this.pages[Math.min(this.pageIndex, this.pages.length - 1)];
    if (!page) return;
    const visible = page.slice(0, Math.floor(this.shown));
    const lines = wrapText(ctx, visible, w - 60);
    lines.forEach((line, i) => drawText(ctx, line, x + 26, y + 22 + i * 30));
    // ページ送りの ▼ 点滅
    if (this.currentPageComplete && !this.done && (Date.now() % 800) < 500) {
      drawText(ctx, '▼', x + w / 2, y + h - 26, { align: 'center' });
    }
  }
}
