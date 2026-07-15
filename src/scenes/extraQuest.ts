// ============================================================
// 育成/イベント/降臨クエストの一覧
//   エントリは「通常ステージ」または「降臨グループ(難易度つき)」。
//   降臨グループをタップすると、その難易度一覧(初級〜極)へ潜る。
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import { getSpecies } from '../data/monsters';
import {
  adventProgress,
  getStage,
  isAdventUnlocked,
  isExtraStageUnlocked,
  type AdventGroup,
  type StageDef,
} from '../data/stages';
import { drawFancyBg, type BgTheme } from '../ui/bg';
import { BackButton, drawText, drawWindow, FONT_SMALL, isPortrait, Menu, view, wrapText } from '../ui/window';
import { StageScene } from './stage';

/** 一覧に並ぶ項目: 通常クエスト or 降臨グループ */
export type QuestEntry =
  | { type: 'stage'; stage: StageDef }
  | { type: 'advent'; group: AdventGroup };

/** 通常ステージ配列を エントリ配列にする補助 */
export function stageEntries(stages: StageDef[]): QuestEntry[] {
  return stages.map((stage) => ({ type: 'stage', stage }));
}

export class ExtraQuestScene implements Scene {
  private menu = new Menu([], 8);
  private backButton = new BackButton();
  private time = 0;

  constructor(
    private app: App,
    private title: string,
    private entries: QuestEntry[],
    private theme: BgTheme,
  ) {}

  onEnter(): void {
    this.app.input.flush();
    this.rebuild();
  }

  private rebuild(): void {
    const state = requireState(this.app);
    const cursor = this.menu.cursor;
    this.menu.setItems(
      this.entries.map((e) => {
        if (e.type === 'advent') {
          const unlocked = isAdventUnlocked(e.group, state.clearedStages);
          const prog = adventProgress(e.group, state.clearedStages);
          return {
            label: unlocked ? `🔥 ${e.group.name} 降臨` : '？？？',
            note: !unlocked ? '🔒' : `${prog.done}/${prog.total}`,
            disabled: !unlocked,
          };
        }
        const s = e.stage;
        const unlocked = isExtraStageUnlocked(s, state.clearedStages);
        const cleared = state.clearedStages.includes(s.id);
        const icon = s.advent ? '🔥 ' : s.boss ? '👑 ' : '';
        return {
          label: unlocked ? `${icon}${s.name}` : '？？？',
          note: !unlocked ? '🔒' : cleared ? 'クリア' : `Lv${s.recLevel}`,
          disabled: !unlocked,
        };
      }),
    );
    this.menu.setCursor(cursor);
  }

  private open(index: number): void {
    const state = requireState(this.app);
    const e = this.entries[index];
    if (!e) return;
    if (e.type === 'advent') {
      if (!isAdventUnlocked(e.group, state.clearedStages)) return;
      // 難易度一覧へ(初級〜極)
      this.app.scenes.push(new ExtraQuestScene(this.app, `${e.group.name} 降臨`, stageEntries(e.group.tiers), 'battleBoss'));
      return;
    }
    if (!isExtraStageUnlocked(e.stage, state.clearedStages)) return;
    this.app.scenes.push(new StageScene(this.app, e.stage.id));
  }

  update(dt: number): void {
    this.time += dt;
    this.rebuild();
    const tap = this.app.input.takeTap();
    const key = this.app.input.poll();
    if (!tap && !key) return;

    if (tap) {
      if (this.backButton.contains(tap.x, tap.y)) {
        this.app.scenes.pop();
        return;
      }
      const idx = this.menu.itemAt(tap.x, tap.y);
      if (idx !== null) {
        this.menu.setCursor(idx);
        this.open(idx);
      }
      return;
    }
    const r = this.menu.handleKey(key!);
    if (r === 'cancel') this.app.scenes.pop();
    else if (r === 'select') this.open(this.menu.cursor);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawFancyBg(ctx, this.theme, this.time);
    const p = isPortrait();

    drawWindow(ctx, 12, 12, view.w - 24, 52);
    drawText(ctx, this.title, view.w / 2, 26, { align: 'center', color: '#ffd94a', shadow: true });
    this.backButton.draw(ctx);

    this.menu.draw(ctx, 12, 76, view.w - 24);

    const entry = this.entries[this.menu.cursor];
    if (!entry) return;
    const dy = view.h - (p ? 168 : 150);
    const dh = p ? 156 : 138;
    drawWindow(ctx, 12, dy, view.w - 24, dh);

    if (entry.type === 'advent') {
      this.drawAdventDetail(ctx, entry.group, dy);
    } else {
      this.drawStageDetail(ctx, entry.stage, dy);
    }
  }

