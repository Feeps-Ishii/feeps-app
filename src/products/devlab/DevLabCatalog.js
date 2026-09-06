// DevLab（開発演習）: 疑似的な開発案件をステップ制で進めるProduct。
// ナビは2026-07-22にLearning Productへ統合され、TrainingApp.jsxのEL_NAV(el_devlab*キー)が
// 正本。ここにあった旧DEVLAB_NAV(dl_*キー)はどこからも参照されない死んだコードだったため削除
// (2026-08-18確認、実際のナビ変更はTrainingApp.jsxのEL_NAV側で行うこと)。

import { roleSlotsFor } from "./roles/phases.js";

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
// artifactType(2026-08-19): アプリ内で作らせる成果物。"none"＝従来のテキスト/URL提出。
// phase(2026-09-05): 空＝どの担当でも出る。担当工程の正典は docs/specs/dev-lab-role-spec.md
export const EMPTY_DEVLAB_STEP = { title: "", goal: "", deliverableGuide: "", artifactType: "none", phase: "", outcomeText: "", checklist: [{ ...EMPTY_DEVLAB_CHECK }, { ...EMPTY_DEVLAB_CHECK }, { ...EMPTY_DEVLAB_CHECK }] };

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
    method: "waterfall",
    roleSlots: [],
    hearingItems: [],
    gainsText: "",
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
// AIの下書き → 編集フォーム。担当区分は**既定の定義から選ぶ**（AIに作らせない）。
// 担当できるタスクが0件になる担当は落とす（置くと受講生が空の一覧を見ることになる）。
function draftRoleSlots(draft, method, steps) {
  const ids = Array.isArray(draft?.roleSlotIds) ? draft.roleSlotIds : [];
  if (!ids.length) return [];
  const phases = new Set(steps.map(s => s.phase).filter(Boolean));
  return roleSlotsFor({ method })
    .filter(slot => ids.includes(slot.roleSlotId))
    .filter(slot => (slot.phases || []).some(p => phases.has(p)));
}

export function draftToForm(draft) {
  const method = draft.method === "agile" ? "agile" : "waterfall";
  const steps = (draft.steps || []).map(s => ({
    title: s.title || "", goal: s.goal || "", deliverableGuide: s.deliverableGuide || "",
    artifactType: s.artifactType || "none",
    phase: s.phase || "",
    outcomeText: s.outcomeText || "",
    checklist: normalizeChecklistForForm(s.checklist),
  }));
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
    steps,
    status: "draft",
    visibilityScope: "all",
    targetCompanyIds: [],
    workspaceTemplateId: "",
    method,
    roleSlots: draftRoleSlots(draft, method, steps),
    hearingItems: Array.isArray(draft.hearingItems) ? draft.hearingItems : [],
    gainsText: (Array.isArray(draft.gains) ? draft.gains : []).join("、"),
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
      artifactType: s.artifactType || "none",
      phase: s.phase || null,
      outcomeText: (s.outcomeText || "").trim(),
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
    method: form.method || "waterfall",
    // 「身につくこと」はカンマ区切りで入力させる（3つまでを目安）
    gains: (form.gainsText || "").split(/[,、]/).map(x => x.trim()).filter(Boolean).slice(0, 4),
    // 名前の無い担当区分・答えの無いヒアリング項目は捨てる（Backendも同じ判定をする）
    roleSlots: (form.roleSlots || []).filter(r => (r.name || "").trim()),
    hearingItems: (form.hearingItems || []).filter(h => (h.question || "").trim() && (h.answer || "").trim()),
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
    method: project.method || "waterfall",
    roleSlots: project.roleSlots || [],
    hearingItems: project.hearingItems || [],
    gainsText: (project.gains || []).join("、"),
  };
}

// ===== プロジェクト体験（ワークスペーステンプレート）管理: 案件と同じフォーム変換パターン =====
export const WORKSPACE_STACK_OPTIONS = [
  { value: "react", label: "React" },
  { value: "spring_sim", label: "Java / Spring Boot（疑似コンソール）" },
  { value: "fullstack_js", label: "React + API（フルスタック）" },
];

export function emptyWorkspaceTemplateForm() {
  return {
    title: "", description: "", stack: "react", level: "beginner", entryHint: "",
    files: [{ path: "", content: "" }],
    scenariosText: "",
    status: "draft",
  };
}

function filesToList(files) {
  const entries = Object.entries(files && typeof files === "object" ? files : {});
  return entries.length ? entries.map(([path, content]) => ({ path, content })) : [{ path: "", content: "" }];
}

// simulatedRun.scenariosはフォーム上「ラベル|コマンド|出力」の1行1シナリオテキストで編集する
// （filesと違い数が少なく構造も単純なため、専用エディタを作らずテキストで十分と判断）。
function scenariosToText(simulatedRun) {
  const scenarios = Array.isArray(simulatedRun?.scenarios) ? simulatedRun.scenarios : [];
  return scenarios.map(s => `${s.label}|${s.command}|${s.output}`).join("\n");
}
function textToScenarios(text) {
  return String(text || "").split("\n").map(line => line.trim()).filter(Boolean).map(line => {
    const [label = "", command = "", ...rest] = line.split("|");
    return { label: label.trim(), command: command.trim(), output: rest.join("|").trim() };
  }).filter(s => s.label && s.command);
}

