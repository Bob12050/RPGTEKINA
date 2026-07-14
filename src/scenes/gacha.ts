// ============================================================
// ガチャシーン — オーブを つかって モンスターを おむかえ!
//   単発 / 10連(★4以上1体確定)。結果はワクワクの順次公開演出つき。
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import { FARM_MAX, PARTY_MAX, rankStars, type Rank, type SpeciesDef } from '../core/types';
import { gachaLevel, MULTI_COST, MULTI_COUNT, pullOne, pullTen, RANK_RATES, SINGLE_COST } from '../data/gacha';
import { createMonster } from '../game/monster';
import { addMonster, markScouted } from '../game/state';
import { drawMonster } from '../ui/sprites';
import { drawText, drawWindow, FONT_BIG, FONT_SMALL, isPortrait, Menu, view } from '../ui/window';

type Phase = 'menu' | 'revealSingle' | 'revealMulti' | 'message';

interface PullResult {
  species: SpeciesDef;
  level: number;
  where: 'party' | 'farm';
}

/** レア度ごとの表示色(★4=青 / ★5=紫 / ★6=金 / ★7=虹っぽく) */
const RANK_COLORS: Record<Rank, string> = {
  F: '#ffffff',
  E: '#ffffff',
  D: '#b5e8a0',
  C: '#8fd4ff',
  B: '#c98af5',
  A: '#ffd94a',
  S: '#ff8ad8',
};

/** 単発演出: この秒数だけタメてから公開 */
const SINGLE_DELAY = 0.9;
/** 10連演出: 1体ずつ公開する間隔 */
const MULTI_STEP = 0.22;

export class GachaScene implements Scene {
  private phase: Phase = 'menu';
  private menu = new Menu([]);
  private results: PullResult[] = [];
  private revealT = 0;
  private message = '';
  private time = 0;

  constructor(private app: App) {
    this.rebuildMenu();
  }

  onEnter(): void {
    this.app.input.flush();
  }

  private rebuildMenu(): void {
    const state = requireState(this.app);
    const cursor = this.menu.cursor;
    this.menu.setItems([
      { label: 'たんぱつ ガチャ', note: `オーブ${SINGLE_COST}`, disabled: state.orbs < SINGLE_COST },
      { label: '10れん ガチャ', note: `オーブ${MULTI_COST}`, disabled: state.orbs < MULTI_COST },
      { label: 'やめる' },
    ]);
    this.menu.setCursor(cursor);
  }

  /** 空きスロット(パーティ+ぼくじょう)の数 */
  private freeSlots(): number {
    const state = requireState(this.app);
    return PARTY_MAX - state.party.length + (FARM_MAX - state.farm.length);
  }

  private doPull(count: number): void {
    const state = requireState(this.app);
    const cost = count === 1 ? SINGLE_COST : MULTI_COST;
    if (state.orbs < cost) {
      this.message = 'オーブが たりない! クエストを クリアして あつめよう。';
      this.phase = 'message';
      return;
    }
    if (this.freeSlots() < count) {
      this.message = 'ぼくじょうが いっぱいだ! ぼくじょうで わかれを つげてから こよう。';
      this.phase = 'message';
      return;
    }
    state.orbs -= cost;
    const specs = count === 1 ? [pullOne()] : pullTen();
    this.results = specs.map((sp) => {
      const level = gachaLevel(sp.rank);
      const joined = createMonster(sp.id, level);
      markScouted(state, sp.id);
      const where = addMonster(state, joined);
      return { species: sp, level, where: where === 'party' ? 'party' : 'farm' };
    });
    this.revealT = 0;
    this.phase = count === 1 ? 'revealSingle' : 'revealMulti';
    this.rebuildMenu();
  }

