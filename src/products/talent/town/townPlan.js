import { COLS, ROWS } from "./townArch.js";

/* 街の割り付け。
 *
 * **目標（GOALS）がそのまま街になる。** 大項目が街区、タスク1つが建物1つ。
 * 区画は役所から近い順に配り、基礎のタスクほど手前に建つようにしてある。
 * 目標の中身はコースが揃うにつれて変わるので、ここは goals を受け取って毎回組み直す。 */

const HALL = { gx: 2, gy: 1 };

/* 大項目ごとの見た目と値段。上の段ほど安く、先の段ほど大きい建物になる */
const STYLE = [
  { arch: ["shop", "shop", "hangar", "shop", "tank", "shop"], h: [7.0, 9.5, 5.4, 8.2, 7.5, 6.4], cost: 90 },
  { arch: ["plaza", "shop", "hangar"], h: [7.5, 9.0, 6.4], cost: 120 },
  { arch: ["dc", "mast", "tower", "dc"], h: [9.5, 24, 28, 8.5], cost: 190 },
  { arch: ["sub", "hangar", "plaza"], h: [5.6, 7.6, 7.5], cost: 240 },
];

export const landCost = (gx, gy) =>
  Math.max(Math.abs(gx - HALL.gx), Math.abs(gy - HALL.gy)) <= 1 ? 60 : 100;

export const lotKey = (gx, gy) => `${gx},${gy}`;
export const hallKey = lotKey(HALL.gx, HALL.gy);

export function adjacentOwned(land, gx, gy) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(d => land.has(lotKey(gx + d[0], gy + d[1])));
}

export function buildPlan(goals) {
  const lots = [];
  for (let gy = 0; gy < ROWS; gy++) for (let gx = 0; gx < COLS; gx++) {
    if (gx === HALL.gx && gy === HALL.gy) continue;
    lots.push({ gx, gy, d: Math.abs(gx - HALL.gx) + Math.abs(gy - HALL.gy) });
  }
  // 役所に近い順。同じ距離なら左上から
  lots.sort((a, b) => a.d - b.d || (a.gy - b.gy) || (a.gx - b.gx));

  const plan = [{ key: hallKey, gx: HALL.gx, gy: HALL.gy, kind: "hall", arch: "hall", h: 9, title: "役所" }];
  let i = 0;
  (goals || []).forEach((goal, gi) => {
    const st = STYLE[gi % STYLE.length];
    (goal.tasks || []).forEach((task, ti) => {
      const lot = lots[i++];
      if (!lot) return;
      plan.push({
        key: lotKey(lot.gx, lot.gy), gx: lot.gx, gy: lot.gy,
        kind: "task",
        task: task.id,
        goalId: goal.id,
        goalTitle: goal.title,
        title: task.t,
        arch: st.arch[ti % st.arch.length],
        h: st.h[ti % st.h.length],
        cost: st.cost,
      });
    });
  });
  while (i < lots.length) {
    const lot = lots[i++];
    plan.push({ key: lotKey(lot.gx, lot.gy), gx: lot.gx, gy: lot.gy, kind: "park", title: "公園" });
  }
  return plan;
}

/* つぎの一歩。街を見て終わりにせず「では何をすればいいか」を1つだけ返す。
 * 優先順位: 建てられる → クレジットが足りない → タスクが未達成 → 土地を買う → 完成。
 * credits が null（実績を確認できなかった）ときは何も返さない。
 * 返すのは種別と対象だけで、文言と行き先は呼び出し側（TownView）が決める。 */
export function nextStepFor({ plan = [], ownedLand, built, done = {}, credits }) {
  if (credits == null) return null;
  const owns = key => (ownedLand?.has ? ownedLand.has(key) : false);
  const isBuilt = task => (built?.has ? built.has(task) : false);
  const taskLots = plan.filter(p => p.kind === "task");

  const ready = taskLots.find(p => owns(p.key) && done[p.task] && !isBuilt(p.task));
  if (ready) return credits >= ready.cost ? { kind: "build", lot: ready } : { kind: "short", lot: ready, need: ready.cost - credits };

  const learn = taskLots.find(p => owns(p.key) && !done[p.task]);
  if (learn) return { kind: "learn", lot: learn };

  const buyable = plan.find(p => p.kind !== "hall" && !owns(p.key) && adjacentOwned(ownedLand, p.gx, p.gy));
  if (buyable) {
    const c = landCost(buyable.gx, buyable.gy);
    return credits >= c ? { kind: "land", lot: buyable, cost: c } : { kind: "shortLand", lot: buyable, need: c - credits };
  }
  return { kind: "done" };
}

/* 建物の短い名前。タスク名は長いので、街の上には出さない */
export function shortName(p) {
  if (!p || p.kind !== "task") return p?.title || "";
  const t = String(p.title || "");
  const cut = t.split(/[（(]/)[0];
  return cut.length > 10 ? cut.slice(0, 10) + "…" : cut;
}
