import { useEffect, useState } from "react";
import { apiGet } from "../../api.js";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fallbackName = (id) => "受講生 " + String(id || "").slice(0, 6);
const hasReportComment = r => !!r?.comment || (Array.isArray(r?.comments) && r.comments.length > 0);

const datesInMonth = (ym) => {
  if (!ym) return [];
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return [];
  const last = new Date(y, m, 0).getDate();
  return Array.from({ length: last }, (_, i) => ym + "-" + String(i + 1).padStart(2, "0"));
};

// 前月比較用: "YYYY-MM" の前月を返す
const prevMonthOf = (ym) => {
  const [y, m] = String(ym || "").split("-").map(Number);
  if (!y || !m) return null;
  const t = new Date(y, m - 2, 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
};

// 出席・日報の延べ件数のみ集計（対象受講生はmemberIdsで絞り込み）。前月比較用に当月・前月で共用する。
const sumAttReport = (attAll, repAll, memberIds) => {
  const att = attAll.filter(a => memberIds.has(a?.traineeId));
  const present = att.filter(a => a?.clockIn).length;
  const absent = att.filter(a => /欠|absent/i.test(String(a?.status || ""))).length;
  const late = att.filter(a => /遅|late/i.test(String(a?.status || ""))).length;
  const reports = repAll.filter(r => memberIds.has(r?.traineeId || r?.userId)).length;
  const commented = repAll.filter(r => memberIds.has(r?.traineeId || r?.userId) && hasReportComment(r)).length;
  return { present, absent, late, reports, commented };
};

// 月次レポート: 既存APIのフロント集計（コース別の出席/日報/テスト。大量データ時はBackend集計API化が前提）
export function useMonthlyReport() {
  const [month, setMonth] = useState(() => todayStr().slice(0, 7));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  // 前月比較: 出席・日報はattendance/reportsのdateパラメータで前月分を取得できるため比較を出す。
  // テスト結果APIは日付を持たず月で絞り込めないため、テスト平均・受験数の前月比較はスコープ外とする。
  const [prevTotals, setPrevTotals] = useState(null);
  const [prevErr, setPrevErr] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr("");
    setPrevErr("");
    const dates = datesInMonth(month);
    const prevMonth = prevMonthOf(month);
    const prevDates = datesInMonth(prevMonth);
    (async () => {
      try {
        const [trainees, courses, tests] = await Promise.all([
          apiGet("/trainees").catch(() => []),
          apiGet("/courses").catch(() => []),
          apiGet("/tests").catch(() => []),
        ]);
        const courseList = (Array.isArray(courses) ? courses : []).filter(c => c?.deleted !== true);
        const activeTests = (Array.isArray(tests) ? tests : []).filter(t => (t?.status || "published") !== "archived");
        const [attDays, repDays, memberPairs, resultPairs, prevAttDays, prevRepDays] = await Promise.all([
          Promise.all(dates.map(d => apiGet("/attendance?date=" + d).catch(() => []))),
          Promise.all(dates.map(d => apiGet("/reports?date=" + d).catch(() => []))),
          Promise.all(courseList.map(c => apiGet(`/courses/${c.courseId}/trainees`).then(rows => [c.courseId, Array.isArray(rows) ? rows : []]).catch(() => [c.courseId, []]))),
          Promise.all(activeTests.map(t => { const id = t.testId || t.id; return apiGet(`/tests/${id}/results`).then(rows => [t, Array.isArray(rows) ? rows : []]).catch(() => [t, []]); })),
          Promise.all(prevDates.map(d => apiGet("/attendance?date=" + d).catch(() => null))),
          Promise.all(prevDates.map(d => apiGet("/reports?date=" + d).catch(() => null))),
        ]);
        if (!alive) return;
        const attAll = attDays.flatMap(x => x || []);
        const repAll = repDays.flatMap(x => x || []);
        const membersByCourse = Object.fromEntries(memberPairs);
        const rows = courseList.map(c => {
          const memberIds = new Set((membersByCourse[c.courseId] || []).map(t => t.userId).filter(Boolean));
          const { present, absent, late, reports, commented } = sumAttReport(attAll, repAll, memberIds);
          const scores = resultPairs.filter(([t]) => t.courseId === c.courseId).flatMap(([, rs]) => rs.filter(r => memberIds.has(r?.traineeId || r?.userId)).map(r => Number(r?.score)).filter(Number.isFinite));
          return {
            courseId: c.courseId,
            name: c.name || c.courseId,
            members: memberIds.size,
            present, absent, late, reports, commented,
            avgScore: scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null,
            testCount: scores.length,
          };
        });
        const allScores = rows.flatMap(r => r.avgScore == null ? [] : [[r.avgScore, r.testCount]]);
        const totalTests = rows.reduce((s, r) => s + r.testCount, 0);
        setData({
          rows,
          totals: {
            trainees: (Array.isArray(trainees) ? trainees : []).length,
            present: rows.reduce((s, r) => s + r.present, 0),
            absent: rows.reduce((s, r) => s + r.absent, 0),
            late: rows.reduce((s, r) => s + r.late, 0),
            reports: rows.reduce((s, r) => s + r.reports, 0),
            commented: rows.reduce((s, r) => s + r.commented, 0),
            avgScore: totalTests ? Math.round(allScores.reduce((s, [a, n]) => s + a * n, 0) / totalTests) : null,
            testCount: totalTests,
          },
        });

        // 前月分: いずれかの日で取得失敗（null）した場合は前月データなし扱い
        const prevOk = prevAttDays.every(x => x !== null) && prevRepDays.every(x => x !== null);
        if (prevOk) {
          const prevAttAll = prevAttDays.flatMap(x => x || []);
          const prevRepAll = prevRepDays.flatMap(x => x || []);
          const allMemberIds = new Set(Object.values(membersByCourse).flat().map(t => t.userId).filter(Boolean));
          const prevAgg = sumAttReport(prevAttAll, prevRepAll, allMemberIds);
          setPrevTotals(prevAgg);
        } else {
          setPrevTotals(null);
          setPrevErr("前月データなし");
        }
      } catch (e) {
        if (alive) setErr("月次レポートの集計に失敗しました：" + (e?.errorMessage || e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [month]);

  return { month, setMonth, data, loading, err, prevTotals, prevErr };
}

export function useAwsCosts() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [aiData, setAiData] = useState(null);
  const [aiErr, setAiErr] = useState("");
  const [prevData, setPrevData] = useState(null);
  const [prevAiData, setPrevAiData] = useState(null);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr("");
    setAiErr("");
    const prevMonth = prevMonthOf(month);
    Promise.allSettled([
      apiGet(`/admin/aws-costs?month=${month}`),
      apiGet(`/admin/ai-usage?month=${month}`),
      apiGet(`/admin/aws-costs?month=${prevMonth}`),
      apiGet(`/admin/ai-usage?month=${prevMonth}`),
    ]).then(([ceRes, aiRes, cePrevRes, aiPrevRes]) => {
      if (!alive) return;
      if (ceRes.status === "fulfilled") setData(ceRes.value);
      else setErr("AWS利用料金の取得に失敗しました：" + (ceRes.reason?.message || ceRes.reason));
      if (aiRes.status === "fulfilled") setAiData(aiRes.value);
      else setAiErr("AI利用ログの取得に失敗しました：" + (aiRes.reason?.message || aiRes.reason));
      // 前月データは取得失敗しても画面全体は落とさず「前月データなし」表示にする
      setPrevData(cePrevRes.status === "fulfilled" ? cePrevRes.value : null);
      setPrevAiData(aiPrevRes.status === "fulfilled" ? aiPrevRes.value : null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [month]);

  return { data, loading, err, aiData, aiErr, month, setMonth, prevData, prevAiData };
}

// 2026-07-21 監査対応: 「今日」基準のraw /reports・/attendance集計だと、非研修日に全員が
// 同じ「日報未提出」理由で埋没し、実際の欠席・遅刻が見えなくなる（P0 A-3）。dashboard.mjsの
// 累積未解消集計（コースの直近研修日までの未解消異常。admin/instructor/client共通ロジック）から
// 日報・勤怠のシグナルを取り、実際に起きている異常の種類（欠席/遅刻/早退/勤怠未登録/未コメント）
// をそのままリスク理由として使う。
export function useRiskAnalysis() {
  const [riskData, setRiskData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const date = todayStr();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr("");
    Promise.all([
      apiGet("/trainees"),
      apiGet("/companies").catch(() => []),
      apiGet("/dashboard/admin?date=" + date).catch(() => null),
      apiGet("/tests").catch(() => []),
    ]).then(async ([trainees, companies, dash, tests]) => {
      const traineeList = Array.isArray(trainees) ? trainees : [];
      const companyMap = Object.fromEntries((Array.isArray(companies) ? companies : []).map(c => [c.companyId, c.name]));
      const followUpById = Object.fromEntries((Array.isArray(dash?.followUps) ? dash.followUps : []).map(f => [f.traineeId, f]));
      const testList = (Array.isArray(tests) ? tests : []).filter(t => (t.status || "published") !== "archived");
      const resultPairs = await Promise.all(
        testList.map(t => {
          const tid = t.testId || t.id;
          return apiGet(`/tests/${tid}/results`).then(rows => [tid, Array.isArray(rows) ? rows : []]).catch(() => [tid, []]);
        })
      );
      if (!alive) return;
      const testResults = Object.fromEntries(resultPairs);

      const data = traineeList.map(t => {
        const uid = t.userId;
        const followUpReasons = followUpById[uid]?.reasons || [];
        const scores = testList.flatMap(test => {
          const tid = test.testId || test.id;
          return (testResults[tid] || []).filter(r => r.traineeId === uid)
            .map(r => Number(r.officialScore ?? r.teacherScore ?? r.score)).filter(Number.isFinite);
        });
        const avgScore = scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null;
        const hasUntaken = testList.length > 0 && testList.some(test => {
          const tid = test.testId || test.id;
          return !(testResults[tid] || []).some(r => r.traineeId === uid);
        });

        let score = 0;
        const signals = { 日報: 0, 勤怠: 0, テスト: 0, コメント: 0 };
        const reasons = [];

        followUpReasons.forEach(r => {
          if (r.type === "report_missing") { score += 20; signals.日報 += 20; reasons.push(r.label || "日報未提出"); }
          else if (r.type === "report_uncommented") { score += 10; signals.コメント += 10; reasons.push(r.label || "日報未コメント"); }
          else if (r.type === "attendance_missing") { score += 15; signals.勤怠 += 15; reasons.push(r.label || "勤怠未登録"); }
          else if (r.type === "attendance_absent") { score += 25; signals.勤怠 += 25; reasons.push(r.label || "欠席"); }
          else if (r.type === "attendance_late" || r.type === "attendance_early_leave") { score += 10; signals.勤怠 += 10; reasons.push(r.label || "遅刻/早退"); }
        });
        if (avgScore !== null && avgScore < 60) { score += 25; signals.テスト += 25; reasons.push("テスト平均60点未満"); }
        else if (avgScore !== null && avgScore < 70) { score += 15; signals.テスト += 15; reasons.push("テスト平均70点未満"); }
        if (hasUntaken) { score += 15; signals.テスト += 15; reasons.push("未受験テストあり"); }

        return {
          userId: uid,
          name: t.name || t.email || fallbackName(uid),
          org: companyMap[t.company] || t.company || "未設定",
          score,
          signals,
          top: reasons[0] || "問題なし",
          reasons,
          avgScore,
        };
      });

      setRiskData(data.sort((a, b) => b.score - a.score));
    }).catch(e => alive && setErr("リスクデータの取得に失敗しました：" + (e?.message || e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [date]);

  return { riskData, loading, err, date };
}