  update(dt: number): void {
    this.time += dt;
    if (this.phase === 'revealSingle' || this.phase === 'revealMulti') this.revealT += dt;
    const key = this.app.input.poll();
    if (!key) return;

    switch (this.phase) {
      case 'menu': {
        const r = this.menu.handleKey(key);
        if (r === 'cancel') {
          this.app.scenes.pop();
          return;
        }
        if (r !== 'select') return;
        if (this.menu.cursor === 0) this.doPull(1);
        else if (this.menu.cursor === 1) this.doPull(MULTI_COUNT);
        else this.app.scenes.pop();
        break;
      }
      case 'revealSingle': {
        if (key !== 'confirm' && key !== 'cancel') return;
        if (this.revealT < SINGLE_DELAY) this.revealT = SINGLE_DELAY; // タメをスキップ
        else this.phase = 'menu';
        break;
      }
      case 'revealMulti': {
        if (key !== 'confirm' && key !== 'cancel') return;
        const fullReveal = SINGLE_DELAY + MULTI_COUNT * MULTI_STEP;
        if (this.revealT < fullReveal) this.revealT = fullReveal; // 全公開へスキップ
        else this.phase = 'menu';
        break;
      }
      case 'message': {
        if (key === 'confirm' || key === 'cancel') this.phase = 'menu';
        break;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // きらびやかな夜空グラデ
    const grad = ctx.createLinearGradient(0, 0, 0, view.h);
    grad.addColorStop(0, '#160a2e');
    grad.addColorStop(1, '#2e1a4a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, view.h);
    this.drawSparkles(ctx);

    const state = requireState(this.app);
    const p = isPortrait();

    // ヘッダー
    drawWindow(ctx, 12, 12, view.w - 24, 52);
    drawText(ctx, 'モンスターガチャ', p ? 28 : 40, 26, { color: '#ffd94a', font: FONT_SMALL });
    drawText(ctx, `オーブ ${state.orbs}`, view.w - (p ? 28 : 40), 26, { align: 'right', color: '#8fd4ff', font: FONT_SMALL });

    if (this.phase === 'menu' || this.phase === 'message') {
      this.menu.draw(ctx, p ? 12 : 24, 84, p ? view.w - 24 : 360, 'ガチャをまわす');

      // 排出率の案内
      const iy = p ? 260 : 84;
      const ix = p ? 12 : 420;
      const iw = p ? view.w - 24 : view.w - 444;
      drawWindow(ctx, ix, iy, iw, p ? 210 : 240);
      drawText(ctx, 'はいしゅつりつ', ix + 20, iy + 14, { font: FONT_SMALL, color: '#ffd94a' });
      RANK_RATES.forEach((r, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        drawText(ctx, `${'★'.repeat(rankStars(r.rank))}`, ix + 20 + col * (iw / 2 - 10), iy + 44 + row * 28, {
          font: FONT_SMALL,
          color: RANK_COLORS[r.rank],
        });
        drawText(ctx, `${r.weight}%`, ix + col * (iw / 2 - 10) + iw / 2 - 46, iy + 44 + row * 28, {
          align: 'right',
          font: FONT_SMALL,
        });
      });
      drawText(ctx, '10れんは ★4いじょう 1たい かくてい!', ix + 20, iy + 44 + 3 * 28 + 8, {
        font: FONT_SMALL,
        color: '#8fd4ff',
      });

      if (this.phase === 'message') {
        const mw = Math.min(560, view.w - 24);
        const mx = (view.w - mw) / 2;
        drawWindow(ctx, mx, view.h - 170, mw, 120);
        drawText(ctx, this.message, mx + 24, view.h - 140, { font: FONT_SMALL });
      }
      return;
    }

    if (this.phase === 'revealSingle') this.drawSingle(ctx);
    else this.drawMulti(ctx);
  }

  /** 背景のキラキラ */
  private drawSparkles(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (let i = 0; i < 40; i++) {
      const x = (i * 137.5) % view.w;
      const y = (i * 251.3) % view.h;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(this.time * 1.5 + i));
      ctx.fillStyle = `rgba(255, 240, 200, ${tw * 0.5})`;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
  }

  private drawSingle(ctx: CanvasRenderingContext2D): void {
    const r = this.results[0];
    if (!r) return;
    const p = isPortrait();
    const cx = view.w / 2;
    const cy = p ? 260 : 220;

    if (this.revealT < SINGLE_DELAY) {
      // タメ演出: ひかる たまご
      const pulse = 1 + Math.sin(this.time * 10) * 0.08;
      ctx.save();
      ctx.fillStyle = `rgba(255, 230, 120, ${0.5 + 0.3 * Math.sin(this.time * 8)})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 40, 55 * pulse, 68 * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawText(ctx, '？', cx, cy + 16, { align: 'center', font: FONT_BIG, color: '#3a2a10' });
      drawText(ctx, 'なにかが うまれる…!', cx, cy + 150, { align: 'center', font: FONT_SMALL, color: '#ffe0a0' });
      return;
    }

    const sp = r.species;
    const scale = p ? 7 : 8;
    const size = 16 * scale;
    const bounce = Math.sin(this.time * 3) * 5;
    // 高レアは背後に光輪
    if (rankStars(sp.rank) >= 5) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 217, 74, ${0.25 + 0.15 * Math.sin(this.time * 4)})`;
      ctx.beginPath();
      ctx.arc(cx, cy + size / 2, size * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    drawMonster(ctx, sp.family, sp.palette, cx - size / 2, cy - size / 2 + bounce, scale);

    const stars = '★'.repeat(rankStars(sp.rank));
    drawText(ctx, stars, cx, cy + size / 2 + 30, { align: 'center', color: RANK_COLORS[sp.rank] });
    drawText(ctx, sp.name, cx, cy + size / 2 + 62, { align: 'center', color: RANK_COLORS[sp.rank] });
    drawText(ctx, `Lv${r.level} で ${r.where === 'party' ? 'パーティに くわわった!' : 'ぼくじょうへ!'}`, cx, cy + size / 2 + 96, {
      align: 'center',
      font: FONT_SMALL,
      color: '#ccccee',
    });
    drawText(ctx, 'Z/A: もどる', cx, view.h - 60, { align: 'center', font: FONT_SMALL, color: '#aaaacc' });
  }

  private drawMulti(ctx: CanvasRenderingContext2D): void {
    const p = isPortrait();
    const w = Math.min(560, view.w - 24);
    const x = (view.w - w) / 2;
    const top = 84;
    const rowH = p ? 44 : 42;
    drawWindow(ctx, x, top, w, rowH * MULTI_COUNT + 36);

    let bestIdx = 0;
    this.results.forEach((r, i) => {
      if (rankStars(r.species.rank) > rankStars(this.results[bestIdx]!.species.rank)) bestIdx = i;
    });

    this.results.forEach((r, i) => {
      const y = top + 20 + i * rowH;
      const revealed = this.revealT >= SINGLE_DELAY + i * MULTI_STEP;
      if (!revealed) {
        drawText(ctx, '？？？', x + 60, y, { font: FONT_SMALL, color: '#666688' });
        return;
      }
      const sp = r.species;
      const stars = rankStars(sp.rank);
      // 最高レアの行はキラッと光る
      if (i === bestIdx && stars >= 4) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 217, 74, ${0.10 + 0.06 * Math.sin(this.time * 5)})`;
        ctx.fillRect(x + 10, y - 6, w - 20, rowH - 4);
        ctx.restore();
      }
      drawMonster(ctx, sp.family, sp.palette, x + 18, y - 6, 2);
      drawText(ctx, '★'.repeat(stars), x + 60, y, { font: FONT_SMALL, color: RANK_COLORS[sp.rank] });
      drawText(ctx, sp.name, x + 60 + 130, y, { font: FONT_SMALL, color: RANK_COLORS[sp.rank] });
      drawText(ctx, r.where === 'party' ? 'パーティ' : 'ぼくじょう', x + w - 20, y, {
        align: 'right',
        font: FONT_SMALL,
        color: '#aaaacc',
      });
    });

    const allRevealed = this.revealT >= SINGLE_DELAY + MULTI_COUNT * MULTI_STEP;
    drawText(ctx, allRevealed ? 'Z/A: もどる' : 'Z/A: いっきに ひらく', view.w / 2, top + rowH * MULTI_COUNT + 44, {
      align: 'center',
      font: FONT_SMALL,
      color: '#aaaacc',
    });
  }
}
