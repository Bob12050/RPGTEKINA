// ============================================================
// アイテムデータ
// ============================================================
import type { ItemDef } from '../core/types';

export const ITEMS: ItemDef[] = [
  {
    id: 'herb',
    name: 'やくそう',
    desc: '味方1体のHPを約35回復する',
    price: 10,
    effect: { kind: 'heal', power: 35 },
  },
  {
    id: 'goodherb',
    name: 'いいやくそう',
    desc: '味方1体のHPを約90回復する',
    price: 40,
    effect: { kind: 'heal', power: 90 },
  },
  {
    id: 'magicwater',
    name: 'まほうのせいすい',
    desc: '味方1体のMPを約30回復する',
    price: 60,
    effect: { kind: 'mp', power: 30 },
  },
  {
    id: 'lifeleaf',
    name: 'いのちのはっぱ',
    desc: '力尽きた味方1体をHP半分で復活させる',
    price: 150,
    effect: { kind: 'revive', ratio: 0.5 },
  },
  {
    id: 'meatchunk',
    name: 'モンスターのごちそう',
    desc: 'スカウトの成功率が1.5倍になる(戦闘中に使用)',
    price: 80,
    effect: { kind: 'scoutBoost', multiplier: 1.5 },
  },
  {
    id: 'royalmeat',
    name: 'ごうかなごちそう',
    desc: 'スカウトの成功率が2倍になる(戦闘中に使用)',
    price: 300,
    effect: { kind: 'scoutBoost', multiplier: 2.0 },
  },
];

const itemMap = new Map(ITEMS.map((i) => [i.id, i]));

export function getItem(id: string): ItemDef {
  const item = itemMap.get(id);
  if (!item) throw new Error(`未定義のアイテム: ${id}`);
  return item;
}

/** ショップに並ぶ商品 */
export const SHOP_ITEMS: string[] = [
  'herb',
  'goodherb',
  'magicwater',
  'lifeleaf',
  'meatchunk',
  'royalmeat',
];
