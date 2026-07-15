// ============================================================
// 入力管理
//  - キーボード: poll() で押下イベントを取り出す(PC用)
//  - タップ: takeTap() でキャンバス座標のタップを取り出す(スマホ/クリック)
// ============================================================

export type GameKey = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'menu';

/** キャンバス内部座標でのタップ位置 */
export interface TapPoint {
  x: number;
  y: number;
}

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
  private taps: TapPoint[] = [];

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

  /** タッチUIなどからの仮想キー押下(キーボードと同じ扱い) */
  virtualPress(key: GameKey): void {
    if (!this.held.has(key)) this.queue.push(key);
    this.held.add(key);
  }

  /** 仮想キーを離す */
  virtualRelease(key: GameKey): void {
    this.held.delete(key);
  }

  /** キュー先頭の押下イベントを取り出す(なければ null) */
  poll(): GameKey | null {
    return this.queue.shift() ?? null;
  }

  /** タップ発生を記録する(main.ts がキャンバス座標に変換して呼ぶ) */
  pushTap(x: number, y: number): void {
    this.taps.push({ x, y });
    if (this.taps.length > 4) this.taps.shift(); // 連打の溜めすぎ防止
  }

  /** 未処理のタップを1つ取り出す(なければ null) */
  takeTap(): TapPoint | null {
    return this.taps.shift() ?? null;
  }

  /** 溜まったイベントを捨てる(シーン切替時など) */
  flush(): void {
    this.queue.length = 0;
    this.taps.length = 0;
  }

  isHeld(key: GameKey): boolean {
    return this.held.has(key);
  }
}
