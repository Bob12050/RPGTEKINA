// ============================================================
// モンスターボックス — ソシャゲ式のBOX画面
//   上: パーティ4枠 / 下: 手持ちモンスターのカードグリッド(ページ制)
//   モンスターをタップ → いれかえ / つよさをみる
//   (旧「つよさ」「ぼくじょう」を統合した画面)
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import type { MonsterInstance } from '../core/types';
import { FARM_MAX, PARTY_MAX, rankStars } from '../core/types';
import { getSpecies } from '../data/monsters';
import { maxStats } from '../game/monster';
import { partyLuck } from '../game/state';
import { monsterLabel, RANK_COLORS } from '../ui/format';
import { drawFancyBg } from '../ui/bg';
import { drawMonster } from '../ui/sprites';
import {
  BackButton,
  Button,
  drawChip,
  drawGauge,
  drawText,
  FONT_SMALL,
  hpColor,
  inRect,
  isPortrait,
  Menu,
  MessageBox,
  view,
  type Rect,
} from '../ui/window';
import { StatusScene } from './status';

/** 1ページに表示するボックスの枠数 */
const PAGE_SIZE = 16;

export class MonsterBoxScene implements Scene {
  private page = 0;
  /** 選択カーソル: 0〜3=パーティ / 4〜19=ボックス(現在ページ内) */
  private sel = 0;
  private choosing = false;
  private actionMenu = new Menu([]);
  private backButton = new BackButton();
  private prevButton = new Button();
  private nextButton = new Button();
  private partyRects: Rect[] = [];
  private boxRects: Rect[] = [];
  private messages = new MessageBox();
  private showingMessage = false;
  private time = 0;

  constructor(private app: App) {}

  onEnter(): void {
    this.app.input.flush();
  }

  private pageCount(): number {
    const state = requireState(this.app);
    return Math.max(1, Math.ceil(state.farm.length / PAGE_SIZE));
  }

  /** 選択位置のモンスター(いなければ null) */
  private selectedMonster(): MonsterInstance | null {
    const state = requireState(this.app);
    if (this.sel < PARTY_MAX) return state.party[this.sel] ?? null;
    return state.farm[this.page * PAGE_SIZE + (this.sel - PARTY_MAX)] ?? null;
  }

  private openActions(): void {
    const m = this.selectedMonster();
    if (!m) return;
    const inParty = this.sel < PARTY_MAX;
    this.actionMenu.setItems([
      { label: inParty ? 'ボックスへ' : 'パーティに いれる' },
      { label: 'つよさをみる' },
      { label: 'やめる' },
    ]);
    this.actionMenu.reset();
    this.choosing = true;
  }

  private doAction(index: number): void {
    const state = requireState(this.app);
    const m = this.selectedMonster();
    this.choosing = false;
    if (!m) return;
    if (index === 1) {
      this.app.scenes.push(new StatusScene(this.app, m));
      return;
    }
    if (index !== 0) return;

    if (this.sel < PARTY_MAX) {
      // パーティ → ボックス
      if (state.party.length <= 1) {
        this.say('さいごの ひとりは はなせないよ!');
      } else if (state.farm.length >= FARM_MAX) {
        this.say('ボックスが いっぱいだ!');
      } else if (state.party.filter((p) => p !== m).every((p) => p.hp <= 0)) {
        this.say('たたかえる なかまが いなくなっちゃうよ!');
      } else {
        state.party.splice(state.party.indexOf(m), 1);
        state.farm.push(m);
      }
    } else {
      // ボックス → パーティ
      if (state.party.length >= PARTY_MAX) {
        this.say(`パーティは ${PARTY_MAX}たいまでだよ! だれかを ボックスへ もどそう。`);
      } else {
        state.farm.splice(state.farm.indexOf(m), 1);
        state.party.push(m);
      }
    }
  }

  private say(text: string): void {
    this.messages.setPages([text]);
    this.showingMessage = true;
  }

  private clampPage(): void {
    this.page = Math.max(0, Math.min(this.page, this.pageCount() - 1));
  }

