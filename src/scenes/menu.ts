// ============================================================
// フィールドメニュー(つよさ・どうぐ・セーブ) と ステータス画面
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import type { MonsterInstance } from '../core/types';
import { STAT_NAMES } from '../core/types';
import { getItem } from '../data/items';
import { getSkill } from '../data/skills';
import { getSpecies } from '../data/monsters';
import { expToNext, maxStats } from '../game/monster';
import { saveGame } from '../game/save';
import { consumeItem } from '../game/state';
import { monsterLabel, monsterNote, speciesInfo } from '../ui/format';
import { drawMonster } from '../ui/sprites';
import { DexScene } from './dex';
import { drawGauge, drawText, drawWindow, FONT_SMALL, hpColor, Menu, MessageBox, view, isPortrait, wrapText } from '../ui/window';

type Phase = 'main' | 'party' | 'itemPick' | 'itemTarget' | 'message';

export class PauseMenuScene implements Scene {
  private phase: Phase = 'main';
  private mainMenu = new Menu([
    { label: 'つよさ' },
    { label: 'どうぐ' },
    { label: 'ずかん' },
    { label: 'セーブ' },
    { label: 'とじる' },
  ]);
  private partyMenu = new Menu([]);
  private itemMenu = new Menu([]);
  private targetMenu = new Menu([]);
  private messages = new MessageBox();
  private selectedItemId: string | null = null;

  constructor(private app: App) {}

  onEnter(): void {
    this.app.input.flush();
  }

  update(dt: number): void {
    this.messages.update(dt);
    const key = this.app.input.poll();
    if (!key) return;
    const state = requireState(this.app);

    switch (this.phase) {
      case 'main': {
        const r = this.mainMenu.handleKey(key);
        if (r === 'cancel') {
          this.app.scenes.pop();
          return;
        }
        if (r !== 'select') return;
        switch (this.mainMenu.cursor) {
          case 0:
            this.buildPartyMenu();
            this.phase = 'party';
            break;
          case 1:
            this.buildItemMenu();
            this.phase = 'itemPick';
            break;
          case 2:
            this.app.scenes.push(new DexScene(this.app));
            break;
          case 3: {
            const ok = saveGame(state);
            this.messages.setPages([ok ? 'ぼうけんの きろくを のこした!' : 'セーブに しっぱいした…。']);
            this.phase = 'message';
            break;
          }
          case 4:
            this.app.scenes.pop();
            break;
        }
        break;
      }
      case 'party': {
        const r = this.partyMenu.handleKey(key);
        if (r === 'cancel') {
          this.phase = 'main';
          return;
        }
        if (r !== 'select') return;
        const m = state.party[this.partyMenu.cursor];
        if (m) this.app.scenes.push(new StatusScene(this.app, m));
        break;
      }
      case 'itemPick': {
        const r = this.itemMenu.handleKey(key);
        if (r === 'cancel') {
          this.phase = 'main';
          return;
        }
        if (r !== 'select') return;
        const ids = this.itemIds();
        const itemId = ids[this.itemMenu.cursor];
        if (!itemId) return;
        const item = getItem(itemId);
        if (item.effect.kind === 'scoutBoost') {
          this.messages.setPages(['それは たたかいの さいちゅうにしか つかえない!']);
          this.phase = 'message';
          return;
        }
        this.selectedItemId = itemId;
        this.buildTargetMenu(item.effect.kind === 'revive');
        this.phase = 'itemTarget';
        break;
      }
      case 'itemTarget': {
        const r = this.targetMenu.handleKey(key);
        if (r === 'cancel') {
          this.phase = 'itemPick';
          return;
        }
        if (r !== 'select') return;
        const target = state.party[this.targetMenu.cursor];
        if (!target || !this.selectedItemId) return;
        this.useItem(this.selectedItemId, target);
        break;
      }
      case 'message': {
        if (key === 'confirm' || key === 'cancel') {
          if (this.messages.advance()) this.phase = 'main';
        }
        break;
      }
    }
  }

  private itemIds(): string[] {
    const state = requireState(this.app);
    return Object.keys(state.items).filter((id) => (state.items[id] ?? 0) > 0);
  }

  private buildPartyMenu(): void {
    const state = requireState(this.app);
    this.partyMenu.setItems(state.party.map((m) => ({ label: monsterLabel(m), note: monsterNote(m) })));
    this.partyMenu.reset();
  }

  private buildItemMenu(): void {
    const state = requireState(this.app);
    const items = this.itemIds().map((id) => ({ label: getItem(id).name, note: `×${state.items[id]}` }));
    this.itemMenu.setItems(items.length > 0 ? items : [{ label: '(なにも もっていない)', disabled: true }]);
    this.itemMenu.reset();
  }

  private buildTargetMenu(deadOnly: boolean): void {
    const state = requireState(this.app);
    this.targetMenu.setItems(
      state.party.map((m) => ({
        label: monsterLabel(m),
        note: monsterNote(m),
        disabled: deadOnly ? m.hp > 0 : m.hp <= 0,
      })),
    );
    this.targetMenu.reset();
  }

