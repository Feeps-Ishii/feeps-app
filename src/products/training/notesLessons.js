/* ノートが刺さる「単元」の並び。正典: docs/specs/training-notes-spec.md
 *
 * ノート本体（react-markdown を含む）とは分けてある。カリキュラム画面のように
 * 常時読み込まれる場所からも、重いものを連れてこずに単元リストだけ使えるようにするため。 */

/* カリキュラムの単元の並び（＝教科書の並び）。
   2026-10-14: 単元＝大項目（中項目はなくした）。日ごとの区切り（小項目）に付けた以前のノートも、
   その単元のものとして扱う（ids に小項目の id も入れる）。startDate / endDate は単元の期間 */
export function flattenLessons(sections) {
  return (sections || []).map(section => {
    const days = (section.chapters || []).flatMap(c => c.lessons || []);
    const dates = [section, ...days].flatMap(x => [String(x?.startDate || "").slice(0, 10), String(x?.endDate || x?.startDate || "").slice(0, 10)])
      .filter(v => /^\d{4}-\d{2}-\d{2}$/.test(v)).sort();
    const own = /^\d{4}-\d{2}-\d{2}$/.test(String(section.startDate || "").slice(0, 10));
    return {
      id: section.id, title: section.title, sectionTitle: section.title, chapterTitle: "",
      ids: [section.id, ...days.map(d => d.id)].filter(Boolean),
      startDate: own ? String(section.startDate).slice(0, 10) : dates[0] || "",
      endDate: own ? String(section.endDate || section.startDate).slice(0, 10) : dates[dates.length - 1] || "",
    };
  });
}

/* ノートの lessonId（単元の id か、以前の小項目の id）を単元の id にそろえる */
export function resolveUnitId(units, id) {
  if (!id) return "";
  const u = (units || []).find(x => x.id === id || (x.ids || []).includes(id));
  return u ? u.id : id;
}

/* 今日の単元（なければ次の単元 → 先頭） */
export function todayUnitId(units, todayKey) {
  const list = units || [];
  const now = list.find(u => u.startDate && u.startDate <= todayKey && todayKey <= (u.endDate || u.startDate));
  const next = list.find(u => u.startDate && u.startDate >= todayKey);
  return (now || next || list[0])?.id || "";
}

/* 教材への書き込み(kind="ink")などは、書いた文章の一覧には出さない。
   ノート画面・ドック・日報の取り込みは、いずれも**本文のあるノート**だけを並べる。 */
export function isWrittenNote(n) {
  return !!n && (!n.kind || n.kind === "note");
}

/* ドックの見出しに出す件数。**取れなかったものを0件と言わない**（研修全体の決まり）。
   mine = この単元のノート数、total = このコース全体のノート数。 */
export function noteCountLabel({ err, mine, total }) {
  if (err) return "件数を確認できません";
  const rest = Math.max(0, (total ?? 0) - mine);
  return `${mine}件${rest ? `／このコース全体で${total}件` : ""}`;
}

export function lessonLabel(l) {
  if (!l) return "";
  const head = l.sectionTitle && l.sectionTitle !== l.title ? `${l.sectionTitle} / ` : "";
  return `${head}${l.title || "名称未設定"}`;
}