  private drawAdventDetail(ctx: CanvasRenderingContext2D, group: AdventGroup, dy: number): void {
    const state = requireState(this.app);
    const unlocked = isAdventUnlocked(group, state.clearedStages);
    if (!unlocked) {
      const reqName = getStageName(group.requires);
      drawText(ctx, '🔒 みかいほう', 32, dy + 18, { color: '#f0a05a' });
      wrapText(ctx, `「${reqName}」を クリアすると こうりんする。`, view.w - 72, FONT_SMALL).forEach((line, i) =>
        drawText(ctx, line, 32, dy + 50 + i * 26, { font: FONT_SMALL, color: '#ccccee' }),
      );
      return;
    }
    const sp = getSpecies(group.boss);
    const known = state.scoutedSpecies.includes(group.boss) || state.seenSpecies.includes(group.boss);
    const prog = adventProgress(group, state.clearedStages);
    drawText(ctx, `🔥 降臨ボス: ${known ? sp.name : '？？？'}`, 32, dy + 16, { font: FONT_SMALL, color: '#ff9a6a' });
    drawText(ctx, 'むずかしさ 初級〜極 の 4だんかい!', 32, dy + 44, { font: FONT_SMALL, color: '#cfe0ff' });
    drawText(ctx, `⚡ しょうりで「${known ? sp.name : 'そのボス'}」が なかま かくてい!`, 32, dy + 70, {
      font: FONT_SMALL,
      color: '#ffd94a',
    });
    drawText(ctx, `クリア: ${prog.done}/${prog.total}`, view.w - 32, dy + 16, { align: 'right', font: FONT_SMALL, color: '#8fd4ff' });
  }

  private drawStageDetail(ctx: CanvasRenderingContext2D, stage: StageDef, dy: number): void {
    const state = requireState(this.app);
    const unlocked = isExtraStageUnlocked(stage, state.clearedStages);
    if (!unlocked) {
      const reqName = stage.requires ? getStageName(stage.requires) : '';
      drawText(ctx, '🔒 みかいほう', 32, dy + 18, { color: '#f0a05a' });
      wrapText(ctx, `「${reqName}」を クリアすると ちょうせん できる。`, view.w - 72, FONT_SMALL).forEach((line, i) =>
        drawText(ctx, line, 32, dy + 50 + i * 26, { font: FONT_SMALL, color: '#ccccee' }),
      );
      return;
    }
    const headLabel = stage.advent ? '🔥 降臨バトル' : stage.boss ? '👑 ボスバトル' : `てき ${stage.enemies.length}たい`;
    drawText(ctx, `${headLabel}  /  すいしょうLv${stage.recLevel}`, 32, dy + 16, {
      font: FONT_SMALL,
      color: stage.advent ? '#ff9a6a' : stage.boss ? '#f0a05a' : '#ccccee',
    });
    let ly = dy + 44;
    if (stage.advent && stage.firstClearMonster && !state.clearedStages.includes(stage.id)) {
      const sp = getSpecies(stage.firstClearMonster.speciesId);
      drawText(ctx, `⚡ しょうりで「${sp.name}」が なかま かくてい!`, 32, ly, { font: FONT_SMALL, color: '#ffd94a' });
      ly += 26;
    }
    if (stage.desc) {
      wrapText(ctx, stage.desc, view.w - 72, FONT_SMALL).forEach((line) => {
        drawText(ctx, line, 32, ly, { font: FONT_SMALL, color: '#cfe0ff' });
        ly += 24;
      });
    }
    if (stage.monsterDrops && stage.monsterDrops.length > 0 && !stage.advent) {
      const names = stage.monsterDrops
        .map((md) => (state.seenSpecies.includes(md.speciesId) ? getSpecies(md.speciesId).name : '？？？'))
        .join(' / ');
      drawText(ctx, `ドロップ: ${names}`, 32, ly, { font: FONT_SMALL, color: '#8fd4ff' });
    }
    if (!state.clearedStages.includes(stage.id) && stage.rewardOrbs > 0) {
      drawText(ctx, `しょかい: 💎×${stage.rewardOrbs}`, view.w - 32, dy + 16, {
        align: 'right',
        font: FONT_SMALL,
        color: '#ffd94a',
      });
    }
  }
}

function getStageName(id: string): string {
  try {
    return getStage(id).name;
  } catch {
    return id;
  }
}
