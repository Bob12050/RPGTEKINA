// ============================================================
// ぼくじょう(パーティ⇔牧場の入れ替え)— タップ対応
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import { FARM_MAX, PARTY_MAX } from '../core/types';
import { monsterLabel, monsterNote } from '../ui/format';
import { BackButton, drawText, drawWindow, FONT_SMALL, Menu, MessageBox, view, isPortrait } from '../ui/window';
import { StatusScene } from './status';

type Side = 'party' | 'farm';

export class FarmScene implements Scene {
  private side: Side = 'party';
  private partyMenu = new Menu([], 10);
  private farmMenu = new Menu([], 10);
  private actionMenu = new Menu([]);
  private backButton = new BackButton();
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

  /** 選んだモンスターの行動メニューを開く */
  private openActions(): void {
    const state = requireState(this.app);
    const list = this.side === 'party' ? state.party : state.farm;
    if (list.length === 0) return;
    this.actionMenu.setItems([
      { label: this.side === 'party' ? 'ぼくじょうへ' : 'パーティへ' },
      { label: 'つよさをみる' },
      { label: 'もどる' },
    ]);
    this.actionMenu.reset();
    this.choosing = true;
  }

  /** 行動メニューの実行 */
  private doAction(index: number): void {
    const state = requireState(this.app);
    const list = this.side === 'party' ? state.party : state.farm;
    const m = list[this.activeMenu().cursor];
    if (!m) {
      this.choosing = false;
      return;
    }
    if (index === 0) {
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
          this.messages.setPages([`パーティは ${PARTY_MAX}たいまでだよ!`]);
          this.showingMessage = true;
        } else {
          state.farm.splice(state.farm.indexOf(m), 1);
          state.party.push(m);
        }
      }
      this.rebuild();
      this.choosing = false;
    } else if (index === 1) {
      this.app.scenes.push(new StatusScene(this.app, m));
      this.choosing = false;
    } else {
      this.choosing = false;
    }
  }

  update(dt: number): void {
    this.messages.update(dt);
    const tap = this.app.input.takeTap();
    const key = this.app.input.poll();
    if (!tap && !key) return;
    const state = requireState(this.app);
    void state;

    if (this.showingMessage) {
      if (tap || key === 'confirm' || key === 'cancel') {
        if (this.messages.advance()) this.showingMessage = false;
      }
      return;
    }

    if (this.choosing) {
      if (tap) {
        const idx = this.actionMenu.itemAt(tap.x, tap.y);
        if (idx !== null) this.doAction(idx);
        else this.choosing = false; // メニュー外タップで閉じる
        return;
      }
      const r = this.actionMenu.handleKey(key!);
      if (r === 'cancel') this.choosing = false;
      else if (r === 'select') this.doAction(this.actionMenu.cursor);
      return;
    }

    if (tap) {
      if (this.backButton.contains(tap.x, tap.y)) {
        this.app.scenes.pop();
        return;
      }
      const pi = this.partyMenu.itemAt(tap.x, tap.y);
      if (pi !== null) {
        this.side = 'party';
        this.partyMenu.setCursor(pi);
        this.openActions();
        return;
      }
      const fi = this.farmMenu.itemAt(tap.x, tap.y);
      if (fi !== null) {
        this.side = 'farm';
        this.farmMenu.setCursor(fi);
        this.openActions();
      }
      return;
    }

    // キーボード操作
    if (key === 'left' || key === 'right') {
      this.side = this.side === 'party' ? 'farm' : 'party';
      return;
    }
    const r = this.activeMenu().handleKey(key!);
    if (r === 'cancel') {
      this.app.scenes.pop();
      return;
    }
    if (r === 'select') this.openActions();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, view.w, view.h);
    const state = requireState(this.app);
    const p = isPortrait();
    // 縦持ちはリストを上下に積む(表示数も絞る)
    this.partyMenu.visibleCount = p ? 3 : 8;
    this.farmMenu.visibleCount = p ? 4 : 8;

    drawWindow(ctx, 12, 10, view.w - 24, 52);
    drawText(ctx, 'ぼくじょう', view.w / 2, 24, { align: 'center', font: FONT_SMALL, color: '#ffd94a' });
    this.backButton.draw(ctx);

    const partyLabelY = p ? 76 : 84;
    const partyListY = p ? 100 : 108;
    drawText(ctx, `パーティ (${state.party.length}/${PARTY_MAX})`, p ? 24 : 70, partyLabelY, {
      color: this.side === 'party' ? '#ffd94a' : '#ffffff',
      font: FONT_SMALL,
    });
    this.partyMenu.draw(ctx, p ? 12 : 40, partyListY, p ? view.w - 24 : 420);

    const farmLabelY = p ? 272 : 84;
    const farmListY = p ? 296 : 108;
    drawText(ctx, `ぼくじょう (${state.farm.length}/${FARM_MAX})`, p ? 24 : 530, farmLabelY, {
      color: this.side === 'farm' ? '#ffd94a' : '#ffffff',
      font: FONT_SMALL,
    });
    this.farmMenu.draw(ctx, p ? 12 : 500, farmListY, p ? view.w - 24 : 420);

    if (this.choosing) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, view.w, view.h);
      this.actionMenu.draw(ctx, view.w / 2 - 140, view.h - (p ? 300 : 260), 280, 'どうする?');
    }
    if (this.showingMessage) {
      const m = p ? 20 : 160;
      this.messages.draw(ctx, m, view.h - 130, view.w - m * 2, 110);
    }
  }
}
