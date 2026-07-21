import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../../api.js";

function apiErrorMessage(e, fallback) {
  if (e?.status === 403) return "この操作を行う権限がありません。";
  return e?.errorMessage || e?.message || fallback;
}

// ---- 案件一覧（trainee: 公開＋可視範囲済み＋自分の進捗マージ／admin・instructor: 全件・自作） ----
export function useDevLabProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true); setError("");
    return apiGet("/devlab/projects")
      .then(res => setProjects(Array.isArray(res?.items) ? res.items : []))
      .catch(e => setError(apiErrorMessage(e, "案件一覧を確認できません。")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return { projects, loading, error, reload: load };
}

// ---- 受講生の自分の進捗（GET /devlab/me） ----
export function useDevLabMe() {
  const [state, setState] = useState({ assignments: [], submissions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true); setError("");
    return apiGet("/devlab/me")
      .then(res => setState({ assignments: res?.assignments || [], submissions: res?.submissions || [] }))
      .catch(e => setError(apiErrorMessage(e, "進捗を確認できません。")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return { ...state, loading, error, reload: load };
}

// ---- 受講生の案件参加・提出・完了アクション ----
export function useDevLabActions(reloadCallbacks = []) {
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  async function reloadAll() {
    await Promise.all(reloadCallbacks.map(fn => fn()));
  }

  async function start(projectId) {
    setBusy(true); setActionError("");
    try {
      const res = await apiPost(`/devlab/projects/${encodeURIComponent(projectId)}/start`, {});
      await reloadAll();
      return res?.assignment || null;
    } catch (e) {
      setActionError(apiErrorMessage(e, "案件の開始に失敗しました。"));
      throw e;
    } finally { setBusy(false); }
  }

  async function submitStep(projectId, stepId, payload) {
    setBusy(true); setActionError("");
    try {
      const res = await apiPost(`/devlab/projects/${encodeURIComponent(projectId)}/steps/${encodeURIComponent(stepId)}/submit`, payload);
      await reloadAll();
      return res?.submission || null;
    } catch (e) {
      setActionError(apiErrorMessage(e, "提出に失敗しました。"));
      throw e;
    } finally { setBusy(false); }
  }

  async function complete(projectId) {
    setBusy(true); setActionError("");
    try {
      const res = await apiPost(`/devlab/projects/${encodeURIComponent(projectId)}/complete`, {});
      await reloadAll();
      return res;
    } catch (e) {
      setActionError(apiErrorMessage(e, "完了処理に失敗しました。"));
      throw e;
    } finally { setBusy(false); }
  }

  async function addToSkillSheet(projectId, worksDraft, existingSkillSheet) {
    setBusy(true); setActionError("");
    try {
      const currentWorks = Array.isArray(existingSkillSheet?.works) ? existingSkillSheet.works : [];
      await apiPut("/skills/me", { works: [...currentWorks, worksDraft] });
      await apiPut("/devlab/me/works-draft-added", { projectId });
      await reloadAll();
    } catch (e) {
      setActionError(apiErrorMessage(e, "スキルシートへの反映に失敗しました。"));
      throw e;
    } finally { setBusy(false); }
  }

  return { start, submitStep, complete, addToSkillSheet, busy, actionError, clearActionError: () => setActionError("") };
}

// ---- admin/instructor: 案件管理（CRUD＋AI下書き生成） ----
export function useDevLabAdmin() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError("");
    return apiGet("/devlab/projects")
      .then(res => setProjects(Array.isArray(res?.items) ? res.items : []))
      .catch(e => setError(apiErrorMessage(e, "案件一覧を確認できません。")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(payload) {
    setBusy(true); setActionError("");
    try {
      const res = await apiPost("/devlab/admin/projects", payload);
      await load();
      return res?.project || null;
    } catch (e) {
      setActionError(apiErrorMessage(e, "案件の作成に失敗しました。"));
      throw e;
    } finally { setBusy(false); }
  }

  async function update(projectId, payload) {
    setBusy(true); setActionError("");
    try {
      const res = await apiPut(`/devlab/admin/projects/${encodeURIComponent(projectId)}`, payload);
      await load();
      return res?.project || null;
    } catch (e) {
      setActionError(apiErrorMessage(e, "案件の更新に失敗しました。"));
      throw e;
    } finally { setBusy(false); }
  }

  async function remove(projectId) {
    setBusy(true); setActionError("");
    try {
      await apiDelete(`/devlab/admin/projects/${encodeURIComponent(projectId)}`);
      await load();
    } catch (e) {
      setActionError(apiErrorMessage(e, "案件の削除に失敗しました。"));
      throw e;
    } finally { setBusy(false); }
  }

  async function generate(payload) {
    setBusy(true); setActionError("");
    try {
      const res = await apiPost("/devlab/admin/projects/generate", payload);
      return res?.draft || null;
    } catch (e) {
      setActionError(apiErrorMessage(e, "AI下書き生成に失敗しました。"));
      throw e;
    } finally { setBusy(false); }
  }

  return { projects, loading, error, reload: load, create, update, remove, generate, busy, actionError, clearActionError: () => setActionError("") };
}

// ---- admin/instructor: 提出状況閲覧＋手動上書き ----
export function useDevLabSubmissions(projectId) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError("");
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    return apiGet(`/devlab/admin/submissions${q}`)
      .then(res => setSubmissions(Array.isArray(res?.items) ? res.items : []))
      .catch(e => setError(apiErrorMessage(e, "提出状況を確認できません。")))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // AIの誤判定への保険。合否(passed)をtrue/falseへ手動上書きする。
  async function override(traineeId, stepId, passed, overrideNote) {
    setBusy(true); setActionError("");
    try {
      const res = await apiPut(`/devlab/admin/submissions/${encodeURIComponent(traineeId)}/${encodeURIComponent(projectId)}/${encodeURIComponent(stepId)}`, { passed, overrideNote });
      await load();
      return res?.submission || null;
    } catch (e) {
      setActionError(apiErrorMessage(e, "上書きに失敗しました。"));
      throw e;
    } finally { setBusy(false); }
  }

  return { submissions, loading, error, reload: load, override, busy, actionError, clearActionError: () => setActionError("") };
}

// ---- ワークスペース（プロジェクト体験）: 公開テンプレ一覧＋自分の進行状況 ----
export function useDevLabWorkspaceTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true); setError("");
    return apiGet("/devlab/workspace-templates")
      .then(res => setTemplates(Array.isArray(res?.items) ? res.items : []))
      .catch(e => setError(apiErrorMessage(e, "テンプレート一覧を確認できません。")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return { templates, loading, error, reload: load };
}

// ---- ワークスペース（プロジェクト体験）: テンプレ詳細（files込み）＋自分のoverlayをマージ ----
export function useDevLabWorkspaceDetail(templateId) {
  const [template, setTemplate] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!templateId) return Promise.resolve();
    setLoading(true); setError("");
    return apiGet(`/devlab/workspace-templates/${encodeURIComponent(templateId)}`)
      .then(res => { setTemplate(res?.template || null); setWorkspace(res?.workspace || null); })
      .catch(e => setError(apiErrorMessage(e, "テンプレートを確認できません。")))
      .finally(() => setLoading(false));
  }, [templateId]);

  useEffect(() => { load(); }, [load]);

  return { template, workspace, loading, error, reload: load };
}

// ---- ワークスペース（プロジェクト体験）: overlay保存・リセット ----
export function useDevLabWorkspaceActions() {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function save(templateId, overlay, deletedPaths) {
    setSaving(true); setSaveError("");
    try {
      const res = await apiPut(`/devlab/workspaces/${encodeURIComponent(templateId)}`, { overlay, deletedPaths });
      return res?.workspace || null;
    } catch (e) {
      const message = apiErrorMessage(e, "保存に失敗しました。");
      setSaveError(message);
      throw e;
    } finally { setSaving(false); }
  }

  async function reset(templateId) {
    setSaving(true); setSaveError("");
    try {
      await apiDelete(`/devlab/workspaces/${encodeURIComponent(templateId)}`);
    } catch (e) {
      setSaveError(apiErrorMessage(e, "リセットに失敗しました。"));
      throw e;
    } finally { setSaving(false); }
  }

  return { save, reset, saving, saveError, clearSaveError: () => setSaveError("") };
}

// ---- 自分のスキルシート（実績下書き反映の判定用） ----
export function useMySkillSheet() {
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    return apiGet("/skills/me")
      .then(res => setSheet(res || null))
      .catch(() => setSheet(null))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  return { sheet, loading, reload: load };
}
