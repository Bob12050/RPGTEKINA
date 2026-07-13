// ============================================================
// はいごう(配合)シーン
// 親2体を選び、子のプレビューと とくぎ継承を決めて誕生させる。
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import type { MonsterInstance } from '../core/types';
import { SYNTHESIS_MIN_LEVEL } from '../core/types';
import { getSkill } from '../data/skills';
import { getSpecies } from '../data/monsters';
import { SPECIAL_RECIPES } from '../data/synthesis';
import { maxStats } from '../game/monster';
import { canSynthesize, inheritableSkills, MAX_INHERIT, performSynthesis } from '../game/synthesis';
import { addMonster, removeMonster } from '../game/state';
import { monsterLabel, speciesInfo } from '../ui/format';
import { drawMonster } from '../ui/sprites';
import { drawText, drawWindow, FONT_SMALL, Menu, MessageBox, SCREEN_H, SCREEN_W } from '../ui/window';

type Phase = 'menu' | 'pickA' | 'pickB' | 'skills' | 'confirm' | 'result' | 'hints';

export class SynthesisScene implements Scene {
  private phase: Phase = 'menu';
  private mainMenu = new Menu([{ label: 'はいごうする' }, { label: 'レシピのヒント' }, { label: 'やめる' }]);
  private listMenu = new Menu([], 8);
  private skillMenu = new Menu([], 8);
  private confirmMenu = new Menu([{ label: 'はい!' }, { label: 'やっぱり やめる' }]);
  private messages = new MessageBox();
  private parentA: MonsterInstance | null = null;
  private parentB: MonsterInstance | null = null;
  private selectedSkills: string[] = [];
  private hintPage = 0;
  private time = 0;

  constructor(private app: App) {}

  onEnter(): void {
    this.app.input.flush();
  }

  /** 配合に出せるモンスター一覧 */
  private candidates(exclude?: MonsterInstance | null): MonsterInstance[] {
    const state = requireState(this.app);
    return [...state.party, ...state.farm].filter((m) => m.uid !== exclude?.uid);
  }

  private buildListMenu(exclude?: MonsterInstance | null): void {
    const state = requireState(this.app);
    const items = this.candidates(exclude).map((m) => {
      const inParty = state.party.includes(m);
      return {
        label: `${inParty ? '[P]' : '[牧]'} ${monsterLabel(m)}`,
        note: m.level < SYNTHESIS_MIN_LEVEL ? `Lv${SYNTHESIS_MIN_LEVEL}未満` : '',
        disabled: m.level < SYNTHESIS_MIN_LEVEL,
      };
    });
    this.listMenu.setItems(items.length > 0 ? items : [{ label: '(モンスターが いない)', disabled: true }]);
    this.listMenu.cursor = 0;
  }

  private buildSkillMenu(): void {
    if (!this.parentA || !this.parentB) return;
    const child = this.previewChild();
    if (!child) return;
    const pool = inheritableSkills(this.parentA, this.parentB, child.speciesId);
    const items = pool.map((id) => ({
      label: `${this.selectedSkills.includes(id) ? '●' : '○'} ${getSkill(id).name}`,
      note: `MP${getSkill(id).mpCost}`,
    }));
    items.push({ label: '>> これで けってい! <<', note: '' });
    this.skillMenu.setItems(items);
  }

