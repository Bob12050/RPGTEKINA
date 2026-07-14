// ============================================================
// モンスター図鑑データ(全70種)
// 新モンスターはここに追加するだけでOK。ランクがそのままガチャのレア度になる。
// テスト(tests/data.test.ts)が learnset の参照整合性などを自動チェックする。
// ============================================================
import type { Family, Rank, SpeciesDef, Stats } from '../core/types';

type StatArray = [hp: number, mp: number, atk: number, def: number, agi: number, wis: number];

function toStats(a: StatArray): Stats {
  return { hp: a[0], mp: a[1], atk: a[2], def: a[3], agi: a[4], wis: a[5] };
}

const DEFAULT_EXP: Record<Rank, number> = { F: 5, E: 9, D: 16, C: 30, B: 55, A: 95, S: 200 };
const DEFAULT_GOLD: Record<Rank, number> = { F: 4, E: 7, D: 13, C: 24, B: 45, A: 80, S: 160 };

interface SpeciesInput {
  id: string;
  name: string;
  family: Family;
  rank: Rank;
  base: StatArray;
  growth: StatArray;
  learnset?: [level: number, skillId: string][];
  resist?: SpeciesDef['resist'];
  exp?: number;
  gold?: number;
  palette: [string, string, string];
  desc: string;
}

function species(s: SpeciesInput): SpeciesDef {
  return {
    id: s.id,
    name: s.name,
    family: s.family,
    rank: s.rank,
    base: toStats(s.base),
    growth: toStats(s.growth),
    learnset: (s.learnset ?? []).map(([level, skillId]) => ({ level, skillId })),
    resist: s.resist ?? {},
    expYield: s.exp ?? DEFAULT_EXP[s.rank],
    goldYield: s.gold ?? DEFAULT_GOLD[s.rank],
    palette: s.palette,
    desc: s.desc,
  };
}

