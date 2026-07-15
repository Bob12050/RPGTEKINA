// ============================================================
// ステージデータ(モンスト・ノマダン式の2階層)
//   エリア(大ステージ) → クエスト(小ステージ)が複数
//   - クエストは同エリア内で上から順に解放
//   - エリアは「前エリアの最後のクエスト」をクリアすると解放
//   - 1クエスト = 1回の戦闘(敵は固定)。エリア最後のクエストがボス戦
//   - 初回クリアでガチャ用オーブがもらえる
//   新エリア/クエストはここに足すだけ(テストが整合性を検証する)。
// ============================================================

/** 1体の敵 */
export interface StageEnemy {
  speciesId: string;
  level: number;
}

/** エリア(大ステージ) */
export interface AreaDef {
  id: string;
  name: string;
  desc: string;
  /** クリア後のやりこみエリアか */
  postgame: boolean;
  /** エリアマップに表示する代表モンスター */
  iconSpecies: string;
}

/** 周回ドロップ(クリアするたびに抽選) */
export interface ItemDrop {
  itemId: string;
  chance: number; // 0〜1
  count: number;
}

/** モンスタードロップ(クリアするたびに1体ずつ抽選・モンスト式) */
export interface MonsterDrop {
  speciesId: string;
  level: number;
  chance: number; // 0〜1
}

/** クエスト(小ステージ) */
export interface StageDef {
  id: string;
  areaId: string;
  name: string;
  /** すいしょうレベル(パーティ平均の目安) */
  recLevel: number;
  /** この1戦の敵(固定編成) */
  enemies: StageEnemy[];
  /** ボスクエストか(強演出・逃走不可)。エリア最後のクエストに付ける */
  boss?: boolean;
  /** 初回クリア報酬 */
  rewardGold: number;
  /** 初回クリアでもらえるガチャ用オーブ */
  rewardOrbs: number;
  rewardItems: { itemId: string; count: number }[];
  /** 周回ドロップ(毎回抽選・省略可) */
  drops?: ItemDrop[];
  /** モンスタードロップ(毎回それぞれ抽選・省略可)。ガチャに出ないF種はここで配る */
  monsterDrops?: MonsterDrop[];
  /** 解放条件(育成/イベント用): このステージIDをクリアで解放。省略時は最初から挑戦可 */
  requires?: string;
  /** 一覧に出す短い説明(育成/イベント用) */
  desc?: string;
  /** 降臨クエスト(モンスト式): 特別演出 + 初回撃破でボスが確定で仲間になる */
  advent?: boolean;
  /** 初回クリアで確定加入するモンスター(降臨のごほうび) */
  firstClearMonster?: { speciesId: string; level: number };
}

/** 2回目以降のクリアでもらえる周回ゴールドの倍率 */
export const REPEAT_GOLD_RATIO = 0.25;

export function repeatGold(stage: StageDef): number {
  return Math.max(10, Math.floor(stage.rewardGold * REPEAT_GOLD_RATIO));
}

export const AREAS: AreaDef[] = [
  { id: 'plains', name: 'そよかぜ草原', desc: 'ぼうけんの はじまりの ち。よわい モンスターが おおい。', postgame: false, iconSpecies: 'puni' },
  { id: 'forest', name: 'こもれびの森', desc: 'ふかい みどりの もり。しぜんの モンスターの なわばり。', postgame: false, iconSpecies: 'treant' },
  { id: 'cave', name: 'ちてい洞窟', desc: 'ひかりの とどかぬ どうくつ。きんぞくや アンデッドが うごめく。', postgame: false, iconSpecies: 'golem' },
  { id: 'volcano', name: 'ごうか火山', desc: 'もえさかる かざん。りゅうや あくまの すみか。', postgame: false, iconSpecies: 'flamedrake' },
  { id: 'lair', name: 'まりゅうの ねぐら', desc: 'せかいを おびやかす まりゅうテキーナが ねむる さいおくのち。', postgame: false, iconSpecies: 'tekina' },
  { id: 'trial', name: 'しれんの ま', desc: 'クリアごの ちょうせんしゃを まつ さいきょうの しれん。', postgame: true, iconSpecies: 'luminas' },
];

