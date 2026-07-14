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
import { drawGridSprite, drawMonster, FAMILY_SPRITES } from '../ui/sprites';
import { drawText, drawWindow, FONT_SMALL, isPortrait, Menu, view, wrapText } from '../ui/window';

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
    this.menu = new Menu([], 12);
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
    const key = this.app.input.poll();
    if (!key) return;
    const r = this.menu.handleKey(key);
    if (r === 'cancel') this.app.scenes.pop();
    // 「けってい」は特になし(カーソル位置の詳細を常時表示)
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 10, 0.85)';
    ctx.fillRect(0, 0, view.w, view.h);
    const state = requireState(this.app);
    const p = isPortrait();
    this.menu.visibleCount = p ? 6 : 13;

    // ヘッダー(コンプリート率)
    const validIds = new Set(SPECIES.map((s) => s.id));
    const seen = state.seenSpecies.filter((id) => validIds.has(id)).length;
    const scouted = state.scoutedSpecies.filter((id) => validIds.has(id)).length;
    drawWindow(ctx, 12, 12, view.w - 24, 52);
    drawText(ctx, 'モンスターずかん', p ? 28 : 40, 26, { color: '#ffd94a', font: FONT_SMALL });
    drawText(ctx, `はっけん ${seen}/${SPECIES.length}  なかま ${scouted}/${SPECIES.length}`, view.w - (p ? 24 : 40), 26, {
      align: 'right',
      font: FONT_SMALL,
    });

    // リストと詳細
    if (p) {
      this.menu.draw(ctx, 12, 76, view.w - 24);
      this.drawDetail(ctx, 12, 302, view.w - 24, view.h - 314);
    } else {
      this.menu.draw(ctx, 12, 76, 380);
      this.drawDetail(ctx, 404, 76, view.w - 416, 520);
    }
  }

  private drawDetail(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    drawWindow(ctx, x, y, w, h);
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

    // スプライト(シルエット or カラー)
    const sx = x + 24;
    const sy = y + 28;
    if (k === 'scouted') {
      drawMonster(ctx, sp.family, sp.palette, sx, sy + bounce, scale);
    } else {
      const shadow: Record<string, string> = { '1': '#181834', '2': '#181834', '3': '#181834', '#': '#101024', W: '#181834', K: '#101024' };
      drawGridSprite(ctx, FAMILY_SPRITES[sp.family], shadow, sx, sy + bounce, scale);
    }

    const tx = sx + size + 22;
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
    let ly = y + size + 44;

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