export function workspaceDraftToForm(draft) {
  return {
    title: draft.title || "",
    description: draft.description || "",
    stack: WORKSPACE_STACK_OPTIONS.some(o => o.value === draft.stack) ? draft.stack : "react",
    level: draft.level || "beginner",
    entryHint: draft.entryHint || "",
    files: filesToList(draft.files),
    scenariosText: scenariosToText(draft.simulatedRun),
    status: "draft",
  };
}

export function workspaceTemplateToForm(template) {
  return {
    title: template.title || "",
    description: template.description || "",
    stack: WORKSPACE_STACK_OPTIONS.some(o => o.value === template.stack) ? template.stack : "react",
    level: template.level || "beginner",
    entryHint: template.entryHint || "",
    files: filesToList(template.files),
    scenariosText: scenariosToText(template.simulatedRun),
    status: template.status || "draft",
  };
}

// ===== チーム開発案件（2026-08-18新設、docs/specs/dev-team-spec.md） =====
export function emptyTeamProjectForm() {
  return {
    title: "", clientName: "", description: "",
    stack: "react", level: "beginner", entryHint: "",
    baseFiles: [{ path: "", content: "" }],
    roles: [{ roleId: "role_1", name: "", description: "", ownedPathsText: "" }],
    aiMembers: [],
    status: "draft",
    visibilityScope: "all",
    targetCompanyIds: [],
  };
}

function rolesToForm(roles) {
  const list = Array.isArray(roles) ? roles : [];
  if (!list.length) return [{ roleId: "role_1", name: "", description: "", ownedPathsText: "" }];
  return list.map((r, i) => ({
    roleId: r.roleId || `role_${i + 1}`,
    name: r.name || "",
    description: r.description || "",
    ownedPathsText: (r.ownedPaths || []).join("\n"),
  }));
}

export function teamDraftToForm(draft) {
  return {
    title: draft.title || "",
    clientName: draft.clientName || "",
    description: draft.description || "",
    stack: WORKSPACE_STACK_OPTIONS.some(o => o.value === draft.stack) ? draft.stack : "react",
    level: draft.level || "beginner",
    entryHint: draft.entryHint || "",
    baseFiles: filesToList(draft.baseFiles),
    roles: rolesToForm(draft.roles),
    aiMembers: [],
    status: "draft",
    visibilityScope: "all",
    targetCompanyIds: [],
  };
}

export function teamProjectToForm(project) {
  return {
    title: project.title || "",
    clientName: project.clientName || "",
    description: project.description || "",
    stack: WORKSPACE_STACK_OPTIONS.some(o => o.value === project.stack) ? project.stack : "react",
    level: project.level || "beginner",
    entryHint: project.entryHint || "",
    baseFiles: filesToList(project.baseFiles),
    roles: rolesToForm(project.roles),
    aiMembers: Array.isArray(project.aiMembers) ? project.aiMembers : [],
    status: project.status || "draft",
    visibilityScope: project.visibilityScope || "all",
    targetCompanyIds: project.targetCompanyIds || [],
  };
}

export function teamFormToPayload(form) {
  const baseFiles = {};
  (form.baseFiles || []).forEach(f => {
    const path = (f.path || "").trim();
    if (path) baseFiles[path] = f.content || "";
  });
  return {
    title: (form.title || "").trim(),
    clientName: (form.clientName || "").trim(),
    description: (form.description || "").trim(),
    stack: form.stack,
    level: form.level,
    entryHint: (form.entryHint || "").trim(),
    baseFiles,
    roles: (form.roles || []).filter(r => (r.name || "").trim()).map((r, i) => ({
      roleId: r.roleId || `role_${i + 1}`,
      name: (r.name || "").trim(),
      description: (r.description || "").trim(),
      ownedPaths: (r.ownedPathsText || "").split("\n").map(s => s.trim()).filter(Boolean),
    })),
    aiMembers: form.aiMembers || [],
    status: form.status,
    visibilityScope: form.visibilityScope,
    targetCompanyIds: form.targetCompanyIds,
  };
}

// AI生成に渡す用（フォームの現在値から、生成APIが必要とする形へ）
export function teamFormToGenerateInput(form) {
  const payload = teamFormToPayload(form);
  return { baseFiles: payload.baseFiles, roles: payload.roles };
}

export function workspaceFormToPayload(form) {
  const files = {};
  (form.files || []).forEach(f => {
    const path = (f.path || "").trim();
    if (path) files[path] = f.content || "";
  });
  return {
    title: (form.title || "").trim(),
    description: (form.description || "").trim(),
    stack: form.stack,
    level: form.level,
    entryHint: (form.entryHint || "").trim(),
    files,
    simulatedRun: form.stack === "spring_sim" ? { scenarios: textToScenarios(form.scenariosText) } : { scenarios: [] },
    status: form.status,
  };
}

// 一覧の並び（2026-09-05）: 進行中 → 未着手 → 完了。同じ群の中は更新の新しい順。
// 完了を最後に置くのは、次にやることが上に来る方が自然なため。
const MY_STATUS_ORDER = { in_progress: 0, not_started: 1, completed: 2 };
export function sortDevLabProjects(projects) {
  return [...(projects || [])].sort((a, b) => {
    const d = (MY_STATUS_ORDER[a.myStatus] ?? 1) - (MY_STATUS_ORDER[b.myStatus] ?? 1);
    if (d !== 0) return d;
    return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  });
}
