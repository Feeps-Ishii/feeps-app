import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../api.js";
import { OPENINGS } from "./MatchingCatalog.js";

// 実受講生のPortfolio(skills)を案件サンプルの要件スキルと突き合わせてマッチ度を算出する。
// skills は {cat,name,level}[]（Talentのスキルシートと同じ形）。
export function matchOf(skills, o) {
  const byName = Object.fromEntries((Array.isArray(skills) ? skills : []).map(s => [s.name, Number(s.level) || 0]));
  let sum = 0; const matched = [], missing = [];
  o.req.forEach(r => {
    const lv = byName[r.skill] || 0;
    sum += Math.min(lv / r.level, 1);
    (lv >= r.level ? matched : missing).push(r.skill);
  });
  return { score: Math.round((sum / o.req.length) * 100), matched, missing };
}

export function matchTone(s) {
  return s >= 80 ? "green" : s >= 60 ? "cyan" : s >= 40 ? "amber" : "muted";
}

// 実受講生のプロフィール+Portfolioをスキルシートプレビュー/Excel発行の入力形に変換する。
// 実データに無い項目（弱み等）は空のまま返し、文面をでっち上げない。
export function candidateToSheet(c) {
  const p = c.portfolio || {};
  return {
    p: { name: c.name || c.email || "氏名未設定", age: "", exp: "", title: c.company || "", station: "" },
    selfPR: p.selfPR || "",
    strengths: Array.isArray(p.strengths) ? p.strengths : [],
    weak: [],
    skills: Array.isArray(p.skills) ? p.skills : [],
    projects: Array.isArray(p.projects) ? p.projects : [],
  };
}

export function useMatching() {
  const [oid, setOid] = useState(OPENINGS[0].id);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState(null);
  const opening = OPENINGS.find(x => x.id === oid) || OPENINGS[0];

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr("");
    Promise.all([apiGet("/trainees"), apiGet("/companies").catch(() => [])])
      .then(async ([list, companies]) => {
        const trainees = Array.isArray(list) ? list : [];
        const companyNameById = Object.fromEntries((Array.isArray(companies) ? companies : []).map(c => [c.companyId, c.name]));
        // 候補ごとのPortfolio取得。件数が増えたらBackend集約API化を検討（他の運用一覧と同様の前提）。
        const pairs = await Promise.all(trainees.map(t => {
          const id = t.userId || t.id;
          return apiGet(`/skills/${id}`).then(p => [id, p]).catch(() => [id, null]);
        }));
        if (!alive) return;
        const portfolioById = Object.fromEntries(pairs);
        setCandidates(trainees.map(t => {
          const id = t.userId || t.id;
          return { ...t, userId: id, company: companyNameById[t.company] || t.company || "", portfolio: portfolioById[id] || null };
        }));
      })
      .catch(e => alive && setErr("受講生一覧の取得に失敗しました：" + (e?.errorMessage || e?.message || e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const ranked = useMemo(() => candidates
    .map(c => ({ c, ...matchOf(c.portfolio?.skills, opening), hasSkills: !!c.portfolio?.skills?.length }))
    .sort((a, b) => b.score - a.score),
  [candidates, opening]);

  return { oid, setOid, opening, ranked, loading, err, preview, setPreview, candidates };
}