export const SPECIES: SpeciesDef[] = [
  // ================= スライム系 =================
  species({
    id: 'puni', name: 'ぷに', family: 'slime', rank: 'F',
    base: [22, 6, 10, 9, 10, 7], growth: [5, 1.2, 2.4, 2.2, 2.0, 1.5],
    learnset: [[1, 'bite'], [3, 'heal']],
    palette: ['#4aa3ff', '#2a6fd6', '#bfe0ff'],
    desc: 'ぷにぷにした からだの あいくるしい モンスター。冒険の あいぼうに ぴったり。',
  }),
  species({
    id: 'tsunopuni', name: 'つのぷに', family: 'slime', rank: 'E',
    base: [30, 8, 15, 12, 12, 8], growth: [6, 1.4, 3.0, 2.6, 2.3, 1.7],
    learnset: [[5, 'powerslash']],
    palette: ['#ff9a3d', '#d66e1a', '#ffd9ad'],
    desc: 'りっぱな ツノが じまんの ぷに。とっしんこうげきが とくい。',
  }),
  species({
    id: 'dekapuni', name: 'でかぷに', family: 'slime', rank: 'D',
    base: [48, 10, 20, 17, 13, 10], growth: [8, 1.6, 3.6, 3.2, 2.2, 2.0],
    learnset: [[12, 'rush']],
    palette: ['#5ecf5e', '#2f9e2f', '#c9f5c9'],
    desc: 'おおきく そだった ぷに。のしかかられると ちょっと いたい。',
  }),
  species({
    id: 'mahopuni', name: 'まほうぷに', family: 'slime', rank: 'C',
    base: [50, 26, 20, 20, 20, 26], growth: [7, 3.2, 3.2, 3.0, 3.0, 4.0],
    learnset: [[1, 'fire'], [6, 'icicle'], [10, 'spark'], [16, 'fira'], [24, 'blizzara'], [32, 'lightning']],
    palette: ['#b06ef5', '#7a3ad6', '#e6cdfd'],
    desc: 'まほうの さいのうに めざめた ぷに。さんぞくせいの じゅもんを あやつる。',
  }),
  species({
    id: 'kingpuni', name: 'キングぷに', family: 'slime', rank: 'B',
    base: [85, 20, 34, 30, 18, 20], growth: [11, 2.4, 4.6, 4.2, 2.6, 3.0],
    learnset: [[1, 'rush'], [12, 'healall'], [20, 'guardsong']],
    palette: ['#3d7bff', '#1c4fc2', '#ffd94a'],
    desc: 'ぷにたちの おうさま。おうかんは うまれたときから かぶっている らしい。',
  }),
  species({
    id: 'metapuni', name: 'メタぷに', family: 'slime', rank: 'A',
    base: [12, 20, 25, 90, 70, 30], growth: [1.2, 2.0, 3.0, 8.0, 5.0, 3.5],
    learnset: [[1, 'spark'], [10, 'lightning']],
    resist: { fire: 0.5, ice: 0.5, thunder: 0.5, wind: 0.5, dark: 0.5, holy: 0.5 },
    exp: 350, gold: 30,
    palette: ['#c9ced8', '#8a93a5', '#f2f5fa'],
    desc: 'ぜんしんが きんぞくの まぼろしの ぷに。たおせば ばくだいな けいけんちが!',
  }),
  species({
    id: 'nijipuni', name: 'にじぷに', family: 'slime', rank: 'S',
    base: [140, 45, 55, 55, 50, 50], growth: [15, 4.5, 5.5, 5.5, 5.0, 5.5],
    learnset: [[1, 'holyray'], [15, 'healall'], [30, 'gigavolt']],
    resist: { fire: 0.5, ice: 0.5, thunder: 0.5, wind: 0.5, dark: 0.5, holy: 0.5 },
    palette: ['#ff8ad8', '#6ee7ff', '#fff29a'],
    desc: 'にじいろに かがやく でんせつの ぷに。であえたものに しあわせが おとずれる という。',
  }),

  // ================= ドラゴン系 =================
  species({
    id: 'chibidra', name: 'ちびドラゴ', family: 'dragon', rank: 'E',
    base: [32, 6, 16, 12, 11, 7], growth: [6, 1.0, 3.2, 2.4, 2.2, 1.4],
    learnset: [[1, 'firebreath'], [9, 'flamebreath']],
    palette: ['#8fd44a', '#5aa422', '#f2e9b0'],
    desc: 'うまれたばかりの こりゅう。ちいさくても ほのおを はける。',
  }),
  species({
    id: 'lizardron', name: 'リザードロン', family: 'dragon', rank: 'D',
    base: [46, 8, 21, 16, 15, 8], growth: [7.5, 1.2, 3.6, 3.0, 2.6, 1.6],
    learnset: [[1, 'bite'], [8, 'powerslash'], [14, 'flamebreath']],
    palette: ['#b08050', '#7a5227', '#e8d3a8'],
    desc: 'にそくほこうの トカゲりゅう。するどい キバと ツメで えものを しとめる。',
  }),
  species({
    id: 'wyvern', name: 'ワイバーン', family: 'dragon', rank: 'C',
    base: [58, 14, 26, 20, 24, 12], growth: [8.5, 1.8, 4.0, 3.2, 3.6, 2.0],
    learnset: [[1, 'windcutter'], [12, 'tempest'], [18, 'flamebreath']],
    palette: ['#4ac2c9', '#22868c', '#d8f5f7'],
    desc: 'おおぞらを かける よくりゅう。かまいたちを おこして おそいかかる。',
  }),
  species({
    id: 'flamedrake', name: 'フレイムドレイク', family: 'dragon', rank: 'B',
    base: [80, 20, 35, 28, 22, 18], growth: [10.5, 2.2, 4.8, 3.8, 3.0, 2.6],
    learnset: [[1, 'flamebreath'], [16, 'fira'], [28, 'scorch']],
    resist: { fire: 0.5, ice: 1.5 },
    palette: ['#f0533d', '#b02a18', '#ffc27a'],
    desc: 'かざんに すむ ほのおの ドラゴン。ひといきで もりを やきはらう。',
  }),
  species({
    id: 'frostdragon', name: 'フロストドラゴン', family: 'dragon', rank: 'B',
    base: [82, 22, 33, 29, 21, 20], growth: [10.5, 2.4, 4.6, 4.0, 2.9, 2.8],
    learnset: [[1, 'icebreath'], [14, 'blizzara'], [26, 'whiteout']],
    resist: { ice: 0.5, fire: 1.5 },
    palette: ['#6db8f5', '#3a7fc2', '#e3f2ff'],
    desc: 'こおりの どうくつの ぬし。いきを はくだけで あたりが こおりつく。',
  }),
  species({
    id: 'grandragon', name: 'グランドラゴン', family: 'dragon', rank: 'A',
    base: [110, 28, 46, 38, 28, 24], growth: [13, 2.8, 5.6, 4.8, 3.4, 3.2],
    learnset: [[1, 'flamebreath'], [10, 'boulder'], [20, 'scorch'], [30, 'inferno']],
    resist: { fire: 0.5, ice: 0.5 },
    palette: ['#e8b93d', '#a8781a', '#7ac25a'],
    desc: 'だいちの ちからを やどした おうじゃの ドラゴン。りゅうの ほこりを むねに たたかう。',
  }),
  species({
    id: 'tekina', name: 'まりゅうテキーナ', family: 'dragon', rank: 'S',
    base: [190, 60, 62, 50, 38, 40], growth: [17, 4.0, 6.5, 5.5, 4.0, 4.5],
    learnset: [[1, 'scorch'], [1, 'darknebula'], [20, 'inferno'], [35, 'gigavolt']],
    resist: { fire: 0.5, ice: 0.5, thunder: 0.5, dark: 0.5 },
    exp: 800, gold: 500,
    palette: ['#8a3df0', '#4a1a99', '#f05a3d'],
    desc: 'かざんの おくふかくに ひそむ でんせつの まりゅう。せかいを ほろぼす ちからを もつ。',
  }),

  // ================= まじゅう系 =================
  species({
    id: 'rabbit', name: 'キラーラビット', family: 'beast', rank: 'F',
    base: [20, 4, 12, 8, 13, 5], growth: [4.5, 0.8, 2.6, 1.8, 2.6, 1.0],
    learnset: [[1, 'bite'], [7, 'powerslash']],
    palette: ['#f5c2d0', '#d68aa3', '#ffffff'],
    desc: 'かわいい みためと うらはらに きけんな ウサギ。ツノで つきさしてくる。',
  }),
  species({
    id: 'wolf', name: 'ウルフ', family: 'beast', rank: 'E',
    base: [30, 5, 16, 11, 15, 6], growth: [6, 1.0, 3.2, 2.2, 2.8, 1.2],
    learnset: [[1, 'bite'], [10, 'rush']],
    palette: ['#9aa3b0', '#5f6875', '#e0e5eb'],
    desc: 'むれで かりをする そうげんの オオカミ。すばやい みのこなしが とくちょう。',
  }),
  species({
    id: 'fangwolf', name: 'ファングウルフ', family: 'beast', rank: 'D',
    base: [44, 8, 22, 15, 19, 8], growth: [7.5, 1.2, 3.8, 2.8, 3.2, 1.5],
    learnset: [[1, 'bite'], [8, 'powerslash'], [16, 'rush']],
    palette: ['#5a6b8c', '#32405c', '#b8c5db'],
    desc: 'するどい キバをもつ オオカミの じょうい しゅ。よるの もりで めが ひかる。',
  }),
  species({
    id: 'grizzly', name: 'グリズリー', family: 'beast', rank: 'C',
    base: [64, 8, 30, 22, 16, 8], growth: [9.5, 1.2, 4.6, 3.4, 2.4, 1.4],
    learnset: [[1, 'powerslash'], [14, 'rush'], [18, 'powerup']],
    palette: ['#a5713d', '#6e4519', '#e0c096'],
    desc: 'きょだいな ヒグマの モンスター。ちからまかせの いちげきは きょうれつ。',
  }),
  species({
    id: 'sabertiger', name: 'サーベルタイガー', family: 'beast', rank: 'B',
    base: [78, 14, 38, 26, 30, 12], growth: [10, 1.6, 5.2, 3.6, 4.2, 1.8],
    learnset: [[1, 'powerslash'], [12, 'rush'], [22, 'warcry']],
    palette: ['#f0c23d', '#b5851a', '#3d3326'],
    desc: 'けものたちの おうしゃ。サーベルのような キバで えものを かりたてる。',
  }),
  species({
    id: 'cerberus', name: 'ケルベロス', family: 'beast', rank: 'A',
    base: [105, 24, 48, 34, 34, 20], growth: [12.5, 2.4, 6.0, 4.4, 4.4, 2.6],
    learnset: [[1, 'flamebreath'], [15, 'rush'], [25, 'scorch']],
    resist: { fire: 0.5, dark: 0.5 },
    palette: ['#b03d3d', '#701c1c', '#f0a53d'],
    desc: 'じごくの もんばん といわれる さんとうけん。みっつの あたまで ほのおを はく。',
  }),
  species({
    id: 'fenrir', name: 'フェンリル', family: 'beast', rank: 'S',
    base: [150, 40, 60, 45, 55, 35], growth: [16, 3.5, 6.8, 5.2, 6.0, 4.0],
    learnset: [[1, 'icebreath'], [12, 'speedsong'], [24, 'whiteout'], [36, 'tempest']],
    resist: { ice: 0.5, dark: 0.5 },
    palette: ['#dbe8f5', '#8fa8c2', '#4a6b8c'],
    desc: 'ふぶきを まとう しんわの おおかみ。その とおぼえは せかいの はてまで とどく。',
  }),

  // ================= しぜん系 =================
  species({
    id: 'mandra', name: 'マンドラっこ', family: 'nature', rank: 'F',
    base: [21, 8, 9, 9, 8, 9], growth: [4.8, 1.4, 2.0, 2.0, 1.6, 1.8],
    learnset: [[1, 'heal'], [8, 'warcry']],
    palette: ['#8fd44a', '#5aa422', '#f5e3c2'],
    desc: 'つちから ひょっこり かおを だす しょくぶつっこ。なきごえは ちょっと うるさい。',
  }),
  species({
    id: 'myconid', name: 'マイコニド', family: 'nature', rank: 'E',
    base: [28, 10, 13, 12, 9, 11], growth: [5.5, 1.6, 2.6, 2.4, 1.6, 2.0],
    learnset: [[1, 'heal'], [6, 'weaken'], [12, 'slow']],
    palette: ['#f05a5a', '#b02a2a', '#f5ead8'],
    desc: 'あるく キノコの モンスター。かさから ふしぎな ほうしを まきちらす。',
  }),
  species({
    id: 'killerplant', name: 'キラープラント', family: 'nature', rank: 'D',
    base: [42, 12, 20, 15, 12, 12], growth: [7, 1.8, 3.6, 2.8, 2.0, 2.2],
    learnset: [[1, 'bite'], [10, 'weaken'], [18, 'rush']],
    palette: ['#4aa53d', '#2a701c', '#f03da5'],
    desc: 'にくしょくの しょくぶつ。あまい かおりで えものを さそいこむ。',
  }),
  species({
    id: 'treant', name: 'トレント', family: 'nature', rank: 'C',
    base: [66, 16, 26, 24, 10, 16], growth: [9.5, 2.0, 4.0, 3.8, 1.4, 2.6],
    learnset: [[1, 'powerslash'], [10, 'guardsong'], [18, 'healmore']],
    resist: { fire: 1.5 },
    palette: ['#8c6239', '#59391c', '#4aa53d'],
    desc: 'いのちを やどした ふるき たいぼく。もりを あらすものを ゆるさない。',
  }),
  species({
    id: 'dryad', name: 'ドリアード', family: 'nature', rank: 'B',
    base: [70, 30, 28, 24, 26, 32], growth: [9, 3.4, 3.8, 3.4, 3.6, 4.4],
    learnset: [[1, 'windcutter'], [8, 'healmore'], [16, 'speedsong'], [26, 'tempest']],
    palette: ['#6ecf8f', '#2f9e5a', '#f5c2e0'],
    desc: 'もりの せいれい。かぜと みどりを あやつり もりびとを まもる。',
  }),
  species({
    id: 'eldertreant', name: 'エルダートレント', family: 'nature', rank: 'A',
    base: [115, 30, 44, 42, 16, 28], growth: [13.5, 3.0, 5.4, 5.4, 2.0, 3.6],
    learnset: [[1, 'boulder'], [12, 'guardsong'], [20, 'healall'], [30, 'tempest']],
    resist: { fire: 1.5, ice: 0.5 },
    palette: ['#5c4226', '#332413', '#2f9e5a'],
    desc: 'せんねんを いきた トレントの ちょうろう。もりの ちえの すべてを しる。',
  }),
  species({
    id: 'daiju', name: 'だいじゅのけしん', family: 'nature', rank: 'S',
    base: [160, 50, 52, 50, 30, 48], growth: [17, 4.5, 6.0, 6.0, 3.5, 5.5],
    learnset: [[1, 'healall'], [12, 'guardsong'], [22, 'tempest'], [34, 'revive']],
    resist: { wind: 0.5, holy: 0.5 },
    palette: ['#2f9e5a', '#1a6b3a', '#f0d43d'],
    desc: 'せかいじゅの たましいが かたちを なした もの。だいちの めぐみ そのもの。',
  }),

  // ================= あくま系 =================
  species({
    id: 'goblin', name: 'ゴブリン', family: 'demon', rank: 'F',
    base: [22, 5, 12, 9, 10, 6], growth: [4.8, 1.0, 2.6, 2.0, 2.0, 1.2],
    learnset: [[5, 'powerslash']],
    palette: ['#7aa53d', '#4a701c', '#c2a575'],
    desc: 'こんぼうを ふりまわす こあくま。ずるがしこいが おっちょこちょい。',
  }),
  species({
    id: 'imp', name: 'インプ', family: 'demon', rank: 'E',
    base: [26, 12, 13, 10, 14, 12], growth: [5, 1.8, 2.6, 2.0, 2.6, 2.2],
    learnset: [[1, 'fire'], [8, 'shadow'], [14, 'slow']],
    palette: ['#b05af0', '#701cb0', '#f05a5a'],
    desc: 'いたずらずきの こあくま。ちいさな つばさで ぱたぱた とびまわる。',
  }),
  species({
    id: 'orc', name: 'オーク', family: 'demon', rank: 'D',
    base: [50, 6, 24, 18, 12, 6], growth: [8, 1.0, 4.0, 3.2, 2.0, 1.2],
    learnset: [[1, 'powerslash'], [12, 'warcry'], [18, 'boulder']],
    palette: ['#8c9e75', '#5a6b45', '#d8c2a5'],
    desc: 'ぶたに にた かおの きょうぼうな あくま。おおきな オノを ふりまわす。',
  }),
  species({
    id: 'gargoyle', name: 'ガーゴイル', family: 'demon', rank: 'C',
    base: [60, 14, 28, 26, 22, 12], growth: [8.5, 1.8, 4.2, 4.0, 3.2, 1.8],
    learnset: [[1, 'windcutter'], [10, 'shadow'], [20, 'rush']],
    resist: { fire: 0.5 },
    palette: ['#8a93a5', '#525a6b', '#c9ced8'],
    desc: 'いしぞうに ばけて えものを まつ あくま。よるに なると うごきだす。',
  }),
  species({
    id: 'demon', name: 'デーモン', family: 'demon', rank: 'B',
    base: [76, 26, 36, 26, 24, 26], growth: [10, 2.8, 5.0, 3.6, 3.2, 3.4],
    learnset: [[1, 'shadow'], [10, 'fira'], [20, 'darknebula']],
    resist: { dark: 0.5, holy: 1.5 },
    palette: ['#c23d3d', '#801c1c', '#3d2633'],
    desc: 'まかいの せんし。やみの ほのおを まとい ひとびとを おびやかす。',
  }),
  species({
    id: 'archdemon', name: 'アークデーモン', family: 'demon', rank: 'A',
    base: [108, 34, 48, 36, 30, 34], growth: [12.5, 3.4, 5.8, 4.6, 3.8, 4.2],
    learnset: [[1, 'fira'], [12, 'darknebula'], [24, 'inferno'], [32, 'warcry']],
    resist: { dark: 0.5, holy: 1.5, fire: 0.5 },
    palette: ['#701cb0', '#40105f', '#f03d3d'],
    desc: 'まかいの しょうぐん。その つばさが そらを おおうとき やみが おとずれる。',
  }),
  species({
    id: 'demonlord', name: 'デモンロード', family: 'demon', rank: 'S',
    base: [155, 55, 62, 48, 42, 50], growth: [16.5, 5.0, 6.6, 5.4, 4.6, 5.6],
    learnset: [[1, 'darknebula'], [15, 'inferno'], [25, 'warcry'], [35, 'gigavolt']],
    resist: { dark: 0, holy: 1.5, fire: 0.5, ice: 0.5 },
    palette: ['#26131f', '#0d0810', '#f0c23d'],
    desc: 'まぞくの ちょうてんに たつ おうしゃ。ぜつぼうそのものが かたちを なしたと いわれる。',
  }),

  // ================= ゾンビ系 =================
  species({
    id: 'ghost', name: 'ゴースト', family: 'zombie', rank: 'F',
    base: [18, 10, 9, 8, 12, 10], growth: [4, 1.6, 2.0, 1.8, 2.4, 1.8],
    learnset: [[1, 'shadow'], [10, 'slow']],
    resist: { dark: 0.5, holy: 1.5 },
    palette: ['#c9d8f0', '#8fa3c9', '#f5f8ff'],
    desc: 'ふよふよ ただよう おばけ。おどかすのが だいすき。',
  }),
  species({
    id: 'skeleton', name: 'スケルトン', family: 'zombie', rank: 'E',
    base: [30, 4, 17, 12, 12, 5], growth: [5.8, 0.8, 3.4, 2.4, 2.2, 1.0],
    learnset: [[1, 'powerslash'], [12, 'rush']],
    resist: { dark: 0.5, holy: 1.5 },
    palette: ['#e8e3d8', '#b0a898', '#5a5245'],
    desc: 'うごく がいこつの せんし。さびた けんを いまも ふるいつづける。',
  }),
  species({
    id: 'ghoul', name: 'グールゾンビ', family: 'zombie', rank: 'D',
    base: [46, 8, 22, 15, 13, 8], growth: [7.5, 1.2, 3.8, 2.8, 2.2, 1.5],
    learnset: [[1, 'bite'], [10, 'weaken'], [18, 'rush']],
    resist: { dark: 0.5, holy: 1.5 },
    palette: ['#8fa875', '#5c7045', '#c9b8a5'],
    desc: 'よみがえった しかばね。くさった うでで つかみかかってくる。',
  }),
  species({
    id: 'wraith', name: 'レイス', family: 'zombie', rank: 'C',
    base: [55, 22, 25, 18, 24, 24], growth: [8, 2.6, 3.8, 2.8, 3.4, 3.4],
    learnset: [[1, 'shadow'], [10, 'icebreath'], [18, 'slow'], [26, 'darknebula']],
    resist: { dark: 0.5, holy: 1.5, ice: 0.5 },
    palette: ['#6b5a8c', '#3d3159', '#b8a8d8'],
    desc: 'うらみを のこした たましいの なれのはて。ふれたものの たいおんを うばう。',
  }),
  species({
    id: 'vampire', name: 'ヴァンパイア', family: 'zombie', rank: 'B',
    base: [78, 26, 36, 26, 30, 26], growth: [10, 2.8, 4.8, 3.6, 4.0, 3.4],
    learnset: [[1, 'bite'], [10, 'shadow'], [18, 'healmore'], [28, 'darknebula']],
    resist: { dark: 0.5, holy: 1.5 },
    palette: ['#26131f', '#0d0810', '#c23d3d'],
    desc: 'よるの きぞく。ちを すって じぶんの きずを いやす。',
  }),
  species({
    id: 'lich', name: 'リッチ', family: 'zombie', rank: 'A',
    base: [95, 44, 38, 34, 28, 48], growth: [11, 4.4, 4.8, 4.4, 3.6, 5.8],
    learnset: [[1, 'blizzara'], [10, 'darknebula'], [20, 'whiteout'], [30, 'revive']],
    resist: { dark: 0, holy: 1.5, ice: 0.5, fire: 0.5 },
    palette: ['#e8e3d8', '#4a8c8c', '#b03df0'],
    desc: 'ふろうふしを もとめて じぶんを アンデッドに かえた だいまどうし。',
  }),
  species({
    id: 'necros', name: 'しりょうおうネクロス', family: 'zombie', rank: 'S',
    base: [150, 60, 55, 45, 40, 58], growth: [15.5, 5.5, 6.0, 5.2, 4.4, 6.4],
    learnset: [[1, 'darknebula'], [12, 'whiteout'], [22, 'revive'], [34, 'inferno']],
    resist: { dark: 0, holy: 1.5, ice: 0.5 },
    palette: ['#3d5c45', '#1f3326', '#f0d43d'],
    desc: 'しりょうたちを したがえる おう。しとせいの さかいめを じざいに いききする。',
  }),

  // ================= ぶっしつ系 =================
  species({
    id: 'muddoll', name: 'どろにんぎょう', family: 'material', rank: 'F',
    base: [24, 4, 11, 11, 7, 5], growth: [5.2, 0.8, 2.4, 2.4, 1.4, 1.0],
    learnset: [[5, 'weaken']],
    resist: { thunder: 0.5 },
    palette: ['#a5713d', '#6e4519', '#d8b88c'],
    desc: 'どろから うまれた にんぎょう。たたいても すぐ もとに もどる。',
  }),
  species({
    id: 'karakuri', name: 'からくりへい', family: 'material', rank: 'E',
    base: [30, 6, 16, 14, 12, 6], growth: [5.8, 1.0, 3.2, 2.8, 2.2, 1.2],
    learnset: [[1, 'powerslash'], [10, 'spark']],
    resist: { thunder: 1.5 },
    palette: ['#c98f4a', '#8c5c26', '#f0d43d'],
    desc: 'こだいに つくられた きかいの へいたい。いまも めいれいを まちつづける。',
  }),
  species({
    id: 'stoneman', name: 'ストーンマン', family: 'material', rank: 'D',
    base: [50, 6, 22, 22, 8, 6], growth: [8, 1.0, 3.6, 3.8, 1.2, 1.2],
    learnset: [[1, 'powerslash'], [12, 'boulder']],
    resist: { fire: 0.5, thunder: 0.5 },
    palette: ['#8a93a5', '#525a6b', '#b8c0cc'],
    desc: 'いわが いのちを もった モンスター。うごきは おそいが かたさは ばつぐん。',
  }),
  species({
    id: 'golem', name: 'ゴーレム', family: 'material', rank: 'C',
    base: [70, 8, 30, 28, 8, 8], growth: [10, 1.2, 4.4, 4.4, 1.2, 1.4],
    learnset: [[1, 'powerslash'], [14, 'boulder'], [22, 'guardsong']],
    resist: { fire: 0.5, thunder: 0.5 },
    palette: ['#c9884a', '#8c5726', '#f0d0a5'],
    desc: 'まほうで つくられた ねんどの きょじん。まもりの かたさは てっぺき。',
  }),
  species({
    id: 'irongolem', name: 'アイアンゴーレム', family: 'material', rank: 'B',
    base: [88, 10, 38, 38, 7, 10], growth: [11.5, 1.4, 5.0, 5.2, 1.0, 1.6],
    learnset: [[1, 'powerslash'], [12, 'boulder'], [24, 'guardsong']],
    resist: { fire: 0.5, ice: 0.5, thunder: 1.5 },
    palette: ['#6b7280', '#3d434d', '#a5adba'],
    desc: 'ぜんしん くろがねの きょじん。その パンチは しろの かべも うちくだく。',
  }),
  species({
    id: 'mithrilgolem', name: 'ミスリルゴーレム', family: 'material', rank: 'A',
    base: [110, 20, 46, 50, 12, 20], growth: [13, 2.2, 5.6, 6.4, 1.8, 2.6],
    learnset: [[1, 'boulder'], [15, 'guardsong'], [25, 'holyray']],
    resist: { fire: 0.5, ice: 0.5, thunder: 0.5 },
    palette: ['#a5c2e0', '#6b8cb0', '#e8f2ff'],
    desc: 'でんせつの きんぞく ミスリルで できた きょじん。まほうへの たいせいも たかい。',
  }),
  species({
    id: 'diamondgolem', name: 'ダイヤゴーレム', family: 'material', rank: 'S',
    base: [150, 25, 58, 68, 15, 25], growth: [15.5, 2.6, 6.4, 7.6, 2.0, 3.0],
    learnset: [[1, 'boulder'], [12, 'guardsong'], [24, 'holyray'], [36, 'whiteout']],
    resist: { fire: 0.5, ice: 0.5, thunder: 0.5, wind: 0.5, dark: 0.5, holy: 0.5 },
    palette: ['#e8f5ff', '#a5d8f0', '#6ee7ff'],
    desc: 'ダイヤモンドの からだを もつ きゅうきょくの ゴーレム。その かがやきは えいえんに。',
  }),

  // ================= ？？？系(超レア) =================
  species({
    id: 'unicorn', name: 'ユニコーン', family: 'mystic', rank: 'B',
    base: [72, 30, 32, 26, 34, 34], growth: [9.5, 3.2, 4.4, 3.6, 4.6, 4.4],
    learnset: [[1, 'holyray'], [10, 'healmore'], [20, 'speedsong'], [30, 'healall']],
    resist: { holy: 0.5, dark: 1.5 },
    palette: ['#f5f8ff', '#c9d8f0', '#f0d43d'],
    desc: 'せいなる いっかくじゅう。きよらかな こころの ものにしか なつかない。',
  }),
  species({
    id: 'phoenix', name: 'フェニックス', family: 'mystic', rank: 'A',
    base: [100, 36, 42, 32, 44, 36], growth: [12, 3.6, 5.2, 4.2, 5.6, 4.6],
    learnset: [[1, 'flamebreath'], [12, 'fira'], [22, 'inferno'], [32, 'revive']],
    resist: { fire: 0, ice: 1.5 },
    palette: ['#f0823d', '#c23d1c', '#f0d43d'],
    desc: 'ふしの ほのおを まとう れいちょう。なんど たおれても はいから よみがえる。',
  }),
  species({
    id: 'luminas', name: 'せいれいおうルミナ', family: 'mystic', rank: 'S',
    base: [145, 60, 52, 46, 52, 60], growth: [15.5, 5.5, 5.8, 5.4, 5.8, 6.6],
    learnset: [[1, 'holyray'], [12, 'healall'], [24, 'gigavolt'], [36, 'revive']],
    resist: { holy: 0, dark: 0.5, fire: 0.5, ice: 0.5 },
    palette: ['#fffef0', '#ffe97a', '#7ae0ff'],
    desc: 'ひかりの せいれいたちの おう。すべての いのちを やさしく みまもる そんざい。',
  }),

  // ============================================================
  // でんせつの モンスターたち(ガチャの高レア枠)
  //   B → A → S の順に レア度と つよさが 上がっていく
  // ============================================================

  // ---- Bランク(★5) ----
  species({
    id: 'caitsith', name: 'ケットシー', family: 'beast', rank: 'B',
    base: [70, 26, 30, 24, 40, 26], growth: [9, 3.0, 4.2, 3.2, 5.2, 3.4],
    learnset: [[1, 'bite'], [8, 'speedsong'], [16, 'powerup'], [26, 'rush']],
    palette: ['#7a5ad6', '#4a3399', '#f0e0c2'],
    desc: 'ながぐつを はいた ようせいの ねこ。すばやさは ぐんを ぬく。であえたら ラッキー。',
  }),
  species({
    id: 'basilisk', name: 'バジリスク', family: 'demon', rank: 'B',
    base: [80, 22, 34, 30, 24, 22], growth: [10, 2.6, 4.6, 4.0, 3.2, 2.8],
    learnset: [[1, 'shadow'], [10, 'weaken'], [18, 'slow'], [26, 'darknebula']],
    resist: { dark: 0.5, holy: 1.5 },
    palette: ['#4a8c3d', '#2a5a1c', '#c2f03d'],
    desc: 'みたものを いしに かえる まがんの へび。めったに すがたを みせない。',
  }),
  species({
    id: 'pegasus', name: 'ペガサス', family: 'mystic', rank: 'B',
    base: [76, 30, 32, 28, 38, 32], growth: [9.5, 3.2, 4.4, 3.6, 5.0, 4.0],
    learnset: [[1, 'windcutter'], [10, 'holyray'], [20, 'speedsong'], [30, 'tempest']],
    resist: { holy: 0.5, wind: 0.5 },
    palette: ['#f5f8ff', '#a5c9f0', '#7ae0ff'],
    desc: 'しろい つばさで てんくうを かける せいなる うま。おおくの でんせつしゅの おやとなる。',
  }),

  // ---- Aランク(★6) ----
  species({
    id: 'chimera', name: 'キマイラ', family: 'demon', rank: 'A',
    base: [110, 26, 48, 36, 34, 22], growth: [12.5, 2.6, 5.8, 4.6, 4.4, 2.8],
    learnset: [[1, 'flamebreath'], [12, 'bite'], [22, 'scorch'], [32, 'rush']],
    resist: { fire: 0.5 },
    palette: ['#c23d3d', '#7a1c1c', '#f0a53d'],
    desc: 'いくつもの けものを つぎはぎに した まじゅう。くちから ほのおを はく。',
  }),
  species({
    id: 'hydra', name: 'ヒュドラ', family: 'dragon', rank: 'A',
    base: [118, 28, 46, 38, 30, 26], growth: [13.5, 2.8, 5.6, 4.8, 3.6, 3.2],
    learnset: [[1, 'icebreath'], [12, 'flamebreath'], [24, 'whiteout'], [34, 'scorch']],
    resist: { fire: 0.5, ice: 0.5 },
    palette: ['#3d7a5a', '#1c4a33', '#8a3df0'],
    desc: 'きゅうつの くびを もつ どくりゅう。くびを きられても すぐに はえてくる。',
  }),
  species({
    id: 'griffin', name: 'グリフォン', family: 'mystic', rank: 'A',
    base: [108, 26, 46, 36, 42, 26], growth: [12.5, 2.6, 5.6, 4.6, 5.4, 3.2],
    learnset: [[1, 'windcutter'], [12, 'rush'], [22, 'tempest'], [32, 'speedsong']],
    resist: { wind: 0.5 },
    palette: ['#e8b93d', '#a8781a', '#f5ead8'],
    desc: 'ししの からだと わしの つばさを もつ れいじゅう。そらの おうじゃ。',
  }),
  species({
    id: 'sphinx', name: 'スフィンクス', family: 'mystic', rank: 'A',
    base: [104, 40, 40, 36, 32, 44], growth: [12, 4.2, 5.0, 4.6, 3.8, 5.4],
    learnset: [[1, 'lightning'], [12, 'holyray'], [22, 'gigavolt'], [32, 'healall']],
    resist: { thunder: 0.5, holy: 0.5 },
    palette: ['#f0d43d', '#b5851a', '#e8d5a0'],
    desc: 'なぞかけを だす いにしえの しんじゅう。こたえられぬ ものに ばつを あたえる。',
  }),
  species({
    id: 'valkyrie', name: 'ヴァルキリー', family: 'mystic', rank: 'A',
    base: [106, 36, 46, 38, 40, 34], growth: [12.5, 3.6, 5.6, 4.8, 5.0, 4.2],
    learnset: [[1, 'holyray'], [12, 'powerup'], [22, 'healall'], [32, 'revive']],
    resist: { holy: 0.5, dark: 0.5 },
    palette: ['#c9d8f0', '#6b8cb0', '#f0d43d'],
    desc: 'せんじょうに まいおりる せんの おとめ。ゆうしゃの たましいを てんへ みちびく。',
  }),
  species({
    id: 'metaldra', name: 'こうてつりゅうメタルドラ', family: 'material', rank: 'A',
    base: [115, 20, 44, 56, 20, 20], growth: [13, 2.2, 5.4, 6.6, 2.6, 2.6],
    learnset: [[1, 'flamebreath'], [12, 'boulder'], [24, 'scorch'], [34, 'guardsong']],
    resist: { fire: 0.5, ice: 0.5, thunder: 1.5 },
    palette: ['#8a93a5', '#4a525f', '#c9ced8'],
    desc: 'くろがねの きょじんに りゅうの たましいを やどした もの。まもりは てっぺき。',
  }),

  // ---- Sランク(★7) ----
  species({
    id: 'bahamut', name: 'りゅうおうバハムート', family: 'dragon', rank: 'S',
    base: [185, 55, 64, 52, 40, 44], growth: [17, 4.5, 6.6, 5.6, 4.2, 4.8],
    learnset: [[1, 'scorch'], [15, 'gigavolt'], [25, 'inferno'], [35, 'whiteout']],
    exp: 750, gold: 450,
    resist: { fire: 0.5, ice: 0.5, thunder: 0.5 },
    palette: ['#3d5ac2', '#1c2f7a', '#c9d8ff'],
    desc: 'すべての りゅうを したがえる りゅうの おう。そのいぶきは てんちを さく。',
  }),
  species({
    id: 'leviathan', name: 'かいりゅうレヴィアタン', family: 'dragon', rank: 'S',
    base: [195, 50, 58, 54, 42, 46], growth: [17.5, 4.2, 6.2, 5.8, 4.4, 5.0],
    learnset: [[1, 'whiteout'], [15, 'blizzara'], [25, 'tempest'], [35, 'gigavolt']],
    exp: 750, gold: 450,
    resist: { ice: 0, fire: 1.5, thunder: 0.5 },
    palette: ['#1c6b8c', '#0d3d5a', '#6ee7ff'],
    desc: 'ふかい うみの そこに ねむる きょだいな かいりゅう。つなみを おこして すべてを のみこむ。',
  }),
  species({
    id: 'behemoth', name: 'きょじゅうベヒーモス', family: 'beast', rank: 'S',
    base: [210, 30, 66, 50, 34, 24], growth: [18, 3.0, 7.0, 5.6, 4.0, 3.0],
    learnset: [[1, 'boulder'], [15, 'rush'], [25, 'powerup'], [35, 'scorch']],
    exp: 750, gold: 450,
    resist: { thunder: 0.5 },
    palette: ['#5c3d26', '#331f13', '#c23d3d'],
    desc: 'だいちを ゆるがして あるく きょだいな まじゅう。その あしおとは じしんの ごとし。',
  }),
  species({
    id: 'seraphim', name: 'だいてんしセラフ', family: 'mystic', rank: 'S',
    base: [170, 60, 56, 48, 50, 58], growth: [16.5, 5.5, 6.2, 5.4, 5.6, 6.4],
    learnset: [[1, 'holyray'], [15, 'healall'], [25, 'gigavolt'], [35, 'revive']],
    exp: 750, gold: 450,
    resist: { holy: 0, dark: 0.5 },
    palette: ['#fffef0', '#ffe97a', '#f0f5ff'],
    desc: 'むっつの つばさを もつ さいこういの てんし。せいなる ひかりで あくを ほろぼす。',
  }),
  species({
    id: 'metalking', name: 'メタルキング', family: 'material', rank: 'S',
    base: [160, 25, 55, 72, 22, 24], growth: [15.5, 2.6, 6.2, 8.0, 2.4, 3.0],
    learnset: [[1, 'boulder'], [12, 'holyray'], [24, 'guardsong'], [36, 'gigavolt']],
    exp: 900, gold: 600,
    resist: { fire: 0.5, ice: 0.5, thunder: 0.5, wind: 0.5, dark: 0.5, holy: 0.5 },
    palette: ['#c9ced8', '#7a8394', '#f2f5fa'],
    desc: 'きんぞくの モンスターたちの おうさま。おうかんと たてに つつまれた てっぺきの まもり。',
  }),

  // ============================================================
  // 究極モンスター(神クラス)
  //   ガチャの さいこうレア枠 & しれんクエストの ボスとして登場。ゲーム最強格
  // ============================================================
  species({
    id: 'odin', name: 'しんおうオーディン', family: 'mystic', rank: 'S',
    base: [230, 72, 66, 56, 58, 70], growth: [19, 5.5, 6.5, 5.5, 5.8, 6.8],
    learnset: [[1, 'gigavolt'], [12, 'healall'], [24, 'darknebula'], [36, 'revive']],
    exp: 1400, gold: 900,
    resist: { holy: 0, dark: 0.5, thunder: 0.5, ice: 0.5 },
    palette: ['#f0e6c2', '#b59a4a', '#7ac2ff'],
    desc: 'かみがみを したがえる てんくうの おう。かために せかいの すべてが うつる という。',
  }),
  species({
    id: 'vritra', name: 'りゅうしんヴリトラ', family: 'dragon', rank: 'S',
    base: [255, 60, 74, 62, 50, 52], growth: [20, 4.8, 7.2, 6.2, 5.0, 5.5],
    learnset: [[1, 'inferno'], [12, 'whiteout'], [24, 'gigavolt'], [36, 'scorch']],
    exp: 1400, gold: 900,
    resist: { fire: 0.5, ice: 0.5, thunder: 0.5, dark: 0.5 },
    palette: ['#6b2ab0', '#3a1266', '#f05a3d'],
    desc: 'てんちそうぞうの ときから いきる りゅうの かみ。ひとふりで やまを けずる。',
  }),
  species({
    id: 'gaia', name: 'だいちしんガイア', family: 'beast', rank: 'S',
    base: [275, 45, 78, 64, 46, 42], growth: [21, 3.5, 7.4, 6.4, 4.6, 4.2],
    learnset: [[1, 'boulder'], [12, 'tempest'], [24, 'healall'], [36, 'scorch']],
    exp: 1400, gold: 900,
    resist: { wind: 0.5, ice: 0.5, fire: 0.5 },
    palette: ['#4a8c3d', '#2a5a22', '#e8b93d'],
    desc: 'だいちそのものが いしを もった きょじゅう。その こどうは せかいの みゃくどう。',
  }),
  species({
    id: 'omega', name: 'きゅうきょくオメガ', family: 'material', rank: 'S',
    base: [225, 40, 68, 90, 30, 42], growth: [18, 3.0, 6.6, 8.4, 3.2, 4.0],
    learnset: [[1, 'gigavolt'], [12, 'boulder'], [24, 'guardsong'], [36, 'whiteout']],
    exp: 1600, gold: 1000,
    resist: { fire: 0.5, ice: 0.5, thunder: 0.5, wind: 0.5, dark: 0.5, holy: 0.5 },
    palette: ['#d8e0ea', '#8a95a8', '#6ee7ff'],
    desc: 'こだいぶんめいが のこした きゅうきょくの へいき。すべてを むこうかする てっぺきの よろい。',
  }),
];

const speciesMap = new Map(SPECIES.map((s) => [s.id, s]));

export function getSpecies(id: string): SpeciesDef {
  const s = speciesMap.get(id);
  if (!s) throw new Error(`未定義のモンスター: ${id}`);
  return s;
}

export function hasSpecies(id: string): boolean {
  return speciesMap.has(id);
}

export function speciesByFamily(family: Family): SpeciesDef[] {
  return SPECIES.filter((s) => s.family === family);
}
