/* 街に建てられるもの。
 *
 * **画面と3Dの両方から読む。** 一覧はReactが描き、形は world.js が作る。
 * 施設を増やすときに触るのはここ1か所で済むようにしておく。
 * 形の作り方（build）は world.js が起動時に差し込む。
 *
 * **ジャンルは修了したコース数で開く。** コース側に新しい設定項目を足さずに済み、
 * 「学ぶほど街に置けるものが増える」がそのまま出る。判定に使う数はサーバが数える
 * （town.mjs の countCompletedCourses）ので、ここは必要数だけを持つ。 */

export const GENRES = [
  { id: "live",  name: "住まい",     needCourses: 0 },
  { id: "town",  name: "にぎわい",   needCourses: 1 },
  { id: "infra", name: "インフラ",   needCourses: 2 },
  { id: "make",  name: "ものづくり", needCourses: 3 },
  { id: "logi",  name: "物流",       needCourses: 4 },
];

export const CATALOG = [
  { id: "houses",  g: "live",  name: "一戸建て",         d: "家と庭がならぶ",       value: 1.0 },
  { id: "apart",   g: "live",  name: "集合住宅",         d: "四〜五階の住棟",       value: 1.4 },
  { id: "park",    g: "live",  name: "公園",             d: "池とあずまや",         value: 0.8 },
  { id: "shops",   g: "town",  name: "商店街",           d: "両側に店がならぶ",     value: 1.9 },
  { id: "plaza",   g: "town",  name: "ひろば",           d: "噴水とベンチ",         value: 1.3 },
  { id: "cafe",    g: "town",  name: "カフェ通り",       d: "テラスとパラソル",     value: 1.7 },
  { id: "mall",    g: "town",  name: "ショッピングモール", d: "二区画×二区画",      value: 7.5, size: 2 },
  { id: "power",   g: "infra", name: "発電所",           d: "変電と太陽光",         value: 2.0 },
  { id: "water",   g: "infra", name: "水道施設",         d: "給水塔とタンク",       value: 1.6 },
  { id: "station", g: "infra", name: "駅",               d: "となりの収入が上がる", value: 2.3 },
  { id: "road",    g: "infra", name: "道路",             d: "となりの道とつながる", value: 0.6 },
  { id: "rail",    g: "infra", name: "線路",             d: "向きを変えて敷く",     value: 0.7 },
  { id: "hall",    g: "infra", name: "市役所",           d: "土地を広げられる",     value: 1.8 },
  { id: "office",  g: "make",  name: "開発棟",           d: "窓のならぶ棟",         value: 2.2 },
  { id: "factory", g: "make",  name: "工場",             d: "煙突と搬入口",         value: 2.4 },
  { id: "data",    g: "make",  name: "データセンター",   d: "冷却塔とアンテナ",     value: 2.1 },
  { id: "campus",  g: "make",  name: "研修センター",     d: "ポイントが増える・二区画", value: 8.0, size: 2 },
  { id: "ware",    g: "logi",  name: "倉庫",             d: "かまぼこ屋根",         value: 1.8 },
  { id: "hub",     g: "logi",  name: "配送センター",     d: "バースと配送車",       value: 2.2 },
  { id: "depot",   g: "logi",  name: "工務店",           d: "区画の費用が下がる",   value: 1.6 },
];

export function itemById(id) {
  for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].id === id) return CATALOG[i];
  return CATALOG[0];
}
export function genreById(id) {
  for (let i = 0; i < GENRES.length; i++) if (GENRES[i].id === id) return GENRES[i];
  return GENRES[0];
}

/* 修了コース数から、開いているジャンルを出す */
export function unlockedGenres(completedCourses) {
  const n = Number.isFinite(completedCourses) ? completedCourses : 0;
  return GENRES.filter(g => n >= g.needCourses).map(g => g.id);
}

/* 次に開くジャンルと、あと何コース必要か */
export function nextGenre(completedCourses) {
  const n = Number.isFinite(completedCourses) ? completedCourses : 0;
  const g = GENRES.find(x => n < x.needCourses);
  return g ? { genre: g, remain: g.needCourses - n } : null;
}
