// ============================================================
// キー入力管理
//  - onKey: 押した瞬間のイベント(メニュー操作用)
//  - isHeld: 押しっぱなし判定(フィールド移動用)
// ============================================================

export type GameKey = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'menu';

const KEY_MAP: Record<string, GameKey> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
  z: 'confirm',
  Z: 'confirm',
  Enter: 'confirm',
  ' ': 'confirm',
  x: 'cancel',
  X: 'cancel',
  Escape: 'cancel',
  Backspace: 'cancel',
  m: 'menu',
  M: 'menu',
};

export class Input {
  private held = new Set<GameKey>();
  private queue: GameKey[] = [];

  attach(target: Window): void {
    target.addEventListener('keydown', (e) => {
      const key = KEY_MAP[e.key];
      if (!key) return;
      e.preventDefault();
      if (!this.held.has(key)) this.queue.push(key);
      this.held.add(key);
    });
    target.addEventListener('keyup', (e) => {
      const key = KEY_MAP[e.key];
      if (!key) return;
      this.held.delete(key);
    });
    // ウィンドウフォーカスが外れたら押しっぱなし状態を解除
    target.addEventListener('blur', () => this.held.clear());
  }

  /** キュー先頭の押下イベントを取り出す(なければ null) */
  poll(): GameKey | null {
    return this.queue.shift() ?? null;
  }

  /** 溜まったイベントを捨てる(シーン切替時など) */
  flush(): void {
    this.queue.length = 0;
  }

  isHeld(key: GameKey): boolean {
    return this.held.has(key);
  }
}