const q = (s: StageDef): StageDef => s;

export const STAGES: StageDef[] = [
  // ===== エリア1: そよかぜ草原 =====
  q({
    id: 'plains-1', areaId: 'plains', name: 'はじまりの みち', recLevel: 3,
    enemies: [{ speciesId: 'puni', level: 2 }, { speciesId: 'rabbit', level: 2 }],
    rewardGold: 30, rewardOrbs: 10, rewardItems: [{ itemId: 'herb', count: 2 }],
    drops: [{ itemId: 'herb', chance: 0.3, count: 1 }],
    monsterDrops: [{ speciesId: 'puni', level: 2, chance: 0.15 }],
  }),
  q({
    id: 'plains-2', areaId: 'plains', name: 'はなばたけ', recLevel: 4,
    enemies: [{ speciesId: 'mandra', level: 3 }, { speciesId: 'ghost', level: 3 }, { speciesId: 'goblin', level: 4 }],
    rewardGold: 40, rewardOrbs: 10, rewardItems: [{ itemId: 'herb', count: 2 }],
    drops: [{ itemId: 'herb', chance: 0.3, count: 1 }, { itemId: 'goodherb', chance: 0.1, count: 1 }],
    monsterDrops: [{ speciesId: 'goblin', level: 3, chance: 0.12 }, { speciesId: 'ghost', level: 3, chance: 0.1 }],
  }),
  q({
    id: 'plains-3', areaId: 'plains', name: 'でかぷにの おか', recLevel: 6, boss: true,
    enemies: [{ speciesId: 'dekapuni', level: 7 }, { speciesId: 'muddoll', level: 5 }],
    rewardGold: 80, rewardOrbs: 15, rewardItems: [{ itemId: 'herb', count: 3 }, { itemId: 'goodherb', count: 1 }],
    drops: [{ itemId: 'goodherb', chance: 0.15, count: 1 }],
    monsterDrops: [{ speciesId: 'muddoll', level: 5, chance: 0.12 }, { speciesId: 'dekapuni', level: 6, chance: 0.08 }],
  }),

  // ===== エリア2: こもれびの森 =====
  q({
    id: 'forest-1', areaId: 'forest', name: 'もりの いりぐち', recLevel: 8,
    enemies: [{ speciesId: 'wolf', level: 7 }, { speciesId: 'myconid', level: 7 }, { speciesId: 'mandra', level: 8 }],
    rewardGold: 60, rewardOrbs: 10, rewardItems: [{ itemId: 'goodherb', count: 1 }],
    drops: [{ itemId: 'herb', chance: 0.3, count: 1 }],
    monsterDrops: [{ speciesId: 'mandra', level: 7, chance: 0.12 }, { speciesId: 'myconid', level: 8, chance: 0.1 }],
  }),
  q({
    id: 'forest-2', areaId: 'forest', name: 'くらやみの こみち', recLevel: 10,
    enemies: [{ speciesId: 'killerplant', level: 9 }, { speciesId: 'imp', level: 9 }, { speciesId: 'fangwolf', level: 10 }],
    rewardGold: 80, rewardOrbs: 10, rewardItems: [{ itemId: 'magicwater', count: 1 }],
    drops: [{ itemId: 'magicwater', chance: 0.15, count: 1 }],
    monsterDrops: [{ speciesId: 'killerplant', level: 10, chance: 0.1 }],
  }),
  q({
    id: 'forest-3', areaId: 'forest', name: 'もりの ぬし', recLevel: 12, boss: true,
    enemies: [{ speciesId: 'dryad', level: 14 }, { speciesId: 'treant', level: 12 }],
    rewardGold: 150, rewardOrbs: 15, rewardItems: [{ itemId: 'goodherb', count: 2 }, { itemId: 'magicwater', count: 1 }],
    drops: [{ itemId: 'goodherb', chance: 0.2, count: 1 }],
    monsterDrops: [{ speciesId: 'dryad', level: 13, chance: 0.08 }],
  }),

  // ===== エリア3: ちてい洞窟 =====
  q({
    id: 'cave-1', areaId: 'cave', name: 'どうくつの いりぐち', recLevel: 14,
    enemies: [{ speciesId: 'skeleton', level: 13 }, { speciesId: 'karakuri', level: 14 }, { speciesId: 'imp', level: 13 }],
    rewardGold: 100, rewardOrbs: 10, rewardItems: [{ itemId: 'magicwater', count: 1 }],
    drops: [{ itemId: 'magicwater', chance: 0.15, count: 1 }],
    monsterDrops: [{ speciesId: 'karakuri', level: 13, chance: 0.12 }],
  }),
  q({
    id: 'cave-2', areaId: 'cave', name: 'ちていこの ほとり', recLevel: 16,
    enemies: [{ speciesId: 'ghoul', level: 15 }, { speciesId: 'stoneman', level: 15 }, { speciesId: 'mahopuni', level: 16 }],
    rewardGold: 130, rewardOrbs: 10, rewardItems: [{ itemId: 'goodherb', count: 2 }],
    drops: [{ itemId: 'goodherb', chance: 0.2, count: 1 }],
    monsterDrops: [{ speciesId: 'mahopuni', level: 15, chance: 0.1 }],
  }),
  q({
    id: 'cave-3', areaId: 'cave', name: 'いわの ばんにん', recLevel: 18, boss: true,
    enemies: [{ speciesId: 'golem', level: 20 }, { speciesId: 'skeleton', level: 16 }],
    rewardGold: 300, rewardOrbs: 15, rewardItems: [{ itemId: 'lifeleaf', count: 1 }, { itemId: 'magicwater', count: 1 }],
    drops: [{ itemId: 'lifeleaf', chance: 0.08, count: 1 }],
    monsterDrops: [{ speciesId: 'golem', level: 18, chance: 0.08 }],
  }),

  // ===== エリア4: ごうか火山 =====
  q({
    id: 'volcano-1', areaId: 'volcano', name: 'かざんの ふもと', recLevel: 21,
    enemies: [{ speciesId: 'gargoyle', level: 20 }, { speciesId: 'wyvern', level: 20 }, { speciesId: 'grizzly', level: 21 }],
    rewardGold: 200, rewardOrbs: 10, rewardItems: [{ itemId: 'goodherb', count: 2 }],
    drops: [{ itemId: 'goodherb', chance: 0.25, count: 1 }],
    monsterDrops: [{ speciesId: 'wyvern', level: 20, chance: 0.1 }],
  }),
  q({
    id: 'volcano-2', areaId: 'volcano', name: 'しゃくねつの みち', recLevel: 24,
    enemies: [{ speciesId: 'demon', level: 23 }, { speciesId: 'vampire', level: 24 }, { speciesId: 'wyvern', level: 23 }],
    rewardGold: 300, rewardOrbs: 10, rewardItems: [{ itemId: 'lifeleaf', count: 1 }],
    drops: [{ itemId: 'magicwater', chance: 0.2, count: 1 }],
    monsterDrops: [{ speciesId: 'demon', level: 22, chance: 0.08 }],
  }),
  q({
    id: 'volcano-3', areaId: 'volcano', name: 'ようがんの ぬし', recLevel: 27, boss: true,
    enemies: [{ speciesId: 'grandragon', level: 29 }, { speciesId: 'flamedrake', level: 26 }],
    rewardGold: 600, rewardOrbs: 15, rewardItems: [{ itemId: 'goodherb', count: 3 }, { itemId: 'lifeleaf', count: 1 }],
    drops: [{ itemId: 'lifeleaf', chance: 0.1, count: 1 }],
    monsterDrops: [{ speciesId: 'flamedrake', level: 25, chance: 0.06 }],
  }),

  // ===== エリア5: まりゅうの ねぐら =====
  q({
    id: 'lair-1', areaId: 'lair', name: 'ねぐらの もんばん', recLevel: 29,
    enemies: [{ speciesId: 'archdemon', level: 28 }, { speciesId: 'cerberus', level: 28 }, { speciesId: 'demon', level: 26 }],
    rewardGold: 500, rewardOrbs: 15, rewardItems: [{ itemId: 'lifeleaf', count: 2 }],
    drops: [{ itemId: 'magicwater', chance: 0.2, count: 1 }],
    monsterDrops: [{ speciesId: 'archdemon', level: 27, chance: 0.06 }],
  }),
  q({
    id: 'lair-2', areaId: 'lair', name: 'けっせん! まりゅう', recLevel: 31, boss: true,
    enemies: [{ speciesId: 'tekina', level: 32 }],
    rewardGold: 1500, rewardOrbs: 30, rewardItems: [{ itemId: 'lifeleaf', count: 3 }, { itemId: 'magicwater', count: 2 }],
    drops: [{ itemId: 'lifeleaf', chance: 0.15, count: 1 }, { itemId: 'goodherb', chance: 0.25, count: 1 }],
    monsterDrops: [{ speciesId: 'grandragon', level: 29, chance: 0.05 }],
  }),

  // ===== エリア6: しれんの ま(クリア後) =====
  q({
    id: 'trial-1', areaId: 'trial', name: 'りゅうの しれん', recLevel: 38, boss: true,
    enemies: [{ speciesId: 'bahamut', level: 40 }, { speciesId: 'frostdragon', level: 36 }],
    rewardGold: 2500, rewardOrbs: 20, rewardItems: [{ itemId: 'lifeleaf', count: 3 }, { itemId: 'magicwater', count: 3 }],
    drops: [{ itemId: 'lifeleaf', chance: 0.1, count: 1 }],
    monsterDrops: [{ speciesId: 'frostdragon', level: 34, chance: 0.08 }],
  }),
  q({
    id: 'trial-2', areaId: 'trial', name: 'ひかりの しれん', recLevel: 41, boss: true,
    enemies: [{ speciesId: 'seraphim', level: 42 }, { speciesId: 'valkyrie', level: 40 }],
    rewardGold: 2500, rewardOrbs: 20, rewardItems: [{ itemId: 'lifeleaf', count: 3 }, { itemId: 'magicwater', count: 3 }],
    drops: [{ itemId: 'lifeleaf', chance: 0.1, count: 1 }],
    monsterDrops: [{ speciesId: 'lich', level: 38, chance: 0.06 }],
  }),
  q({
    id: 'trial-3', areaId: 'trial', name: 'しんの しれん', recLevel: 46, boss: true,
    enemies: [{ speciesId: 'omega', level: 48 }, { speciesId: 'metalking', level: 45 }],
    rewardGold: 5000, rewardOrbs: 30, rewardItems: [{ itemId: 'lifeleaf', count: 5 }, { itemId: 'magicwater', count: 5 }],
    drops: [{ itemId: 'goodherb', chance: 0.3, count: 1 }, { itemId: 'lifeleaf', chance: 0.15, count: 1 }],
    monsterDrops: [{ speciesId: 'metapuni', level: 40, chance: 0.08 }],
  }),
];

