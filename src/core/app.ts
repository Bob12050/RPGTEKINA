// アプリ全体の共有コンテキスト
import type { GameState } from './types';
import type { Input } from './input';
import type { SceneManager } from './scene';

export interface App {
  input: Input;
  scenes: SceneManager;
  /** タイトル画面の間は null */
  state: GameState | null;
}

/** ゲーム中であることを保証して state を取る */
export function requireState(app: App): GameState {
  if (!app.state) throw new Error('ゲームが開始されていません');
  return app.state;
}
