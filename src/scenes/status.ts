// ============================================================
// モンスター詳細 — 管理画面と共通の高品質カードUI
// ============================================================
import {
  faArrowLeft,
  faBolt,
  faBookOpen,
  faClover,
  faDroplet,
  faShieldHalved,
  faStar,
  faWandSparkles,
  faWind,
} from '@fortawesome/free-solid-svg-icons';
import type { App } from '../core/app';
import type { Scene } from '../core/scene';
import type { MonsterInstance } from '../core/types';
import { FAMILY_NAMES, MAX_LUCK, rankStars } from '../core/types';
import { getSpecies } from '../data/monsters';
import { getSkill } from '../data/skills';
import { expToNext, maxStats } from '../game/monster';
import { RANK_COLORS } from '../ui/format';
import { drawIcon } from '../ui/icon';
import { drawSpeciesBadge, drawSpeciesPortrait } from '../ui/monsterArt';
import { drawMonster } from '../ui/sprites';
import { drawGauge, drawText, hpColor, inRect, isPortrait, view, wrapText, type Rect } from '../ui/window';

const UI_FONT = '"Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Yu Gothic", sans-serif';

export class StatusScene implements Scene {
  private time = 0;
  private headerBackRect: Rect | null = null;
  private footerBackRect: Rect | null = null;

  constructor(
    private app: App,
    private monster: MonsterInstance,
  ) {}

  onEnter(): void {
    this.app.input.flush();
  }