// ============================================================
// 育成クエスト(経験値・ゴールドかせぎ用の特別クエスト)
//   ストーリーの進行で解放される。メタル系がどっさり経験値をくれる。
// ============================================================
export const TRAINING_STAGES: StageDef[] = [
  q({
    id: 'train-1', areaId: 'training', name: 'メタルの すあな', recLevel: 8, requires: 'plains-3',
    desc: 'メタぷにが たくさんの けいけんちを くれる。まもりが かたいので こうげき力が だいじ!',
    enemies: [{ speciesId: 'metapuni', level: 8 }, { speciesId: 'puni', level: 5 }],
    rewardGold: 100, rewardOrbs: 5, rewardItems: [{ itemId: 'goodherb', count: 1 }],
    drops: [{ itemId: 'goodherb', chance: 0.2, count: 1 }],
  }),
  q({
    id: 'train-2', areaId: 'training', name: 'はぐれメタルの すあな', recLevel: 22, requires: 'cave-3',
    desc: 'メタぷに 2たいの ぐんれい。たおせば レベルが ぐんぐん あがる!',
    enemies: [{ speciesId: 'metapuni', level: 22 }, { speciesId: 'metapuni', level: 22 }],
    rewardGold: 300, rewardOrbs: 8, rewardItems: [{ itemId: 'magicwater', count: 2 }],
    drops: [{ itemId: 'magicwater', chance: 0.25, count: 1 }],
  }),
  q({
    id: 'train-3', areaId: 'training', name: 'メタルキングの すあな', recLevel: 36, requires: 'lair-2',
    desc: 'メタルキングは ばくだいな けいけんちの かたまり! そうびを ととのえて いどもう。',
    enemies: [{ speciesId: 'metalking', level: 36 }, { speciesId: 'metapuni', level: 30 }],
    rewardGold: 800, rewardOrbs: 10, rewardItems: [{ itemId: 'lifeleaf', count: 1 }],
    drops: [{ itemId: 'goodherb', chance: 0.3, count: 2 }],
  }),
];

