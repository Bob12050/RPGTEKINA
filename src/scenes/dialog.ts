// ============================================================
// NPC会話シーン(オーバーレイ)
// 会話が終わったら NPC のアクション(回復・ショップ・配合・牧場・ボス)を起動
// ============================================================
import { requireState, type App } from '../core/app';
import type { Scene } from '../core/scene';
import type { Npc } from '../core/types';
import { healParty } from '../game/state';
import { drawText, drawWindow, Menu, MessageBox, view, isPortrait } from '../ui/window';
import { BattleScene } from './battle';
import { FarmScene } from './farm';
import { ShopScene } from './shop';
import { SynthesisScene } from './synthesis';

export class DialogScene implements Scene {
  private messages = new MessageBox();
  private phase: 'talk' | 'bossConfirm' | 'done' = 'talk';
  private bossMenu = new Menu([{ label: 'たたかう!' }, { label: 'やめておく' }]);

  constructor(
    private app: App,
    private npc: Npc,
  ) {
    const state = requireState(app);
    let lines = [...npc.lines];
    if (npc.action === 'boss') {
      lines = state.flags['clearedBoss']
        ? ['まりゅうテキーナは しずかに ねむっている…。']
        : ['グオオオオ…! よくぞ ここまで きたな ちいさきものよ…。', 'わがねむりを さまたげるか…!!'];
    } else if (npc.action === 'heal') {
      lines = [...npc.lines];
    }
    const open = npc.action === 'boss' ? '『' : '「';
    const close = npc.action === 'boss' ? '』' : '」';
    this.messages.setPages(lines.map((l) => `${npc.name}${open}${l}${close}`));
  }

  update(dt: number): void {
    this.messages.update(dt);
    const key = this.app.input.poll();

    if (this.phase === 'talk') {
      if (key === 'confirm' || key === 'cancel') {
        const finished = this.messages.advance();
        if (finished) this.finishTalk();
      }
      return;
    }

    if (this.phase === 'bossConfirm') {
      if (!key) return;
      const result = this.bossMenu.handleKey(key);
      if (result === 'cancel' || (result === 'select' && this.bossMenu.cursor === 1)) {
        this.app.scenes.pop();
        return;
      }
      if (result === 'select' && this.bossMenu.cursor === 0) {
        this.app.scenes.pop();
        this.app.scenes.push(new BattleScene(this.app, [{ speciesId: 'tekina', level: 32 }], true));
      }
    }
  }

  private finishTalk(): void {
    const state = requireState(this.app);
    switch (this.npc.action) {
      case 'heal':
        healParty(state);
        this.messages.setPages(['モンスターたちは すっかり げんきに なった!']);
        this.npc = { ...this.npc, action: undefined }; // 2重回復メッセージ防止
        this.phase = 'talk';
        break;
      case 'shop':
        this.app.scenes.pop();
        this.app.scenes.push(new ShopScene(this.app));
        break;
      case 'synthesis':
        this.app.scenes.pop();
        this.app.scenes.push(new SynthesisScene(this.app));
        break;
      case 'farm':
        this.app.scenes.pop();
        this.app.scenes.push(new FarmScene(this.app));
        break;
      case 'boss':
        if (state.flags['clearedBoss']) {
          this.app.scenes.pop();
        } else {
          this.phase = 'bossConfirm';
        }
        break;
      default:
        this.app.scenes.pop();
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const m = isPortrait() ? 10 : 60;
    this.messages.draw(ctx, m, view.h - 160, view.w - m * 2, 140);
    if (this.phase === 'bossConfirm') {
      drawWindow(ctx, view.w - 320, view.h - 320, 260, 60);
      drawText(ctx, 'どうする?', view.w - 300, view.h - 302);
      this.bossMenu.draw(ctx, view.w - 320, view.h - 250, 260);
    }
  }
}
