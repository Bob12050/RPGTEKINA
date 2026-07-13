// ============================================================
// 配合データ
//  - FAMILY_TABLE: 系統×系統 → 生まれる子の系統(通常配合)
//  - SPECIAL_RECIPES: 特定種族の組み合わせ → 特別なモンスター
// 通常配合で生まれるのは最高ランクA。Sランクは特殊配合のみ!
// ============================================================
import type { Family } from '../core/types';

/** キーは系統をソートして "a+b" 形式(順不同) */
function key(a: Family, b: Family): string {
  return [a, b].sort().join('+');
}

const table = new Map<string, Family>();

function rule(a: Family, b: Family, child: Family): void {
  table.set(key(a, b), child);
}

// 同系統どうし → 同系統
const ALL_FAMILIES: Family[] = ['slime', 'dragon', 'beast', 'nature', 'demon', 'zombie', 'material', 'mystic'];
for (const f of ALL_FAMILIES) rule(f, f, f);

// スライムは万能素材: 相手側の系統が生まれる
rule('slime', 'dragon', 'dragon');
rule('slime', 'beast', 'beast');
rule('slime', 'nature', 'nature');
rule('slime', 'demon', 'demon');
rule('slime', 'zombie', 'zombie');
rule('slime', 'material', 'material');
rule('slime', 'mystic', 'mystic');

// ドラゴンの血は濃い
rule('dragon', 'beast', 'dragon');
rule('dragon', 'nature', 'dragon');
rule('dragon', 'demon', 'demon');
rule('dragon', 'zombie', 'zombie');
rule('dragon', 'material', 'dragon');
rule('dragon', 'mystic', 'mystic');

// まじゅう
rule('beast', 'nature', 'nature');
rule('beast', 'demon', 'beast');
rule('beast', 'zombie', 'zombie');
rule('beast', 'material', 'beast');
rule('beast', 'mystic', 'mystic');

// しぜん
rule('nature', 'demon', 'demon');
rule('nature', 'zombie', 'zombie');
rule('nature', 'material', 'nature');
rule('nature', 'mystic', 'mystic');

// あくま
rule('demon', 'zombie', 'zombie');
rule('demon', 'material', 'demon');
rule('demon', 'mystic', 'mystic');

// ゾンビ
rule('zombie', 'material', 'zombie');
rule('zombie', 'mystic', 'mystic');

// ぶっしつ
rule('material', 'mystic', 'mystic');

export function childFamily(a: Family, b: Family): Family {
  const child = table.get(key(a, b));
  if (!child) throw new Error(`配合表にない組み合わせ: ${a} × ${b}`);
  return child;
}

/** 特殊配合レシピ(順不同)。ここに足せば新レシピ完成 */
export interface SpecialRecipe {
  parents: [string, string]; // 種族ID
  child: string; // 種族ID
  hint: string; // 配合屋のヒントで表示
}

export const SPECIAL_RECIPES: SpecialRecipe[] = [
  { parents: ['dekapuni', 'dekapuni'], child: 'kingpuni', hint: 'おおきな ぷに どうしを かけあわせると…?' },
  { parents: ['kingpuni', 'metapuni'], child: 'nijipuni', hint: 'ぷにの おうさまと まぼろしの ぷにが であうとき…' },
  { parents: ['mahopuni', 'dryad'], child: 'unicorn', hint: 'まほうの ぷにと もりの せいれいの きせき。' },
  { parents: ['flamedrake', 'frostdragon'], child: 'grandragon', hint: 'ほのおと こおりの りゅうが まじわるとき…' },
  { parents: ['cerberus', 'frostdragon'], child: 'fenrir', hint: 'じごくの ばんけんに こおりの ちからを。' },
  { parents: ['eldertreant', 'dryad'], child: 'daiju', hint: 'もりの ちょうろうと せいれいの さいごの こたえ。' },
  { parents: ['archdemon', 'lich'], child: 'demonlord', hint: 'まかいの しょうぐんと ふしの まどうしの けいやく。' },
  { parents: ['lich', 'vampire'], child: 'necros', hint: 'ふしの まどうしと よるの きぞくの えんげき。' },
  { parents: ['mithrilgolem', 'irongolem'], child: 'diamondgolem', hint: 'でんせつの きんぞくと くろがねを きたえあげろ。' },
  { parents: ['flamedrake', 'eldertreant'], child: 'phoenix', hint: 'ほのおの りゅうと せんねんの たいぼくから うまれる きせき。' },
  { parents: ['phoenix', 'unicorn'], child: 'luminas', hint: 'れいちょうと いっかくじゅう、ふたつの せいなる ひかり。' },
  { parents: ['grandragon', 'demonlord'], child: 'tekina', hint: 'りゅうの おうと まぞくの おう…きんだんの はいごう。' },
];

/** 特殊レシピ検索(順不同マッチ) */
export function findSpecialRecipe(speciesA: string, speciesB: string): SpecialRecipe | undefined {
  return SPECIAL_RECIPES.find((r) => {
    const [p1, p2] = r.parents;
    return (p1 === speciesA && p2 === speciesB) || (p1 === speciesB && p2 === speciesA);
  });
}
