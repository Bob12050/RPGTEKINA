// ============================================================
// ホーム(きょてん)シーン — 完全ステージ制の中心メニュー
//   ぼうけん(ステージ)へ行くほか、なかま/どうぐ/はいごう/ぼくじょう/
//   ショップ/かいふく/ずかん/セーブ をすべてここから開く。
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import type { MonsterInstance } from '../core/types';
import { getItem } from '../data/items';
import { maxStats } from '../game/monster';
import { saveGame } from '../game/save';
import { consumeItem, healParty } from '../game/state';
import { monsterLabel, monsterNote } from '../ui/format';
import { drawMonster } from '../ui/sprites';
import { drawText, drawWindow, FONT_SMALL, isPortrait, Menu, MessageBox, view } from '../ui/window';
import { getSpecies } from '../data/monsters';
import { DexScene } from './dex';
import { FarmScene } from './farm';
import { ShopScene } from './shop';
import { StageSelectScene } from './stageSelect';
import { StatusScene } from './status';
import { SynthesisScene } from './synthesis';

type Phase = 'main' | 'party' | 'itemPick' | 'itemTarget' | 'message';

const MENU = ['ぼうけんへ', 'つよさ', 'どうぐ', 'はいごう', 'ぼくじょう', 'ショップ', 'かいふく', 'ずかん', 'セーブ'] as const;

export class HomeScene implements Scene {
  private phase: Phase = 'main';
  private mainMenu = new Menu(MENU.map((label) => ({ label })), 9);
  private partyMenu = new Menu([]);
  private itemMenu = new Menu([]);
  private targetMenu = new Menu([]);
  private messages = new MessageBox();
  private selectedItemId: string | null = null;
  private time = 0;

  constructor(private app: App) {}

  onEnter(): void {
    this.app.input.flush();
    this.phase = 'main';
  }

  update(dt: number): void {
    this.time += dt;
    this.messages.update(dt);
    const key = this.app.input.poll();
    if (!key) return;
    const state = requireState(this.app);

    switch (this.phase) {
      case 'main': {
        const r = this.mainMenu.handleKey(key);
        if (r !== 'select') return;
        switch (this.mainMenu.cursor) {
          case 0: // ぼうけんへ
            this.app.scenes.push(new StageSelectScene(this.app));
            break;
          case 1: // つよさ
            this.buildPartyMenu();
            this.phase = 'party';
            break;
          case 2: // どうぐ
            this.buildItemMenu();
            this.phase = 'itemPick';
            break;
          case 3: // はいごう
            this.app.scenes.push(new SynthesisScene(this.app));
            break;
          case 4: // ぼくじょう
            this.app.scenes.push(new FarmScene(this.app));
            break;
          case 5: // ショップ
            this.app.scenes.push(new ShopScene(this.app));
            break;
          case 6: // かいふく
            healParty(state);
            this.messages.setPages(['モンスターたちは すっかり げんきに なった!']);
            this.phase = 'message';
            break;
          case 7: // ずかん
            this.app.scenes.push(new DexScene(this.app));
            break;
          case 8: { // セーブ
            const ok = saveGame(state);
            this.messages.setPages([ok ? 'ぼうけんの きろくを のこした!' : 'セーブに しっぱいした…。']);
            this.phase = 'message';
            break;
          }
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
    // 拠点らしい夜のグラデ背景
    const grad = ctx.createLinearGradient(0, 0, 0, view.h);
    grad.addColorStop(0, '#101a2e');
    grad.addColorStop(1, '#24304a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, view.h);
    const state = requireState(this.app);
    const p = isPortrait();

    // タイトル + 所持金
    drawWindow(ctx, 12, 12, view.w - 24, 52);
    drawText(ctx, 'モンスターマスターの きょてん', p ? 28 : 40, 26, { color: '#ffd94a', font: FONT_SMALL });
    drawText(ctx, `${state.gold} G`, view.w - (p ? 28 : 40), 26, { align: 'right', color: '#ffd94a', font: FONT_SMALL });

    // マスコット(先頭のなかま)
    const lead = state.party[0];
    if (lead) {
      const sp = getSpecies(lead.speciesId);
      const bounce = Math.sin(this.time * 3) * 4;
      const mx = p ? view.w - 120 : view.w - 220;
      const my = p ? view.h - 180 : 200;
      drawMonster(ctx, sp.family, sp.palette, mx, my + bounce, p ? 5 : 8);
    }

    this.mainMenu.draw(ctx, p ? 12 : 24, p ? 76 : 90, p ? 240 : 260, 'メニュー');
    if (this.phase === 'party') this.partyMenu.draw(ctx, p ? 12 : 300, p ? 380 : 90, p ? view.w - 24 : 420, 'なかま');
    if (this.phase === 'itemPick' || this.phase === 'itemTarget')
      this.itemMenu.draw(ctx, p ? 12 : 300, p ? 380 : 90, p ? view.w - 24 : 380, 'どうぐ');
    if (this.phase === 'itemTarget')
      this.targetMenu.draw(ctx, p ? 24 : 340, p ? 470 : 200, p ? view.w - 48 : 420, 'だれに?');
    if (this.phase === 'message') {
      const m = p ? 12 : 60;
      this.messages.draw(ctx, m, view.h - 150, view.w - m * 2, 130);
    }
  }
}
