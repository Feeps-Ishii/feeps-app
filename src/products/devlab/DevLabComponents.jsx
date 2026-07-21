import React, { useMemo, useState } from "react";
import {
  Award, CheckCircle2, ClipboardList, Clock3, Code2, Link2, Loader2, Pencil, Plus, Sparkles, Trash2, XCircle, X,
} from "lucide-react";
import {
  Badge, Btn, Card, EmptyState, Field, PageHeader, SectionHead, SkeletonRows, fieldStyle, T,
} from "../../components/common";
import { useCompanyDirectory, companyNameResolver } from "../learning/admin/useCompanyDirectory.js";
import {
  DEVLAB_LEVEL_OPTIONS, DEVLAB_VISIBILITY_SCOPE_OPTIONS, devLabLevelLabel,
  devLabStatusLabel, devLabStatusTone, devLabMyStatusLabel, devLabMyStatusTone,
  EMPTY_DEVLAB_CHECK, emptyDevLabForm, draftToForm, formToPayload, projectToForm,
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
            ? "疑似的なクライアント案件を作成・公開し、受講生の進捗と提出物・チェック結果を確認できます。AIの判定に誤りがある場合は手動で上書きできます。"
            : "公開されている案件に参加し、ステップごとに成果物（テキスト・URL）を提出して進めます。各ステップは事前に決められたチェック項目を満たすと合格になり、全ステップ合格するとスキルシートへの実績下書きを作成できます。"}
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

