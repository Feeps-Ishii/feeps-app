import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../../api.js";

function apiErrorMessage(e, fallback) {
  if (e?.status === 403) return "この操作を行う権限がありません。";
  return e?.errorMessage || e?.message || fallback;
}

function qs(params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") usp.set(k, v);
  });
  const s = usp.toString();
  return s ? `?${s}` : "";
}

// ---- 企業一覧（admin用の対象企業セレクタ。既存 /companies を流用） ----
export function useGrantCompanies(enabled = true) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) { setCompanies([]); setLoading(false); setError(""); return undefined; }
    let alive = true;
    setLoading(true);
    apiGet("/companies")
      .then(list => { if (alive) setCompanies(Array.isArray(list) ? list : []); })
      .catch(e => { if (alive) setError(apiErrorMessage(e, "企業一覧を確認できません。")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [enabled]);
  return { companies, loading, error };
}

// ---- 企業プロフィール（GET/PUT /grants/company-profile） ----
export function useCompanyProfile(companyId, enabled = true) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(() => {
    if (!enabled) { setProfile(null); setLoading(false); setError(""); return Promise.resolve(); }
    setLoading(true); setError("");
    return apiGet(`/grants/company-profile${qs({ companyId })}`)
      .then(res => setProfile(res))
      .catch(e => setError(apiErrorMessage(e, "企業プロフィールを確認できません。")))
      .finally(() => setLoading(false));
  }, [enabled, companyId]);

  useEffect(() => { load(); }, [load]);

  async function save(payload) {
    try {
      const res = await apiPut("/grants/company-profile", { ...payload, companyId });
      await load();
      return res?.company || null;
    } catch (e) {
      setActionError(apiErrorMessage(e, "企業プロフィールの更新に失敗しました。"));
      throw e;
    }
  }

  return { profile, loading, error, actionError, clearActionError: () => setActionError(""), reload: load, save };
}

// ---- 企業所属受講生の助成金項目（GET/PUT /grants/company-trainees） ----
export function useCompanyTrainees(companyId, enabled = true) {
  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(() => {
    if (!enabled) { setTrainees([]); setLoading(false); setError(""); return Promise.resolve(); }
    setLoading(true); setError("");
    return apiGet(`/grants/company-trainees${qs({ companyId })}`)
      .then(res => setTrainees(Array.isArray(res?.items) ? res.items : []))
      .catch(e => setError(apiErrorMessage(e, "受講生の助成金情報を確認できません。")))
      .finally(() => setLoading(false));
  }, [enabled, companyId]);

  useEffect(() => { load(); }, [load]);

  async function updateTrainee(traineeId, payload) {
    try {
      const res = await apiPut(`/grants/company-trainees/${encodeURIComponent(traineeId)}`, payload);
      await load();
      return res?.trainee || null;
    } catch (e) {
      setActionError(apiErrorMessage(e, "受講生情報の更新に失敗しました。"));
      throw e;
    }
  }

  return { trainees, loading, error, actionError, clearActionError: () => setActionError(""), reload: load, updateTrainee };
}

