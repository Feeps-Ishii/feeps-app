import { LayoutDashboard, Code2, ClipboardList } from "lucide-react";

// DevLab（開発演習）: 疑似的な開発案件をステップ制で進めるProduct。
// NAV: trainee=ホーム/案件一覧、admin・instructor=ホーム＋案件管理（一覧・作成編集・生成・提出状況閲覧を1画面に集約）。
export const DEVLAB_NAV = {
  trainee: [
    { sec: null, items: [["dl_home", "ホーム", LayoutDashboard]] },
    { sec: "開発演習", items: [["dl_projects", "案件一覧", Code2]] },
  ],
  instructor: [
    { sec: null, items: [["dl_home", "ホーム", LayoutDashboard]] },
    { sec: "開発演習", items: [["dl_manage", "案件管理", ClipboardList]] },
  ],
  admin: [
    { sec: null, items: [["dl_home", "ホーム", LayoutDashboard]] },
    { sec: "開発演習", items: [["dl_manage", "案件管理", ClipboardList]] },
  ],
};

export const DEVLAB_LEVEL_OPTIONS = [
  { value: "beginner", label: "初級" },
  { value: "intermediate", label: "中級" },
  { value: "advanced", label: "上級" },
];
export function devLabLevelLabel(value) {
  return DEVLAB_LEVEL_OPTIONS.find(o => o.value === value)?.label || value || "初級";
}

export const DEVLAB_STATUS_OPTIONS = [
  { value: "draft", label: "下書き" },
  { value: "published", label: "公開中" },
];
export function devLabStatusLabel(value) {
  return DEVLAB_STATUS_OPTIONS.find(o => o.value === value)?.label || value || "下書き";
}
export function devLabStatusTone(value) {
  return value === "published" ? "green" : "muted";
}

export const DEVLAB_VISIBILITY_SCOPE_OPTIONS = [
  { value: "all", label: "全体公開" },
  { value: "companies", label: "特定企業のみ公開" },
];

export const DEVLAB_MY_STATUS_OPTIONS = [
  { value: "not_started", label: "未着手", tone: "muted" },
  { value: "in_progress", label: "進行中", tone: "amber" },
  { value: "completed", label: "完了", tone: "green" },
];
export function devLabMyStatusLabel(value) {
  return DEVLAB_MY_STATUS_OPTIONS.find(o => o.value === value)?.label || "未着手";
}
export function devLabMyStatusTone(value) {
  return DEVLAB_MY_STATUS_OPTIONS.find(o => o.value === value)?.tone || "muted";
}

// ワークスペース（プロジェクト体験）のstack表示ラベル。2026-07-22 fullstack_js追加分。
export function devLabWorkspaceStackLabel(stack) {
  if (stack === "spring_sim") return "Java / Spring Boot";
  if (stack === "fullstack_js") return "React + API（フルスタック）";
  return "React";
}

// 2026-07-21 チェックリスト充足方式確定: rubric(自由記述)を廃止し、checklist[{text,criteria,required,reqIds}]へ。
export const EMPTY_DEVLAB_CHECK = { text: "", criteria: "", required: true, reqIds: [] };
export const EMPTY_DEVLAB_STEP = { title: "", goal: "", deliverableGuide: "", checklist: [{ ...EMPTY_DEVLAB_CHECK }, { ...EMPTY_DEVLAB_CHECK }, { ...EMPTY_DEVLAB_CHECK }] };

export function emptyDevLabForm() {
  return {
    title: "", clientName: "", background: "",
    requirementsText: "", techStackText: "",
    requiredSkills: [],
    functionalRequirements: [{ reqId: "F-1", text: "" }, { reqId: "F-2", text: "" }],
    level: "beginner", estimatedHours: "",
    steps: [{ ...EMPTY_DEVLAB_STEP, checklist: [{ ...EMPTY_DEVLAB_CHECK }, { ...EMPTY_DEVLAB_CHECK }] }, { ...EMPTY_DEVLAB_STEP, checklist: [{ ...EMPTY_DEVLAB_CHECK }, { ...EMPTY_DEVLAB_CHECK }] }, { ...EMPTY_DEVLAB_STEP, checklist: [{ ...EMPTY_DEVLAB_CHECK }, { ...EMPTY_DEVLAB_CHECK }] }],
    status: "draft",
    visibilityScope: "all",
    targetCompanyIds: [],
    workspaceTemplateId: "",
  };
}

