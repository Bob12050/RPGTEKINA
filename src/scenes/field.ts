// ============================================================
// フィールド探索シーン
// タイル移動・カメラ・エンカウント・NPC会話・ポータル遷移
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import type { Dir, MapDef } from '../core/types';
import { chance, randInt, weightedPick } from '../core/rng';
import { getMap, isWalkable, tileAt } from '../data/maps';
import { getSpecies } from '../data/monsters';
import type { EnemySpec } from '../game/battle';
import { markSeen } from '../game/state';
import { drawHero, drawMonster, drawGridSprite, HERO_SPRITE, drawTile } from '../ui/sprites';
import { drawText, drawWindow, FONT_SMALL, MessageBox, SCREEN_H, SCREEN_W } from '../ui/window';
import { BattleScene } from './battle';
import { DialogScene } from './dialog';
import { PauseMenuScene } from './menu';

const TILE = 48;
const VIEW_W = SCREEN_W / TILE; // 20
const VIEW_H = SCREEN_H / TILE; // 13
const MOVE_SPEED = 5.5; // タイル/秒

const DIR_DELTA: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export class FieldScene implements Scene {
  private map: MapDef;
  private moving = false;
  private moveProgress = 0;
  private fromX = 0;
  private fromY = 0;
  private time = 0;
  private mapNameTimer = 2.5;
  private messages = new MessageBox();

  constructor(
    private app: App,
    initialMessages: string[] = [],
  ) {
    const state = requireState(app);
    this.map = getMap(state.mapId);
    if (initialMessages.length > 0) this.messages.setPages(initialMessages);
  }

  onEnter(): void {
    this.app.input.flush();
  }

  update(dt: number): void {
    this.time += dt;
    this.mapNameTimer -= dt;
    this.messages.update(dt);
    const state = requireState(this.app);

    // メッセージ表示中はページ送りだけ受け付ける
    if (!this.messages.done) {
      const key = this.app.input.poll();
      if (key === 'confirm' || key === 'cancel') this.messages.advance();
      return;
    }

    // 離散キーイベント(メニュー・会話・タップでの振り向き)
    const key = this.app.input.poll();
    if (key === 'menu' || key === 'cancel') {
      this.app.scenes.push(new PauseMenuScene(this.app));
      return;
    }
    if (key === 'confirm' && !this.moving) {
      const [dx, dy] = DIR_DELTA[state.dir];
      const npc = this.map.npcs.find((n) => n.x === state.x + dx && n.y === state.y + dy);
      if (npc) {
        this.app.scenes.push(new DialogScene(this.app, npc));
        return;
      }
    }

    // 移動
    if (this.moving) {
      this.moveProgress += MOVE_SPEED * dt;
      if (this.moveProgress >= 1) {
        this.moving = false;
        this.moveProgress = 0;
        this.onStepComplete();
      }
      return;
    }

    // 一瞬だけ押されたキーでも向き変更+1歩あるけるようにする
    if (key === 'up' || key === 'down' || key === 'left' || key === 'right') {
      this.tryMove(key);
      return;
    }

    for (const dir of ['up', 'down', 'left', 'right'] as Dir[]) {
      if (this.app.input.isHeld(dir)) {
        this.tryMove(dir);
        break;
      }
    }
  }

  private tryMove(dir: Dir): void {
    const state = requireState(this.app);
    state.dir = dir;
    const [dx, dy] = DIR_DELTA[dir];
    const nx = state.x + dx;
    const ny = state.y + dy;
    if (isWalkable(this.map, nx, ny)) {
      this.fromX = state.x;
      this.fromY = state.y;
      state.x = nx;
      state.y = ny;
      this.moving = true;
      this.moveProgress = 0;
    }
  }

  /** 1歩あるき終わったとき: ポータル → エンカウント の順に判定 */
  private onStepComplete(): void {
    const state = requireState(this.app);
    const portal = this.map.portals.find((p) => p.x === state.x && p.y === state.y);
    if (portal) {
      state.mapId = portal.toMap;
      state.x = portal.toX;
      state.y = portal.toY;
      this.map = getMap(portal.toMap);
      this.mapNameTimer = 2.5;
      this.app.input.flush();
      return;
    }
    if (this.map.encounterRate > 0 && this.map.encounters.length > 0 && chance(this.map.encounterRate)) {
      this.startEncounter();
    }
  }

  private startEncounter(): void {
    const state = requireState(this.app);
    const sizeRoll = weightedPick([
      { weight: 50, value: 1 },
      { weight: 35, value: 2 },
      { weight: 15, value: 3 },
    ]);
    const size = Math.min(sizeRoll, this.map.maxGroupSize);
    const specs: EnemySpec[] = [];
    for (let i = 0; i < size; i++) {
      const entry = weightedPick(this.map.encounters.map((e) => ({ weight: e.weight, value: e })));
      specs.push({ speciesId: entry.speciesId, level: randInt(entry.minLevel, entry.maxLevel) });
      markSeen(state, entry.speciesId);
    }
    this.app.scenes.push(new BattleScene(this.app, specs, false));
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const state = requireState(this.app);

    // プレイヤーの描画上の位置(移動補間)
    const t = this.moving ? this.moveProgress : 1;
    const px = this.fromX + (state.x - this.fromX) * t;
    const py = this.fromY + (state.y - this.fromY) * t;
    const mapW = this.map.tiles[0]!.length;
    const mapH = this.map.tiles.length;
    const camX = Math.max(0, Math.min(mapW - VIEW_W, px - VIEW_W / 2 + 0.5));
    const camY = Math.max(0, Math.min(mapH - VIEW_H, py - VIEW_H / 2 + 0.5));

    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    const startX = Math.floor(camX);
    const startY = Math.floor(camY);
    for (let y = startY; y <= Math.min(mapH - 1, startY + VIEW_H + 1); y++) {
      for (let x = startX; x <= Math.min(mapW - 1, startX + VIEW_W + 1); x++) {
        drawTile(ctx, tileAt(this.map, x, y), (x - camX) * TILE, (y - camY) * TILE, TILE, x, y, this.time);
      }
    }

    // NPC
    for (const npc of this.map.npcs) {
      const sx = (npc.x - camX) * TILE;
      const sy = (npc.y - camY) * TILE;
      if (sx < -TILE || sx > SCREEN_W || sy < -TILE || sy > SCREEN_H) continue;
      if (npc.action === 'boss') {
        const sp = getSpecies('tekina');
        drawMonster(ctx, sp.family, sp.palette, sx, sy + Math.sin(this.time * 2) * 3, 3);
      } else {
        drawGridSprite(
          ctx,
          HERO_SPRITE,
          {
            '#': '#1a1a24',
            H: '#4a3320',
            F: '#f5c9a0',
            C: npc.color ?? '#999999',
            L: '#3d3348',
            W: '#ffffff',
            K: '#1a1a24',
          },
          sx,
          sy,
          3,
        );
      }
    }

    // プレイヤー
    drawHero(ctx, (px - camX) * TILE, (py - camY) * TILE - 6, 3);

    // マップ名
    if (this.mapNameTimer > 0) {
      drawWindow(ctx, 16, 16, 260, 52);
      drawText(ctx, this.map.name, 146, 31, { align: 'center' });
    }
    drawText(ctx, 'Z/A:はなす・しらべる  X/B:メニュー', SCREEN_W - 16, 10, {
      align: 'right',
      font: FONT_SMALL,
      color: 'rgba(255,255,255,0.75)',
    });

    // 冒頭メッセージ
    this.messages.draw(ctx, 60, SCREEN_H - 150, SCREEN_W - 120, 130);
  }
}
