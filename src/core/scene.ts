// ============================================================
// シーン管理(スタック式)
// フィールドの上にメニューを重ねる、などをスタックで表現する。
// ============================================================
import type { Input } from './input';

export interface SceneContext {
  input: Input;
  scenes: SceneManager;
  canvas: HTMLCanvasElement;
}

export interface Scene {
  /** 毎フレーム呼ばれる(dt: 秒) */
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  /** スタックに積まれた時 */
  onEnter?(): void;
  /** スタックから外れた時 */
  onExit?(): void;
}

export class SceneManager {
  private stack: Scene[] = [];

  get current(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  push(scene: Scene): void {
    this.stack.push(scene);
    scene.onEnter?.();
  }

  pop(): void {
    const s = this.stack.pop();
    s?.onExit?.();
  }

  /** スタックを全部入れ替える(タイトル→フィールドなど) */
  replaceAll(scene: Scene): void {
    while (this.stack.length > 0) this.pop();
    this.push(scene);
  }

  update(dt: number): void {
    this.current?.update(dt);
  }

  /** 下のシーンも描く(オーバーレイメニュー用) */
  draw(ctx: CanvasRenderingContext2D): void {
    for (const s of this.stack) s.draw(ctx);
  }
}