  update(dt: number): void {
    this.time += dt;
    this.messages.update(dt);
    const tap = this.app.input.takeTap();
    const key = this.app.input.poll();
    if (!tap && !key) return;
    this.clampPage();

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
      if (this.prevButton.contains(tap.x, tap.y)) {
        this.page = (this.page + this.pageCount() - 1) % this.pageCount();
        return;
      }
      if (this.nextButton.contains(tap.x, tap.y)) {
        this.page = (this.page + 1) % this.pageCount();
        return;
      }
      const state = requireState(this.app);
      for (let i = 0; i < this.partyRects.length; i++) {
        if (state.party[i] && inRect(tap.x, tap.y, this.partyRects[i]!)) {
          this.sel = i;
          this.openActions();
          return;
        }
      }
      for (let i = 0; i < this.boxRects.length; i++) {
        const m = state.farm[this.page * PAGE_SIZE + i];
        if (m && inRect(tap.x, tap.y, this.boxRects[i]!)) {
          this.sel = PARTY_MAX + i;
          this.openActions();
          return;
        }
      }
      return;
    }

    // ---- キーボード操作 ----
    if (key === 'cancel') {
      this.app.scenes.pop();
      return;
    }
    if (key === 'confirm') {
      if (this.selectedMonster()) this.openActions();
      return;
    }
    const state = requireState(this.app);
    const pageItems = Math.min(PAGE_SIZE, state.farm.length - this.page * PAGE_SIZE);
    const total = PARTY_MAX + Math.max(0, pageItems);
    if (key === 'right') {
      if (this.sel === total - 1 && this.pageCount() > 1) {
        this.page = (this.page + 1) % this.pageCount();
        this.sel = PARTY_MAX;
      } else {
        this.sel = (this.sel + 1) % total;
      }
    } else if (key === 'left') {
      if (this.sel === PARTY_MAX && this.pageCount() > 1) {
        this.page = (this.page + this.pageCount() - 1) % this.pageCount();
        this.sel = PARTY_MAX;
      } else {
        this.sel = (this.sel + total - 1) % total;
      }
    } else if (key === 'down') {
      this.sel = Math.min(total - 1, this.sel + 4);
    } else if (key === 'up') {
      this.sel = Math.max(0, this.sel - 4);
    }
  }

  // ==================== 描画 ====================

  draw(ctx: CanvasRenderingContext2D): void {
    drawFancyBg(ctx, 'home', this.time);
    const state = requireState(this.app);
    const p = isPortrait();
    this.clampPage();

    // ヘッダー
    drawText(ctx, 'モンスターボックス', p ? 80 : 90, 22, { color: '#ffd94a', font: FONT_SMALL, shadow: true });
    drawChip(ctx, view.w - 20 - 130, 14, 130, 34, `📦 ${state.farm.length}/${FARM_MAX}`, '#ccccee');
    this.backButton.draw(ctx);

    const luckLabel = `パーティ (${state.party.length}/${PARTY_MAX})  🍀ラック計 ${partyLuck(state)}`;
    if (p) {
      drawText(ctx, luckLabel, 16, 66, { font: FONT_SMALL, color: '#8fd4ff' });
      this.drawPartyRow(ctx, 12, 90, view.w - 24, 116);
      drawText(ctx, 'ボックス', 16, 218, { font: FONT_SMALL, color: '#8fd4ff' });
      this.drawBoxGrid(ctx, 12, 242, view.w - 24, 4, 4, 98);
      this.drawPager(ctx, 12, 662, view.w - 24);
      drawText(ctx, 'モンスターを タップして いれかえ / つよさ', view.w / 2, view.h - 46, {
        align: 'center',
        font: FONT_SMALL,
        color: '#aaaacc',
      });
    } else {
      drawText(ctx, luckLabel, 26, 66, { font: FONT_SMALL, color: '#8fd4ff' });
      this.drawPartyRow(ctx, 24, 90, 520, 112);
      drawText(ctx, 'ボックス', 26, 216, { font: FONT_SMALL, color: '#8fd4ff' });
      this.drawBoxGrid(ctx, 24, 240, view.w - 48, 8, 2, 100);
      this.drawPager(ctx, 24, 456, view.w - 48);
      drawText(ctx, 'モンスターを タップして いれかえ / つよさ', view.w / 2, view.h - 46, {
        align: 'center',
        font: FONT_SMALL,
        color: '#aaaacc',
      });
    }

    if (this.choosing) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, view.w, view.h);
      const m = this.selectedMonster();
      if (m) {
        drawText(ctx, monsterLabel(m), view.w / 2, view.h / 2 - 150, { align: 'center', color: '#ffd94a', shadow: true });
      }
      this.actionMenu.draw(ctx, view.w / 2 - 150, view.h / 2 - 110, 300, 'どうする?');
    }
    if (this.showingMessage) {
      const m = p ? 16 : 160;
      this.messages.draw(ctx, m, view.h - 140, view.w - m * 2, 120);
    }
  }

  /** パーティ4枠(ランク色ふち+HPゲージ) */
  private drawPartyRow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const state = requireState(this.app);
    const gap = 8;
    const slotW = Math.floor((w - gap * (PARTY_MAX - 1)) / PARTY_MAX);
    this.partyRects = [];
    for (let i = 0; i < PARTY_MAX; i++) {
      const sx = x + i * (slotW + gap);
      const rect: Rect = { x: sx, y, w: slotW, h };
      this.partyRects.push(rect);
      this.drawMonsterCard(ctx, rect, state.party[i] ?? null, this.sel === i && !this.choosing, true);
    }
  }

  /** ボックスのカードグリッド(現在ページぶん) */
  private drawBoxGrid(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, cols: number, rows: number, cellH: number): void {
    const state = requireState(this.app);
    const gap = 8;
    const cellW = Math.floor((w - gap * (cols - 1)) / cols);
    this.boxRects = [];
    for (let i = 0; i < cols * rows && i < PAGE_SIZE; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const rect: Rect = { x: x + col * (cellW + gap), y: y + row * (cellH + gap), w: cellW, h: cellH };
      this.boxRects.push(rect);
      const m = state.farm[this.page * PAGE_SIZE + i] ?? null;
      this.drawMonsterCard(ctx, rect, m, this.sel === PARTY_MAX + i && !this.choosing, false);
    }
  }

  /** モンスターカード1枚(空きは点線) */
  private drawMonsterCard(ctx: CanvasRenderingContext2D, rect: Rect, m: MonsterInstance | null, selected: boolean, showHp: boolean): void {
    const { x, y, w, h } = rect;
    ctx.save();
    if (!m) {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 10);
      ctx.stroke();
      ctx.restore();
      return;
    }
    const sp = getSpecies(m.speciesId);
    // 背景 + ランク色のふち
    ctx.fillStyle = 'rgba(10,12,26,0.85)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = selected ? '#ffd94a' : RANK_COLORS[sp.rank];
    ctx.lineWidth = selected ? 3 : 2;
    ctx.globalAlpha = selected ? 1 : 0.85;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, w - 2, h - 2, 9);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    const bounce = selected ? Math.sin(this.time * 4) * 2 : 0;
    drawMonster(ctx, sp.family, sp.palette, x + w / 2 - 24, y + 6 + bounce, 3);
    // ラック(右上)
    drawText(ctx, `🍀${m.luck ?? 1}`, x + w - 6, y + 5, { align: 'right', font: FONT_SMALL, color: '#8fe89a' });
    drawText(ctx, `Lv${m.level}`, x + 8, y + h - 24, { font: FONT_SMALL, color: '#ccccee' });
    drawText(ctx, `★${rankStars(sp.rank)}`, x + w - 8, y + h - 24, { align: 'right', font: FONT_SMALL, color: RANK_COLORS[sp.rank] });
    if (showHp) {
      const ms = maxStats(m);
      drawGauge(ctx, x + 8, y + h - 34, w - 16, 7, ms.hp === 0 ? 0 : m.hp / ms.hp, hpColor(m.hp / ms.hp));
    }
  }

  /** ページ送り(◀ 1/4 ▶) */
  private drawPager(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    const pages = this.pageCount();
    this.prevButton.draw(ctx, x, y, 72, 52, '◀', { color: '#3a3a55', disabled: pages <= 1 });
    this.nextButton.draw(ctx, x + w - 72, y, 72, 52, '▶', { color: '#3a3a55', disabled: pages <= 1 });
    drawText(ctx, `ページ ${this.page + 1} / ${pages}`, x + w / 2, y + 16, { align: 'center', font: FONT_SMALL, color: '#ccccee' });
  }
}