  private useItem(itemId: string, target: MonsterInstance): void {
    const state = requireState(this.app);
    const item = getItem(itemId);
    const ms = maxStats(target);
    let text = 'しかし なにも おこらなかった…。';
    switch (item.effect.kind) {
      case 'heal': {
        const healed = Math.min(ms.hp - target.hp, item.effect.power);
        if (healed > 0) {
          consumeItem(state, itemId);
          target.hp += healed;
          text = `${target.nickname}の HPが ${healed}かいふくした!`;
        } else {
          text = `${target.nickname}の HPは まんたんだ!`;
        }
        break;
      }
      case 'mp': {
        const healed = Math.min(ms.mp - target.mp, item.effect.power);
        if (healed > 0) {
          consumeItem(state, itemId);
          target.mp += healed;
          text = `${target.nickname}の MPが ${healed}かいふくした!`;
        } else {
          text = `${target.nickname}の MPは まんたんだ!`;
        }
        break;
      }
      case 'revive': {
        if (target.hp <= 0) {
          consumeItem(state, itemId);
          target.hp = Math.max(1, Math.floor(ms.hp * item.effect.ratio));
          text = `${target.nickname}が いきかえった!`;
        }
        break;
      }
      case 'scoutBoost':
        break;
    }
    this.messages.setPages([text]);
    this.phase = 'message';
    this.buildItemMenu();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, view.w, view.h);
    const state = requireState(this.app);
    const p = isPortrait();

    // 所持金
    const goldW = p ? 180 : 224;
    drawWindow(ctx, view.w - goldW - 12, 12, goldW, 52);
    drawText(ctx, `${state.gold} G`, view.w - 36, 26, { align: 'right', color: '#ffd94a' });

    this.mainMenu.draw(ctx, p ? 12 : 24, p ? 12 : 24, p ? 190 : 220);
    if (this.phase === 'party') this.partyMenu.draw(ctx, p ? 12 : 260, p ? 210 : 24, p ? view.w - 24 : 420, 'なかま');
    if (this.phase === 'itemPick' || this.phase === 'itemTarget')
      this.itemMenu.draw(ctx, p ? 12 : 260, p ? 210 : 24, p ? view.w - 24 : 380, 'どうぐ');
    if (this.phase === 'itemTarget')
      this.targetMenu.draw(ctx, p ? 24 : 300, p ? 330 : 120, p ? view.w - 48 : 420, 'だれに つかう?');
    if (this.phase === 'message') {
      const m = p ? 12 : 60;
      this.messages.draw(ctx, m, view.h - 150, view.w - m * 2, 130);
    }
  }
}

// ============================================================
// ステータス詳細画面
// ============================================================
export class StatusScene implements Scene {
  private time = 0;

  constructor(
    private app: App,
    private monster: MonsterInstance,
  ) {}

  onEnter(): void {
    this.app.input.flush();
  }

  update(dt: number): void {
    this.time += dt;
    const key = this.app.input.poll();
    if (key === 'cancel' || key === 'confirm') this.app.scenes.pop();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, view.w, view.h);
    const m = this.monster;
    const sp = getSpecies(m.speciesId);
    const ms = maxStats(m);
    const bounce = Math.sin(this.time * 3) * 4;

