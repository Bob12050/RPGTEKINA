// ============================================================
// モンスターずかん
// なかまにした種族はフルカラー+詳細、見ただけの種族はシルエット、
// 未発見は ??? で表示する。縦持ち・横持ち両対応。
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import type { SpeciesDef } from '../core/types';
import { ELEMENT_NAMES, FAMILY_NAMES, rankStars } from '../core/types';
import { getSkill } from '../data/skills';
import { SPECIES } from '../data/monsters';
import { inGachaPool } from '../data/gacha';
import { STAGES } from '../data/stages';
import { drawPremiumSceneHeader, premiumBackRect } from '../ui/menuChrome';
import { createImageAsset, drawCoverImage, imageReady } from '../ui/media';
import { drawSpeciesPortrait } from '../ui/monsterArt';
import { drawGridSprite, drawMonster, FAMILY_SPRITES } from '../ui/sprites';
import { drawPremiumPanel, drawText, FONT_SMALL, inRect, isPortrait, Menu, view, wrapText } from '../ui/window';

const MENU_BACKGROUND = createImageAsset(new URL('../assets/menu/menu-bg.webp', import.meta.url).href);

/** 入手ヒント: ガチャ排出か、クエストドロップか */
function obtainHint(speciesId: string): string | null {
  if (inGachaPool(speciesId)) return 'ガチャで なかまに できる';
  if (STAGES.some((s) => s.monsterDrops?.some((md) => md.speciesId === speciesId))) {
    return 'クエストの ドロップで なかまに';
  }
  return null;
}

type Knowledge = 'unknown' | 'seen' | 'scouted';

export class DexScene implements Scene {
  private menu: Menu;
  private time = 0;

  constructor(private app: App) {
    this.menu = new Menu([], 12, 56, 'premium');
    this.rebuild();
  }

  onEnter(): void {
    this.app.input.flush();
  }

  private knowledge(speciesId: string): Knowledge {
    const state = requireState(this.app);
    if (state.scoutedSpecies.includes(speciesId)) return 'scouted';
    if (state.seenSpecies.includes(speciesId)) return 'seen';
    return 'unknown';
  }

  private rebuild(): void {
    this.menu.setItems(
      SPECIES.map((sp, i) => {
        const k = this.knowledge(sp.id);
        const no = String(i + 1).padStart(2, '0');
        return {
          label: `No.${no} ${k === 'unknown' ? '？？？' : sp.name}`,
          note: k === 'scouted' ? 'なかま' : k === 'seen' ? 'はっけん' : '',
        };
      }),
    );
  }

  update(dt: number): void {
    this.time += dt;
    const tap = this.app.input.takeTap();
    if (tap) {
      if (inRect(tap.x, tap.y, premiumBackRect())) {
        this.app.scenes.pop();
        return;
      }
      const idx = this.menu.itemAt(tap.x, tap.y);
      if (idx !== null) this.menu.setCursor(idx); // タップした種族の詳細を表示
      return;
    }
    const key = this.app.input.poll();
    if (!key) return;
    const r = this.menu.handleKey(key);
    if (r === 'cancel') this.app.scenes.pop();
    // 「けってい」は特になし(カーソル位置の詳細を常時表示)
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (imageReady(MENU_BACKGROUND)) {
      drawCoverImage(ctx, MENU_BACKGROUND, { x: 0, y: 0, w: view.w, h: view.h }, 0.5, 0.5);
    } else {
      ctx.fillStyle = '#020616';
      ctx.fillRect(0, 0, view.w, view.h);
    }
    ctx.fillStyle = 'rgba(1,5,18,0.28)';
    ctx.fillRect(0, 0, view.w, view.h);
    const state = requireState(this.app);
    const p = isPortrait();
    this.menu.visibleCount = p ? 5 : 8;

    // ヘッダー(コンプリート率)
    const validIds = new Set(SPECIES.map((s) => s.id));
    const seen = state.seenSpecies.filter((id) => validIds.has(id)).length;
    const scouted = state.scoutedSpecies.filter((id) => validIds.has(id)).length;
    drawPremiumSceneHeader(ctx, 'モンスター図鑑');
    drawPremiumPanel(ctx, 12, 68, view.w - 24, 52);
    drawText(ctx, `発見 ${seen}/${SPECIES.length}`, p ? 34 : 64, 82, { color: '#d8e3f8', font: FONT_SMALL });
    drawText(ctx, `仲間 ${scouted}/${SPECIES.length}`, view.w - (p ? 34 : 64), 82, {
      align: 'right', color: '#7fe4b2', font: FONT_SMALL,
    });

    // リストと詳細
    if (p) {
      const mh = this.menu.draw(ctx, 12, 132, view.w - 24);
      this.drawDetail(ctx, 12, 132 + mh + 8, view.w - 24, view.h - (132 + mh + 8) - 12);
    } else {
      this.menu.draw(ctx, 12, 132, 380);
      this.drawDetail(ctx, 404, 132, view.w - 416, view.h - 144);
    }
  }