// ============================================================
// イベントクエスト(特別なボス・レア報酬)
//   高レアモンスターが ドロップしたり オーブが たくさん もらえる。
// ============================================================
export const EVENT_STAGES: StageDef[] = [
  q({
    id: 'event-1', areaId: 'event', name: '天空の れいじゅう', recLevel: 15, requires: 'forest-3', boss: true,
    desc: 'そらの おうじゃ グリフォンが あらわれた! たおすと なかまに なる かも!?',
    enemies: [{ speciesId: 'griffin', level: 16 }, { speciesId: 'wyvern', level: 14 }],
    rewardGold: 400, rewardOrbs: 25, rewardItems: [{ itemId: 'lifeleaf', count: 1 }, { itemId: 'magicwater', count: 2 }],
    drops: [{ itemId: 'lifeleaf', chance: 0.12, count: 1 }],
    monsterDrops: [{ speciesId: 'griffin', level: 15, chance: 0.1 }],
  }),
  q({
    id: 'event-2', areaId: 'event', name: 'どくりゅうの まつり', recLevel: 28, requires: 'volcano-3', boss: true,
    desc: 'きゅうつの くびを もつ ヒュドラ との けっせん! レアな なかまを ねらえ。',
    enemies: [{ speciesId: 'hydra', level: 30 }, { speciesId: 'flamedrake', level: 26 }],
    rewardGold: 800, rewardOrbs: 30, rewardItems: [{ itemId: 'lifeleaf', count: 2 }, { itemId: 'magicwater', count: 3 }],
    drops: [{ itemId: 'lifeleaf', chance: 0.15, count: 1 }],
    monsterDrops: [{ speciesId: 'hydra', level: 28, chance: 0.08 }],
  }),

  // ---- 降臨クエスト(強敵を たおすと そのボスが 確定で なかまに!) ----
  q({
    id: 'advent-vritra', areaId: 'event', name: '【降臨】りゅうしんヴリトラ', recLevel: 40, requires: 'lair-2', boss: true, advent: true,
    desc: 'てんちそうぞうの りゅうしんが こうりんした! うちかてば なかまに なる!!',
    enemies: [{ speciesId: 'vritra', level: 42 }],
    rewardGold: 3000, rewardOrbs: 30, rewardItems: [{ itemId: 'lifeleaf', count: 3 }],
    firstClearMonster: { speciesId: 'vritra', level: 30 },
    monsterDrops: [{ speciesId: 'vritra', level: 30, chance: 0.2 }],
  }),
  q({
    id: 'advent-odin', areaId: 'event', name: '【降臨】しんおうオーディン', recLevel: 44, requires: 'trial-2', boss: true, advent: true,
    desc: 'てんくうの おうが こうりんした! かために せかいを うつす かみを うちやぶれ!',
    enemies: [{ speciesId: 'odin', level: 46 }, { speciesId: 'valkyrie', level: 40 }],
    rewardGold: 4000, rewardOrbs: 35, rewardItems: [{ itemId: 'lifeleaf', count: 4 }, { itemId: 'magicwater', count: 3 }],
    firstClearMonster: { speciesId: 'odin', level: 35 },
    monsterDrops: [{ speciesId: 'odin', level: 35, chance: 0.2 }],
  }),
  q({
    id: 'advent-gaia', areaId: 'event', name: '【降臨】だいちしんガイア', recLevel: 48, requires: 'trial-3', boss: true, advent: true,
    desc: 'だいちそのものが いしを もった きょじゅう。さいごの しれんを のりこえろ!',
    enemies: [{ speciesId: 'gaia', level: 50 }, { speciesId: 'behemoth', level: 45 }],
    rewardGold: 6000, rewardOrbs: 40, rewardItems: [{ itemId: 'lifeleaf', count: 5 }, { itemId: 'magicwater', count: 5 }],
    firstClearMonster: { speciesId: 'gaia', level: 40 },
    monsterDrops: [{ speciesId: 'gaia', level: 40, chance: 0.2 }],
  }),
];

