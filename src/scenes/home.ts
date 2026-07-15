// ============================================================
// ホーム(きょてん)シーン — ソシャゲ風レイアウト
//   上: 通貨バー(オーブ/ゴールド)
//   中: マスコット + パーティ4枠(タップでステータス)
//   下: アイコンつき大ボタンの 3x3 グリッド
//   すべてタップで操作できる(キーボードも併用可)。
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import type { MonsterInstance } from '../core/types';
import { PARTY_MAX } from '../core/types';
import { getItem } from '../data/items';
import { maxStats } from '../game/monster';
import { saveGame } from '../game/save';
import { consumeItem, healParty } from '../game/state';
import { monsterLabel, monsterNote } from '../ui/format';
import { drawMonster } from '../ui/sprites';
import {
  Button,
  drawGauge,
  drawText,
  drawWindow,
  FONT_SMALL,
  hpColor,
  inRect,
  isPortrait,
  Menu,
  MessageBox,
  view,
  type Rect,
} from '../ui/window';
import { getSpecies } from '../data/monsters';
import { DexScene } from './dex';
import { FarmScene } from './farm';
import { GachaScene } from './gacha';
import { ShopScene } from './shop';
import { StageSelectScene } from './stageSelect';
import { StatusScene } from './status';

type Phase = 'main' | 'party' | 'itemPick' | 'itemTarget' | 'message';

const TILES = [
  { icon: '⚔️', label: 'クエスト', color: '#a8402e' },
  { icon: '🎰', label: 'ガチャ', color: '#7a3ad6' },
  { icon: '💪', label: 'つよさ', color: '#2c6a4f' },
  { icon: '🎒', label: 'どうぐ', color: '#7a5a26' },
  { icon: '🐾', label: 'ぼくじょう', color: '#3f6a2c' },
  { icon: '🛒', label: 'ショップ', color: '#2c4a80' },
  { icon: '💖', label: 'かいふく', color: '#a83a6a' },
  { icon: '📖', label: 'ずかん', color: '#44506a' },
  { icon: '💾', label: 'セーブ', color: '#555568' },
] as const;

const GRID_COLS = 3;

export class HomeScene implements Scene {
  private phase: Phase = 'main';
  private cursor = 0; // グリッドのキーボードカーソル
  private tiles = TILES.map(() => new Button());
  private partySlots: Rect[] = [];
  private partyMenu = new Menu([]);
  private itemMenu = new Menu([]);
  private targetMenu = new Menu([]);
  private messages = new MessageBox();
  private selectedItemId: string | null = null;
  private overlayRect: Rect | null = null;
  private time = 0;

  constructor(private app: App) {}

  onEnter(): void {
    this.app.input.flush();
    this.phase = 'main';
  }

  update(dt: number): void {
    this.time += dt;
    this.messages.update(dt);
    const tap = this.app.input.takeTap();
    const key = this.app.input.poll();
    if (!tap && !key) return;
    const state = requireState(this.app);

    switch (this.phase) {
      case 'main': {
        if (tap) {
          // パーティ枠タップ → ステータス
          for (let i = 0; i < this.partySlots.length; i++) {
            const m = state.party[i];
            if (m && inRect(tap.x, tap.y, this.partySlots[i]!)) {
              this.app.scenes.push(new StatusScene(this.app, m));
              return;
            }
          }
          for (let i = 0; i < this.tiles.length; i++) {
            if (this.tiles[i]!.contains(tap.x, tap.y)) {
              this.cursor = i;
              this.activateTile(i);
              return;
            }
          }
          return;
        }
        if (!key) return;
        if (key === 'left') this.cursor = (this.cursor + TILES.length - 1) % TILES.length;
        else if (key === 'right') this.cursor = (this.cursor + 1) % TILES.length;
        else if (key === 'up') this.cursor = (this.cursor + TILES.length - GRID_COLS) % TILES.length;
        else if (key === 'down') this.cursor = (this.cursor + GRID_COLS) % TILES.length;
        else if (key === 'confirm') this.activateTile(this.cursor);
        break;
      }
      case 'party': {
        if (tap) {
          const idx = this.partyMenu.itemAt(tap.x, tap.y);
          if (idx !== null) {
            this.partyMenu.setCursor(idx);
            this.openStatus(idx);
          } else if (this.tapOutsideOverlay(tap.x, tap.y)) {
            this.phase = 'main';
          }
          return;
        }
        const r = this.partyMenu.handleKey(key!);
        if (r === 'cancel') this.phase = 'main';
        else if (r === 'select') this.openStatus(this.partyMenu.cursor);
        break;
      }
      case 'itemPick': {
        if (tap) {
          const idx = this.itemMenu.itemAt(tap.x, tap.y);
          if (idx !== null) {
            this.itemMenu.setCursor(idx);
            this.pickItem(idx);
          } else if (this.tapOutsideOverlay(tap.x, tap.y)) {
            this.phase = 'main';
          }
          return;
        }
        const r = this.itemMenu.handleKey(key!);
        if (r === 'cancel') this.phase = 'main';
        else if (r === 'select') this.pickItem(this.itemMenu.cursor);
        break;
      }
      case 'itemTarget': {
        if (tap) {
          const idx = this.targetMenu.itemAt(tap.x, tap.y);
          if (idx !== null) {
            this.targetMenu.setCursor(idx);
            this.applyItem(idx);
          } else if (this.tapOutsideOverlay(tap.x, tap.y)) {
            this.phase = 'itemPick';
          }
          return;
        }
        const r = this.targetMenu.handleKey(key!);
        if (r === 'cancel') this.phase = 'itemPick';
        else if (r === 'select') this.applyItem(this.targetMenu.cursor);
        break;
      }
      case 'message': {
        if (tap || key === 'confirm' || key === 'cancel') {
          if (this.messages.advance()) this.phase = 'main';
        }
        break;
      }
    }
  }

