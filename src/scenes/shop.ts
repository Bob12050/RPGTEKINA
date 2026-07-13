// ============================================================
// ショップ
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import { getItem, SHOP_ITEMS } from '../data/items';
import { addItem } from '../game/state';
import { drawText, drawWindow, FONT_SMALL, Menu, MessageBox, SCREEN_H, SCREEN_W } from '../ui/window';

export class ShopScene implements Scene {
  private menu: Menu;
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

  update(dt: number): void {
    this.messages.update(dt);
    const key = this.app.input.poll();
    if (!key) return;

    if (this.showingMessage) {
      if (key === 'confirm' || key === 'cancel') {
        if (this.messages.advance()) this.showingMessage = false;
      }
      return;
    }

    const r = this.menu.handleKey(key);
    if (r === 'cancel') {
      this.app.scenes.pop();
      return;
    }
    if (r !== 'select') return;
    const state = requireState(this.app);
    const itemId = SHOP_ITEMS[this.menu.cursor];
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

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const state = requireState(this.app);

    drawWindow(ctx, 60, 40, 320, 56);
    drawText(ctx, 'どうぐや', 90, 56);
    drawWindow(ctx, SCREEN_W - 300, 40, 240, 56);
    drawText(ctx, `${state.gold} G`, SCREEN_W - 90, 56, { align: 'right', color: '#ffd94a' });

    this.menu.draw(ctx, 60, 120, 480, 'しょうひん (Zでかう / Xでやめる)');

    // 選択中アイテムの説明
    const itemId = SHOP_ITEMS[this.menu.cursor];
    if (itemId) {
      drawWindow(ctx, 60, SCREEN_H - 140, SCREEN_W - 120, 80);
      drawText(ctx, getItem(itemId).desc, 90, SCREEN_H - 114, { font: FONT_SMALL });
    }
    if (this.showingMessage) this.messages.draw(ctx, 160, SCREEN_H - 260, SCREEN_W - 320, 90);
  }
}
