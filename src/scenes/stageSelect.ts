// ============================================================
// ステージセレクト(モンスト・ノマダン式の2階層)
//   エリア一覧 → エリア内のクエスト一覧 → クエストに挑戦
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
import { drawText, drawWindow, FONT_SMALL, isPortrait, Menu, view, wrapText } from '../ui/window';
import { StageScene } from './stage';

type Phase = 'area' | 'quest';

export class StageSelectScene implements Scene {
  private phase: Phase = 'area';
  private areaMenu = new Menu([], 8);
  private questMenu = new Menu([], 8);
  private currentArea: AreaDef | null = null;

  constructor(private app: App) {}

  onEnter(): void {
    this.app.input.flush();
  }

  private rebuildAreas(): void {
    const state = requireState(this.app);
    const cursor = this.areaMenu.cursor;
    this.areaMenu.setItems(
      AREAS.map((a) => {
        const unlocked = isAreaUnlocked(a.id, state.clearedStages);
        const prog = areaProgress(a.id, state.clearedStages);
        return {
          label: `${a.postgame ? '★' : ''}${unlocked ? a.name : '？？？'}`,
          note: unlocked ? `${prog.done}/${prog.total}` : '🔒',
          disabled: !unlocked,
        };
      }),
    );
    this.areaMenu.setCursor(cursor);
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

  update(): void {
    this.rebuildAreas();
    if (this.phase === 'quest') this.rebuildQuests();
    const key = this.app.input.poll();
    if (!key) return;

    if (this.phase === 'area') {
      const r = this.areaMenu.handleKey(key);
      if (r === 'cancel') {
        this.app.scenes.pop();
        return;
      }
      if (r !== 'select') return;
      const area = AREAS[this.areaMenu.cursor];
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
    grad.addColorStop(1, '#1a2a44');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, view.h);
    const p = isPortrait();
    const state = requireState(this.app);

    if (this.phase === 'area') {
      drawWindow(ctx, 12, 12, view.w - 24, 52);
      drawText(ctx, 'エリアせんたく', view.w / 2, 26, { align: 'center', color: '#ffd94a' });
      this.areaMenu.draw(ctx, 12, 76, view.w - 24);

      const area = AREAS[this.areaMenu.cursor];
      if (area && isAreaUnlocked(area.id, state.clearedStages)) {
        const dy = view.h - (p ? 120 : 130);
        drawWindow(ctx, 12, dy, view.w - 24, p ? 106 : 110);
        const lines = wrapText(ctx, area.desc, view.w - 80, FONT_SMALL);
        lines.forEach((line, i) => drawText(ctx, line, 32, dy + 16 + i * 24, { font: FONT_SMALL, color: '#ccccee' }));
        drawText(ctx, 'Z/A: クエストをみる   X/B: もどる', view.w - 32, dy + (p ? 74 : 78), {
          align: 'right',
          font: FONT_SMALL,
          color: '#aaaacc',
        });
      }
      return;
    }

    // quest phase
    const area = this.currentArea!;
    const prog = areaProgress(area.id, state.clearedStages);
    drawWindow(ctx, 12, 12, view.w - 24, 52);
    drawText(ctx, `${area.name}  (${prog.done}/${prog.total})`, view.w / 2, 26, { align: 'center', color: '#ffd94a' });
    this.questMenu.draw(ctx, 12, 76, view.w - 24);

    const quests = questsOf(area.id);
    const quest = quests[this.questMenu.cursor];
    if (quest && isStageUnlocked(quest, state.clearedStages)) {
      const dy = view.h - (p ? 110 : 130);
      drawWindow(ctx, 12, dy, view.w - 24, p ? 96 : 110);
      drawText(ctx, `WAVE ${quest.waves.length} + ボス  /  すいしょうLv${quest.recLevel}`, 32, dy + 18, {
        font: FONT_SMALL,
        color: '#ccccee',
      });
      drawText(ctx, 'Z/A: いどむ   X/B: エリアへもどる', view.w - 32, dy + 48, {
        align: 'right',
        font: FONT_SMALL,
        color: '#aaaacc',
      });
    }
  }
}
