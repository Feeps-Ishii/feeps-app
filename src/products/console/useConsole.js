import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../../api.js";

// コースの色。コースが多くても見分けられるように、id から決まった色を出す
const COLORS = ["#339CFF", "#2FA9A1", "#8C6BE0", "#E2A63B", "#EB77B1", "#3AB9B1", "#F3883B", "#5D7BF0"];
export function courseColor(id) {
  let h = 0;
  for (const ch of String(id || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

const md = d => (d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : "");
export function termLabel(c) {
  if (!c?.startDate && !c?.endDate) return "";
  return `${md(c.startDate)}〜${md(c.endDate)}`;
}

/* コースの一覧と今日の様子。
   管理者：/courses（全部）＋ /dashboard/admin-overview（今日の出席・日報・設定漏れ）
   講師：/courses（担当）＋ /dashboard/instructor（今日のコース・日報の未対応）
   取れなかった数は null のまま（0 にしない）。画面は「—」と出す */
export function useConsoleCourses(role) {
  const [state, setState] = useState({ loading: true, error: "", courses: [], summary: null, todos: [] });
  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: "" }));
    try {
      const [list, overview, companies] = await Promise.all([
        apiGet("/courses"),
        apiGet(role === "admin" ? "/dashboard/admin-overview" : "/dashboard/instructor").catch(() => null),
        role === "admin" ? apiGet("/companies").catch(() => []) : Promise.resolve([]),
      ]);
      const companyName = new Map((companies || []).map(c => [c.companyId, c.name]));
      const today = new Map();
      if (role === "admin") {
        (overview?.companies || []).forEach(co => (co.courses || []).forEach(r => today.set(r.courseId, { ...r, companyName: co.companyName })));
      } else {
        (overview?.todayCourses || []).forEach(r => today.set(r.courseId, { ...r, today: "training" }));
      }
      const courses = (Array.isArray(list) ? list : [])
        .filter(c => c?.courseId && c.status !== "archived")
        .map(c => {
          const t = today.get(c.courseId) || null;
          return {
            ...c,
            id: c.courseId,
            name: c.name || c.courseId,
            company: t?.companyName || companyName.get(c.companyId) || "",
            term: termLabel(c),
            color: courseColor(c.courseId),
            today: t?.today || (overview ? "off" : "unknown"),
            students: t?.studentCount ?? null,
            present: t?.attendanceCount ?? null,
            reports: t?.reportCount ?? null,
            commented: t?.commentedCount ?? null,
            issues: t?.issues || [],
            instructorNames: t?.instructorNames || [],
            todayCurriculum: t?.todayCurriculum || null,
          };
        })
        .sort((a, b) => (a.today === "training" ? 0 : 1) - (b.today === "training" ? 0 : 1) || b.issues.length - a.issues.length || String(a.name).localeCompare(String(b.name), "ja"));
      setState({ loading: false, error: "", courses, summary: overview?.summary || null, todos: overview?.todos || [], overviewOk: !!overview });
    } catch (e) {
      setState({ loading: false, error: "コースを読み込めませんでした。", courses: [], summary: null, todos: [] });
    }
  }, [role]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

// 名前で人を探す（頼む欄の「変える内容」で使う）。空白は無視して、部分一致の候補を返す
const norm = s => String(s || "").replace(/[\s　]/g, "").toLowerCase();
export function findPeople(list, name) {
  const n = norm(name);
  if (!n) return [];
  const exact = list.filter(p => norm(p.name) === n || norm(p.email).split("@")[0] === n);
  if (exact.length) return exact;
  return list.filter(p => norm(p.name).includes(n) || (n.length >= 2 && n.includes(norm(p.name)) && norm(p.name).length >= 2) || norm(p.email).includes(n)).slice(0, 6);
}
