// Menuウィジェットのカーソル/スクロール整合性テスト
// (配合の親選択リストでカーソルが画面外に消えるバグのリグレッション)
import { describe, expect, it } from 'vitest';
import { Menu } from '../src/ui/window';

function items(n: number) {
  return Array.from({ length: n }, (_, i) => ({ label: `item${i}` }));
}

describe('Menu', () => {
  it('setCursor でスクロールが追従する', () => {
    const menu = new Menu(items(20), 8);
    menu.setCursor(15);
    expect(menu.cursor).toBe(15);
    // 15番目が可視範囲(scroll..scroll+7)に入っている
    expect(menu.scroll).toBeLessThanOrEqual(15);
    expect(15).toBeLessThan(menu.scroll + 8);
  });

  it('reset でカーソルとスクロールが先頭に戻る', () => {
    const menu = new Menu(items(20), 8);
    menu.setCursor(15);
    menu.setItems(items(19));
    menu.reset();
    expect(menu.cursor).toBe(0);
    expect(menu.scroll).toBe(0);
  });

  it('スクロール後に setItems + reset してもカーソルが常に可視範囲にある', () => {
    const menu = new Menu(items(20), 8);
    for (let i = 0; i < 15; i++) menu.handleKey('down');
    expect(menu.cursor).toBe(15);
    menu.setItems(items(19)); // 親Aを除いたリストの再構築を模倣
    menu.reset();
    expect(menu.cursor).toBe(0);
    expect(menu.scroll).toBe(0); // 以前は scroll=8 のままカーソルが画面外だった
  });

  it('上下キーで端から端へループする', () => {
    const menu = new Menu(items(3));
    menu.handleKey('up');
    expect(menu.cursor).toBe(2);
    menu.handleKey('down');
    expect(menu.cursor).toBe(0);
  });

  it('setCursor は範囲外を渡してもクランプされる', () => {
    const menu = new Menu(items(5), 8);
    menu.setCursor(99);
    expect(menu.cursor).toBe(4);
    menu.setCursor(-5);
    expect(menu.cursor).toBe(0);
  });
});
