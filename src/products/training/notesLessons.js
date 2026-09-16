/* ノートが刺さる「単元」の並び。正典: docs/specs/training-notes-spec.md
 *
 * ノート本体（react-markdown を含む）とは分けてある。カリキュラム画面のように
 * 常時読み込まれる場所からも、重いものを連れてこずに単元リストだけ使えるようにするため。 */

/* カリキュラムの木を、上から順の平らな単元リストにする（＝教科書の並び） */
export function flattenLessons(sections) {
  const out = [];
  (sections || []).forEach(section => {
    if (section.unitMode === "section") {
      out.push({ id: section.id, title: section.title, sectionTitle: section.title, chapterTitle: "" });
      return;
    }
    (section.chapters || []).forEach(chapter => {
      (chapter.lessons || []).forEach(lesson => {
        out.push({
          id: lesson.id,
          title: lesson.title,
          sectionTitle: section.title,
          chapterTitle: chapter.title,
        });
      });
    });
  });
  return out;
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
