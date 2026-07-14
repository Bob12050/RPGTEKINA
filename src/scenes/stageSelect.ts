// ============================================================
// ステージセレクト(モンスト・ノマダン式の2階層)
//   エリアマップ(島マップ風のノード表示) → クエスト一覧 → 挑戦
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import {
  AREAS,
  areaProgress,
  isAreaUnlocked,
  isStageUnlocked,
  questsOf,
  type AreaDef,
} from '../data/stages';
import { getSpecies } from '../data/monsters';
import { drawGridSprite, drawMonster, FAMILY_SPRITES } from '../ui/sprites';
import { drawText, drawWindow, FONT_SMALL, isPortrait, Menu, view, wrapText } from '../ui/window';
import { StageScene } from './stage';

type Phase = 'area' | 'quest';

/** シルエット用の暗色パレット */
const SHADOW_COLORS: Record<string, string> = {
  '1': '#1a2238', '2': '#1a2238', '3': '#1a2238', '#': '#121a2c', W: '#1a2238', K: '#121a2c',
};

export class StageSelectScene implements Scene {
  private phase: Phase = 'area';
  private areaCursor = 0;
  private questMenu = new Menu([], 8);
  private currentArea: AreaDef | null = null;
  private time = 0;

  constructor(private app: App) {}

  onEnter(): void {
    this.app.input.flush();
  }

  private rebuildQuests(): void {
    if (!this.currentArea) return;
    const state = requireState(this.app);
    const cursor = this.questMenu.cursor;
    const quests = questsOf(this.currentArea.id);
    this.questMenu.setItems(
      quests.map((s, i) => {
        const unlocked = isStageUnlocked(s, state.clearedStages);
        const cleared = state.clearedStages.includes(s.id);
        return {
          label: `${i + 1}. ${unlocked ? s.name : '？？？'}`,
          note: !unlocked ? '🔒' : cleared ? 'クリア' : `Lv${s.recLevel}`,
          disabled: !unlocked,
        };
      }),
    );
    this.questMenu.setCursor(cursor);
  }

  update(dt: number): void {
    this.time += dt;
    if (this.phase === 'quest') this.rebuildQuests();
    const key = this.app.input.poll();
    if (!key) return;

    if (this.phase === 'area') {
      // マップ上のノードを 前/次 で移動する
      if (key === 'up' || key === 'left') {
        this.areaCursor = (this.areaCursor - 1 + AREAS.length) % AREAS.length;
        return;
      }
      if (key === 'down' || key === 'right') {
        this.areaCursor = (this.areaCursor + 1) % AREAS.length;
        return;
      }
      if (key === 'cancel') {
        this.app.scenes.pop();
        return;
      }
      if (key !== 'confirm') return;
      const area = AREAS[this.areaCursor];
      if (!area) return;
      const state = requireState(this.app);
      if (!isAreaUnlocked(area.id, state.clearedStages)) return;
      this.currentArea = area;
      this.questMenu.reset();
      this.rebuildQuests();
      this.phase = 'quest';
      return;
    }

    // quest phase
    const r = this.questMenu.handleKey(key);
    if (r === 'cancel') {
      this.phase = 'area';
      return;
    }
    if (r !== 'select') return;
    if (!this.currentArea) return;
    const quests = questsOf(this.currentArea.id);
    const quest = quests[this.questMenu.cursor];
    if (!quest) return;
    const state = requireState(this.app);
    if (!isStageUnlocked(quest, state.clearedStages)) return;
    this.app.scenes.push(new StageScene(this.app, quest.id));
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const grad = ctx.createLinearGradient(0, 0, 0, view.h);
    grad.addColorStop(0, '#0a1428');
    grad.addColorStop(1, '#16304a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, view.h);
    const p = isPortrait();
    const state = requireState(this.app);

    if (this.phase === 'area') {
      this.drawAreaMap(ctx);
      return;
    }

    // ---- クエスト一覧 ----
    const area = this.currentArea!;
    const prog = areaProgress(area.id, state.clearedStages);
    drawWindow(ctx, 12, 12, view.w - 24, 52);
    drawText(ctx, `${area.name}  (${prog.done}/${prog.total})`, view.w / 2, 26, { align: 'center', color: '#ffd94a' });
    this.questMenu.draw(ctx, 12, 76, view.w - 24);

    const quests = questsOf(area.id);
    const quest = quests[this.questMenu.cursor];
    if (quest && isStageUnlocked(quest, state.clearedStages)) {
      const dy = view.h - (p ? 130 : 130);
      drawWindow(ctx, 12, dy, view.w - 24, p ? 116 : 110);
      drawText(ctx, `WAVE ${quest.waves.length} + ボス  /  すいしょうLv${quest.recLevel}`, 32, dy + 16, {
        font: FONT_SMALL,
        color: '#ccccee',
      });
      // ドロップ情報(モンスタードロップがあれば見せてあげる)
      if (quest.monsterDrops && quest.monsterDrops.length > 0) {
        const names = quest.monsterDrops
          .map((md) => (state.seenSpecies.includes(md.speciesId) ? getSpecies(md.speciesId).name : '？？？'))
          .join(' / ');
        drawText(ctx, `ドロップ: ${names}`, 32, dy + 44, { font: FONT_SMALL, color: '#8fd4ff' });
      }
      // 初回クリアのオーブ報酬(未クリアのときだけ)
      if (!state.clearedStages.includes(quest.id) && quest.rewardOrbs > 0) {
        drawText(ctx, `しょかい: オーブ×${quest.rewardOrbs}`, view.w - 32, dy + 16, {
          align: 'right',
          font: FONT_SMALL,
          color: '#ffd94a',
        });
      }
      drawText(ctx, 'Z/A: いどむ   X/B: マップへもどる', view.w - 32, dy + (p ? 84 : 78), {
        align: 'right',
        font: FONT_SMALL,
        color: '#aaaacc',
      });
    }
  }

  // ---- 島マップ風のエリアノード描画 ----
  private drawAreaMap(ctx: CanvasRenderingContext2D): void {
    const p = isPortrait();
    const state = requireState(this.app);

    drawWindow(ctx, 12, 12, view.w - 24, 52);
    drawText(ctx, 'ぼうけんマップ', view.w / 2, 26, { align: 'center', color: '#ffd94a' });

    // ノード座標(縦持ち: 下から上へジグザグ / 横持ち: 左から右へジグザグ)
    const n = AREAS.length;
    const nodes = AREAS.map((_, i) => {
      if (p) {
        return {
          x: view.w / 2 + (i % 2 === 0 ? -85 : 85),
          y: view.h - 220 - i * 86,
        };
      }
      return {
        x: 110 + (i * (view.w - 220)) / (n - 1),
        y: 250 + (i % 2 === 0 ? 55 : -55),
      };
    });

    // ノード間の点線
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 7]);
    for (let i = 0; i < n - 1; i++) {
      ctx.beginPath();
      ctx.moveTo(nodes[i]!.x, nodes[i]!.y);
      ctx.lineTo(nodes[i + 1]!.x, nodes[i + 1]!.y);
      ctx.stroke();
    }
    ctx.restore();