// ---- 企業所属受講生が在籍するコース一覧（GET /grants/company-courses） ----
export function useCompanyCourses(companyId, enabled = true) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) { setCourses([]); setLoading(false); setError(""); return undefined; }
    let alive = true;
    setLoading(true); setError("");
    apiGet(`/grants/company-courses${qs({ companyId })}`)
      .then(res => { if (alive) setCourses(Array.isArray(res?.items) ? res.items : []); })
      .catch(e => { if (alive) setError(apiErrorMessage(e, "コース一覧を確認できません。")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [enabled, companyId]);
  return { courses, loading, error };
}

// ---- 助成金申請ステージ計算用のコース情報まとめ取得（gr_home・gr_listの期限アラート用） ----
// GET /grants/company-courses は既存API（companyId指定で在籍コース一覧を返す）を流用し、
// 新規Backend呼び出しは追加しない。client: 自社分のみ1回。admin: 表示中の申請に登場する
// companyIdごとに1回ずつ呼び出し、courseIdをキーにしたマップへまとめる（startDate/endDate参照用）。
export function useGrantCoursesMap(grants, isAdmin, enabled = true) {
  const companyIds = useMemo(() => {
    if (!enabled) return [];
    if (!isAdmin) return [""];
    return [...new Set((grants || []).map(g => g.companyId).filter(Boolean))];
  }, [grants, isAdmin, enabled]);
  const key = companyIds.join(",");
  const [coursesById, setCoursesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!companyIds.length) { setCoursesById({}); setLoading(false); setError(""); return undefined; }
    let alive = true;
    setLoading(true); setError("");
    Promise.all(companyIds.map(cid => apiGet(`/grants/company-courses${qs({ companyId: cid })}`).catch(() => null)))
      .then(results => {
        if (!alive) return;
        const next = {};
        results.forEach(res => { (res?.items || []).forEach(c => { if (c?.courseId) next[c.courseId] = c; }); });
        setCoursesById(next);
      })
      .catch(e => { if (alive) setError(apiErrorMessage(e, "コース日程を確認できません。")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // key（companyIds.join(",")）だけを見ると、client( companyIds=[""] )はenabled切替前後で
    // 常に空文字列のままになり、[] → [""] へ変化してもkeyが変わらず再取得が走らない
    // （2026-07-21 監査C-3: 企業担当者Homeの助成金カードが「日程未設定」に固定される根本原因）。
    // enabledの変化も依存に含め、disabled→enabled遷移で確実に再取得させる。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return { coursesById, loading, error };
}

// ---- 助成金申請一覧・CRUD（/grants） ----
export function useGrantsList(params = {}, enabled = true) {
  const { companyId, courseId, status, limit } = params;
  const path = `/grants${qs({ companyId, courseId, status, limit })}`;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(() => {
    if (!enabled) { setItems([]); setLoading(false); setError(""); return Promise.resolve(); }
    setLoading(true); setError("");
    return apiGet(path)
      .then(res => setItems(Array.isArray(res?.items) ? res.items : []))
      .catch(e => setError(apiErrorMessage(e, "助成金申請一覧を確認できません。")))
      .finally(() => setLoading(false));
  }, [enabled, path]);

  useEffect(() => { load(); }, [load]);

  async function createGrant(payload) {
    try {
      const res = await apiPost("/grants", payload);
      await load();
      return res?.grant || null;
    } catch (e) {
      setActionError(apiErrorMessage(e, "助成金申請の作成に失敗しました。"));
      throw e;
    }
  }
  async function updateGrant(grantId, payload) {
    try {
      const res = await apiPut(`/grants/${encodeURIComponent(grantId)}`, payload);
      await load();
      return res?.grant || null;
    } catch (e) {
      setActionError(apiErrorMessage(e, "助成金申請の更新に失敗しました。"));
      throw e;
    }
  }
  async function deleteGrant(grantId) {
    try {
      await apiDelete(`/grants/${encodeURIComponent(grantId)}`);
      await load();
    } catch (e) {
      setActionError(apiErrorMessage(e, "助成金申請の削除に失敗しました。"));
      throw e;
    }
  }

  return {
    items, loading, error, actionError, clearActionError: () => setActionError(""),
    reload: load, createGrant, updateGrant, deleteGrant,
  };
}

// ---- 提出書類（/grants/{grantId}/documents。S3署名URL方式の3ステップアップロード） ----
export function useGrantDocuments(grantId, enabled = true) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(() => {
    if (!enabled || !grantId) { setItems([]); setLoading(false); setError(""); return Promise.resolve(); }
    setLoading(true); setError("");
    return apiGet(`/grants/${encodeURIComponent(grantId)}/documents`)
      .then(res => setItems(Array.isArray(res?.items) ? res.items : []))
      .catch(e => setError(apiErrorMessage(e, "提出書類を確認できません。")))
      .finally(() => setLoading(false));
  }, [enabled, grantId]);

  useEffect(() => { load(); }, [load]);

  // Step1: 署名付きURL発行 → Step2: S3へ直PUT → Step3: メタデータ登録（既存Materialsと同じ3ステップ）
  async function uploadDocument({ file, documentType, dueDate, note }) {
    try {
      const contentType = file.type || "application/octet-stream";
      const { documentId, uploadUrl, s3key } = await apiPost(
        `/grants/${encodeURIComponent(grantId)}/documents/upload-url`,
        { fileName: file.name, filename: file.name, contentType },
      );
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!putRes.ok) throw new Error(`S3 upload failed: ${putRes.status}`);
      await apiPost(`/grants/${encodeURIComponent(grantId)}/documents`, {
        documentId, s3key, documentType, fileName: file.name, contentType,
        dueDate: dueDate || undefined, note: note || "",
      });
      await load();
    } catch (e) {
      setActionError(apiErrorMessage(e, "書類のアップロードに失敗しました。"));
      throw e;
    }
  }

  async function reviewDocument(documentId, status, note) {
    try {
      await apiPut(`/grants/${encodeURIComponent(grantId)}/documents/${encodeURIComponent(documentId)}`, { status, note: note || "" });
      await load();
    } catch (e) {
      setActionError(apiErrorMessage(e, "書類の審査に失敗しました。"));
      throw e;
    }
  }

  async function removeDocument(documentId) {
    try {
      await apiDelete(`/grants/${encodeURIComponent(grantId)}/documents/${encodeURIComponent(documentId)}`);
      await load();
    } catch (e) {
      setActionError(apiErrorMessage(e, "書類の削除に失敗しました。"));
      throw e;
    }
  }

  async function viewDocument(documentId) {
    const res = await apiGet(`/grants/${encodeURIComponent(grantId)}/documents/${encodeURIComponent(documentId)}/view`);
    return res?.url || "";
  }

  return {
    items, loading, error, actionError, clearActionError: () => setActionError(""),
    reload: load, uploadDocument, reviewDocument, removeDocument, viewDocument,
  };
}

// ---- 帳票のアプリ内Excel生成（POST /grants/{grantId}/exports） ----
export function useGrantExports(grantId) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState(null); // { formType, files, missingFields }

  async function generate(formType) {
    if (!grantId || generating) return null;
    setGenerating(true); setError(""); setLastResult(null);
    try {
      const res = await apiPost(`/grants/${encodeURIComponent(grantId)}/exports`, { formType });
      setLastResult(res);
      return res;
    } catch (e) {
      setError(apiErrorMessage(e, "帳票の生成に失敗しました。"));
      throw e;
    } finally {
      setGenerating(false);
    }
  }

  return { generate, generating, error, clearError: () => setError(""), lastResult, clearLastResult: () => setLastResult(null) };
}

// ---- 年度別マスタ（助成率・単価・上限額、admin専用。/grants/rate-master） ----
export function useRateMasterYears(enabled = true) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!enabled) { setItems([]); setLoading(false); setError(""); return Promise.resolve(); }
    setLoading(true); setError("");
    return apiGet("/grants/rate-master")
      .then(res => setItems(Array.isArray(res?.items) ? res.items : []))
      .catch(e => setError(apiErrorMessage(e, "助成金マスタの年度一覧を確認できません。")))
      .finally(() => setLoading(false));
  }, [enabled]);

  useEffect(() => { load(); }, [load]);

  return { items, loading, error, reload: load };
}

