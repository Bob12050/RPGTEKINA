// ============================================================
// ショップ
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import { getItem, SHOP_ITEMS } from '../data/items';
import { addItem } from '../game/state';
import { drawPremiumSceneHeader, premiumBackRect } from '../ui/menuChrome';
import { createImageAsset, drawCoverImage, imageReady } from '../ui/media';
import { drawPremiumPanel, drawText, FONT_SMALL, inRect, Menu, MessageBox, view, isPortrait, wrapText } from '../ui/window';

const MENU_BACKGROUND = createImageAsset(new URL('../assets/menu/menu-bg.webp', import.meta.url).href);

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
      8,
      56,
      'premium',
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
      if (inRect(tap.x, tap.y, premiumBackRect())) {
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
    if (imageReady(MENU_BACKGROUND)) {
      drawCoverImage(ctx, MENU_BACKGROUND, { x: 0, y: 0, w: view.w, h: view.h }, 0.5, 0.5);
    } else {
      ctx.fillStyle = '#020616';
      ctx.fillRect(0, 0, view.w, view.h);
    }
    ctx.fillStyle = 'rgba(1,5,18,0.24)';
    ctx.fillRect(0, 0, view.w, view.h);
    const state = requireState(this.app);
    const p = isPortrait();

    drawPremiumSceneHeader(ctx, 'ショップ');
    const goldW = p ? 170 : 240;
    drawPremiumPanel(ctx, view.w - goldW - (p ? 12 : 18), p ? 68 : 12, goldW, 52);
    drawText(ctx, `所持  ${state.gold} G`, view.w - (p ? 36 : 42), p ? 82 : 26, { align: 'right', color: '#ffd94a' });

    this.menu.draw(ctx, p ? 12 : 60, p ? 132 : 88, p ? view.w - 24 : 480, '商品を選ぶ');

    // 選択中アイテムの説明
    const itemId = SHOP_ITEMS[this.menu.cursor];
    if (itemId) {
      const descLines = wrapText(ctx, getItem(itemId).desc, view.w - (p ? 80 : 180), FONT_SMALL);
      const m = p ? 12 : 60;
      drawPremiumPanel(ctx, m, view.h - 150, view.w - m * 2, 60 + descLines.length * 24);
      descLines.forEach((line, i) => drawText(ctx, line, m + 28, view.h - 124 + i * 24, { font: FONT_SMALL }));
    }
    if (this.showingMessage) {
      const m = p ? 20 : 160;
      this.messages.draw(ctx, m, view.h - 280, view.w - m * 2, 90);
    }
  }
}