  private drawDetail(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    drawPremiumPanel(ctx, x, y, w, h);
    const sp: SpeciesDef | undefined = SPECIES[this.menu.cursor];
    if (!sp) return;
    const k = this.knowledge(sp.id);
    const p = isPortrait();
    const scale = p ? 5 : 6;
    const size = 16 * scale;
    const bounce = Math.sin(this.time * 3) * 3;

    if (k === 'unknown') {
      drawText(ctx, '？？？', x + w / 2, y + h / 2 - 30, { align: 'center' });
      drawText(ctx, 'まだ であったことが ない…。', x + w / 2, y + h / 2 + 8, {
        align: 'center',
        font: FONT_SMALL,
        color: '#8888aa',
      });
      return;
    }

    // 高精細肖像を優先し、未対応種族のみ正確なパレットのスプライトへ戻す。
    const portraitSize = p ? 126 : 154;
    const sx = x + 18;
    const sy = y + 18;
    const portraitRect = { x: sx, y: sy, w: portraitSize, h: portraitSize };
    if (k === 'scouted') {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(portraitRect.x, portraitRect.y, portraitRect.w, portraitRect.h, 14);
      ctx.clip();
      ctx.fillStyle = '#07152f';
      ctx.fillRect(portraitRect.x, portraitRect.y, portraitRect.w, portraitRect.h);
      const rendered = drawSpeciesPortrait(ctx, sp, portraitRect);
      if (!rendered) {
        const fallbackScale = p ? 7 : 9;
        const fallbackSize = 16 * fallbackScale;
        drawMonster(
          ctx,
          sp.family,
          sp.palette,
          portraitRect.x + (portraitRect.w - fallbackSize) / 2,
          portraitRect.y + (portraitRect.h - fallbackSize) / 2 + bounce,
          fallbackScale,
        );
      }
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(portraitRect.x, portraitRect.y, portraitRect.w, portraitRect.h, 14);
      ctx.strokeStyle = '#d8ad57';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    } else {
      const shadow: Record<string, string> = { '1': '#181834', '2': '#181834', '3': '#181834', '#': '#101024', W: '#181834', K: '#101024' };
      drawGridSprite(ctx, FAMILY_SPRITES[sp.family], shadow, sx + 18, sy + 18 + bounce, scale);
    }

    const tx = sx + portraitSize + 18;
    drawText(ctx, k === 'scouted' ? sp.name : `${sp.name} (シルエット)`, tx, y + 30, { font: p ? FONT_SMALL : undefined });
    drawText(ctx, `${FAMILY_NAMES[sp.family]}・${'★'.repeat(rankStars(sp.rank))}`, tx, y + (p ? 58 : 66), {
      font: FONT_SMALL,
      color: '#aaaacc',
    });
    const hint = obtainHint(sp.id);
    if (hint) {
      drawText(ctx, hint, tx, y + (p ? 82 : 94), { font: FONT_SMALL, color: '#8fd4ff' });
    }

    // 下段の描画開始位置
    let ly = y + Math.max(size + 44, portraitSize + 38);

    if (k === 'seen') {
      const msg = wrapText(ctx, 'なかまに すれば くわしい じょうほうが わかる!', w - 48, FONT_SMALL);
      msg.forEach((line, i) => {
        drawText(ctx, line, x + 24, ly + i * 24, { font: FONT_SMALL, color: '#8888aa' });
      });
      return;
    }

    // ---- なかま済み: 詳細 ----
    const descLines = wrapText(ctx, sp.desc, w - 48, FONT_SMALL);
    for (const line of descLines) {
      drawText(ctx, line, x + 24, ly, { font: FONT_SMALL, color: '#ccccee' });
      ly += 24;
    }
    ly += 12;

    drawText(ctx, 'おぼえる とくぎ', x + 24, ly, { font: FONT_SMALL, color: '#ffd94a' });
    ly += 28;
    if (sp.learnset.length === 0) {
      drawText(ctx, '(なし)', x + 24, ly, { font: FONT_SMALL, color: '#8888aa' });
      ly += 26;
    } else {
      const colW = (w - 48) / 2;
      sp.learnset.forEach((entry, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        drawText(ctx, `Lv${String(entry.level).padStart(2, ' ')} ${getSkill(entry.skillId).name}`, x + 24 + col * colW, ly + row * 26, {
          font: FONT_SMALL,
        });
      });
      ly += Math.ceil(sp.learnset.length / 2) * 26;
    }
    ly += 12;

    // 耐性まとめ
    const weak: string[] = [];
    const resist: string[] = [];
    for (const [el, mul] of Object.entries(sp.resist)) {
      const name = ELEMENT_NAMES[el as keyof typeof ELEMENT_NAMES];
      if (mul > 1) weak.push(name);
      else if (mul < 1) resist.push(name);
    }
    drawText(ctx, `よわてん: ${weak.length > 0 ? weak.join(' ') : 'なし'}`, x + 24, ly, {
      font: FONT_SMALL,
      color: weak.length > 0 ? '#f0a0a0' : '#8888aa',
    });
    ly += 26;
    drawText(ctx, `たいせい: ${resist.length > 0 ? resist.join(' ') : 'なし'}`, x + 24, ly, {
      font: FONT_SMALL,
      color: resist.length > 0 ? '#a0d0f0' : '#8888aa',
    });
  }
}
