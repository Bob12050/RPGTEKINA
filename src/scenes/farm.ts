// ============================================================
// ぼくじょう(パーティ⇔牧場の入れ替え)
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import { FARM_MAX, PARTY_MAX } from '../core/types';
import { monsterLabel, monsterNote } from '../ui/format';
import { drawText, drawWindow, FONT_SMALL, Menu, MessageBox, SCREEN_H, SCREEN_W } from '../ui/window';
import { StatusScene } from './menu';

type Side = 'party' | 'farm';

export class FarmScene implements Scene {
  private side: Side = 'party';
  private partyMenu = new Menu([], 10);
  private farmMenu = new Menu([], 10);
  private actionMenu = new Menu([]);
  private choosing = false;
  private messages = new MessageBox();
  private showingMessage = false;

  constructor(private app: App) {
    this.rebuild();
  }

  onEnter(): void {
    this.app.input.flush();
    this.rebuild();
  }

  private rebuild(): void {
    const state = requireState(this.app);
    this.partyMenu.setItems(
      state.party.length > 0
        ? state.party.map((m) => ({ label: monsterLabel(m), note: monsterNote(m) }))
        : [{ label: '(いない)', disabled: true }],
    );
    this.farmMenu.setItems(
      state.farm.length > 0
        ? state.farm.map((m) => ({ label: monsterLabel(m), note: monsterNote(m) }))
        : [{ label: '(いない)', disabled: true }],
    );
  }

  private activeMenu(): Menu {
    return this.side === 'party' ? this.partyMenu : this.farmMenu;
  }

  update(dt: number): void {
    this.messages.update(dt);
    const key = this.app.input.poll();
    if (!key) return;
    const state = requireState(this.app);

    if (this.showingMessage) {
      if (key === 'confirm' || key === 'cancel') {
        if (this.messages.advance()) this.showingMessage = false;
      }
      return;
    }

    if (this.choosing) {
      const r = this.actionMenu.handleKey(key);
      if (r === 'cancel') {
        this.choosing = false;
        return;
      }
      if (r !== 'select') return;
      const list = this.side === 'party' ? state.party : state.farm;
      const m = list[this.activeMenu().cursor];
      if (!m) {
        this.choosing = false;
        return;
      }
      if (this.actionMenu.cursor === 0) {
        // 移動
        if (this.side === 'party') {
          if (state.party.length <= 1) {
            this.messages.setPages(['さいごの ひとりは はなせないよ!']);
            this.showingMessage = true;
          } else if (state.farm.length >= FARM_MAX) {
            this.messages.setPages(['ぼくじょうが いっぱいだ!']);
            this.showingMessage = true;
          } else {
            state.party.splice(state.party.indexOf(m), 1);
            state.farm.push(m);
          }
        } else {
          if (state.party.length >= PARTY_MAX) {
            this.messages.setPages(['パーティは 3たいまでだよ!']);
            this.showingMessage = true;
          } else {
            state.farm.splice(state.farm.indexOf(m), 1);
            state.party.push(m);
          }
        }
        this.rebuild();
        this.choosing = false;
      } else if (this.actionMenu.cursor === 1) {
        this.app.scenes.push(new StatusScene(this.app, m));
        this.choosing = false;
      } else {
        this.choosing = false;
      }
      return;
    }

    // リスト操作
    if (key === 'left' || key === 'right') {
      this.side = this.side === 'party' ? 'farm' : 'party';
      return;
    }
    const r = this.activeMenu().handleKey(key);
    if (r === 'cancel') {
      this.app.scenes.pop();
      return;
    }
    if (r !== 'select') return;
    const list = this.side === 'party' ? state.party : state.farm;
    if (list.length === 0) return;
    this.actionMenu.setItems([
      { label: this.side === 'party' ? 'ぼくじょうへ' : 'パーティへ' },
      { label: 'つよさをみる' },
      { label: 'もどる' },
    ]);
    this.actionMenu.cursor = 0;
    this.choosing = true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const state = requireState(this.app);

    drawWindow(ctx, 40, 20, SCREEN_W - 80, 56);
    drawText(ctx, `ぼくじょう  (←→でリスト切替 / Xでもどる)`, SCREEN_W / 2, 36, { align: 'center' });

    drawText(ctx, this.side === 'party' ? '▼ パーティ' : `パーティ (${state.party.length}/${PARTY_MAX})`, 70, 96, {
      color: this.side === 'party' ? '#ffd94a' : '#ffffff',
      font: FONT_SMALL,
    });
    this.partyMenu.draw(ctx, 40, 120, 420);

    drawText(ctx, this.side === 'farm' ? '▼ ぼくじょう' : `ぼくじょう (${state.farm.length}/${FARM_MAX})`, 530, 96, {
      color: this.side === 'farm' ? '#ffd94a' : '#ffffff',
      font: FONT_SMALL,
    });
    this.farmMenu.draw(ctx, 500, 120, 420);

    if (this.choosing) {
      this.actionMenu.draw(ctx, SCREEN_W / 2 - 130, SCREEN_H - 220, 260);
    }
    if (this.showingMessage) this.messages.draw(ctx, 160, SCREEN_H - 130, SCREEN_W - 320, 90);
  }
}
