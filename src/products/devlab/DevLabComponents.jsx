import React, { useMemo, useState } from "react";
import {
  Award, ClipboardList, Clock3, Code2, Link2, Loader2, Pencil, Plus, Sparkles, Trash2, X,
} from "lucide-react";
import {
  Badge, Btn, Card, EmptyState, Field, PageHeader, SectionHead, SkeletonRows, fieldStyle, T,
} from "../../components/common";
import { useCompanyDirectory, companyNameResolver } from "../learning/admin/useCompanyDirectory.js";
import {
  DEVLAB_LEVEL_OPTIONS, DEVLAB_VISIBILITY_SCOPE_OPTIONS, devLabLevelLabel,
  devLabStatusLabel, devLabStatusTone, devLabMyStatusLabel, devLabMyStatusTone,
  emptyDevLabForm, draftToForm, formToPayload, projectToForm,
} from "./DevLabCatalog.js";
import {
  useDevLabProjects, useDevLabMe, useDevLabActions, useDevLabAdmin, useDevLabSubmissions, useMySkillSheet,
} from "./useDevLab.js";

// ===================== ホーム =====================
export function DevLabHome({ role, goSub }) {
  const isManager = role === "instructor" || role === "admin";
  return (
    <div>
      <PageHeader
        product="devlab"
        label="DevLab"
        title="開発演習"
        description="疑似的な開発案件をステップ制で進め、成果物を提出しながら実践経験を積むProductです。"
        cta={isManager ? { label: "案件管理へ", icon: ClipboardList, onClick: () => goSub("dl_manage") } : { label: "案件一覧へ", icon: Code2, onClick: () => goSub("dl_projects") }}
      />
      <Card className="p-5">
        <p className="text-sm" style={{ color: T.textSecondary }}>
          {isManager
            ? "疑似的なクライアント案件を作成・公開し、受講生の進捗と提出物を確認できます。"
            : "公開されている案件に参加し、ステップごとに成果物（テキスト・URL）を提出して進めます。全ステップ完走すると、スキルシートへの実績下書きを作成できます。"}
        </p>
      </Card>
    </div>
  );
}

