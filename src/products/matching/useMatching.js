import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../../api.js";

function apiErrorMessage(e, fallback) {
  if (e?.status === 403) return "この操作を行う権限がありません。";
  return e?.errorMessage || e?.message || fallback;
}

export function matchTone(score) {
  const s = Number(score) || 0;
  return s >= 80 ? "green" : s >= 60 ? "cyan" : s >= 40 ? "amber" : "muted";
}

// "Java:60, SQL:40" 形式のテキスト⇔配列変換（Backendの requiredSkills/preferredSkills 形状に合わせる）
export function parseSkillReqText(text) {
  return String(text || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(pair => {
      const [skill, level] = pair.split(":").map(s => (s || "").trim());
      return { skill: skill || "", level: Number(level) || 0 };
    })
    .filter(item => item.skill);
}
export function skillReqToText(arr) {
  return (Array.isArray(arr) ? arr : []).map(s => `${s.skill}:${s.level}`).join(", ");
}
function parseListText(text) {
  return String(text || "").split(",").map(s => s.trim()).filter(Boolean);
}

// ---- Projects（client: 自社CRUD / admin: 監査閲覧、権限はBackendが強制） ----
export function useMatchingProjects(enabled = true, scopeKey = "") {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(() => {
    if (!enabled) {
      setProjects([]);
      setLoading(false);
      setError("");
      return Promise.resolve();
    }
    setLoading(true);
    setError("");
    return apiGet("/projects")
      .then(res => setProjects(Array.isArray(res?.items) ? res.items : []))
      .catch(e => setError(apiErrorMessage(e, "案件一覧の取得に失敗しました。")))
      .finally(() => setLoading(false));
  }, [enabled, scopeKey]);

  useEffect(() => { load(); }, [load]);

  async function createProject(payload) {
    try {
      const res = await apiPost("/projects", payload);
      await load();
      return res?.project || null;
    } catch (e) {
      setActionError(apiErrorMessage(e, "案件の作成に失敗しました。"));
      throw e;
    }
  }
  async function updateProject(projectId, payload) {
    try {
      const res = await apiPut(`/projects/${encodeURIComponent(projectId)}`, payload);
      await load();
      return res?.project || null;
    } catch (e) {
      setActionError(apiErrorMessage(e, "案件の更新に失敗しました。"));
      throw e;
    }
  }
  async function deleteProject(projectId) {
    try {
      await apiDelete(`/projects/${encodeURIComponent(projectId)}`);
      await load();
    } catch (e) {
      setActionError(apiErrorMessage(e, "案件の削除に失敗しました。"));
      throw e;
    }
  }

  return {
    projects, loading, error, actionError,
    clearActionError: () => setActionError(""),
    reload: load, createProject, updateProject, deleteProject,
  };
}

export function projectFormToPayload(form) {
  return {
    companyId: form.companyId || "",
    title: form.title.trim(),
    description: form.description || "",
    status: form.status || "draft",
    visibility: form.visibility || "public",
    requiredSkills: parseSkillReqText(form.requiredSkillsText),
    preferredSkills: parseSkillReqText(form.preferredSkillsText),
    requiredQualifications: parseListText(form.requiredQualificationsText),
    preferredQualifications: parseListText(form.preferredQualificationsText),
    requiredExperience: form.requiredExperience || "",
    location: form.location || "",
    workStyle: form.workStyle || "",
    budgetMin: form.budgetMin === "" ? null : Number(form.budgetMin),
    budgetMax: form.budgetMax === "" ? null : Number(form.budgetMax),
    periodStart: form.periodStart || "",
    periodEnd: form.periodEnd || "",
    openings: Number(form.openings || 1),
    tags: parseListText(form.tagsText),
    notes: form.notes || "",
  };
}

export function projectToForm(project) {
  if (!project) return null;
  return {
    companyId: project.companyId || "",
    title: project.title || "",
    description: project.description || "",
    status: project.status || "draft",
    visibility: project.visibility || "public",
    requiredSkillsText: skillReqToText(project.requiredSkills),
    preferredSkillsText: skillReqToText(project.preferredSkills),
    requiredQualificationsText: (project.requiredQualifications || []).join(", "),
    preferredQualificationsText: (project.preferredQualifications || []).join(", "),
    requiredExperience: project.requiredExperience || "",
    location: project.location || "",
    workStyle: project.workStyle || "",
    budgetMin: project.budgetMin != null ? String(project.budgetMin) : "",
    budgetMax: project.budgetMax != null ? String(project.budgetMax) : "",
    periodStart: project.periodStart || "",
    periodEnd: project.periodEnd || "",
    openings: String(project.openings || 1),
    tagsText: (project.tags || []).join(", "),
    notes: project.notes || "",
  };
}

// ---- Candidates（案件ごとの候補者マッチング。案件選択時にオンデマンド取得） ----
export function useProjectCandidates(projectId, enabled = true) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled || !projectId) { setItems([]); setLoading(false); setError(""); return; }
    let alive = true;
    setLoading(true);
    setError("");
    apiGet(`/projects/${encodeURIComponent(projectId)}/candidates`)
      .then(res => { if (alive) setItems(Array.isArray(res?.items) ? res.items : []); })
      .catch(e => { if (alive) setError(apiErrorMessage(e, "候補者一覧の取得に失敗しました。")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [enabled, projectId]);

  return { items, loading, error };
}

// ---- Placements（client: 自社CRUD / admin: 監査read / trainee: 本人read） ----
export function useMatchingPlacements(params = {}, enabled = true, scopeKey = "") {
  const query = new URLSearchParams();
  if (params.projectId) query.set("projectId", params.projectId);
  if (params.traineeId) query.set("traineeId", params.traineeId);
  if (params.companyId) query.set("companyId", params.companyId);
  if (params.status) query.set("status", params.status);
  const qs = query.toString();
  const path = "/placements" + (qs ? `?${qs}` : "");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(() => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      setError("");
      return Promise.resolve();
    }
    setLoading(true);
    setError("");
    return apiGet(path)
      .then(res => setItems(Array.isArray(res?.items) ? res.items : []))
      .catch(e => setError(apiErrorMessage(e, "参画状況の取得に失敗しました。")))
      .finally(() => setLoading(false));
  }, [enabled, path, scopeKey]);

  useEffect(() => { load(); }, [load]);

  async function createPlacement(payload) {
    try {
      const res = await apiPost("/placements", payload);
      await load();
      return res?.placement || null;
    } catch (e) {
      setActionError(apiErrorMessage(e, "参画の登録に失敗しました。"));
      throw e;
    }
  }
  async function updatePlacement(placementId, payload) {
    try {
      const res = await apiPut(`/placements/${encodeURIComponent(placementId)}`, payload);
      await load();
      return res?.placement || null;
    } catch (e) {
      setActionError(apiErrorMessage(e, "参画の更新に失敗しました。"));
      throw e;
    }
  }
  async function deletePlacement(placementId) {
    try {
      await apiDelete(`/placements/${encodeURIComponent(placementId)}`);
      await load();
    } catch (e) {
      setActionError(apiErrorMessage(e, "参画の削除に失敗しました。"));
      throw e;
    }
  }

  return {
    items, loading, error, actionError,
    clearActionError: () => setActionError(""),
    reload: load, createPlacement, updatePlacement, deletePlacement,
  };
}