function normalizeFunctionalRequirementsForForm(list) {
  const items = Array.isArray(list) ? list : [];
  return items.map((r, i) => ({ reqId: r.reqId || `F-${i + 1}`, text: r.text || "" }));
}

function normalizeChecklistForForm(list) {
  const items = Array.isArray(list) ? list : [];
  if (!items.length) return [{ ...EMPTY_DEVLAB_CHECK }];
  return items.map(c => ({
    checkId: c.checkId,
    text: c.text || "",
    criteria: c.criteria || "",
    required: c.required !== false,
    reqIds: Array.isArray(c.reqIds) ? c.reqIds : [],
  }));
}

// AI下書き生成結果 → 編集フォームへ流し込む変換
export function draftToForm(draft) {
  return {
    title: draft.title || "",
    clientName: draft.clientName || "",
    background: draft.background || "",
    requirementsText: (draft.requirements || []).join("\n"),
    techStackText: (draft.techStack || []).join(", "),
    requiredSkills: draft.requiredSkills || [],
    functionalRequirements: normalizeFunctionalRequirementsForForm(draft.functionalRequirements),
    level: draft.level || "beginner",
    estimatedHours: "",
    steps: (draft.steps || []).map(s => ({
      title: s.title || "", goal: s.goal || "", deliverableGuide: s.deliverableGuide || "",
      checklist: normalizeChecklistForForm(s.checklist),
    })),
    status: "draft",
    visibilityScope: "all",
    targetCompanyIds: [],
    workspaceTemplateId: "",
  };
}

// フォーム → API保存ペイロード
export function formToPayload(form) {
  return {
    title: form.title.trim(),
    clientName: form.clientName.trim(),
    background: form.background.trim(),
    requirements: (form.requirementsText || "").split("\n").map(s => s.trim()).filter(Boolean),
    techStack: (form.techStackText || "").split(",").map(s => s.trim()).filter(Boolean),
    requiredSkills: form.requiredSkills || [],
    functionalRequirements: (form.functionalRequirements || [])
      .filter(r => r.text.trim())
      .map((r, i) => ({ reqId: r.reqId || `F-${i + 1}`, text: r.text.trim() })),
    level: form.level,
    estimatedHours: Number(form.estimatedHours) || 0,
    steps: (form.steps || []).filter(s => s.title.trim()).map((s, i) => ({
      stepId: s.stepId || `step_${i + 1}`,
      order: i + 1,
      title: s.title.trim(),
      goal: s.goal.trim(),
      deliverableGuide: s.deliverableGuide.trim(),
      checklist: (s.checklist || []).filter(c => c.text.trim()).map(c => ({
        checkId: c.checkId,
        text: c.text.trim(),
        criteria: c.criteria.trim(),
        required: c.required !== false,
        reqIds: c.reqIds || [],
      })),
    })),
    status: form.status,
    visibilityScope: form.visibilityScope,
    targetCompanyIds: form.targetCompanyIds,
    workspaceTemplateId: form.workspaceTemplateId || "",
  };
}

// 既存案件 → 編集フォーム
export function projectToForm(project) {
  return {
    title: project.title || "",
    clientName: project.clientName || "",
    background: project.background || "",
    requirementsText: (project.requirements || []).join("\n"),
    techStackText: (project.techStack || []).join(", "),
    requiredSkills: project.requiredSkills || [],
    functionalRequirements: normalizeFunctionalRequirementsForForm(project.functionalRequirements),
    level: project.level || "beginner",
    estimatedHours: project.estimatedHours ? String(project.estimatedHours) : "",
    steps: (project.steps && project.steps.length)
      ? project.steps.map(s => ({ ...s, checklist: normalizeChecklistForForm(s.checklist) }))
      : [{ ...EMPTY_DEVLAB_STEP }],
    status: project.status || "draft",
    visibilityScope: project.visibilityScope || "all",
    targetCompanyIds: project.targetCompanyIds || [],
    workspaceTemplateId: project.workspaceTemplateId || "",
  };
}
