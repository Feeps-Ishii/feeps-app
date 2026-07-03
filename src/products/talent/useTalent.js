import * as XLSX from "xlsx";
import { useEffect, useState } from "react";
import { apiGet } from "../../api.js";

function buildSelfPR(p, strengths, weak, skills, projects) {
  const top = skills.filter(s => s.level >= 65).map(s => s.name).slice(0, 4);
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
function exportSkillSheetExcel({ p, selfPR, strengths, weak, skills, projects }) {
  try {
    const W = 6, rows = [], merges = [];
    const push = r => rows.push(r);
    const full = text => { const r = rows.length; push([text]); merges.push({ s: { r, c: 0 }, e: { r, c: W } }); };
    full("スキルシート");
    push([]);
    push(["氏名", p.name, "", "年齢", String(p.age), "", ""]);
    push(["役割", p.title, "", "経験年数", p.exp, "", ""]);
    push(["最寄駅", p.station, "", "", "", "", ""]);
    push([]);
    full("自己PR");
    { const r = rows.length; push([selfPR]); merges.push({ s: { r, c: 0 }, e: { r, c: W } }); }
    push([]);
    push(["強み", strengths.join("、")]);
    push(["弱み・課題", weak.join("、")]);
    push([]);
    full("保有スキル・資格");
    push(["分類", "名称", "習熟度(%)"]);
    skills.forEach(sk => push([sk.cat, sk.name, sk.level]));
    push([]);
    full("案件履歴 / 職務経歴");
    push(["No", "期間", "案件名 / 業務内容", "役割", "規模", "担当工程", "使用技術"]);
    projects.forEach((pr, i) => push([
      i + 1, pr.period, pr.name + (pr.desc ? "\n" + pr.desc : ""), pr.role, pr.scale,
      (pr.phases || []).join("・"), (pr.tech || []).join(", "),
    ]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 6 }, { wch: 18 }, { wch: 46 }, { wch: 14 }, { wch: 10 }, { wch: 26 }, { wch: 28 }];
    ws["!merges"] = merges;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "スキルシート");
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    XLSX.writeFile(wb, `スキルシート_${p.name}_${stamp}.xlsx`);
  } catch (e) { console.error(e); }
}
function exportClientSkillSheetsExcel(rows) {
  try {
    const data = (rows || []).map(r => ({
      氏名: r.name || "氏名未設定",
      メール: r.email || "",
      所属コース: r.courseName || r.course || "未登録",
      状態: "詳細API追加予定",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 18 }, { wch: 28 }, { wch: 24 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "スキルシート一覧");
    XLSX.writeFile(wb, "自社受講生_スキルシート一覧.xlsx");
  } catch (e) { console.error(e); }
}

const ELEARNING_FINAL_RESULTS_KEY = "feeps.el.finalTestResults";
const ELEARNING_FINAL_RESULTS_API_CACHE_KEY = "feeps.el.finalTestResults.apiCache";
const ELEARNING_FINAL_OFFICIAL_API_CACHE_KEY = "feeps.el.finalTestResults.officialApiCache";

function hasStorageKey(key) {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function normalizeFinalTestResult(item) {
  return { ...item, id: item.id || item.resultId };
}

function readFinalTestResultsFromStorage(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeFinalTestResult) : [];
  } catch {
    return [];
  }
}

function getElearningFinalTestResults() {
  if (hasStorageKey(ELEARNING_FINAL_RESULTS_API_CACHE_KEY)) {
    return readFinalTestResultsFromStorage(ELEARNING_FINAL_RESULTS_API_CACHE_KEY);
  }
  return readFinalTestResultsFromStorage(ELEARNING_FINAL_RESULTS_KEY);
}

async function refreshElearningFinalTestResultsFromApi() {
  const [resultsResponse, officialResponse] = await Promise.allSettled([
    apiGet("/learning/final-tests/results"),
    apiGet("/learning/final-tests/official"),
  ]);
  if (resultsResponse.status === "fulfilled" && Array.isArray(resultsResponse.value)) {
    const normalized = resultsResponse.value.map(normalizeFinalTestResult);
    localStorage.setItem(ELEARNING_FINAL_RESULTS_API_CACHE_KEY, JSON.stringify(normalized));
  }
  if (officialResponse.status === "fulfilled" && Array.isArray(officialResponse.value)) {
    const normalizedOfficial = officialResponse.value.map(normalizeFinalTestResult);
    localStorage.setItem(ELEARNING_FINAL_OFFICIAL_API_CACHE_KEY, JSON.stringify(normalizedOfficial));
  }
  return getElearningFinalTestResults();
}

function getPassedElearningFinalTests() {
  return getElearningFinalTestResults()
    .filter(item => item?.passed === true)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function compareOfficialResult(a, b) {
  const scoreDiff = Number(b?.score || 0) - Number(a?.score || 0);
  if (scoreDiff !== 0) return scoreDiff;
  return String(b?.createdAt || "").localeCompare(String(a?.createdAt || ""));
}

function getOfficialFinalTestResults() {
  if (hasStorageKey(ELEARNING_FINAL_OFFICIAL_API_CACHE_KEY)) {
    return readFinalTestResultsFromStorage(ELEARNING_FINAL_OFFICIAL_API_CACHE_KEY)
      .map(result => ({ ...result, official: true, officialRule: result.officialRule || "highest_pass_score_latest_on_tie" }))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }
  const bestByCourse = getPassedElearningFinalTests().reduce((acc, result) => {
    const key = result.courseId || result.courseTitle || result.id;
    const current = acc[key];
    if (!current || compareOfficialResult(current, result) > 0) acc[key] = result;
    return acc;
  }, {});
  return Object.values(bestByCourse)
    .map(result => ({ ...result, official: true, officialRule: "highest_pass_score_latest_on_tie" }))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function getOfficialSkillEvidence() {
  return getOfficialFinalTestResults().flatMap(result => (
    (result.skills || []).map(skill => ({
      id: `${result.id || result.courseId}_${skill}`,
      skill,
      courseId: result.courseId,
      courseTitle: result.courseTitle || result.courseId,
      score: Number(result.score || 0),
      passed: result.passed === true,
      completedAt: result.createdAt,
      weakLessons: result.weakLessons || [],
      lessonBreakdown: result.lessonBreakdown || [],
      official: true,
      officialRule: "最高点の合格結果を公式採用。同点の場合は最新の合格結果を採用。",
      evidence: `${result.courseTitle || result.courseId} 総合テスト ${Number(result.score || 0)}点 合格`,
    }))
  ));
}

function getElearningSkillEvidence() {
  return getOfficialSkillEvidence();
}

function getElearningFinalTestSummary() {
  const passed = getOfficialFinalTestResults();
  const allPassed = getPassedElearningFinalTests();
  const avgScore = passed.length
    ? Math.round(passed.reduce((sum, item) => sum + Number(item.score || 0), 0) / passed.length)
    : 0;
  const recent = passed[0] || null;
  const weakLessons = passed.flatMap(item => (
    (item.weakLessons || []).map(lesson => ({
      ...lesson,
      courseId: item.courseId,
      courseTitle: item.courseTitle || item.courseId,
      score: item.score,
      createdAt: item.createdAt,
    }))
  ));
  return { passedCount: passed.length, avgScore, recent, weakLessons, allPassedCount: allPassed.length, officialRule: "最高点の合格結果を公式採用。同点の場合は最新の合格結果を採用。" };
}

function useElearningFinalTestEvidence() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    refreshElearningFinalTestResultsFromApi()
      .then(() => { if (alive) setVersion(v => v + 1); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return {
    version,
    results: getElearningFinalTestResults(),
    officialResults: getOfficialFinalTestResults(),
    officialSkillEvidence: getOfficialSkillEvidence(),
    summary: getElearningFinalTestSummary(),
  };
}

function useTalent() {
  return {
    buildSelfPR,
    exportSkillSheetExcel,
    exportClientSkillSheetsExcel,
    getElearningFinalTestResults,
    getPassedElearningFinalTests,
    getOfficialFinalTestResults,
    getOfficialSkillEvidence,
    getElearningSkillEvidence,
    getElearningFinalTestSummary,
    refreshElearningFinalTestResultsFromApi,
    useElearningFinalTestEvidence,
  };
}

export {
  useTalent,
  buildSelfPR,
  exportSkillSheetExcel,
  exportClientSkillSheetsExcel,
  getElearningFinalTestResults,
  getPassedElearningFinalTests,
  getOfficialFinalTestResults,
  getOfficialSkillEvidence,
  getElearningSkillEvidence,
  getElearningFinalTestSummary,
  refreshElearningFinalTestResultsFromApi,
  useElearningFinalTestEvidence,
};