    if (isPortrait()) {
      // 縦持ち: 1カラムで上から順に
      const x = 12;
      const y = 16;
      const w = view.w - 24;
      const h = view.h - 32;
      drawWindow(ctx, x, y, w, h);

      drawText(ctx, monsterLabel(m), x + w / 2, y + 18, { align: 'center' });
      drawMonster(ctx, sp.family, sp.palette, x + w / 2 - 56, y + 52 + bounce, 7);
      drawText(ctx, speciesInfo(m.speciesId), x + w / 2, y + 172, { align: 'center', font: FONT_SMALL, color: '#aaaacc' });

      drawText(ctx, `HP ${m.hp}/${ms.hp}`, x + 28, y + 206, { font: FONT_SMALL });
      drawGauge(ctx, x + 170, y + 210, w - 200, 9, ms.hp === 0 ? 0 : m.hp / ms.hp, hpColor(m.hp / ms.hp));
      drawText(ctx, `MP ${m.mp}/${ms.mp}`, x + 28, y + 232, { font: FONT_SMALL });
      drawGauge(ctx, x + 170, y + 236, w - 200, 9, ms.mp === 0 ? 0 : m.mp / ms.mp, '#4a8ae8');
      drawText(ctx, `つぎのレベルまで あと ${expToNext(m.level) - m.exp}`, x + 28, y + 258, {
        font: FONT_SMALL,
        color: '#aaaacc',
      });

      drawText(ctx, 'ステータス', x + 28, y + 296, { color: '#ffd94a', font: FONT_SMALL });
      const rows: [string, number][] = [
        [STAT_NAMES.atk, ms.atk],
        [STAT_NAMES.def, ms.def],
        [STAT_NAMES.agi, ms.agi],
        [STAT_NAMES.wis, ms.wis],
      ];
      rows.forEach(([label, value], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        drawText(ctx, label, x + 28 + col * 220, y + 326 + row * 30, { font: FONT_SMALL });
        drawText(ctx, String(value), x + 28 + col * 220 + 180, y + 326 + row * 30, { align: 'right', font: FONT_SMALL });
      });
      drawText(ctx, `プラスち +${m.plus}`, x + w - 28, y + 296, { align: 'right', font: FONT_SMALL, color: '#aaaacc' });

      drawText(ctx, 'とくぎ', x + 28, y + 400, { color: '#ffd94a', font: FONT_SMALL });
      if (m.skillIds.length === 0) {
        drawText(ctx, '(なし)', x + 28, y + 428, { font: FONT_SMALL, color: '#aaaacc' });
      }
      m.skillIds.forEach((id, i) => {
        const s = getSkill(id);
        const col = i % 2;
        const row = Math.floor(i / 2);
        drawText(ctx, s.name, x + 28 + col * 220, y + 428 + row * 28, { font: FONT_SMALL });
        drawText(ctx, s.mpCost > 0 ? `MP${s.mpCost}` : '', x + 28 + col * 220 + 180, y + 428 + row * 28, {
          align: 'right',
          font: FONT_SMALL,
          color: '#aaaacc',
        });
      });

      const descLines = wrapText(ctx, sp.desc, w - 56, FONT_SMALL);
      descLines.forEach((line, i) => {
        drawText(ctx, line, x + w / 2, y + h - 30 - (descLines.length - i) * 24, {
          align: 'center',
          font: FONT_SMALL,
          color: '#ccccee',
        });
      });
      return;
    }

    // 横持ち: 3カラム
    const x = 80;
    const y = 40;
    const w = view.w - 160;
    const h = view.h - 80;
    drawWindow(ctx, x, y, w, h);

    // 左: スプライトと基本情報
    drawMonster(ctx, sp.family, sp.palette, x + 60, y + 70 + bounce, 8);
    drawText(ctx, monsterLabel(m), x + 124, y + 24, { align: 'center' });
    drawText(ctx, speciesInfo(m.speciesId), x + 124, y + 220, { align: 'center', font: FONT_SMALL, color: '#aaaacc' });

    // HP/MP ゲージ
    drawText(ctx, `HP ${m.hp}/${ms.hp}`, x + 40, y + 260, { font: FONT_SMALL });
    drawGauge(ctx, x + 40, y + 284, 220, 10, ms.hp === 0 ? 0 : m.hp / ms.hp, hpColor(m.hp / ms.hp));
    drawText(ctx, `MP ${m.mp}/${ms.mp}`, x + 40, y + 304, { font: FONT_SMALL });
    drawGauge(ctx, x + 40, y + 328, 220, 10, ms.mp === 0 ? 0 : m.mp / ms.mp, '#4a8ae8');
    drawText(ctx, `つぎのレベルまで あと ${expToNext(m.level) - m.exp}`, x + 40, y + 352, {
      font: FONT_SMALL,
      color: '#aaaacc',
    });

    // 中央: ステータス
    const sx = x + 320;
    drawText(ctx, 'ステータス', sx, y + 30, { color: '#ffd94a' });
    const rows: [string, number][] = [
      [STAT_NAMES.atk, ms.atk],
      [STAT_NAMES.def, ms.def],
      [STAT_NAMES.agi, ms.agi],
      [STAT_NAMES.wis, ms.wis],
    ];
    rows.forEach(([label, value], i) => {
      drawText(ctx, label, sx, y + 70 + i * 36);
      drawText(ctx, String(value), sx + 200, y + 70 + i * 36, { align: 'right' });
    });
    drawText(ctx, `プラスち +${m.plus}`, sx, y + 70 + 4 * 36, { color: '#aaaacc', font: FONT_SMALL });

    // 右: とくぎ
    const kx = x + 320;
    drawText(ctx, 'とくぎ', kx, y + 260, { color: '#ffd94a' });
    if (m.skillIds.length === 0) {
      drawText(ctx, '(なし)', kx, y + 296, { font: FONT_SMALL, color: '#aaaacc' });
    }
    m.skillIds.forEach((id, i) => {
      const s = getSkill(id);
      drawText(ctx, s.name, kx, y + 296 + i * 28, { font: FONT_SMALL });
      drawText(ctx, s.mpCost > 0 ? `MP${s.mpCost}` : '-', kx + 200, y + 296 + i * 28, { align: 'right', font: FONT_SMALL });
    });

    // 説明
    drawText(ctx, sp.desc, x + w / 2, y + h - 44, { align: 'center', font: FONT_SMALL, color: '#ccccee' });
  }
}
