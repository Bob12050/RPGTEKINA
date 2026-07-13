// ============================================================
// ぼくじょう(パーティ⇔牧場の入れ替え)
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import { FARM_MAX, PARTY_MAX } from '../core/types';
import { monsterLabel, monsterNote } from '../ui/format';
import { drawText, drawWindow, FONT_SMALL, Menu, MessageBox, view, isPortrait } from '../ui/window';
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
          } else if (state.party.filter((p) => p !== m).every((p) => p.hp <= 0)) {
            this.messages.setPages(['たたかえる なかまが いなくなっちゃうよ!']);
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
    ctx.fillRect(0, 0, view.w, view.h);
    const state = requireState(this.app);
    const p = isPortrait();
    // 縦持ちはリストを上下に積む(表示数も絞る)
    this.partyMenu.visibleCount = p ? 3 : 10;
    this.farmMenu.visibleCount = p ? 5 : 10;

    drawWindow(ctx, p ? 12 : 40, p ? 12 : 20, view.w - (p ? 24 : 80), 52);
    drawText(ctx, p ? 'ぼくじょう (←→:切替 B:もどる)' : 'ぼくじょう  (←→でリスト切替 / Xでもどる)', view.w / 2, p ? 26 : 34, {
      align: 'center',
      font: p ? FONT_SMALL : undefined,
    });

    const partyLabelY = p ? 78 : 96;
    const partyListY = p ? 100 : 120;
    drawText(
      ctx,
      this.side === 'party' ? '▼ パーティ' : `パーティ (${state.party.length}/${PARTY_MAX})`,
      p ? 24 : 70,
      partyLabelY,
      { color: this.side === 'party' ? '#ffd94a' : '#ffffff', font: FONT_SMALL },
    );
    this.partyMenu.draw(ctx, p ? 12 : 40, partyListY, p ? view.w - 24 : 420);

    const farmLabelY = p ? 262 : 96;
    const farmListY = p ? 284 : 120;
    drawText(
      ctx,
      this.side === 'farm' ? '▼ ぼくじょう' : `ぼくじょう (${state.farm.length}/${FARM_MAX})`,
      p ? 24 : 530,
      farmLabelY,
      { color: this.side === 'farm' ? '#ffd94a' : '#ffffff', font: FONT_SMALL },
    );
    this.farmMenu.draw(ctx, p ? 12 : 500, farmListY, p ? view.w - 24 : 420);

    if (this.choosing) {
      this.actionMenu.draw(ctx, view.w / 2 - 130, view.h - (p ? 250 : 220), 260);
    }
    if (this.showingMessage) {
      const m = p ? 20 : 160;
      this.messages.draw(ctx, m, view.h - 130, view.w - m * 2, 90);
    }
  }
}