  /** 現在の選択でのプレビュー用の子(状態は変更しない) */
  private previewChild(): MonsterInstance | null {
    if (!this.parentA || !this.parentB) return null;
    try {
      return performSynthesis(this.parentA, this.parentB, this.selectedSkills).child;
    } catch {
      return null;
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.messages.update(dt);
    const key = this.app.input.poll();
    if (!key) return;
    const state = requireState(this.app);

    switch (this.phase) {
      case 'menu': {
        const r = this.mainMenu.handleKey(key);
        if (r === 'cancel') return void this.app.scenes.pop();
        if (r !== 'select') return;
        if (this.mainMenu.cursor === 0) {
          this.parentA = null;
          this.parentB = null;
          this.selectedSkills = [];
          this.buildListMenu();
          this.phase = 'pickA';
        } else if (this.mainMenu.cursor === 1) {
          this.hintPage = 0;
          this.phase = 'hints';
        } else {
          this.app.scenes.pop();
        }
        break;
      }
      case 'pickA': {
        const r = this.listMenu.handleKey(key);
        if (r === 'cancel') {
          this.phase = 'menu';
          return;
        }
        if (r !== 'select') return;
        const m = this.candidates()[this.listMenu.cursor];
        if (!m) return;
        this.parentA = m;
        this.buildListMenu(m);
        this.phase = 'pickB';
        break;
      }
      case 'pickB': {
        const r = this.listMenu.handleKey(key);
        if (r === 'cancel') {
          this.parentA = null;
          this.buildListMenu();
          this.phase = 'pickA';
          return;
        }
        if (r !== 'select') return;
        const m = this.candidates(this.parentA)[this.listMenu.cursor];
        if (!m || !this.parentA) return;
        const check = canSynthesize(this.parentA, m);
        if (!check.ok) return;
        this.parentB = m;
        this.selectedSkills = [];
        this.buildSkillMenu();
        this.phase = 'skills';
        break;
      }
      case 'skills': {
        const r = this.skillMenu.handleKey(key);
        if (r === 'cancel') {
          this.parentB = null;
          this.buildListMenu(this.parentA);
          this.phase = 'pickB';
          return;
        }
        if (r !== 'select') return;
        if (!this.parentA || !this.parentB) return;
        const child = this.previewChild();
        if (!child) return;
        const pool = inheritableSkills(this.parentA, this.parentB, child.speciesId);
        if (this.skillMenu.cursor >= pool.length) {
          // けってい
          this.confirmMenu.cursor = 0;
          this.phase = 'confirm';
          return;
        }
        const skillId = pool[this.skillMenu.cursor]!;
        if (this.selectedSkills.includes(skillId)) {
          this.selectedSkills = this.selectedSkills.filter((s) => s !== skillId);
        } else if (this.selectedSkills.length < MAX_INHERIT) {
          this.selectedSkills.push(skillId);
        }
        const cursor = this.skillMenu.cursor;
        this.buildSkillMenu();
        this.skillMenu.cursor = cursor;
        break;
      }
      case 'confirm': {
        const r = this.confirmMenu.handleKey(key);
        if (r === 'cancel' || (r === 'select' && this.confirmMenu.cursor === 1)) {
          this.phase = 'skills';
          return;
        }
        if (r !== 'select') return;
        if (!this.parentA || !this.parentB) return;
        const result = performSynthesis(this.parentA, this.parentB, this.selectedSkills);
        removeMonster(state, this.parentA.uid);
        removeMonster(state, this.parentB.uid);
        const where = addMonster(state, result.child);
        state.synthesisCount += 1;
        if (!state.scoutedSpecies.includes(result.species.id)) state.scoutedSpecies.push(result.species.id);
        if (!state.seenSpecies.includes(result.species.id)) state.seenSpecies.push(result.species.id);
        const pages = [
          `${this.parentA.nickname}と ${this.parentB.nickname}は ひかりに つつまれた…!`,
        ];
        if (result.wasSpecial) pages.push('こ… これは とくしゅはいごう だ!!');
        pages.push(`${result.species.name}が うまれた!`);
        pages.push(
          where === 'party'
            ? `${result.species.name}は パーティに くわわった!`
            : `${result.species.name}は ぼくじょうで まっている!`,
        );
        this.messages.setPages(pages);
        this.phase = 'result';
        break;
      }
      case 'result': {
        if (key === 'confirm' || key === 'cancel') {
          if (this.messages.advance()) {
            this.phase = 'menu';
          }
        }
        break;
      }
      case 'hints': {
        if (key === 'cancel') {
          this.phase = 'menu';
          return;
        }
        const perPage = 6;
        const pages = Math.ceil(SPECIAL_RECIPES.length / perPage);
        if (key === 'confirm' || key === 'right' || key === 'down') {
          this.hintPage += 1;
          if (this.hintPage >= pages) this.phase = 'menu';
        } else if (key === 'left' || key === 'up') {
          this.hintPage = Math.max(0, this.hintPage - 1);
        }
        break;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(10,5,25,0.85)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    drawWindow(ctx, 40, 20, SCREEN_W - 80, 56);
    drawText(ctx, 'はいごうの やかた', SCREEN_W / 2, 36, { align: 'center', color: '#ffd94a' });

    switch (this.phase) {
      case 'menu':
        this.mainMenu.draw(ctx, 60, 110, 300);
        break;
      case 'pickA':
      case 'pickB':
        drawText(ctx, this.phase === 'pickA' ? '1たいめの おやを えらぼう' : '2たいめの おやを えらぼう', 60, 100, {
          font: FONT_SMALL,
        });
        this.listMenu.draw(ctx, 60, 130, 460);
        if (this.parentA) this.drawParentCard(ctx, this.parentA, 560, 130, 'おや1');
        break;
      case 'skills':
      case 'confirm': {
        if (this.parentA) this.drawParentCard(ctx, this.parentA, 40, 100, 'おや1');
        if (this.parentB) this.drawParentCard(ctx, this.parentB, 40, 250, 'おや2');
        this.drawChildPreview(ctx, 40, 400);
        drawText(ctx, `ひきつぐ とくぎを えらぼう (さいだい${MAX_INHERIT}つ)`, 480, 100, { font: FONT_SMALL });
        this.skillMenu.draw(ctx, 480, 130, 440);
        if (this.phase === 'confirm') {
          drawWindow(ctx, SCREEN_W / 2 - 200, SCREEN_H / 2 - 120, 400, 70);
          drawText(ctx, 'この2たいで はいごうする?', SCREEN_W / 2, SCREEN_H / 2 - 98, { align: 'center' });
          drawText(ctx, '(おやは いなくなるよ)', SCREEN_W / 2, SCREEN_H / 2 - 72, {
            align: 'center',
            font: FONT_SMALL,
            color: '#f0a0a0',
          });
          this.confirmMenu.draw(ctx, SCREEN_W / 2 - 200, SCREEN_H / 2 - 40, 400);
        }
        break;
      }
      case 'result':
        this.messages.draw(ctx, 60, SCREEN_H - 170, SCREEN_W - 120, 150);
        break;
      case 'hints': {
        const perPage = 6;
        const start = this.hintPage * perPage;
        const slice = SPECIAL_RECIPES.slice(start, start + perPage);
        drawWindow(ctx, 60, 100, SCREEN_W - 120, 420);
        drawText(ctx, 'とくしゅはいごうの うわさ', SCREEN_W / 2, 120, { align: 'center', color: '#ffd94a' });
        const state = requireState(this.app);
        slice.forEach((r, i) => {
          const known = state.scoutedSpecies.includes(r.child);
          const childName = known ? getSpecies(r.child).name : '？？？';
          drawText(ctx, `・${r.hint}`, 100, 165 + i * 58, { font: FONT_SMALL });
          drawText(ctx, `→ ${childName}`, 130, 165 + i * 58 + 26, { font: FONT_SMALL, color: known ? '#8fd44a' : '#8888aa' });
        });
        drawText(
          ctx,
          `${this.hintPage + 1} / ${Math.ceil(SPECIAL_RECIPES.length / perPage)}  (Z:つぎ / X:もどる)`,
          SCREEN_W / 2,
          490,
          { align: 'center', font: FONT_SMALL, color: '#aaaacc' },
        );
        break;
      }
    }
  }

  private drawParentCard(ctx: CanvasRenderingContext2D, m: MonsterInstance, x: number, y: number, title: string): void {
    const sp = getSpecies(m.speciesId);
    drawWindow(ctx, x, y, 400, 140);
    drawText(ctx, title, x + 20, y + 14, { font: FONT_SMALL, color: '#ffd94a' });
    drawMonster(ctx, sp.family, sp.palette, x + 20, y + 40, 5);
    drawText(ctx, monsterLabel(m), x + 120, y + 40, { font: FONT_SMALL });
    drawText(ctx, speciesInfo(m.speciesId), x + 120, y + 66, { font: FONT_SMALL, color: '#aaaacc' });
    drawText(ctx, `とくぎ ${m.skillIds.length}こ`, x + 120, y + 92, { font: FONT_SMALL, color: '#aaaacc' });
  }

  private drawChildPreview(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const child = this.previewChild();
    drawWindow(ctx, x, y, 400, 180);
    drawText(ctx, '▼ うまれる モンスター', x + 20, y + 14, { font: FONT_SMALL, color: '#8fd44a' });
    if (!child) return;
    const sp = getSpecies(child.speciesId);
    const ms = maxStats(child);
    const bounce = Math.sin(this.time * 4) * 3;
    drawMonster(ctx, sp.family, sp.palette, x + 20, y + 44 + bounce, 6);
    drawText(ctx, `${sp.name} +${child.plus}`, x + 140, y + 44, { font: FONT_SMALL });
    drawText(ctx, speciesInfo(child.speciesId), x + 140, y + 70, { font: FONT_SMALL, color: '#aaaacc' });
    drawText(ctx, `HP${ms.hp} MP${ms.mp} こうげき${ms.atk}`, x + 140, y + 96, { font: FONT_SMALL });
    drawText(ctx, `しゅび${ms.def} すばやさ${ms.agi} かしこさ${ms.wis}`, x + 140, y + 122, { font: FONT_SMALL });
    drawText(ctx, `とくぎ: ${child.skillIds.map((s) => getSkill(s).name).join(' ') || 'なし'}`, x + 20, y + 150, {
      font: FONT_SMALL,
      color: '#ccccee',
    });
  }
}
