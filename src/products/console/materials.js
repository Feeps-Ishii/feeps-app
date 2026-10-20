/* 教材の画面と頼む欄で使う計算（2026-10-20） */

// フォルダの公開先を、短い言葉に（utils/libraryAcl.mjs の acl と同じ形）
export const ROLE_NAMES = [["trainee", "受講生"], ["instructor", "講師"], ["client", "企業担当"]];
export function aclLabel(acl, spaceId = "") {
  if (!acl) return { scope: "—", roles: [] };
  const scope = acl.scope === "org" ? (spaceId === "shared" ? "付けたコースすべて" : "全コース")
    : acl.scope === "groups" ? `グループ ${(acl.groups || []).length}`
      : "このコース";
  const roles = ROLE_NAMES.filter(([k]) => acl.roles?.[k]).map(([, t]) => t);
  return { scope, roles, owner: !!acl.owner };
}
export function aclText(acl, spaceId) {
  const a = aclLabel(acl, spaceId);
  return `${a.roles.length ? a.roles.join("・") : "講師・管理者だけ"}（${a.scope}）`;
}

// テストがつながっているコース
export const testCourseIds = t => [...new Set([...(Array.isArray(t?.courseIds) ? t.courseIds : []), t?.courseId].filter(Boolean).map(String))];

/* カリキュラムの日付を、写す先の始まりの日から研修日（平日）で並べ直す。
   元の一番早い日を基準に「何日目の平日か」を数え、写す先の始まりの日から同じだけ進める。祝日は見ない */
const DATE_KEYS = new Set(["startDate", "endDate", "date", "from", "to"]);
const DATE_RE = /^(\d{4})[-/](\d{2})[-/](\d{2})$/;
const toUtc = s => { const m = DATE_RE.exec(String(s || "").trim()); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
const fmt = d => d.toISOString().slice(0, 10);
const isBiz = d => d.getUTCDay() !== 0 && d.getUTCDay() !== 6;
const nextBiz = d => { const x = new Date(d); while (!isBiz(x)) x.setUTCDate(x.getUTCDate() + 1); return x; };
function bizIndex(from, to) {
  let n = 0; const x = new Date(from);
  while (x < to) { x.setUTCDate(x.getUTCDate() + 1); if (isBiz(x)) n += 1; }
  return n;
}
function addBiz(start, n) {
  const x = nextBiz(start);
  let k = 0;
  while (k < n) { x.setUTCDate(x.getUTCDate() + 1); if (isBiz(x)) k += 1; }
  return x;
}
export function curriculumDates(cur) {
  const out = [];
  (function walk(v) {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => { if (DATE_KEYS.has(k) && toUtc(x)) out.push(fmt(toUtc(x))); else walk(x); });
  })(cur);
  return out.sort();
}
export function relayoutCurriculum(cur, startDate) {
  const dates = curriculumDates(cur);
  const target = toUtc(startDate);
  if (!dates.length || !target) return { sections: cur?.sections, sessions: cur?.sessions || [], first: "", last: "" };
  const anchor = nextBiz(toUtc(dates[0]));
  const map = s => fmt(addBiz(target, bizIndex(anchor, toUtc(s))));
  const conv = v => {
    if (Array.isArray(v)) return v.map(conv);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, DATE_KEYS.has(k) && toUtc(x) ? map(x) : conv(x)]));
    return v;
  };
  const sections = cur?.sections ? conv(cur.sections) : undefined;
  const sessions = conv(cur?.sessions || []);
  const after = curriculumDates({ sections, sessions });
  return { sections, sessions, first: after[0] || "", last: after[after.length - 1] || "" };
}
export function curriculumCount(cur) {
  const secs = Array.isArray(cur?.sections) ? cur.sections : [];
  const units = secs.reduce((n, s) => n + (Array.isArray(s.sessions) ? s.sessions.length : (s.chapters || []).reduce((m, c) => m + (c.lessons || []).length, 0)), 0);
  return { sections: secs.length, units: units || (cur?.sessions || []).length };
}