export function placementFormToPayload(form) {
  return {
    projectId: form.projectId,
    traineeId: form.traineeId,
    status: form.status || "proposed",
    interviewAt: form.interviewAt || "",
    acceptedAt: form.acceptedAt || "",
    startDate: form.startDate || "",
    expectedEndDate: form.expectedEndDate || "",
    actualEndDate: form.actualEndDate || "",
    rate: form.rate === "" ? null : Number(form.rate),
    contractType: form.contractType || "",
    notes: form.notes || "",
  };
}

// ---- trainee本人向け: おすすめ案件 + 自分の参画状況/履歴 ----
export function useMatchingMe(enabled = true, scopeKey = "") {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      setError("");
      return Promise.resolve();
    }
    setLoading(true);
    setError("");
    return apiGet("/matching/me")
      .then(res => setData(res))
      .catch(e => setError(apiErrorMessage(e, "あなた向け案件の取得に失敗しました。")))
      .finally(() => setLoading(false));
  }, [enabled, scopeKey]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}

// ---- client向け: 自社受講生一覧（既存 /trainees を流用、Backend側で自社scope済み） ----
export function useManagedTrainees(enabled = true, scopeKey = "") {
  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) {
      setTrainees([]);
      setLoading(false);
      setError("");
      return undefined;
    }
    let alive = true;
    setLoading(true);
    apiGet("/trainees")
      .then(list => { if (alive) setTrainees(Array.isArray(list) ? list : []); })
      .catch(e => { if (alive) setError(apiErrorMessage(e, "受講生一覧の取得に失敗しました。")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [enabled, scopeKey]);
  return { trainees, loading, error };
}

// ---- 企業一覧（案件フォームの会社選択用、既存 /companies を流用） ----
export function useCompanies(enabled = true, scopeKey = "") {
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) {
      setCompanies([]);
      setError("");
      return undefined;
    }
    let alive = true;
    apiGet("/companies")
      .then(list => { if (alive) setCompanies(Array.isArray(list) ? list : []); })
      .catch(e => { if (alive) setError(apiErrorMessage(e, "企業一覧の取得に失敗しました。")); });
    return () => { alive = false; };
  }, [enabled, scopeKey]);
  return { companies, error };
}

// ---- スキルシート: 候補者クリック時にオンデマンドで実データのみ取得（Talent APIのみ利用） ----
export async function fetchTraineePortfolio(traineeId) {
  return apiGet(`/skills/${encodeURIComponent(traineeId)}`);
}

// 未登録項目は「未登録」と明示し、勝手に補完しない。
export function candidateToSheet(trainee, portfolio) {
  const p = portfolio || {};
  return {
    p: {
      name: trainee?.name || "氏名未登録",
      age: "未登録",
      exp: "未登録",
      title: trainee?.companyName || "所属未登録",
      station: "未登録",
    },
    selfPR: p.selfPR || "",
    strengths: Array.isArray(p.strengths) ? p.strengths : [],
    weak: Array.isArray(p.weak) ? p.weak : [],
    skills: Array.isArray(p.skills) ? p.skills : [],
    projects: Array.isArray(p.projects) ? p.projects : [],
  };
}
