import { useCallback, useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";

/* テノラボ（コース型、ADR 0024）のデータ。正本は API（DynamoDB）。
   取得に失敗したら state を "error" にして画面で「確認できません＋もう一度」を出す（0件・未受講として扱わない）。 */

// 1つの GET を読み込む小さなフック。state: loading | ready | error
function useGet(path, { enabled = true, pick = x => x } = {}) {
  const [st, setSt] = useState({ state: enabled ? "loading" : "off", data: null });
  const reload = useCallback(async () => {
    if (!enabled || !path) { setSt({ state: "off", data: null }); return; }
    setSt(s => ({ ...s, state: "loading" }));
    try {
      const res = await apiGet(path);
      setSt({ state: "ready", data: pick(res) });
    } catch (e) {
      console.warn("tenolab load failed", path, e);
      setSt(s => ({ ...s, state: "error", status: e?.status }));
    }
  }, [path, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [reload]);
  return { ...st, reload, setData: data => setSt(s => ({ ...s, data: typeof data === "function" ? data(s.data) : data })) };
}

// 自分の契約（Premium かどうか）とロール
export function useMe(enabled) {
  // elearning：false は「研修のみ」の契約の企業の人（テノラボには入れない）。返ってこないときは入れる
  return useGet("/tenolab/me", { enabled, pick: r => ({ plan: r?.plan || "basic", premium: !!r?.premium, role: r?.role || "trainee", elearning: r?.elearning !== false }) });
}

export function useTopics(enabled) {
  return useGet("/tenolab/topics", { enabled, pick: r => (Array.isArray(r?.topics) ? r.topics : []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) });
}

export function useDrills(enabled) {
  return useGet("/tenolab/drills", { enabled, pick: r => (Array.isArray(r?.items) ? r.items : []) });
}

export function useCases(enabled) {
  return useGet("/tenolab/cases", { enabled, pick: r => (Array.isArray(r?.items) ? r.items : []) });
}

export function useDrill(id) {
  return useGet(id ? `/tenolab/drills/${encodeURIComponent(id)}` : null, { enabled: !!id, pick: r => r?.drill || null });
}

export function useCase(id) {
  return useGet(id ? `/tenolab/cases/${encodeURIComponent(id)}` : null, { enabled: !!id, pick: r => (r?.case ? { ...r.case, progress: r.progress || null } : null) });
}

/* 演習・案件体験の記録（自分の分）。unitKey は "drill#<id>" / "case#<id>" */
export function useLabProgress(enabled) {
  const g = useGet("/tenolab/progress", { enabled, pick: r => (Array.isArray(r?.items) ? r.items : []) });
  const byKey = useMemo(() => {
    const m = {};
    for (const it of g.data || []) m[`${it.courseId}#${it.unitId}`] = it;
    return m;
  }, [g.data]);
  const drill = id => byKey[`drill#${id}`] || null;
  const caseOf = id => byKey[`case#${id}`] || null;
  // 演習の進み具合を保存する（クリアは戻さない＝API 側でも守る）
  const saveDrill = useCallback(async (id, data) => {
    const res = await apiPut(`/tenolab/progress/drill/${encodeURIComponent(id)}`, data);
    if (res?.item) g.setData(prev => [...(prev || []).filter(x => !(x.courseId === "drill" && x.unitId === id)), res.item]);
    return res?.item;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const upsert = useCallback(item => {
    if (item) g.setData(prev => [...(prev || []).filter(x => !(x.courseId === item.courseId && x.unitId === item.unitId)), item]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { state: g.state, reload: g.reload, items: g.data || [], drill, caseOf, saveDrill, upsert };
}

export const submitCase = (id, body) => apiPost(`/tenolab/cases/${encodeURIComponent(id)}/submit`, body);
export const skipCase = id => apiPost(`/tenolab/cases/${encodeURIComponent(id)}/skip`, {});
export const getDrillAnswer = id => apiGet(`/tenolab/drills/${encodeURIComponent(id)}/answer`);
export const submitInquiry = body => apiPost("/tenolab/inquiries", body);

/* 講師・管理者 */
export const manage = {
  list: kind => apiGet(`/tenolab/manage/${kind}`),
  get: (kind, id) => apiGet(`/tenolab/manage/${kind}/${encodeURIComponent(id)}`),
  save: (kind, id, body) => apiPut(`/tenolab/manage/${kind}/${encodeURIComponent(id)}`, body),
  publish: (kind, id) => apiPost(`/tenolab/manage/${kind}/${encodeURIComponent(id)}/publish`, {}),
  remove: (kind, id) => apiDelete(`/tenolab/manage/${kind}/${encodeURIComponent(id)}`),
  submissions: ({ status = "all", caseId = "" } = {}) => apiGet(`/tenolab/manage/submissions?status=${encodeURIComponent(status)}${caseId ? `&caseId=${encodeURIComponent(caseId)}` : ""}`),
  review: (userId, caseId, body) => apiPut(`/tenolab/manage/submissions/${encodeURIComponent(userId)}/${encodeURIComponent(caseId)}`, body),
  gradeTest: (id, body) => apiPost(`/tenolab/manage/cases/${encodeURIComponent(id)}/grade-test`, body),
  rubricDraft: (id, body) => apiPost(`/tenolab/manage/cases/${encodeURIComponent(id)}/rubric-draft`, body),
  saveTopics: topics => apiPut("/tenolab/topics", { topics }),
};

/* 管理者：企業と契約・使用料・お見積り依頼（ADR 0025 §5） */
export const admin = {
  overview: month => apiGet(`/tenolab/admin/overview${month ? `?month=${encodeURIComponent(month)}` : ""}`),
  saveCompany: (companyId, body) => apiPut(`/tenolab/admin/companies/${encodeURIComponent(companyId)}`, body),
  inquiries: () => apiGet("/tenolab/admin/inquiries"),
};

/* AWS（本物の環境） */
export const cloud = {
  session: () => apiGet("/cloudlab/session"),
  start: scenario => apiPost("/cloudlab/session", { scenario }),
  console: () => apiPost("/cloudlab/session/console", {}),
  extend: () => apiPost("/cloudlab/session/extend", {}),
  stop: () => apiDelete("/cloudlab/session"),
  check: scenario => apiPost(`/cloudlab/scenarios/${encodeURIComponent(scenario)}/check`, {}),
  note: (scenario, body) => apiPost(`/cloudlab/scenarios/${encodeURIComponent(scenario)}/note`, body),
};