  update(dt: number): void {
    this.time += dt;
    const tap = this.app.input.takeTap();
    const key = this.app.input.poll();
    if (
      tap &&
      ((this.headerBackRect && inRect(tap.x, tap.y, this.headerBackRect)) ||
        (this.footerBackRect && inRect(tap.x, tap.y, this.footerBackRect)))
    ) {
      this.app.scenes.pop();
    }
    else if (key === 'cancel' || key === 'confirm') this.app.scenes.pop();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(1,4,16,0.88)';
    ctx.fillRect(0, 0, view.w, view.h);
    const glow = ctx.createRadialGradient(view.w / 2, view.h * 0.24, 20, view.w / 2, view.h * 0.24, view.h * 0.62);
    glow.addColorStop(0, 'rgba(40,112,184,0.26)');
    glow.addColorStop(0.55, 'rgba(18,38,83,0.1)');
    glow.addColorStop(1, 'rgba(2,5,18,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.restore();

    if (isPortrait()) this.drawPortrait(ctx);
    else this.drawLandscape(ctx);
  }

  private drawPortrait(ctx: CanvasRenderingContext2D): void {
    const shell = { x: 14, y: 24, w: view.w - 28, h: view.h - 48 };
    this.drawPanel(ctx, shell, true);
    this.drawHeader(ctx, { x: 28, y: 40, w: 54, h: 42 }, view.w / 2, 43);
    this.drawHero(ctx, { x: 28, y: 98, w: view.w - 56, h: 278 }, true);
    this.drawStats(ctx, { x: 28, y: 390, w: view.w - 56, h: 184 });
    this.drawSkills(ctx, { x: 28, y: 588, w: view.w - 56, h: 174 });
    this.drawDescription(ctx, { x: 28, y: 776, w: view.w - 56, h: 112 });
    this.drawBackButton(ctx, { x: 96, y: 908, w: view.w - 192, h: 60 });
  }

  private drawLandscape(ctx: CanvasRenderingContext2D): void {
    const shell = { x: 24, y: 18, w: view.w - 48, h: view.h - 36 };
    this.drawPanel(ctx, shell, true);
    this.drawHeader(ctx, { x: 40, y: 34, w: 56, h: 42 }, 276, 37);
    this.drawHero(ctx, { x: 40, y: 92, w: 410, h: 356 }, false);
    this.drawStats(ctx, { x: 466, y: 92, w: 454, h: 184 });
    this.drawSkills(ctx, { x: 466, y: 290, w: 454, h: 158 });
    this.drawDescription(ctx, { x: 40, y: 462, w: 650, h: 104 });
    this.drawBackButton(ctx, { x: 724, y: 482, w: 196, h: 66 });
  }

  private drawHeader(ctx: CanvasRenderingContext2D, backRect: Rect, titleX: number, titleY: number): void {
    this.headerBackRect = backRect;
    ctx.save();
    beveledPath(ctx, backRect, 10);
    const fill = ctx.createLinearGradient(0, backRect.y, 0, backRect.y + backRect.h);
    fill.addColorStop(0, '#4b3519');
    fill.addColorStop(1, '#151329');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#e0ba58';
    ctx.lineWidth = 2;
    ctx.stroke();
    drawIcon(ctx, faArrowLeft, backRect.x + 15, backRect.y + 9, 24, '#ffe279');
    ctx.restore();
    drawText(ctx, 'モンスター詳細', titleX, titleY, {
      align: 'center',
      color: '#ffe187',
      font: `bold 22px ${UI_FONT}`,
      shadow: true,
    });
  }

  private drawHero(ctx: CanvasRenderingContext2D, rect: Rect, portrait: boolean): void {
    const monster = this.monster;
    const species = getSpecies(monster.speciesId);
    const stats = maxStats(monster);
    this.drawPanel(ctx, rect, false);
    const artRect = portrait
      ? { x: rect.x + 10, y: rect.y + 10, w: 186, h: rect.h - 20 }
      : { x: rect.x + 10, y: rect.y + 10, w: 222, h: rect.h - 20 };
    ctx.save();
    rounded(ctx, artRect.x, artRect.y, artRect.w, artRect.h, 12);
    ctx.clip();
    ctx.fillStyle = '#0d2141';
    ctx.fillRect(artRect.x, artRect.y, artRect.w, artRect.h);
    const bounce = Math.sin(this.time * 2.4) * 3;
    if (!drawSpeciesPortrait(ctx, species, { ...artRect, y: artRect.y + bounce })) {
      const scale = portrait ? 9 : 11;
      drawMonster(
        ctx,
        species.family,
        species.palette,
        artRect.x + artRect.w / 2 - scale * 8,
        artRect.y + artRect.h / 2 - scale * 8 + bounce,
        scale,
      );
    }
    const fade = ctx.createLinearGradient(0, artRect.y + artRect.h * 0.6, 0, artRect.y + artRect.h);
    fade.addColorStop(0, 'rgba(3,8,23,0)');
    fade.addColorStop(1, 'rgba(3,8,23,0.95)');
    ctx.fillStyle = fade;
    ctx.fillRect(artRect.x, artRect.y + artRect.h * 0.55, artRect.w, artRect.h * 0.45);
    ctx.restore();
    ctx.save();
    rounded(ctx, artRect.x, artRect.y, artRect.w, artRect.h, 12);
    ctx.strokeStyle = RANK_COLORS[species.rank];
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
    drawSpeciesBadge(ctx, species, { x: artRect.x + 10, y: artRect.y + 10, w: 38, h: 38 });

    const infoX = artRect.x + artRect.w + 18;
    const infoW = rect.x + rect.w - infoX - 14;
    drawText(ctx, monster.nickname, infoX, rect.y + 20, {
      color: '#ffffff',
      font: `bold ${portrait ? 21 : 24}px ${UI_FONT}`,
      shadow: true,
    });
    drawText(ctx, `Lv ${monster.level}${monster.plus > 0 ? `  +${monster.plus}` : ''}`, infoX, rect.y + 55, {
      color: '#cdd9ef',
      font: `bold 14px ${UI_FONT}`,
    });
    drawIcon(ctx, faStar, infoX, rect.y + 84, 18, RANK_COLORS[species.rank]);
    drawText(ctx, `★${rankStars(species.rank)}  ランク${species.rank}`, infoX + 27, rect.y + 83, {
      color: RANK_COLORS[species.rank],
      font: `bold 13px ${UI_FONT}`,
    });
    drawText(ctx, FAMILY_NAMES[species.family], infoX, rect.y + 112, {
      color: '#99b3d8',
      font: `12px ${UI_FONT}`,
    });
    drawIcon(ctx, faClover, infoX, rect.y + 139, 17, '#79e28c');
    drawText(ctx, `ラック ${monster.luck ?? 1} / ${MAX_LUCK}`, infoX + 27, rect.y + 138, {
      color: '#a8efa3',
      font: `bold 12px ${UI_FONT}`,
    });

    drawText(ctx, `HP ${monster.hp} / ${stats.hp}`, infoX, rect.y + 176, {
      color: '#dfe8f8',
      font: `bold 11px ${UI_FONT}`,
    });
    drawGauge(ctx, infoX, rect.y + 197, infoW, 9, monster.hp / stats.hp, hpColor(monster.hp / stats.hp));
    drawText(ctx, `MP ${monster.mp} / ${stats.mp}`, infoX, rect.y + 216, {
      color: '#dfe8f8',
      font: `bold 11px ${UI_FONT}`,
    });
    drawGauge(ctx, infoX, rect.y + 237, infoW, 9, monster.mp / stats.mp, '#4c8eea');
    drawText(ctx, `次のLvまで ${Math.max(0, expToNext(monster.level) - monster.exp)}`, infoX, rect.y + rect.h - 27, {
      color: '#b7c5da',
      font: `14px ${UI_FONT}`,
    });
  }

  private drawStats(ctx: CanvasRenderingContext2D, rect: Rect): void {
    const stats = maxStats(this.monster);
    this.drawPanel(ctx, rect, false);
    this.drawSectionTitle(ctx, rect, 'ステータス', faBolt);
    const entries = [
      { label: 'こうげき', value: stats.atk, icon: faBolt, color: '#ffb25f' },
      { label: 'しゅび', value: stats.def, icon: faShieldHalved, color: '#72c7ff' },
      { label: 'すばやさ', value: stats.agi, icon: faWind, color: '#72e8b0' },
      { label: 'かしこさ', value: stats.wis, icon: faWandSparkles, color: '#d99aff' },
    ];
    const gap = 9;
    const cardW = (rect.w - 28 - gap) / 2;
    const cardH = 52;
    entries.forEach((entry, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const card = { x: rect.x + 14 + column * (cardW + gap), y: rect.y + 54 + row * 61, w: cardW, h: cardH };
      rounded(ctx, card.x, card.y, card.w, card.h, 8);
      ctx.fillStyle = 'rgba(8,20,42,0.88)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(111,147,199,0.38)';
      ctx.lineWidth = 1;
      ctx.stroke();
      drawIcon(ctx, entry.icon, card.x + 12, card.y + 14, 23, entry.color);
      drawText(ctx, entry.label, card.x + 46, card.y + 8, { color: '#bac9de', font: `14px ${UI_FONT}` });
      drawText(ctx, String(entry.value), card.x + card.w - 12, card.y + 21, {
        align: 'right',
        color: '#ffffff',
        font: `bold 18px ${UI_FONT}`,
      });
    });
  }

  private drawSkills(ctx: CanvasRenderingContext2D, rect: Rect): void {
    this.drawPanel(ctx, rect, false);
    this.drawSectionTitle(ctx, rect, 'とくぎ', faWandSparkles);
    const skills = this.monster.skillIds.map(getSkill);
    if (skills.length === 0) {
      drawText(ctx, 'まだ、とくぎを覚えていません', rect.x + rect.w / 2, rect.y + rect.h / 2, {
        align: 'center',
        color: '#8fa2bf',
        font: `13px ${UI_FONT}`,
      });
      return;
    }
    const gap = 8;
    const cellW = (rect.w - 28 - gap) / 2;
    skills.slice(0, 6).forEach((skill, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const cell = { x: rect.x + 14 + column * (cellW + gap), y: rect.y + 54 + row * 38, w: cellW, h: 34 };
      rounded(ctx, cell.x, cell.y, cell.w, cell.h, 6);
      ctx.fillStyle = 'rgba(8,20,42,0.82)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(115,151,204,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      drawIcon(ctx, faDroplet, cell.x + 9, cell.y + 9, 14, '#66b7ff');
      drawText(ctx, skill.name, cell.x + 30, cell.y + 8, { color: '#eef3ff', font: `bold 14px ${UI_FONT}` });
      if (skill.mpCost > 0) {
        drawText(ctx, `MP${skill.mpCost}`, cell.x + cell.w - 8, cell.y + 7, {
          align: 'right',
          color: '#8dbcf4',
          font: `12px ${UI_FONT}`,
        });
      }
    });
  }

  private drawDescription(ctx: CanvasRenderingContext2D, rect: Rect): void {
    const species = getSpecies(this.monster.speciesId);
    this.drawPanel(ctx, rect, false);
    this.drawSectionTitle(ctx, rect, 'プロフィール', faBookOpen);
    const lines = wrapText(ctx, species.desc, rect.w - 34, `14px ${UI_FONT}`).slice(0, 3);
    lines.forEach((line, index) => {
      drawText(ctx, line, rect.x + 17, rect.y + 48 + index * 20, {
        color: '#d5deed',
        font: `14px ${UI_FONT}`,
      });
    });
  }

  private drawSectionTitle(ctx: CanvasRenderingContext2D, rect: Rect, label: string, icon: typeof faBolt): void {
    drawIcon(ctx, icon, rect.x + 16, rect.y + 15, 22, '#68dfff');
    drawText(ctx, label, rect.x + 48, rect.y + 14, {
      color: '#ffe084',
      font: `bold 16px ${UI_FONT}`,
    });
    ctx.beginPath();
    ctx.moveTo(rect.x + 14, rect.y + 44);
    ctx.lineTo(rect.x + rect.w - 14, rect.y + 44);
    ctx.strokeStyle = 'rgba(218,186,96,0.36)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawBackButton(ctx: CanvasRenderingContext2D, rect: Rect): void {
    this.footerBackRect = rect;
    ctx.save();
    beveledPath(ctx, rect, 10);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    fill.addColorStop(0, '#23639a');
    fill.addColorStop(1, '#0b2d63');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#6de5ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    drawIcon(ctx, faArrowLeft, rect.x + rect.w / 2 - 52, rect.y + (rect.h - 22) / 2, 22, '#ffffff');
    drawText(ctx, '戻る', rect.x + rect.w / 2 + 13, rect.y + rect.h / 2 - 10, {
      align: 'center',
      color: '#ffffff',
      font: `bold 16px ${UI_FONT}`,
    });
    ctx.restore();
  }

  private drawPanel(ctx: CanvasRenderingContext2D, rect: Rect, gold: boolean): void {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    rounded(ctx, rect.x, rect.y, rect.w, rect.h, 13);
    const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    fill.addColorStop(0, 'rgba(20,40,75,0.97)');
    fill.addColorStop(1, 'rgba(5,11,27,0.98)');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = gold ? '#d2ad59' : '#5878a5';
    ctx.lineWidth = gold ? 2.2 : 1.3;
    ctx.stroke();
    rounded(ctx, rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10, 10);
    ctx.strokeStyle = gold ? 'rgba(255,233,151,0.3)' : 'rgba(177,206,244,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function beveledPath(ctx: CanvasRenderingContext2D, rect: Rect, cut: number): void {
  ctx.beginPath();
  ctx.moveTo(rect.x + cut, rect.y);
  ctx.lineTo(rect.x + rect.w - cut, rect.y);
  ctx.lineTo(rect.x + rect.w, rect.y + cut);
  ctx.lineTo(rect.x + rect.w, rect.y + rect.h - cut);
  ctx.lineTo(rect.x + rect.w - cut, rect.y + rect.h);
  ctx.lineTo(rect.x + cut, rect.y + rect.h);
  ctx.lineTo(rect.x, rect.y + rect.h - cut);
  ctx.lineTo(rect.x, rect.y + cut);
  ctx.closePath();
}