  private tapOutsideOverlay(px: number, py: number): boolean {
    return this.overlayRect !== null && !inRect(px, py, this.overlayRect);
  }

  private activateTile(i: number): void {
    const state = requireState(this.app);
    switch (i) {
      case 0:
        this.app.scenes.push(new StageSelectScene(this.app));
        break;
      case 1:
        this.app.scenes.push(new GachaScene(this.app));
        break;
      case 2:
        this.buildPartyMenu();
        this.phase = 'party';
        break;
      case 3:
        this.buildItemMenu();
        this.phase = 'itemPick';
        break;
      case 4:
        this.app.scenes.push(new FarmScene(this.app));
        break;
      case 5:
        this.app.scenes.push(new ShopScene(this.app));
        break;
      case 6:
        healParty(state);
        this.messages.setPages(['モンスターたちは すっかり げんきに なった!']);
        this.phase = 'message';
        break;
      case 7:
        this.app.scenes.push(new DexScene(this.app));
        break;
      case 8: {
        const ok = saveGame(state);
        this.messages.setPages([ok ? 'ぼうけんの きろくを のこした!' : 'セーブに しっぱいした…。']);
        this.phase = 'message';
        break;
      }
    }
  }

  private openStatus(index: number): void {
    const state = requireState(this.app);
    const m = state.party[index];
    if (m) this.app.scenes.push(new StatusScene(this.app, m));
  }

  private pickItem(index: number): void {
    const ids = this.itemIds();
    const itemId = ids[index];
    if (!itemId) return;
    const item = getItem(itemId);
    this.selectedItemId = itemId;
    this.buildTargetMenu(item.effect.kind === 'revive');
    this.phase = 'itemTarget';
  }