const stageMap = new Map([...STAGES, ...TRAINING_STAGES, ...EVENT_STAGES].map((s) => [s.id, s]));
const areaMap = new Map(AREAS.map((a) => [a.id, a]));

/** 育成/イベントなど「解放条件つき単体クエスト」の解放判定 */
export function isExtraStageUnlocked(stage: StageDef, cleared: readonly string[]): boolean {
  return stage.requires === undefined || cleared.includes(stage.requires);
}

export function getStage(id: string): StageDef {
  const s = stageMap.get(id);
  if (!s) throw new Error(`未定義のクエスト: ${id}`);
  return s;
}

export function hasStage(id: string): boolean {
  return stageMap.has(id);
}

export function getArea(id: string): AreaDef {
  const a = areaMap.get(id);
  if (!a) throw new Error(`未定義のエリア: ${id}`);
  return a;
}

/** エリア内のクエスト一覧(定義順) */
export function questsOf(areaId: string): StageDef[] {
  return STAGES.filter((s) => s.areaId === areaId);
}

/** エリアの解放判定: 最初のエリア、または前エリアの最終クエストをクリア済み */
export function isAreaUnlocked(areaId: string, cleared: readonly string[]): boolean {
  const idx = AREAS.findIndex((a) => a.id === areaId);
  if (idx < 0) return false;
  if (idx === 0) return true;
  const prevQuests = questsOf(AREAS[idx - 1]!.id);
  const last = prevQuests[prevQuests.length - 1];
  return last !== undefined && cleared.includes(last.id);
}

/** クエストの解放判定: エリア解放済み かつ (エリア先頭 or ひとつ前をクリア済み) */
export function isStageUnlocked(stage: StageDef, cleared: readonly string[]): boolean {
  if (!isAreaUnlocked(stage.areaId, cleared)) return false;
  const quests = questsOf(stage.areaId);
  const idx = quests.findIndex((s) => s.id === stage.id);
  if (idx <= 0) return idx === 0;
  return cleared.includes(quests[idx - 1]!.id);
}

/** エリアのクリア進捗 */
export function areaProgress(areaId: string, cleared: readonly string[]): { done: number; total: number } {
  const quests = questsOf(areaId);
  return { done: quests.filter((s) => cleared.includes(s.id)).length, total: quests.length };
}

export const FIRST_STAGE = STAGES[0]!.id;