export function useRateMaster(fiscalYear, enabled = true) {
  const [master, setMaster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(() => {
    if (!enabled || !fiscalYear) { setMaster(null); setLoading(false); setError(""); return Promise.resolve(); }
    setLoading(true); setError("");
    return apiGet(`/grants/rate-master/${encodeURIComponent(fiscalYear)}`)
      .then(res => setMaster(res))
      .catch(e => setError(apiErrorMessage(e, "助成金マスタを確認できません。")))
      .finally(() => setLoading(false));
  }, [enabled, fiscalYear]);

  useEffect(() => { load(); }, [load]);

  async function saveCategory(applicationType, companySize, payload) {
    try {
      const res = await apiPut(`/grants/rate-master/${encodeURIComponent(fiscalYear)}`, { applicationType, companySize, ...payload });
      await load();
      return res;
    } catch (e) {
      setActionError(apiErrorMessage(e, "助成金マスタの保存に失敗しました。"));
      throw e;
    }
  }

  return { master, loading, error, actionError, clearActionError: () => setActionError(""), reload: load, saveCategory };
}

// ---- 個社面談・成果報告会予約（/grant-reservations） ----
export function useReservations(params = {}, enabled = true) {
  const { companyId, courseId, from, to } = params;
  const path = `/grant-reservations${qs({ companyId, courseId, from, to })}`;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(() => {
    if (!enabled) { setItems([]); setLoading(false); setError(""); return Promise.resolve(); }
    setLoading(true); setError("");
    return apiGet(path)
      .then(res => setItems(Array.isArray(res?.items) ? res.items : []))
      .catch(e => setError(apiErrorMessage(e, "予約情報を確認できません。")))
      .finally(() => setLoading(false));
  }, [enabled, path]);

  useEffect(() => { load(); }, [load]);

  async function createReservation(payload) {
    try {
      const res = await apiPost("/grant-reservations", payload);
      await load();
      return res?.reservation || null;
    } catch (e) {
      setActionError(apiErrorMessage(e, "予約の登録に失敗しました。"));
      throw e;
    }
  }
  async function updateReservationStatus(reservationId, status) {
    try {
      await apiPut(`/grant-reservations/${encodeURIComponent(reservationId)}`, { status });
      await load();
    } catch (e) {
      setActionError(apiErrorMessage(e, "予約の更新に失敗しました。"));
      throw e;
    }
  }

  return {
    items, loading, error, actionError, clearActionError: () => setActionError(""),
    reload: load, createReservation, updateReservationStatus,
  };
}
