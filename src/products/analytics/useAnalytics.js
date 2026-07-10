import { useEffect, useState } from "react";
import { apiGet } from "../../api.js";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const statusKind = (status) => {
  const s = String(status || "").toLowerCase();
  if (["present", "出勤", "attended"].includes(s)) return "present";
  if (["absent", "欠席"].includes(s)) return "absent";
  if (["late", "遅刻", "early", "早退"].includes(s)) return "late";
  return "unknown";
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

// 月次レポート: 既存APIのフロント集計（コース別の出席/日報/テスト。大量データ時はBackend集計API化が前提）
export function useMonthlyReport() {
  const [month, setMonth] = useState(() => todayStr().slice(0, 7));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr("");
    const dates = datesInMonth(month);
    (async () => {
      try {
        const [trainees, courses, tests] = await Promise.all([
          apiGet("/trainees").catch(() => []),
          apiGet("/courses").catch(() => []),
          apiGet("/tests").catch(() => []),
        ]);
        const courseList = (Array.isArray(courses) ? courses : []).filter(c => c?.deleted !== true);
        const activeTests = (Array.isArray(tests) ? tests : []).filter(t => (t?.status || "published") !== "archived");
        const [attDays, repDays, memberPairs, resultPairs] = await Promise.all([
          Promise.all(dates.map(d => apiGet("/attendance?date=" + d).catch(() => []))),
          Promise.all(dates.map(d => apiGet("/reports?date=" + d).catch(() => []))),
          Promise.all(courseList.map(c => apiGet(`/courses/${c.courseId}/trainees`).then(rows => [c.courseId, Array.isArray(rows) ? rows : []]).catch(() => [c.courseId, []]))),
          Promise.all(activeTests.map(t => { const id = t.testId || t.id; return apiGet(`/tests/${id}/results`).then(rows => [t, Array.isArray(rows) ? rows : []]).catch(() => [t, []]); })),
        ]);
        if (!alive) return;
        const attAll = attDays.flatMap(x => x || []);
        const repAll = repDays.flatMap(x => x || []);
        const membersByCourse = Object.fromEntries(memberPairs);
        const rows = courseList.map(c => {
          const memberIds = new Set((membersByCourse[c.courseId] || []).map(t => t.userId).filter(Boolean));
          const att = attAll.filter(a => memberIds.has(a?.traineeId));
          const present = att.filter(a => a?.clockIn).length;
          const absent = att.filter(a => /欠|absent/i.test(String(a?.status || ""))).length;
          const late = att.filter(a => /遅|late/i.test(String(a?.status || ""))).length;
          const reports = repAll.filter(r => memberIds.has(r?.traineeId || r?.userId)).length;
          const commented = repAll.filter(r => memberIds.has(r?.traineeId || r?.userId) && hasReportComment(r)).length;
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
      } catch (e) {
        if (alive) setErr("月次レポートの集計に失敗しました：" + (e?.errorMessage || e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [month]);

  return { month, setMonth, data, loading, err };
}

export function useAwsCosts() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [aiData, setAiData] = useState(null);
  const [aiErr, setAiErr] = useState("");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr("");
    setAiErr("");
    Promise.allSettled([
      apiGet(`/admin/aws-costs?month=${month}`),
      apiGet(`/admin/ai-usage?month=${month}`),
    ]).then(([ceRes, aiRes]) => {
      if (!alive) return;
      if (ceRes.status === "fulfilled") setData(ceRes.value);
      else setErr("AWS利用料金の取得に失敗しました：" + (ceRes.reason?.message || ceRes.reason));
      if (aiRes.status === "fulfilled") setAiData(aiRes.value);
      else setAiErr("AI利用ログの取得に失敗しました：" + (aiRes.reason?.message || aiRes.reason));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [month]);

  return { data, loading, err, aiData, aiErr, month, setMonth };
}

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
      apiGet("/reports?date=" + date).catch(() => []),
      apiGet("/attendance?date=" + date).catch(() => []),
      apiGet("/tests").catch(() => []),
    ]).then(async ([trainees, companies, reports, attendances, tests]) => {
      const traineeList = Array.isArray(trainees) ? trainees : [];
      const companyMap = Object.fromEntries((Array.isArray(companies) ? companies : []).map(c => [c.companyId, c.name]));
      const reportById = Object.fromEntries((Array.isArray(reports) ? reports : []).map(r => [r.traineeId, r]));
      const attendanceById = Object.fromEntries((Array.isArray(attendances) ? attendances : []).map(a => [a.traineeId, a]));
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
        const report = reportById[uid];
        const att = attendanceById[uid];
        const attKind = statusKind(att?.status);
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
        const needsComment = report && (report.question || report.blockers) && !hasReportComment(report);

        let score = 0;
        const signals = { 日報: 0, 勤怠: 0, テスト: 0, コメント: 0 };
        const reasons = [];

        if (!report) { score += 20; signals.日報 += 20; reasons.push("日報未提出"); }
        if (!att) { score += 15; signals.勤怠 += 15; reasons.push("勤怠未登録"); }
        else if (attKind === "absent") { score += 25; signals.勤怠 += 25; reasons.push("欠席"); }
        else if (attKind === "late") { score += 10; signals.勤怠 += 10; reasons.push("遅刻/早退"); }
        if (avgScore !== null && avgScore < 60) { score += 25; signals.テスト += 25; reasons.push("テスト平均60点未満"); }
        else if (avgScore !== null && avgScore < 70) { score += 15; signals.テスト += 15; reasons.push("テスト平均70点未満"); }
        if (hasUntaken) { score += 15; signals.テスト += 15; reasons.push("未受験テストあり"); }
        if (needsComment) { score += 10; signals.コメント += 10; reasons.push("コメント未対応"); }

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
