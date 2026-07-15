// ============================================================
// ショップ
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import { getItem, SHOP_ITEMS } from '../data/items';
import { addItem } from '../game/state';
import { BackButton, drawText, drawWindow, FONT_SMALL, Menu, MessageBox, view, isPortrait, wrapText } from '../ui/window';

export class ShopScene implements Scene {
  private menu: Menu;
  private backButton = new BackButton();
  private messages = new MessageBox();
  private showingMessage = false;

  constructor(private app: App) {
    this.menu = new Menu(
      SHOP_ITEMS.map((id) => {
        const item = getItem(id);
        return { label: item.name, note: `${item.price} G` };
      }),
    );
  }

  onEnter(): void {
    this.app.input.flush();
  }

  private buy(index: number): void {
    const state = requireState(this.app);
    const itemId = SHOP_ITEMS[index];
    if (!itemId) return;
    const item = getItem(itemId);
    if (state.gold < item.price) {
      this.messages.setPages(['おかねが たりないよ!']);
    } else {
      state.gold -= item.price;
      addItem(state, itemId);
      this.messages.setPages([`${item.name}を かった! (しょじ ×${state.items[itemId]})`]);
    }
    this.showingMessage = true;
  }

  update(dt: number): void {
    this.messages.update(dt);
    const tap = this.app.input.takeTap();
    const key = this.app.input.poll();
    if (!tap && !key) return;

    if (this.showingMessage) {
      if (tap || key === 'confirm' || key === 'cancel') {
        if (this.messages.advance()) this.showingMessage = false;
      }
      return;
    }

    if (tap) {
      if (this.backButton.contains(tap.x, tap.y)) {
        this.app.scenes.pop();
        return;
      }
      const idx = this.menu.itemAt(tap.x, tap.y);
      if (idx !== null) {
        this.menu.setCursor(idx);
        this.buy(idx);
      }
      return;
    }

    const r = this.menu.handleKey(key!);
    if (r === 'cancel') {
      this.app.scenes.pop();
      return;
    }
    if (r === 'select') this.buy(this.menu.cursor);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, view.w, view.h);
    const state = requireState(this.app);
    const p = isPortrait();

    drawWindow(ctx, p ? 12 : 60, p ? 16 : 40, p ? 170 : 320, 52);
    drawText(ctx, 'どうぐや', p ? 36 : 90, p ? 30 : 54);
    const goldW = p ? 170 : 240;
    drawWindow(ctx, view.w - goldW - (p ? 12 : 60), p ? 16 : 40, goldW, 52);
    drawText(ctx, `${state.gold} G`, view.w - (p ? 36 : 90), p ? 30 : 54, { align: 'right', color: '#ffd94a' });

    this.menu.draw(ctx, p ? 12 : 60, p ? 88 : 120, p ? view.w - 24 : 480, p ? 'しょうひん (A:かう B:やめる)' : 'しょうひん (Zでかう / Xでやめる)');

    // 選択中アイテムの説明
    const itemId = SHOP_ITEMS[this.menu.cursor];
    if (itemId) {
      const descLines = wrapText(ctx, getItem(itemId).desc, view.w - (p ? 80 : 180), FONT_SMALL);
      const m = p ? 12 : 60;
      drawWindow(ctx, m, view.h - 150, view.w - m * 2, 60 + descLines.length * 24);
      descLines.forEach((line, i) => drawText(ctx, line, m + 28, view.h - 124 + i * 24, { font: FONT_SMALL }));
    }
    if (this.showingMessage) {
      const m = p ? 20 : 160;
      this.messages.draw(ctx, m, view.h - 280, view.w - m * 2, 90);
    }
  }
}