  private applyItem(index: number): void {
    const state = requireState(this.app);
    const target = state.party[index];
    if (!target || !this.selectedItemId) return;
    if (this.targetMenu.items[index]?.disabled) return;
    this.useItem(this.selectedItemId, target);
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
    }
    this.messages.setPages([text]);
    this.phase = 'message';
    this.buildItemMenu();
  }

  // ==================== 描画 ====================

  draw(ctx: CanvasRenderingContext2D): void {
    const grad = ctx.createLinearGradient(0, 0, 0, view.h);
    grad.addColorStop(0, '#101a2e');
    grad.addColorStop(1, '#24304a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, view.h);
    const state = requireState(this.app);
    const p = isPortrait();

    // ---- 上部バー: タイトル + 通貨 ----
    drawWindow(ctx, 10, 10, view.w - 20, 52);
    drawText(ctx, 'きょてん', 30, 24, { color: '#ffd94a', font: FONT_SMALL });
    drawText(ctx, `💎 ${state.orbs}`, view.w - (p ? 150 : 200), 24, { align: 'right', color: '#8fd4ff', font: FONT_SMALL });
    drawText(ctx, `🪙 ${state.gold} G`, view.w - 28, 24, { align: 'right', color: '#ffd94a', font: FONT_SMALL });

    if (p) {
      this.drawMascot(ctx, view.w / 2 - 72, 96, 9);
      this.drawPartyRow(ctx, 12, 356, view.w - 24);
      this.drawGrid(ctx, 14, view.h - 3 * 94 - 2 * 10 - 14, view.w - 28, 94);
    } else {
      this.drawMascot(ctx, 170, 150, 10);
      this.drawPartyRow(ctx, 24, 460, 560);
      this.drawGrid(ctx, 620, 90, view.w - 620 - 16, 92);
    }

    // ---- オーバーレイ(モーダル風) ----
    this.overlayRect = null;
    const mw = Math.min(440, view.w - 24);
    const mx = (view.w - mw) / 2;
    const my = p ? 150 : 100;
    if (this.phase === 'party') {
      this.dimBackground(ctx);
      const h = this.partyMenu.draw(ctx, mx, my, mw, 'なかま (タップで つよさ)');
      this.overlayRect = { x: mx, y: my, w: mw, h };
    }
    if (this.phase === 'itemPick' || this.phase === 'itemTarget') {
      this.dimBackground(ctx);
      const h = this.itemMenu.draw(ctx, mx, my, mw, 'どうぐ');
      this.overlayRect = { x: mx, y: my, w: mw, h };
    }
    if (this.phase === 'itemTarget') {
      const ty = my + 60;
      const h = this.targetMenu.draw(ctx, mx + 14, ty, mw - 28, 'だれに つかう?');
      this.overlayRect = { x: mx + 14, y: ty, w: mw - 28, h };
    }
    if (this.phase === 'message') {
      const m = p ? 12 : 60;
      this.messages.draw(ctx, m, view.h - 150, view.w - m * 2, 130);
    }
  }

  private dimBackground(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, view.w, view.h);
  }

  private drawMascot(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
    const state = requireState(this.app);
    const lead = state.party[0];
    if (!lead) return;
    const sp = getSpecies(lead.speciesId);
    const bounce = Math.sin(this.time * 3) * 5;
    // 足元の影
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 8 * scale, y + 16.5 * scale, 7 * scale, 1.6 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawMonster(ctx, sp.family, sp.palette, x, y + bounce, scale);
  }

  /** パーティ4枠。空き枠は点線。タップでステータスへ */
  private drawPartyRow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    const state = requireState(this.app);
    const gap = 8;
    const slotW = Math.floor((w - gap * (PARTY_MAX - 1)) / PARTY_MAX);
    const slotH = 108;
    this.partySlots = [];
    for (let i = 0; i < PARTY_MAX; i++) {
      const sx = x + i * (slotW + gap);
      const rect: Rect = { x: sx, y, w: slotW, h: slotH };
      this.partySlots.push(rect);
      const m = state.party[i];
      ctx.save();
      ctx.fillStyle = m ? 'rgba(8,8,24,0.8)' : 'rgba(8,8,24,0.4)';
      ctx.strokeStyle = m ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      if (!m) ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.roundRect(sx, y, slotW, slotH, 10);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      if (!m) {
        drawText(ctx, '—', sx + slotW / 2, y + slotH / 2 - 12, { align: 'center', color: '#555577' });
        continue;
      }
      const sp = getSpecies(m.speciesId);
      const bounce = Math.sin(this.time * 3 + i) * 2;
      drawMonster(ctx, sp.family, sp.palette, sx + slotW / 2 - 24, y + 8 + bounce, 3);
      const ms = maxStats(m);
      drawText(ctx, `Lv${m.level}`, sx + slotW / 2, y + 60, { align: 'center', font: FONT_SMALL, color: '#ccccee' });
      drawGauge(ctx, sx + 8, y + 86, slotW - 16, 7, ms.hp === 0 ? 0 : m.hp / ms.hp, hpColor(m.hp / ms.hp));
    }
  }

  /** 3x3 のアイコンボタングリッド */
  private drawGrid(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, tileH: number): void {
    const gap = 10;
    const tileW = Math.floor((w - gap * (GRID_COLS - 1)) / GRID_COLS);
    for (let i = 0; i < TILES.length; i++) {
      const t = TILES[i]!;
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const bx = x + col * (tileW + gap);
      const by = y + row * (tileH + gap);
      this.tiles[i]!.draw(ctx, bx, by, tileW, tileH, t.label, {
        icon: t.icon,
        color: t.color,
        selected: this.phase === 'main' && i === this.cursor,
      });
    }
  }
}