// ===================== 受講生: 案件一覧 =====================
export function ProjectCatalog({ onOpenProject }) {
  const { projects, loading, error, reload } = useDevLabProjects();

  return (
    <div>
      <SectionHead icon={Code2} title="案件一覧" desc="公開中の疑似開発案件です。参加してステップごとに成果物を提出しましょう。" />
      {error && (
        <Card className="mb-4 p-4">
          <p className="text-sm" style={{ color: T.danger }}>{error}</p>
          <Btn kind="ghost" size="sm" className="mt-2" onClick={reload}>再試行</Btn>
        </Card>
      )}
      <Card>
        {loading ? <SkeletonRows rows={3} /> : projects.length === 0 ? (
          <EmptyState icon={Code2} title="公開中の案件はありません" desc="新しい案件が公開されるまでお待ちください。" />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {projects.map(project => (
              <button
                key={project.id}
                type="button"
                onClick={() => onOpenProject(project.id)}
                className="rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                style={{ background: T.bgBase, border: `1px solid ${T.border}` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold" style={{ color: T.textMuted }}>{project.clientName || "案件"}</div>
                    <div className="mt-0.5 truncate text-base font-bold" style={{ color: T.textPrimary }}>{project.title}</div>
                  </div>
                  <Badge tone={devLabMyStatusTone(project.myStatus)}>{devLabMyStatusLabel(project.myStatus)}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="cyan">{devLabLevelLabel(project.level)}</Badge>
                  {project.estimatedHours > 0 && <Badge tone="muted"><Clock3 size={11} />約{project.estimatedHours}時間</Badge>}
                  {(project.techStack || []).slice(0, 4).map(tech => <Badge key={tech} tone="muted">{tech}</Badge>)}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ===================== 受講生: 案件詳細/進行画面 =====================
export function ProjectDetail({ projectId, onBack }) {
  const { projects, loading, error, reload: reloadProjects } = useDevLabProjects();
  const { assignments, submissions, reload: reloadMe } = useDevLabMe();
  const { sheet, reload: reloadSheet } = useMySkillSheet();
  const { start, submitStep, complete, addToSkillSheet, busy, actionError, clearActionError } = useDevLabActions([reloadProjects, reloadMe, reloadSheet]);
  const [draft, setDraft] = useState({ submittedText: "", submittedUrl: "" });
  const [completeError, setCompleteError] = useState(null);
  const [worksDraftPreview, setWorksDraftPreview] = useState(null);

  const project = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);
  const assignment = useMemo(() => assignments.find(a => a.projectId === projectId), [assignments, projectId]);
  const mySubmissions = useMemo(() => submissions.filter(s => s.projectId === projectId), [submissions, projectId]);
  const submittedStepIds = useMemo(() => new Set(mySubmissions.map(s => s.stepId)), [mySubmissions]);

  if (loading) return <Card><SkeletonRows rows={4} /></Card>;
  if (error || !project) {
    return (
      <Card className="p-5">
        <p className="text-sm" style={{ color: T.danger }}>{error || "案件が見つかりません。"}</p>
        <Btn kind="ghost" size="sm" className="mt-2" onClick={onBack}>一覧に戻る</Btn>
      </Card>
    );
  }

  const steps = project.steps || [];
  const currentStep = steps.find(s => !submittedStepIds.has(s.stepId));
  const allSubmitted = steps.length > 0 && !currentStep;
  const isCompleted = assignment?.status === "completed";

  async function handleStart() {
    clearActionError();
    await start(projectId);
  }

  async function handleSubmit(step) {
    clearActionError();
    if (!draft.submittedText.trim() && !draft.submittedUrl.trim()) return;
    await submitStep(projectId, step.stepId, draft);
    setDraft({ submittedText: "", submittedUrl: "" });
  }

  async function handleComplete() {
    clearActionError();
    setCompleteError(null);
    try {
      const res = await complete(projectId);
      setWorksDraftPreview(res?.assignment?.worksDraft || null);
    } catch (e) {
      setCompleteError(e?.data || null);
    }
  }

  async function handleAddToSkillSheet(finalDraft) {
    clearActionError();
    await addToSkillSheet(projectId, finalDraft, sheet);
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 text-xs font-semibold" style={{ color: T.textMuted }}>← 案件一覧に戻る</button>
      <PageHeader
        product="devlab"
        label={project.clientName || "案件"}
        title={project.title}
        description={project.background}
        chips={[
          { label: "レベル", value: devLabLevelLabel(project.level) },
          { label: "想定時間", value: project.estimatedHours ? `約${project.estimatedHours}時間` : "-" },
          { label: "ステップ", value: `${steps.length}` },
        ]}
      />

      <Card className="mb-4 p-5">
        <h3 className="text-sm font-bold" style={{ color: T.textPrimary }}>要件</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm" style={{ color: T.textSecondary }}>
          {(project.requirements || []).map((r, i) => <li key={i}>{r}</li>)}
        </ul>
        {(project.techStack || []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {project.techStack.map(t => <Badge key={t} tone="muted">{t}</Badge>)}
          </div>
        )}
      </Card>

      {actionError && <Card className="mb-4 p-4"><p className="text-sm" style={{ color: T.danger }}>{actionError}</p></Card>}

      {!assignment ? (
        <Card className="p-5 text-center">
          <p className="text-sm" style={{ color: T.textSecondary }}>この案件に参加してステップを進めましょう。</p>
          <Btn className="mt-3" icon={Code2} disabled={busy} onClick={handleStart}>この案件に参加する</Btn>
        </Card>
      ) : (
        <>
          <h3 className="mb-3 text-sm font-bold" style={{ color: T.textPrimary }}>ステップ</h3>
          <div className="space-y-3">
            {steps.map((step, i) => {
              const submitted = submittedStepIds.has(step.stepId);
              const isCurrent = !isCompleted && currentStep?.stepId === step.stepId;
              return (
                <Card key={step.stepId} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold" style={{ background: submitted ? T.successSubtle : T.bgBase, color: submitted ? T.success : T.textMuted, border: `1px solid ${T.border}` }}>{i + 1}</span>
                      <div className="text-sm font-bold" style={{ color: T.textPrimary }}>{step.title}</div>
                    </div>
                    <Badge tone={submitted ? "green" : "muted"}>{submitted ? "提出済み" : "未提出"}</Badge>
                  </div>
                  <p className="mt-2 ml-9 text-xs" style={{ color: T.textSecondary }}>{step.goal}</p>
                  {step.deliverableGuide && <p className="mt-1 ml-9 text-xs" style={{ color: T.textMuted }}>提出物の目安: {step.deliverableGuide}</p>}

                  {isCurrent && (
                    <div className="mt-3 ml-9 space-y-2">
                      <Field label="成果物（テキスト）">
                        <textarea style={{ ...fieldStyle, minHeight: 88 }} value={draft.submittedText} onChange={e => setDraft({ ...draft, submittedText: e.target.value })} placeholder="実施内容・工夫点などを記入してください" />
                      </Field>
                      <Field label="URL（任意。GitHub等）">
                        <input style={fieldStyle} value={draft.submittedUrl} onChange={e => setDraft({ ...draft, submittedUrl: e.target.value })} placeholder="https://github.com/..." />
                      </Field>
                      <Btn size="sm" icon={Link2} disabled={busy || (!draft.submittedText.trim() && !draft.submittedUrl.trim())} onClick={() => handleSubmit(step)}>提出する</Btn>
                    </div>
                  )}
                  {submitted && !isCurrent && (
                    <p className="mt-2 ml-9 text-xs" style={{ color: T.textMuted }}>提出済み（再提出は現在のステップ表示から行えます）</p>
                  )}
                </Card>
              );
            })}
          </div>

          {allSubmitted && !isCompleted && (
            <Card className="mt-4 p-5 text-center">
              <p className="text-sm" style={{ color: T.textSecondary }}>全ステップの成果物を提出しました。完了して実績下書きを作成しましょう。</p>
              <Btn className="mt-3" icon={Award} disabled={busy} onClick={handleComplete}>完了する</Btn>
              {completeError?.missingSteps?.length > 0 && (
                <p className="mt-2 text-xs" style={{ color: T.danger }}>未提出のステップがあります: {completeError.missingSteps.map(s => s.title).join("、")}</p>
              )}
            </Card>
          )}

          {(isCompleted || worksDraftPreview) && (
            <WorksDraftPanel
              draft={worksDraftPreview || assignment.worksDraft}
              addedAt={assignment.worksDraftAddedAt}
              busy={busy}
              onAdd={handleAddToSkillSheet}
            />
          )}
        </>
      )}
    </div>
  );
}

function WorksDraftPanel({ draft, addedAt, busy, onAdd }) {
  const [form, setForm] = useState(draft || {});
  if (!draft) return null;
  function set(key, value) { setForm({ ...form, [key]: value }); }
  return (
    <Card className="mt-4 p-5">
      <h3 className="text-sm font-bold" style={{ color: T.textPrimary }}>実績下書き（スキルシート）</h3>
      <p className="mt-1 text-xs" style={{ color: T.textMuted }}>内容を確認・編集してからスキルシートへ追加してください。</p>
      <div className="mt-3 space-y-2">
        <Field label="実績名"><input style={fieldStyle} value={form.name || ""} onChange={e => set("name", e.target.value)} /></Field>
        <Field label="概要"><textarea style={{ ...fieldStyle, minHeight: 88 }} value={form.desc || ""} onChange={e => set("desc", e.target.value)} /></Field>
        <Field label="役割"><input style={fieldStyle} value={form.role || ""} onChange={e => set("role", e.target.value)} /></Field>
        <Field label="GitHub URL"><input style={fieldStyle} value={form.github || ""} onChange={e => set("github", e.target.value)} /></Field>
        <Field label="アピールポイント"><textarea style={{ ...fieldStyle, minHeight: 60 }} value={form.appeal || ""} onChange={e => set("appeal", e.target.value)} /></Field>
      </div>
      {addedAt ? (
        <Badge tone="green" className="mt-3">スキルシートへ追加済み</Badge>
      ) : (
        <Btn className="mt-3" icon={Award} disabled={busy} onClick={() => onAdd(form)}>スキルシートへ追加</Btn>
      )}
    </Card>
  );
}

// ===================== admin/instructor: 案件管理 =====================
export function ProjectManager({ role }) {
  const { projects, loading, error, create, update, remove, generate, busy, actionError, clearActionError } = useDevLabAdmin();
  const { companies, companiesError } = useCompanyDirectory();
  const [editing, setEditing] = useState(null); // null=一覧 / "new" / project
  const [form, setForm] = useState(emptyDevLabForm());
  const [selectedProjectId, setSelectedProjectId] = useState("");

  function startCreate() { clearActionError(); setForm(emptyDevLabForm()); setEditing("new"); }
  function startEdit(project) { clearActionError(); setForm(projectToForm(project)); setEditing(project); }
  function cancel() { setEditing(null); }

  async function handleSave() {
    const payload = formToPayload(form);
    if (editing === "new") await create(payload);
    else await update(editing.courseId || editing.id, payload);
    setEditing(null);
  }

  async function handleDelete(project) {
    if (!window.confirm(`「${project.title}」を削除しますか？`)) return;
    await remove(project.id);
  }

  if (editing) {
    return (
      <ProjectForm
        mode={editing === "new" ? "create" : "edit"}
        role={role}
        form={form}
        onChange={setForm}
        onSave={handleSave}
        onCancel={cancel}
        onGenerate={generate}
        busy={busy}
        actionError={actionError}
        companies={companies}
        companiesError={companiesError}
      />
    );
  }

  if (selectedProjectId) {
    return <SubmissionsPanel projectId={selectedProjectId} onBack={() => setSelectedProjectId("")} />;
  }

  return (
    <div>
      <SectionHead
        icon={ClipboardList}
        title="案件管理"
        desc="疑似開発案件の作成・編集・公開範囲設定・提出状況の確認を行います。"
        action={<Btn icon={Plus} onClick={startCreate}>新規作成</Btn>}
      />
      {error && <Card className="mb-4 p-4"><p className="text-sm" style={{ color: T.danger }}>{error}</p></Card>}
      <Card>
        {loading ? <SkeletonRows rows={3} /> : projects.length === 0 ? (
          <EmptyState icon={ClipboardList} title="案件がありません" desc="「新規作成」から案件を作成してください。" />
        ) : (
          <div className="divide-y" style={{ borderColor: T.border }}>
            {projects.map(project => (
              <div key={project.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{project.title}</span>
                    <Badge tone={devLabStatusTone(project.status)}>{devLabStatusLabel(project.status)}</Badge>
                    <Badge tone="cyan">{devLabLevelLabel(project.level)}</Badge>
                    {project.visibilityScope === "companies" && <Badge tone="amber">企業限定公開</Badge>}
                  </div>
                  <div className="mt-1 text-xs" style={{ color: T.textMuted }}>{project.clientName} ・ ステップ{project.steps?.length || 0}件</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Btn kind="ghost" size="sm" icon={ClipboardList} onClick={() => setSelectedProjectId(project.id)}>提出状況</Btn>
                  <Btn kind="ghost" size="sm" icon={Pencil} onClick={() => startEdit(project)}>編集</Btn>
                  <Btn kind="ghost" size="sm" icon={Trash2} onClick={() => handleDelete(project)}>削除</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StepEditor({ steps, onChange }) {
  function updateStep(i, key, value) {
    const next = steps.map((s, idx) => (idx === i ? { ...s, [key]: value } : s));
    onChange(next);
  }
  function addStep() { onChange([...steps, { title: "", goal: "", deliverableGuide: "", rubric: "" }]); }
  function removeStep(i) { onChange(steps.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={i} className="rounded-xl border p-3" style={{ borderColor: T.border }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: T.textMuted }}>ステップ{i + 1}</span>
            {steps.length > 1 && <button type="button" onClick={() => removeStep(i)} aria-label="削除"><X size={14} style={{ color: T.textMuted }} /></button>}
          </div>
          <div className="space-y-2">
            <input style={fieldStyle} placeholder="タイトル" value={step.title} onChange={e => updateStep(i, "title", e.target.value)} />
            <input style={fieldStyle} placeholder="ゴール（このステップで達成すること）" value={step.goal} onChange={e => updateStep(i, "goal", e.target.value)} />
            <input style={fieldStyle} placeholder="提出物の目安" value={step.deliverableGuide} onChange={e => updateStep(i, "deliverableGuide", e.target.value)} />
            <input style={fieldStyle} placeholder="採点観点（rubric）" value={step.rubric} onChange={e => updateStep(i, "rubric", e.target.value)} />
          </div>
        </div>
      ))}
      <Btn kind="ghost" size="sm" icon={Plus} onClick={addStep}>ステップを追加</Btn>
    </div>
  );
}

function ProjectForm({ mode, role, form, onChange, onSave, onCancel, onGenerate, busy, actionError, companies, companiesError }) {
  const [genTheme, setGenTheme] = useState("");
  const [genTech, setGenTech] = useState("");
  const [genLevel, setGenLevel] = useState("beginner");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const isAdmin = role === "admin";

  function set(key, value) { onChange({ ...form, [key]: value }); }

  function toggleTargetCompany(companyId) {
    const current = Array.isArray(form.targetCompanyIds) ? form.targetCompanyIds : [];
    const next = current.includes(companyId) ? current.filter(id => id !== companyId) : [...current, companyId];
    set("targetCompanyIds", next);
  }

  async function handleGenerate() {
    if (!genTheme.trim()) { setGenError("テーマを入力してください。"); return; }
    setGenerating(true); setGenError("");
    try {
      const draft = await onGenerate({ theme: genTheme, techStack: genTech.split(",").map(s => s.trim()).filter(Boolean), level: genLevel, stepCountHint: 4 });
      if (draft) onChange(draftToForm(draft));
    } catch (e) {
      setGenError(e?.errorMessage || e?.message || "AI下書き生成に失敗しました。");
    } finally { setGenerating(false); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold" style={{ color: T.textPrimary }}>{mode === "edit" ? "案件編集" : "案件新規作成"}</h3>
        <Btn kind="ghost" size="sm" icon={X} onClick={onCancel}>閉じる</Btn>
      </div>

      {mode === "create" && (
        <Card className="mb-4 p-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold" style={{ color: T.textPrimary }}><Sparkles size={15} />AIで下書き生成</h4>
          <div className="grid gap-2 sm:grid-cols-3">
            <input style={fieldStyle} placeholder="テーマ（例: 社内備品管理システム）" value={genTheme} onChange={e => setGenTheme(e.target.value)} />
            <input style={fieldStyle} placeholder="技術スタック（カンマ区切り）" value={genTech} onChange={e => setGenTech(e.target.value)} />
            <select style={fieldStyle} value={genLevel} onChange={e => setGenLevel(e.target.value)}>
              {DEVLAB_LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {genError && <p className="mt-2 text-xs" style={{ color: T.danger }}>{genError}</p>}
          <Btn kind="ai" size="sm" className="mt-2" icon={generating ? Loader2 : Sparkles} disabled={generating} onClick={handleGenerate}>
            {generating ? "生成中…" : "下書きを生成"}
          </Btn>
        </Card>
      )}

      {actionError && <Card className="mb-4 p-4"><p className="text-sm" style={{ color: T.danger }}>{actionError}</p></Card>}

      <Card className="p-4">
        <div className="space-y-3">
          <Field label="案件名"><input style={fieldStyle} value={form.title} onChange={e => set("title", e.target.value)} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="架空クライアント名"><input style={fieldStyle} value={form.clientName} onChange={e => set("clientName", e.target.value)} /></Field>
            <Field label="レベル">
              <select style={fieldStyle} value={form.level} onChange={e => set("level", e.target.value)}>
                {DEVLAB_LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="案件背景"><textarea style={{ ...fieldStyle, minHeight: 80 }} value={form.background} onChange={e => set("background", e.target.value)} /></Field>
          <Field label="要件（1行1件）"><textarea style={{ ...fieldStyle, minHeight: 80 }} value={form.requirementsText} onChange={e => set("requirementsText", e.target.value)} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="技術スタック（カンマ区切り）"><input style={fieldStyle} value={form.techStackText} onChange={e => set("techStackText", e.target.value)} /></Field>
            <Field label="想定時間（時間）"><input style={fieldStyle} value={form.estimatedHours} onChange={e => set("estimatedHours", e.target.value)} /></Field>
          </div>

          <Field label="ステップ"><StepEditor steps={form.steps} onChange={steps => set("steps", steps)} /></Field>

          <Field label="公開状態">
            <select style={fieldStyle} value={form.status} onChange={e => set("status", e.target.value)}>
              <option value="draft">下書き</option>
              <option value="published">公開中</option>
            </select>
          </Field>

          <Field label="公開範囲">
            {isAdmin ? (
              <div className="space-y-2">
                <select style={fieldStyle} value={form.visibilityScope} onChange={e => set("visibilityScope", e.target.value)}>
                  {DEVLAB_VISIBILITY_SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {form.visibilityScope === "companies" && (
                  <div className="rounded-xl border p-3" style={{ borderColor: T.border }}>
                    {companiesError ? (
                      <p className="text-xs" style={{ color: T.danger }}>{companiesError}</p>
                    ) : (
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {companies.map(c => (
                          <label key={c.companyId} className="flex items-center gap-2 text-xs" style={{ color: T.textPrimary }}>
                            <input type="checkbox" checked={(form.targetCompanyIds || []).includes(c.companyId)} onChange={() => toggleTargetCompany(c.companyId)} />
                            {c.name || c.companyId}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl p-3 text-xs" style={{ background: T.bgBase, color: T.textSecondary }}>
                {form.visibilityScope === "companies" ? "特定企業のみ公開" : "全体公開"}（公開範囲の変更は管理者のみ行えます）
              </div>
            )}
          </Field>
        </div>
      </Card>

      <div className="mt-4 flex justify-end gap-2">
        <Btn kind="ghost" onClick={onCancel}>キャンセル</Btn>
        <Btn disabled={busy || !form.title.trim()} onClick={onSave}>保存する</Btn>
      </div>
    </div>
  );
}

// ===================== admin/instructor: 提出状況閲覧 =====================
function SubmissionsPanel({ projectId, onBack }) {
  const { submissions, loading, error } = useDevLabSubmissions(projectId);
  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 text-xs font-semibold" style={{ color: T.textMuted }}>← 案件一覧に戻る</button>
      <SectionHead icon={ClipboardList} title="提出状況" desc="受講生ごとのステップ提出状況を確認できます。" />
      {error && <Card className="mb-4 p-4"><p className="text-sm" style={{ color: T.danger }}>{error}</p></Card>}
      <Card>
        {loading ? <SkeletonRows rows={3} /> : submissions.length === 0 ? (
          <EmptyState icon={ClipboardList} title="提出はまだありません" />
        ) : (
          <div className="divide-y" style={{ borderColor: T.border }}>
            {submissions.map(s => (
              <div key={`${s.projectId}#${s.stepId}`} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold" style={{ color: T.textMuted }}>ステップ: {s.stepId}</span>
                  <span className="text-xs" style={{ color: T.textMuted }}>{s.submittedAt}</span>
                </div>
                {s.submittedText && <p className="mt-1 text-sm" style={{ color: T.textPrimary }}>{s.submittedText}</p>}
                {s.submittedUrl && <a href={s.submittedUrl} target="_blank" rel="noreferrer" className="mt-1 block text-xs" style={{ color: T.accentHover }}>{s.submittedUrl}</a>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
