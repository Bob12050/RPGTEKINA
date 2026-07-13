// ============================================================
// エントリポイント: キャンバス生成・入力・ゲームループ
// ============================================================
import type { App } from './core/app';
import { Input } from './core/input';
import { SceneManager } from './core/scene';
import { setupTouchControls } from './ui/touch';
import { SCREEN_H, SCREEN_W } from './ui/window';
import { TitleScene } from './scenes/title';

function boot(): void {
  const root = document.getElementById('game-root');
  if (!root) throw new Error('#game-root が見つかりません');

  const canvas = document.createElement('canvas');
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  canvas.tabIndex = 0;
  root.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2Dコンテキストを取得できません');
  ctx.imageSmoothingEnabled = false;

  const input = new Input();
  input.attach(window);
  setupTouchControls(input); // スマホならタッチ操作UIを表示

  const scenes = new SceneManager();
  const app: App = { input, scenes, state: null };
  scenes.push(new TitleScene(app));

  // E2Eテスト・デバッグ用にアプリ状態を公開する
  (window as unknown as { __game?: App }).__game = app;

  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    scenes.update(dt);
    ctx!.clearRect(0, 0, SCREEN_W, SCREEN_H);
    scenes.draw(ctx!);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
