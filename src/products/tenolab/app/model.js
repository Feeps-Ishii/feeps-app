import { OTHER_TOPIC } from "./ui.jsx";

/* API の形を、画面で使う形（単元・鍵・進み具合つき）に整える。 */

export function topicOf(topics, id) {
  return (topics || []).find(t => t.id === id) || { ...OTHER_TOPIC };
}

// コース（Eラーニングのコース + 自分の進み具合）
export function courseModels(lrn, topics, cases, premium) {
  return (lrn.catalog || []).map(c => {
    const topicObj = topicOf(topics, c.topic);
    const st = lrn.getCourseState(c.id);
    const done = st.status === "completed";
    const prog = done ? 100 : Math.max(0, Math.min(99, Number(st.progress ?? lrn.progress?.[c.id]?.progress ?? 0)));
    const isPremium = !!(c.premium || topicObj.premium);
    // 一覧の topic は「登録した単元のどれか」に。そうでなければ「その他」にまとめる
    return {
      id: c.id, title: c.title, level: c.level || "", duration: c.duration || "", topic: c.topic || OTHER_TOPIC.id, topicObj,
      lessons: Number(c.lessons ?? c.lessonCount ?? 0) || 0, progress: done ? 100 : prog, completed: done,
      premium: isPremium, locked: isPremium && !premium, raw: c,
      nextCase: (cases || []).find(x => x.needCourseId === c.id) || null,
    };
  });
}

// 演習（公開中 + 自分の記録）
export function drillModels(drills, topics, progress, premium) {
  return (drills || []).map(d => {
    const topicObj = topicOf(topics, d.topic);
    const isPremium = !!(d.premium || topicObj.premium);
    const rec = progress?.drill?.(d.id);
    return {
      ...d, topicObj, premium: isPremium, locked: isPremium && !premium,
      cleared: rec?.status === "cleared", start: START_OF[d.aws?.scenario] || "",
      thumb: d.thumb || (d.runtime === "aws" ? { kind: "aws", aws: AWS_THUMB[d.aws?.scenario] || {} } : null),
    };
  });
}
// AWS の演習の始める状態はシナリオで決まる（まっさら／用意済み／障害あり）
export const START_OF = { vpc: "blank", vpcec2: "blank", elb: "ready", asg: "ready", cw: "ready", recover: "trouble" };
const AWS_THUMB = { vpc: { ec2: 0 }, vpcec2: { ec2: 1 }, elb: { ec2: 2, elb: true }, asg: { ec2: 4, elb: true, asg: true }, cw: {}, recover: { ec2: 1, fixed: true } };

// 案件体験（公開中 + 自分の状態）。open = 挑戦できる（前提のコースを修了した）
export function caseModels(cases, topics, courses, premium) {
  return (cases || []).map(x => {
    const topicObj = topicOf(topics, x.topic);
    const isPremium = !!(x.premium || topicObj.premium);
    const need = (courses || []).find(c => c.id === x.needCourseId);
    // API の locked は「前提のコースが未修了」。画面の locked は「Premium の鍵」に使う
    return {
      ...x, topicObj, premium: isPremium, locked: !!x.premiumLocked || (isPremium && !premium),
      open: x.open ?? (x.locked === false || !!need?.completed),
      status: x.progress?.status || "",
      needTitle: need?.title || "",
    };
  });
}

export const byTopic = (list, topicId) => list.filter(x => x.topic === topicId);
