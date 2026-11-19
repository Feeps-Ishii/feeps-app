import React from "react";
import { activeCases } from "../cards.jsx";
import { ActGo, CaseScene, CaseSteps, CourseScene, DrillScene, Mk, PageBand } from "./Steps.jsx";

/* 各画面の帯（コース一覧・演習一覧・案件体験）。数字とカードの下の段は本人のデータ */

export function CoursesBand({ ctx }) {
  const { courses, resume, go } = ctx;
  const done = courses.filter(c => c.completed).length;
  const doing = courses.filter(c => c.progress > 0 && !c.completed).length;
  const rc = resume ? courses.find(c => c.id === resume.course.id) : null;
  const first = !resume ? courses.find(c => !c.locked && !c.completed) : null;
  const act = resume ? (
    <><span className="stp-pbar" aria-hidden="true"><i style={{ width: `${rc?.progress || 0}%` }} /></span>
      <span className="nm"><b>{resume.course.title}</b>{resume.lesson ? ` ・ ${resume.lesson.title}` : ""}</span>
      <ActGo onClick={() => go(resume.href)}>続きから</ActGo></>
  ) : first ? (
    <><span className="nm">はじめに <b>{first.title}</b></span><ActGo onClick={() => go(`#/courses/${first.id}`)}>はじめる</ActGo></>
  ) : courses.length && done === courses.length ? <span className="nm"><b>すべて修了</b></span> : null;
  return (
    <PageBand k="courses" headline={<>スライドで、<Mk>基礎から順に</Mk>。</>} flow={["スライド", "確認問題", "総合テスト", "修了"]}
      nums={<><span>修了 <b>{done}</b> / {courses.length}</span><span>受講中 <b>{doing}</b></span>{resume && <span className="now">{resume.course.title}</span>}</>}
      scene={<CourseScene>{act}</CourseScene>} />
  );
}

// 案件の今の段（依頼 0 › 修正 1 › 提出 2 › レビュー 3）
const CASE_AT = { doing: 1, returned: 1, submitted: 3 };
export function CasesBand({ ctx }) {
  const { cases, go } = ctx;
  const active = activeCases(cases);
  const top = active[0] || null;
  const merged = cases.filter(x => x.status === "approved").length;
  const first = !top ? cases.find(x => !x.locked && !x.status) : null;
  const act = top ? (
    <><CaseSteps at={CASE_AT[top.status] ?? 0} /><ActGo onClick={() => go(`#/cases/${top.id}`)}>続きから</ActGo></>
  ) : first ? (
    <><span className="nm">はじめに <b>{first.title}</b></span><ActGo onClick={() => go(`#/cases/${first.id}`)}>始める</ActGo></>
  ) : null;
  return (
    <PageBand k="cases" headline={<>案件の一部を、<Mk>まるごと体験</Mk>。</>} flow={["依頼を読む", "作る・直す", "提出", "レビュー"]}
      nums={<><span>全 <b>{cases.length}</b> 件</span><span>対応中 <b>{active.length}</b></span><span>マージ済み <b>{merged}</b></span>{top && <span className="now">{top.title}</span>}</>}
      scene={<CaseScene>{act}</CaseScene>} />
  );
}

/* 演習一覧の帯。数え方と「次」は DrillList が渡す（progressError のときは数字を出さない） */
export function DrillsBand({ go, total, done, trying, learned, next, progressError }) {
  const [d, why] = next || [];
  const act = progressError ? <span className="nm">進み具合を確認できません</span>
    : d ? <><span className="nm">{why === "try" ? "つづき" : "次は"} <b>{d.title}</b></span><ActGo onClick={() => go(`#/drills/${encodeURIComponent(d.id)}`)}>{why === "try" ? "つづきから" : "次の1問"}</ActGo></>
      : total ? <span className="nm"><b>すべてクリア</b></span> : null;
  return (
    <PageBand k="drills" headline={<>習ったら、<Mk>すぐ書いて動かす</Mk>。</>} flow={["コードを書く", "実行", "自動で採点"]}
      nums={progressError ? <span>進み具合を確認できません</span>
        : <><span>クリア <b>{done}</b> / {total}</span><span>挑戦中 <b>{trying}</b></span>{learned > 0 && <span className="now">習ったところ {learned}問</span>}</>}
      scene={<DrillScene>{act}</DrillScene>} />
  );
}