    // ノード本体
    for (let i = 0; i < n; i++) {
      const area = AREAS[i]!;
      const { x, y } = nodes[i]!;
      const unlocked = isAreaUnlocked(area.id, state.clearedStages);
      const prog = areaProgress(area.id, state.clearedStages);
      const done = prog.done === prog.total;
      const selected = i === this.areaCursor;

      // 円
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, 36, 0, Math.PI * 2);
      ctx.fillStyle = unlocked ? (area.postgame ? '#3a2a4c' : '#28405f') : '#1c2436';
      ctx.fill();
      ctx.lineWidth = selected ? 4 : 2;
      ctx.strokeStyle = selected ? '#ffd94a' : done ? '#8fd44a' : 'rgba(255,255,255,0.4)';
      ctx.stroke();
      ctx.restore();

      // 代表モンスター(未解放はシルエット)
      const sp = getSpecies(area.iconSpecies);
      const bounce = selected ? Math.sin(this.time * 4) * 3 : 0;
      if (unlocked) {
        drawMonster(ctx, sp.family, sp.palette, x - 24, y - 26 + bounce, 3);
      } else {
        drawGridSprite(ctx, FAMILY_SPRITES[sp.family], SHADOW_COLORS, x - 24, y - 26, 3);
      }

      // ラベル
      drawText(ctx, unlocked ? area.name : '？？？', x, y + 42, { align: 'center', font: FONT_SMALL });
      drawText(ctx, unlocked ? (done ? '★クリア' : `${prog.done}/${prog.total}`) : '🔒', x, y + 64, {
        align: 'center',
        font: FONT_SMALL,
        color: done ? '#ffd94a' : '#aaaacc',
      });

      // 選択カーソル
      if (selected) {
        drawText(ctx, '▼', x, y - 62 + Math.sin(this.time * 6) * 4, { align: 'center', color: '#ffd94a' });
      }
    }

    // 下部: 選択中エリアの情報
    const area = AREAS[this.areaCursor]!;
    const unlocked = isAreaUnlocked(area.id, state.clearedStages);
    const dy = view.h - (p ? 118 : 124);
    drawWindow(ctx, 12, dy, view.w - 24, p ? 104 : 110);
    if (unlocked) {
      const lines = wrapText(ctx, area.desc, view.w - 80, FONT_SMALL);
      lines.forEach((line, i) => drawText(ctx, line, 32, dy + 14 + i * 24, { font: FONT_SMALL, color: '#ccccee' }));
      drawText(ctx, 'Z/A: クエストをみる   X/B: もどる', view.w - 32, dy + (p ? 72 : 78), {
        align: 'right',
        font: FONT_SMALL,
        color: '#aaaacc',
      });
    } else {
      drawText(ctx, 'まえの エリアを クリアすると かいほうされる…', 32, dy + 20, { font: FONT_SMALL, color: '#8888aa' });
    }
  }
}
