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

// ---- タップ判定つき部品 ----
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function inRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export interface ButtonOpts {
  /** ベース色(省略時は青系) */
  color?: string;
  /** キーボードカーソルが当たっているときの強調 */
  selected?: boolean;
  disabled?: boolean;
  font?: string;
  /** ラベルの下に出す小さな補足 */
  sub?: string;
  /** ラベルの上に出す絵文字アイコン */
  icon?: string;
}

/** タップできる大きめボタン。draw した位置を覚えて contains で判定する */
export class Button {
  rect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, opts: ButtonOpts = {}): void {
    this.rect = { x, y, w, h };
    ctx.save();
    const base = opts.disabled ? '#31313f' : (opts.color ?? '#2c4a80');
    roundRect(ctx, x, y, w, h, 14);
    ctx.fillStyle = base;
    ctx.fill();
    // 上面のツヤ
    ctx.fillStyle = opts.disabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.13)';
    roundRect(ctx, x + 3, y + 3, w - 6, Math.max(8, h / 2 - 4), 11);
    ctx.fill();
    ctx.lineWidth = opts.selected ? 4 : 2;
    ctx.strokeStyle = opts.selected ? '#ffd94a' : opts.disabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.85)';
    roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 13);
    ctx.stroke();

    const textColor = opts.disabled ? '#8a8a99' : '#ffffff';
    const font = opts.font ?? FONT;
    const cx = x + w / 2;
    if (opts.icon) {
      // アイコン + ラベル(縦積み)
      drawText(ctx, opts.icon, cx, y + h / 2 - 34, { align: 'center', font: '30px sans-serif' });
      drawText(ctx, label, cx, y + h / 2 + 6, { align: 'center', color: textColor, font: opts.font ?? FONT_SMALL });
    } else if (opts.sub) {
      drawText(ctx, label, cx, y + h / 2 - 24, { align: 'center', color: textColor, font });
      drawText(ctx, opts.sub, cx, y + h / 2 + 4, { align: 'center', color: opts.disabled ? '#8a8a99' : '#cfe0ff', font: FONT_SMALL });
    } else {
      drawText(ctx, label, cx, y + h / 2 - 11, { align: 'center', color: textColor, font });
    }
    ctx.restore();
  }

  contains(px: number, py: number): boolean {
    return inRect(px, py, this.rect);
  }
}

/** 画面左上に置く「◀ もどる」ボタン */
export class BackButton {
  private button = new Button();

  draw(ctx: CanvasRenderingContext2D, label = '◀'): void {
    this.button.draw(ctx, 10, 10, 56, 44, label, { color: '#3a3a55', font: FONT_SMALL });
  }

  contains(px: number, py: number): boolean {
    return this.button.contains(px, py);
  }
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
  /** 直近の draw で描いた行のタップ判定領域 */
  private itemRects: { index: number; rect: Rect }[] = [];

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

  /**
   * タップ位置にある行の index を返す(無効行・行間は null)。
   * 直前フレームの draw の配置で判定する。
   */
  itemAt(px: number, py: number): number | null {
    for (const { index, rect } of this.itemRects) {
      if (!inRect(px, py, rect)) continue;
      const item = this.items[index];
      return item && !item.disabled ? index : null;
    }
    return null;
  }

  /** ウィンドウ込みで描画する。高さを返す(行はタップしやすい高さ) */
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, title?: string): number {
    const lineH = 44;
    const pad = 14;
    const titleH = title ? 32 : 0;
    const count = Math.min(this.items.length, this.visibleCount);
    const h = pad * 2 + titleH + Math.max(count, 1) * lineH;
    drawWindow(ctx, x, y, w, h);
    if (title) drawText(ctx, title, x + pad + 8, y + pad - 2, { color: '#ffd94a', font: FONT_SMALL });
    const end = Math.min(this.items.length, this.scroll + this.visibleCount);
    this.itemRects = [];
    for (let i = this.scroll; i < end; i++) {
      const item = this.items[i]!;
      const ly = y + pad + titleH + (i - this.scroll) * lineH;
      const rect: Rect = { x: x + 10, y: ly, w: w - 20, h: lineH - 6 };
      this.itemRects.push({ index: i, rect });
      // タップできる行に見えるよう、行ごとに下地を敷く
      ctx.save();
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
      ctx.fillStyle = item.disabled
        ? 'rgba(255,255,255,0.03)'
        : i === this.cursor
          ? 'rgba(255,217,74,0.18)'
          : 'rgba(255,255,255,0.07)';
      ctx.fill();
      if (i === this.cursor && !item.disabled) {
        ctx.strokeStyle = '#ffd94a';
        ctx.lineWidth = 2;
        roundRect(ctx, rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2, 7);
        ctx.stroke();
      }
      ctx.restore();
      const color = item.disabled ? '#777788' : '#ffffff';
      drawText(ctx, item.label, rect.x + 14, ly + 8, { color });
      if (item.note) drawText(ctx, item.note, rect.x + rect.w - 12, ly + 10, { color, align: 'right', font: FONT_SMALL });
    }
    // スクロールインジケータ
    if (this.scroll > 0) drawText(ctx, '▲', x + w - 26, y + 8, { font: FONT_SMALL });
    if (end < this.items.length) drawText(ctx, '▼', x + w - 26, y + h - 24, { font: FONT_SMALL });
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