// チェックリスト充足の表示。met=trueの件数/総数と、未充足項目のcriteriaヒント＋対応F-nを出す。
// AIのcomment/adviceは合否と分離し「AIレビュー（参考）」として別枠で表示する（点数はどこにも出さない）。
function ChecklistResult({ checklist, checkResults }) {
  const results = Array.isArray(checkResults) ? checkResults : [];
  const byId = new Map(results.map(r => [r.checkId, r]));
  const required = (checklist || []).filter(c => c.required !== false);
  const metCount = required.filter(c => byId.get(c.checkId)?.met === true).length;
  const unmet = (checklist || []).filter(c => c.required !== false && byId.get(c.checkId)?.met !== true);

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{metCount}/{required.length}項目 充足</span>
        {unmet.length === 0 && required.length > 0 && <Badge tone="green">合格</Badge>}
        {unmet.length > 0 && <Badge tone="amber">未合格</Badge>}
      </div>
      <div className="mt-2 space-y-1.5">
        {(checklist || []).map(c => {
          const met = byId.get(c.checkId)?.met === true;
          const evidence = byId.get(c.checkId)?.evidence;
          return (
            <div key={c.checkId} className="flex items-start gap-2 text-xs">
              {met ? <CheckCircle2 size={14} style={{ color: T.success, marginTop: 1 }} /> : <XCircle size={14} style={{ color: c.required === false ? T.textMuted : T.warning, marginTop: 1 }} />}
              <div className="min-w-0">
                <span style={{ color: T.textPrimary }}>{c.text}</span>
                {c.required === false && <span className="ml-1" style={{ color: T.textMuted }}>（参考項目）</span>}
                {!met && (
                  <div className="mt-0.5" style={{ color: T.textMuted }}>
                    ヒント: {c.criteria}{c.reqIds?.length ? `（対応要件: ${c.reqIds.join("、")}）` : ""}
                  </div>
                )}
                {met && evidence && <div className="mt-0.5" style={{ color: T.textMuted }}>{evidence}</div>}
              </div>
            </div>
          );
        })}
      </div>
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
  const byStep = useMemo(() => new Map(mySubmissions.map(s => [s.stepId, s])), [mySubmissions]);

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
  const currentStep = steps.find(s => byStep.get(s.stepId)?.passed !== true);
  const allPassed = steps.length > 0 && !currentStep;
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
        {(project.functionalRequirements || []).length > 0 && (
          <>
            <h4 className="mt-3 text-xs font-bold" style={{ color: T.textMuted }}>機能要件</h4>
            <ul className="mt-1 space-y-1 text-xs" style={{ color: T.textSecondary }}>
              {project.functionalRequirements.map(r => <li key={r.reqId}><span className="font-semibold">{r.reqId}</span>: {r.text}</li>)}
            </ul>
          </>
        )}
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
              const submission = byStep.get(step.stepId);
              const passed = submission?.passed === true;
              const isCurrent = !isCompleted && currentStep?.stepId === step.stepId;
              return (
                <Card key={step.stepId} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold" style={{ background: passed ? T.successSubtle : T.bgBase, color: passed ? T.success : T.textMuted, border: `1px solid ${T.border}` }}>{i + 1}</span>
                      <div className="text-sm font-bold" style={{ color: T.textPrimary }}>{step.title}</div>
                    </div>
                    <Badge tone={passed ? "green" : submission ? "amber" : "muted"}>{passed ? "合格" : submission ? "未合格（再提出可）" : "未提出"}</Badge>
                  </div>
                  <p className="mt-2 ml-9 text-xs" style={{ color: T.textSecondary }}>{step.goal}</p>
                  {step.deliverableGuide && <p className="mt-1 ml-9 text-xs" style={{ color: T.textMuted }}>提出物の目安: {step.deliverableGuide}</p>}

                  {submission && (
                    <div className="mt-3 ml-9">
                      <ChecklistResult checklist={step.checklist} checkResults={submission.checkResults} />
                      {(submission.aiComment || submission.aiAdvice) && (
                        <div className="mt-2 rounded-xl p-3 text-xs" style={{ background: T.bgBase, border: `1px solid ${T.border}` }}>
                          <div className="mb-1 font-bold" style={{ color: T.textMuted }}>AIレビュー（参考）</div>
                          {submission.aiComment && <p style={{ color: T.textSecondary }}>{submission.aiComment}</p>}
                          {submission.aiAdvice && <p className="mt-1" style={{ color: T.textSecondary }}>{submission.aiAdvice}</p>}
                        </div>
                      )}
                      {submission.aiFeedbackError && <p className="mt-1 text-xs" style={{ color: T.danger }}>AI判定に失敗したため、この提出は未合格として扱われています。再提出をお試しください。</p>}
                      {submission.overriddenBy && <p className="mt-1 text-xs" style={{ color: T.textMuted }}>※講師/管理者により合否が確認・調整されています。</p>}
                    </div>
                  )}

                  {isCurrent && (
                    <div className="mt-3 ml-9 space-y-2">
                      <Field label="成果物（テキスト）">
                        <textarea style={{ ...fieldStyle, minHeight: 88 }} value={draft.submittedText} onChange={e => setDraft({ ...draft, submittedText: e.target.value })} placeholder="実施内容・工夫点などを記入してください" />
                      </Field>
                      <Field label="URL（任意。GitHub等）">
                        <input style={fieldStyle} value={draft.submittedUrl} onChange={e => setDraft({ ...draft, submittedUrl: e.target.value })} placeholder="https://github.com/..." />
                      </Field>
                      <Btn size="sm" icon={Link2} disabled={busy || (!draft.submittedText.trim() && !draft.submittedUrl.trim())} onClick={() => handleSubmit(step)}>{submission ? "再提出する" : "提出する"}</Btn>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {allPassed && !isCompleted && (
            <Card className="mt-4 p-5 text-center">
              <p className="text-sm" style={{ color: T.textSecondary }}>全ステップ合格しました。完了して実績下書きを作成しましょう。</p>
              <Btn className="mt-3" icon={Award} disabled={busy} onClick={handleComplete}>完了する</Btn>
            </Card>
          )}
          {completeError?.unpassedSteps?.length > 0 && (
            <Card className="mt-4 p-4">
              <p className="text-sm font-bold" style={{ color: T.danger }}>未合格のステップがあります</p>
              <ul className="mt-2 space-y-2 text-xs">
                {completeError.unpassedSteps.map(s => (
                  <li key={s.stepId}>
                    <span className="font-semibold" style={{ color: T.textPrimary }}>{s.title}</span>
                    <ul className="mt-1 list-disc pl-4" style={{ color: T.textMuted }}>
                      {(s.unmetChecks || []).map(c => <li key={c.checkId}>{c.text}（{c.criteria}）</li>)}
                    </ul>
                  </li>
                ))}
              </ul>
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
    const project = projects.find(p => p.id === selectedProjectId);
    return <SubmissionsPanel projectId={selectedProjectId} project={project} onBack={() => setSelectedProjectId("")} />;
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

function FunctionalRequirementsEditor({ items, onChange }) {
  function update(i, text) {
    onChange(items.map((r, idx) => (idx === i ? { ...r, text } : r)));
  }
  function add() {
    onChange([...items, { reqId: `F-${items.length + 1}`, text: "" }]);
  }
  function remove(i) {
    onChange(items.filter((_, idx) => idx !== i).map((r, idx) => ({ reqId: `F-${idx + 1}`, text: r.text })));
  }
  return (
    <div className="space-y-2">
      {items.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-xs font-bold" style={{ color: T.textMuted }}>{r.reqId}</span>
          <input style={fieldStyle} value={r.text} onChange={e => update(i, e.target.value)} placeholder="機能要件（例: 備品の一覧を表示できる）" />
          {items.length > 1 && <button type="button" onClick={() => remove(i)} aria-label="削除"><X size={14} style={{ color: T.textMuted }} /></button>}
        </div>
      ))}
      <Btn kind="ghost" size="sm" icon={Plus} onClick={add}>機能要件を追加</Btn>
    </div>
  );
}

function ChecklistEditor({ checklist, functionalRequirements, onChange }) {
  function updateCheck(i, key, value) {
    onChange(checklist.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)));
  }
  function toggleReqId(i, reqId) {
    const current = checklist[i].reqIds || [];
    const next = current.includes(reqId) ? current.filter(id => id !== reqId) : [...current, reqId];
    updateCheck(i, "reqIds", next);
  }
  function add() { onChange([...checklist, { ...EMPTY_DEVLAB_CHECK }]); }
  function remove(i) { onChange(checklist.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-2">
      {checklist.map((c, i) => (
        <div key={i} className="rounded-xl border p-3" style={{ borderColor: T.border }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: T.textMuted }}>チェック{i + 1}</span>
            {checklist.length > 1 && <button type="button" onClick={() => remove(i)} aria-label="削除"><X size={14} style={{ color: T.textMuted }} /></button>}
          </div>
          <div className="space-y-2">
            <input style={fieldStyle} placeholder="チェック項目（例: 備品の一覧表示が実装されている）" value={c.text} onChange={e => updateCheck(i, "text", e.target.value)} />
            <textarea style={{ ...fieldStyle, minHeight: 56 }} placeholder="判定基準（criteria）。AIはこの基準に対して充足/未充足のみを判定します。作成時に固定する「答え」です。" value={c.criteria} onChange={e => updateCheck(i, "criteria", e.target.value)} />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs" style={{ color: T.textPrimary }}>
                <input type="checkbox" checked={c.required !== false} onChange={e => updateCheck(i, "required", e.target.checked)} />
                合否に使う（必須項目）
              </label>
              {(functionalRequirements || []).filter(r => r.text.trim()).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {functionalRequirements.filter(r => r.text.trim()).map(r => (
                    <button
                      key={r.reqId}
                      type="button"
                      onClick={() => toggleReqId(i, r.reqId)}
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        background: (c.reqIds || []).includes(r.reqId) ? T.accentSubtle : T.bgBase,
                        color: (c.reqIds || []).includes(r.reqId) ? T.accentHover : T.textMuted,
                        border: `1px solid ${T.border}`,
                      }}
                    >
                      {r.reqId}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      <Btn kind="ghost" size="sm" icon={Plus} onClick={add}>チェック項目を追加</Btn>
    </div>
  );
}

function StepEditor({ steps, functionalRequirements, onChange }) {
  function updateStep(i, key, value) {
    const next = steps.map((s, idx) => (idx === i ? { ...s, [key]: value } : s));
    onChange(next);
  }
  function addStep() { onChange([...steps, { title: "", goal: "", deliverableGuide: "", checklist: [{ ...EMPTY_DEVLAB_CHECK }] }]); }
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
            <div>
              <div className="mb-1.5 text-xs font-semibold" style={{ color: T.textMuted }}>チェックリスト</div>
              <ChecklistEditor checklist={step.checklist || []} functionalRequirements={functionalRequirements} onChange={checklist => updateStep(i, "checklist", checklist)} />
            </div>
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
          <p className="mb-2 text-xs" style={{ color: T.textMuted }}>機能要件と各ステップのチェックリスト（判定基準込み）まで生成します。保存前に必ず内容を確認・編集してください。</p>
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
          <Field label="機能要件（F-n。チェックリストの判定基準の対象になります）">
            <FunctionalRequirementsEditor items={form.functionalRequirements} onChange={v => set("functionalRequirements", v)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="技術スタック（カンマ区切り）"><input style={fieldStyle} value={form.techStackText} onChange={e => set("techStackText", e.target.value)} /></Field>
            <Field label="想定時間（時間）"><input style={fieldStyle} value={form.estimatedHours} onChange={e => set("estimatedHours", e.target.value)} /></Field>
          </div>

          <Field label="ステップ・チェックリスト">
            <StepEditor steps={form.steps} functionalRequirements={form.functionalRequirements} onChange={steps => set("steps", steps)} />
          </Field>

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

// ===================== admin/instructor: 提出状況閲覧＋手動上書き =====================
function OverrideForm({ submission, onOverride, busy }) {
  const [note, setNote] = useState("");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl p-2" style={{ background: T.bgBase }}>
      <input style={{ ...fieldStyle, width: 220 }} placeholder="上書き理由（任意）" value={note} onChange={e => setNote(e.target.value)} />
      <Btn kind="ghost" size="sm" disabled={busy} onClick={() => onOverride(true, note)}>合格に上書き</Btn>
      <Btn kind="ghost" size="sm" disabled={busy} onClick={() => onOverride(false, note)}>不合格に上書き</Btn>
    </div>
  );
}

function SubmissionsPanel({ projectId, project, onBack }) {
  const { submissions, loading, error, override, busy } = useDevLabSubmissions(projectId);
  const [openOverrideKey, setOpenOverrideKey] = useState("");
  const checklistByStep = useMemo(() => {
    const map = new Map();
    (project?.steps || []).forEach(s => map.set(s.stepId, s.checklist || []));
    return map;
  }, [project]);

  async function handleOverride(s, passed, note) {
    await override(s.traineeId, s.stepId, passed, note);
    setOpenOverrideKey("");
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 text-xs font-semibold" style={{ color: T.textMuted }}>← 案件一覧に戻る</button>
      <SectionHead icon={ClipboardList} title="提出状況" desc="受講生ごとのステップ提出・チェック結果を確認できます。AIの判定に誤りがある場合は合否を手動で上書きできます。" />
      {error && <Card className="mb-4 p-4"><p className="text-sm" style={{ color: T.danger }}>{error}</p></Card>}
      <Card>
        {loading ? <SkeletonRows rows={3} /> : submissions.length === 0 ? (
          <EmptyState icon={ClipboardList} title="提出はまだありません" />
        ) : (
          <div className="divide-y" style={{ borderColor: T.border }}>
            {submissions.map(s => {
              const key = `${s.traineeId}#${s.stepId}`;
              return (
                <div key={key} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold" style={{ color: T.textMuted }}>受講生: {s.traineeId} ／ ステップ: {s.stepId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={s.passed ? "green" : "amber"}>{s.passed ? "合格" : "未合格"}</Badge>
                      <span className="text-xs" style={{ color: T.textMuted }}>{s.submittedAt}</span>
                    </div>
                  </div>
                  {s.submittedText && <p className="mt-1 text-sm" style={{ color: T.textPrimary }}>{s.submittedText}</p>}
                  {s.submittedUrl && <a href={s.submittedUrl} target="_blank" rel="noreferrer" className="mt-1 block text-xs" style={{ color: T.accentHover }}>{s.submittedUrl}</a>}
                  {checklistByStep.get(s.stepId) && <div className="mt-2"><ChecklistResult checklist={checklistByStep.get(s.stepId)} checkResults={s.checkResults} /></div>}
                  {(s.aiComment || s.aiAdvice) && (
                    <div className="mt-2 rounded-xl p-3 text-xs" style={{ background: T.bgBase }}>
                      <div className="mb-1 font-bold" style={{ color: T.textMuted }}>AIレビュー（参考）</div>
                      {s.aiComment && <p style={{ color: T.textSecondary }}>{s.aiComment}</p>}
                      {s.aiAdvice && <p className="mt-1" style={{ color: T.textSecondary }}>{s.aiAdvice}</p>}
                    </div>
                  )}
                  {s.overriddenBy && (
                    <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
                      手動上書き済み（{s.overriddenAt}）{s.overrideNote ? `: ${s.overrideNote}` : ""}
                    </p>
                  )}
                  {openOverrideKey === key ? (
                    <OverrideForm submission={s} busy={busy} onOverride={(passed, note) => handleOverride(s, passed, note)} />
                  ) : (
                    <Btn kind="ghost" size="sm" className="mt-2" onClick={() => setOpenOverrideKey(key)}>合否を手動で上書き</Btn>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
