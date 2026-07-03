import { useMemo, useState } from "react";
import { ENGINEERS, OPENINGS, SKILL_CAT } from "./MatchingCatalog.js";

function buildSelfPR(p, strengths, weak, skills, projects) {
  const top = [...skills].sort((a, b) => b.level - a.level).slice(0, 3).map(s => s.name);
  const proj = projects[0];
  const s = strengths.join("、"), w = weak.join("、");
  let t = `${p.title}として${p.exp}の経験があります。`;
  if (top.length) t += `${top.join("・")}を中心に開発に取り組んできました。`;
  if (proj) t += `直近では「${proj.name}」（${proj.role || "開発"}・${(proj.phases || []).join("〜") || "製造"}）に参画し、実装から試験まで一連の工程を経験しました。`;
  if (s) t += `強みは${s}で、チーム開発でも安定して成果を出せます。`;
  if (w) t += `一方で${w}を課題と認識し、継続的な学習で克服に取り組んでいます。`;
  t += `今後はより上流工程や実務レベルの設計・実装にも挑戦し、価値を発揮していきたいと考えています。`;
  return t;
}

export function engToSheet(e) {
  const skills = Object.entries(e.skills).map(([name, level]) => ({ cat: SKILL_CAT[name] || "その他", name, level }));
  return { p: { name: e.name, age: e.age, station: e.station, title: e.title, exp: e.exp },
    selfPR: buildSelfPR({ title: e.title, exp: e.exp }, e.strengths || [], e.weak || [], skills, e.projects || []),
    strengths: e.strengths || [], weak: e.weak || [], skills, projects: e.projects || [] };
}

export function matchOf(e, o) {
  let sum = 0; const matched = [], missing = [];
  o.req.forEach(r => { const lv = e.skills[r.skill] || 0; sum += Math.min(lv / r.level, 1); (lv >= r.level ? matched : missing).push(r.skill); });
  return { score: Math.round((sum / o.req.length) * 100), matched, missing };
}

export function matchTone(s) {
  return s >= 80 ? "green" : s >= 60 ? "cyan" : s >= 40 ? "amber" : "muted";
}

export function useMatching() {
  const [oid, setOid] = useState(OPENINGS[0].id);
  const [assign, setAssign] = useState({});
  const [preview, setPreview] = useState(null);
  const opening = OPENINGS.find(x => x.id === oid) || OPENINGS[0];
  const ranked = useMemo(() => ENGINEERS.map(e => ({ e, ...matchOf(e, opening) })).sort((a, b) => b.score - a.score), [opening]);
  const assigned = assign[oid] || [];

  function toggleAssign(eid) {
    setAssign(s => {
      const cur = s[oid] || [];
      return { ...s, [oid]: cur.includes(eid) ? cur.filter(x => x !== eid) : [...cur, eid] };
    });
  }

  return { oid, setOid, assign, preview, setPreview, opening, ranked, assigned, toggleAssign };
}
