import React, { useMemo, useState } from "react";
import {
  Award, CheckCircle2, ClipboardList, Clock3, Code2, FolderTree, Link2, Loader2, Paperclip, Pencil, Plus, Sparkles, Trash2, Users, XCircle, X,
} from "lucide-react";
import {
  Badge, Btn, Card, EmptyState, Field, PageHeader, SectionHead, SkeletonRows, fieldStyle, T,
} from "../../components/common";
import { useCompanyDirectory, companyNameResolver } from "../learning/admin/useCompanyDirectory.js";
import {
  DEVLAB_LEVEL_OPTIONS, DEVLAB_VISIBILITY_SCOPE_OPTIONS, devLabLevelLabel,
  devLabStatusLabel, devLabStatusTone, devLabMyStatusLabel, devLabMyStatusTone, devLabWorkspaceStackLabel,
  EMPTY_DEVLAB_CHECK, emptyDevLabForm, draftToForm, formToPayload, projectToForm,
  WORKSPACE_STACK_OPTIONS, emptyWorkspaceTemplateForm, workspaceDraftToForm, workspaceTemplateToForm, workspaceFormToPayload,
  emptyTeamProjectForm, teamDraftToForm, teamProjectToForm, teamFormToPayload, teamFormToGenerateInput,
} from "./DevLabCatalog.js";
import {
  useDevLabProjects, useDevLabMe, useDevLabActions, useDevLabAdmin, useDevLabSubmissions, useMySkillSheet,
  useDevLabWorkspaceTemplates, useDevLabLinkedWorkspaceOverlay, useDevLabAdminWorkspaceTemplates,
  useDevLabAdminTeamProjects,
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

// ===================== 受講生: 開発演習カタログ（案件一覧＋プロジェクト体験を統合、2026-07-22） =====================
// ユーザー要望「案件一覧とプロジェクト体験は似ているので1つにまとめたい」に対応し、
// サイドナビの2項目(el_devlab/el_devlab_workspace)を1項目(el_devlab)へ統合。この画面はその
// 統合カタログで、チェックリスト提出型の案件(dev_project)とワークスペース(dev_workspace_template)
// をカードとして並べ、種別バッジで区別する。クリック時の遷移先(ProjectDetail/WorkspaceDetail)は
// 従来のまま変更しない。useDevLabWorkspaceTemplatesはSandpackに依存しないAPI hookのため、
// Sandpackを直接importする唯一のファイル(DevLabWorkspaceComponents.jsx、docs/decisions/0011)の
// lazy分割境界を崩さずにここへ持ち込める。
export function DevLabCombinedCatalog({ onOpenProject, onOpenTemplate }) {
  const { projects, loading: loadingProjects, error: errorProjects, reload: reloadProjects } = useDevLabProjects();
  const { templates, loading: loadingTemplates, error: errorTemplates, reload: reloadTemplates } = useDevLabWorkspaceTemplates();
  const loading = loadingProjects || loadingTemplates;
  const error = errorProjects || errorTemplates;
  const isEmpty = !loading && projects.length === 0 && templates.length === 0;
  // 案件×ワークスペース連携(2026-07-22追加): リンク済み案件カードに「プロジェクト連携」バッジ、
  // リンクされているテンプレートのカードには対応案件名を小さく表示する(重複感の解消)。
  const linkedProjectsByTemplate = useMemo(() => {
    const map = new Map();
    for (const p of projects) {
      if (!p.workspaceTemplateId) continue;
      const list = map.get(p.workspaceTemplateId) || [];
      list.push(p);
      map.set(p.workspaceTemplateId, list);
    }
    return map;
  }, [projects]);

  // 2026-08-18 「案件一覧とプロジェクト体験が同じ一覧に混ざって分かりにくい」という指摘を
  // 受けて対応。サイドナビは1項目のまま(2026-07-22の統合方針は維持)、画面内を「案件（提出型・
  // AIレビュー）」「プロジェクト体験（ブラウザ内で自由に編集）」の2セクションへ見出し分けする。
  // 該当0件のセクションは表示しない（空欄を並べない）。
  return (
    <div>
      <SectionHead
        icon={Code2}
        title="開発演習"
        desc="疑似的な開発案件（提出・AIレビュー）とベースプロジェクト（ブラウザ内で編集・体験）から選んで参加できます。"
      />
      {error && (
        <Card className="mb-4 p-4">
          <p className="text-sm" style={{ color: T.danger }}>{error}</p>
          <Btn kind="ghost" size="sm" className="mt-2" onClick={() => { reloadProjects(); reloadTemplates(); }}>再試行</Btn>
        </Card>
      )}
      {loading ? <Card><SkeletonRows rows={3} /></Card> : isEmpty ? (
        <Card><EmptyState icon={Code2} title="公開中の案件・プロジェクトはありません" desc="新しいコンテンツが公開されるまでお待ちください。" /></Card>
      ) : (
        <>
          {projects.length > 0 && (
            <div className="mb-5">
              <div className="mb-2 flex items-baseline gap-2">
                <h4 className="text-sm font-bold" style={{ color: T.textPrimary }}>案件（提出型）</h4>
                <span className="text-xs" style={{ color: T.textMuted }}>ステップごとに成果物を提出し、AIレビューを受けます</span>
              </div>
              <Card>
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  {projects.map(project => (
                    <button
                      key={`project-${project.id}`}
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
                        {project.workspaceTemplateId && <Badge tone="green"><Link2 size={11} />プロジェクト連携</Badge>}
                        {project.estimatedHours > 0 && <Badge tone="muted"><Clock3 size={11} />約{project.estimatedHours}時間</Badge>}
                        {(project.techStack || []).slice(0, 3).map(tech => <Badge key={tech} tone="muted">{tech}</Badge>)}
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}
          {templates.length > 0 && (
            <div>
              <div className="mb-2 flex items-baseline gap-2">
                <h4 className="text-sm font-bold" style={{ color: T.textPrimary }}>プロジェクト体験</h4>
                <span className="text-xs" style={{ color: T.textMuted }}>ブラウザ内で自由にコードを編集して体験できます</span>
              </div>
              <Card>
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  {templates.map(tpl => (
                    <button
                      key={`template-${tpl.id}`}
                      type="button"
                      onClick={() => onOpenTemplate(tpl.id)}
                      className="rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                      style={{ background: T.bgBase, border: `1px solid ${T.border}` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold" style={{ color: T.textMuted }}>{devLabWorkspaceStackLabel(tpl.stack)}</div>
                          <div className="mt-0.5 truncate text-base font-bold" style={{ color: T.textPrimary }}>{tpl.title}</div>
                        </div>
                        <Badge tone={devLabMyStatusTone(tpl.myStatus)}>{devLabMyStatusLabel(tpl.myStatus)}</Badge>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed" style={{ color: T.textSecondary }}>{tpl.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge tone="muted">{devLabLevelLabel(tpl.level)}</Badge>
                        <Badge tone="muted">{tpl.stack === "spring_sim" ? "疑似コンソール実行" : "ブラウザ内プレビュー"}</Badge>
                      </div>
                      {(linkedProjectsByTemplate.get(tpl.id) || []).length > 0 && (
                        <p className="mt-1.5 text-[11px]" style={{ color: T.textMuted }}>
                          対応案件: {linkedProjectsByTemplate.get(tpl.id).map(p => p.title).join("、")}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}
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
export function ProjectDetail({ projectId, onBack, onOpenWorkspace }) {
  const { projects, loading, error, reload: reloadProjects } = useDevLabProjects();
  const { assignments, submissions, reload: reloadMe } = useDevLabMe();
  const { sheet, reload: reloadSheet } = useMySkillSheet();
  const { start, submitStep, complete, addToSkillSheet, busy, actionError, clearActionError } = useDevLabActions([reloadProjects, reloadMe, reloadSheet]);
  const [draft, setDraft] = useState({ submittedText: "", submittedUrl: "" });
  const [attachWorkspaceFiles, setAttachWorkspaceFiles] = useState(true);
  const [completeError, setCompleteError] = useState(null);
  const [worksDraftPreview, setWorksDraftPreview] = useState(null);

  const project = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);
  const assignment = useMemo(() => assignments.find(a => a.projectId === projectId), [assignments, projectId]);
  const mySubmissions = useMemo(() => submissions.filter(s => s.projectId === projectId), [submissions, projectId]);
  const byStep = useMemo(() => new Map(mySubmissions.map(s => [s.stepId, s])), [mySubmissions]);
  // 案件×ワークスペース連携(2026-07-22追加): リンク済み案件のみ、自分のworkspace overlayを取得し
  // 提出フォームの「ワークスペースのコードを添付」チェックON時にsubmittedFilesとして同送する。
  const { overlay: workspaceOverlay } = useDevLabLinkedWorkspaceOverlay(project?.workspaceTemplateId);

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
    const payload = { ...draft };
    if (project.workspaceTemplateId && attachWorkspaceFiles && workspaceOverlay && Object.keys(workspaceOverlay).length > 0) {
      payload.submittedFiles = workspaceOverlay;
    }
    await submitStep(projectId, step.stepId, payload);
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

      {project.workspaceTemplateId && onOpenWorkspace && (
        <Card className="mb-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm" style={{ color: T.textSecondary }}>この案件にはベースプロジェクトのワークスペースがリンクされています。実際にコードを編集してから提出しましょう。</p>
            <Btn kind="ghost" size="sm" icon={FolderTree} onClick={() => onOpenWorkspace(project.workspaceTemplateId)}>ワークスペースで作業する</Btn>
          </div>
        </Card>
      )}

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
                      {project.workspaceTemplateId && (
                        <label className="flex items-center gap-1.5 text-xs" style={{ color: T.textPrimary }}>
                          <input type="checkbox" checked={attachWorkspaceFiles} onChange={e => setAttachWorkspaceFiles(e.target.checked)} />
                          <Paperclip size={12} />ワークスペースのコードを添付する（AI判定の根拠として使われます）
                        </label>
                      )}
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
  // 案件→テンプレートのリンク(2026-07-22追加): publishedテンプレの一覧からselect、「リンクなし」も可。
  const { templates: workspaceTemplates } = useDevLabWorkspaceTemplates();

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

          <Field label="リンクするワークスペーステンプレート（任意）">
            <select style={fieldStyle} value={form.workspaceTemplateId || ""} onChange={e => set("workspaceTemplateId", e.target.value)}>
              <option value="">リンクなし</option>
              {workspaceTemplates.map(t => <option key={t.id} value={t.id}>{t.title}（{devLabLevelLabel(t.level)}）</option>)}
            </select>
            <p className="mt-1 text-xs" style={{ color: T.textMuted }}>リンクすると、受講生は案件詳細から該当のワークスペースで実際にコードを編集し、提出時にそのコードを添付できるようになります。</p>
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

// ===================== admin/instructor: プロジェクト体験（ワークスペーステンプレート）管理 =====================
// 2026-08-18新設。ProjectManager/ProjectFormと同じ構成。ファイル編集はSandpackを使わず
// パス＋テキストエリアの一覧編集にする(DevLabWorkspaceComponents.jsxのSandpack lazy-load境界を
// 崩さないため、docs/decisions/0011参照)。実際の動作確認は既存の「プレビュー」ボタンで行う。
function FilesEditor({ files, onChange }) {
  function update(i, key, value) {
    onChange(files.map((f, idx) => (idx === i ? { ...f, [key]: value } : f)));
  }
  function add() { onChange([...files, { path: "", content: "" }]); }
  function remove(i) { onChange(files.filter((_, idx) => idx !== i)); }
  return (
    <div className="space-y-3">
      {files.map((f, i) => (
        <div key={i} className="rounded-xl border p-3" style={{ borderColor: T.border }}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <input style={{ ...fieldStyle, fontFamily: "monospace", fontSize: 12 }} placeholder="ファイルパス（例: src/App.js）" value={f.path} onChange={e => update(i, "path", e.target.value)} />
            {files.length > 1 && <button type="button" onClick={() => remove(i)} aria-label="削除" className="shrink-0"><X size={14} style={{ color: T.textMuted }} /></button>}
          </div>
          <textarea
            style={{ ...fieldStyle, minHeight: 140, fontFamily: "monospace", fontSize: 12, whiteSpace: "pre" }}
            placeholder="ファイル内容"
            value={f.content}
            onChange={e => update(i, "content", e.target.value)}
          />
        </div>
      ))}
      <Btn kind="ghost" size="sm" icon={Plus} onClick={add}>ファイルを追加</Btn>
    </div>
  );
}

function WorkspaceTemplateForm({ mode, form, onChange, onSave, onCancel, onGenerate, busy, actionError }) {
  const [genTheme, setGenTheme] = useState("");
  const [genStack, setGenStack] = useState("react");
  const [genLevel, setGenLevel] = useState("beginner");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  function set(key, value) { onChange({ ...form, [key]: value }); }

  async function handleGenerate() {
    if (!genTheme.trim()) { setGenError("テーマを入力してください。"); return; }
    setGenerating(true); setGenError("");
    try {
      const draft = await onGenerate({ theme: genTheme, stack: genStack, level: genLevel });
      if (draft) onChange(workspaceDraftToForm(draft));
    } catch (e) {
      setGenError(e?.errorMessage || e?.message || "AI下書き生成に失敗しました。");
    } finally { setGenerating(false); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold" style={{ color: T.textPrimary }}>{mode === "edit" ? "プロジェクト体験 編集" : "プロジェクト体験 新規作成"}</h3>
        <Btn kind="ghost" size="sm" icon={X} onClick={onCancel}>閉じる</Btn>
      </div>

      {mode === "create" && (
        <Card className="mb-4 p-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold" style={{ color: T.textPrimary }}><Sparkles size={15} />AIで下書き生成</h4>
          <p className="mb-2 text-xs" style={{ color: T.textMuted }}>「こういう体験をさせたい」を自由に書くと、動く土台＋未実装の1機能（TODO付き）のコードを生成します。保存前に必ず内容を確認・編集してください。</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <input style={fieldStyle} placeholder="テーマ（例: 在庫管理アプリ、削除機能を未実装にしたい）" value={genTheme} onChange={e => setGenTheme(e.target.value)} />
            <select style={fieldStyle} value={genStack} onChange={e => setGenStack(e.target.value)}>
              {WORKSPACE_STACK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
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
          <Field label="タイトル"><input style={fieldStyle} value={form.title} onChange={e => set("title", e.target.value)} /></Field>
          <Field label="説明"><textarea style={{ ...fieldStyle, minHeight: 64 }} value={form.description} onChange={e => set("description", e.target.value)} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="スタック">
              <select style={fieldStyle} value={form.stack} onChange={e => set("stack", e.target.value)}>
                {WORKSPACE_STACK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="レベル">
              <select style={fieldStyle} value={form.level} onChange={e => set("level", e.target.value)}>
                {DEVLAB_LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="最初に開くファイル（entryHint、下のファイルパスのいずれかと一致させてください）">
            <input style={{ ...fieldStyle, fontFamily: "monospace", fontSize: 12 }} value={form.entryHint} onChange={e => set("entryHint", e.target.value)} />
          </Field>
          <Field label="ファイル">
            <FilesEditor files={form.files} onChange={files => set("files", files)} />
          </Field>
          {form.stack === "spring_sim" && (
            <Field label="疑似コンソールのシナリオ（1行1件、「ラベル|コマンド|出力」の形式）">
              <textarea style={{ ...fieldStyle, minHeight: 100, fontFamily: "monospace", fontSize: 12 }} value={form.scenariosText} onChange={e => set("scenariosText", e.target.value)} placeholder="一覧取得|GET /items|[{&quot;id&quot;:1,&quot;name&quot;:&quot;ノートPC&quot;}]" />
            </Field>
          )}
          <Field label="公開状態">
            <select style={fieldStyle} value={form.status} onChange={e => set("status", e.target.value)}>
              <option value="draft">下書き</option>
              <option value="published">公開中</option>
            </select>
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

export function WorkspaceTemplateManager() {
  const { templates, loading, error, create, update, remove, generate, busy, actionError, clearActionError } = useDevLabAdminWorkspaceTemplates();
  const [editing, setEditing] = useState(null); // null=一覧 / "new" / template
  const [form, setForm] = useState(emptyWorkspaceTemplateForm());

  function startCreate() { clearActionError(); setForm(emptyWorkspaceTemplateForm()); setEditing("new"); }
  function startEdit(template) { clearActionError(); setForm(workspaceTemplateToForm(template)); setEditing(template); }
  function cancel() { setEditing(null); }

  async function handleSave() {
    const payload = workspaceFormToPayload(form);
    if (editing === "new") await create(payload);
    else await update(editing.id, payload);
    setEditing(null);
  }

  async function handleDelete(template) {
    if (!window.confirm(`「${template.title}」を削除しますか？`)) return;
    await remove(template.id);
  }

  if (editing) {
    return (
      <WorkspaceTemplateForm
        mode={editing === "new" ? "create" : "edit"}
        form={form}
        onChange={setForm}
        onSave={handleSave}
        onCancel={cancel}
        onGenerate={generate}
        busy={busy}
        actionError={actionError}
      />
    );
  }

  return (
    <div>
      <SectionHead
        icon={FolderTree}
        title="プロジェクト体験管理"
        desc="ブラウザ内で自由に編集できるベースプロジェクト（コード）の作成・編集・AI下書き生成を行います。"
        action={<Btn icon={Plus} onClick={startCreate}>新規作成</Btn>}
      />
      {error && <Card className="mb-4 p-4"><p className="text-sm" style={{ color: T.danger }}>{error}</p></Card>}
      <Card>
        {loading ? <SkeletonRows rows={3} /> : templates.length === 0 ? (
          <EmptyState icon={FolderTree} title="プロジェクト体験がありません" desc="「新規作成」から作成してください。" />
        ) : (
          <div className="divide-y" style={{ borderColor: T.border }}>
            {templates.map(template => (
              <div key={template.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{template.title}</span>
                    <Badge tone={devLabStatusTone(template.status)}>{devLabStatusLabel(template.status)}</Badge>
                    <Badge tone="cyan">{devLabLevelLabel(template.level)}</Badge>
                  </div>
                  <div className="mt-1 text-xs" style={{ color: T.textMuted }}>{devLabWorkspaceStackLabel(template.stack)} ・ ファイル{Object.keys(template.files || {}).length}件</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Btn kind="ghost" size="sm" icon={Pencil} onClick={() => startEdit(template)}>編集</Btn>
                  <Btn kind="ghost" size="sm" icon={Trash2} onClick={() => handleDelete(template)}>削除</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ===================== admin/instructor: チーム開発案件の管理 =====================
// 2026-08-18新設（docs/specs/dev-team-spec.md）。WorkspaceTemplateManagerと同じ構成に、
// 役割分担エディタとAIメンバーの生成結果表示を足したもの。AI生成は2段階
// （①題材＋出発点コード＋役割分担 → ②AIメンバーの予定コミット列）。
function RolesEditor({ roles, onChange }) {
  function update(i, key, value) {
    onChange(roles.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
  function add() { onChange([...roles, { roleId: `role_${roles.length + 1}`, name: "", description: "", ownedPathsText: "" }]); }
  function remove(i) { onChange(roles.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, roleId: `role_${idx + 1}` }))); }
  return (
    <div className="space-y-2">
      {roles.map((r, i) => (
        <div key={i} className="rounded-xl border p-3" style={{ borderColor: T.border }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: T.textMuted }}>{r.roleId}</span>
            {roles.length > 1 && <button type="button" onClick={() => remove(i)} aria-label="削除"><X size={14} style={{ color: T.textMuted }} /></button>}
          </div>
          <div className="space-y-2">
            <input style={fieldStyle} placeholder="担当名（例: API担当）" value={r.name} onChange={e => update(i, "name", e.target.value)} />
            <input style={fieldStyle} placeholder="担当の説明（例: バックエンドのAPIを実装します）" value={r.description} onChange={e => update(i, "description", e.target.value)} />
            <textarea
              style={{ ...fieldStyle, minHeight: 64, fontFamily: "monospace", fontSize: 12 }}
              placeholder="担当ファイル（1行1パス）"
              value={r.ownedPathsText}
              onChange={e => update(i, "ownedPathsText", e.target.value)}
            />
          </div>
        </div>
      ))}
      <Btn kind="ghost" size="sm" icon={Plus} onClick={add}>担当を追加</Btn>
      <p className="text-xs" style={{ color: T.textMuted }}>
        担当ファイルはほぼ重ならないように分け、共有ファイル（App等）だけ複数の担当に入れます。そこが自然にぶつかる箇所になります。
      </p>
    </div>
  );
}

function AiMembersPanel({ aiMembers, generating, onGenerate, onClear }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: T.border }}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs" style={{ color: T.textMuted }}>
          空席を埋めるAIメンバーが、担当範囲を順に進めていきます。受講生がpullしたときに1コミットずつ入ります。
        </p>
        <div className="flex shrink-0 gap-2">
          {aiMembers.length > 0 && <Btn kind="ghost" size="sm" onClick={onClear}>クリア</Btn>}
          <Btn kind="ai" size="sm" icon={generating ? Loader2 : Sparkles} disabled={generating} onClick={onGenerate}>
            {generating ? "生成中…" : aiMembers.length ? "作り直す" : "AIメンバーを生成"}
          </Btn>
        </div>
      </div>
      {aiMembers.length === 0 ? (
        <p className="text-xs" style={{ color: T.textMuted }}>まだ生成されていません。出発点コードと役割分担を先に用意してから生成してください。</p>
      ) : (
        <div className="space-y-2">
          {aiMembers.map(m => (
            <div key={m.memberId} className="rounded-lg p-2" style={{ background: T.bgBase }}>
              <div className="text-xs font-bold" style={{ color: T.textPrimary }}>{m.name}<span className="ml-1.5 font-normal" style={{ color: T.textMuted }}>{m.roleId}</span></div>
              <ul className="mt-1 space-y-0.5">
                {(m.commits || []).map((c, i) => (
                  <li key={i} className="text-[11px]" style={{ color: T.textSecondary }}>
                    {i + 1}. {c.message}
                    <span className="ml-1" style={{ color: T.textMuted }}>（{Object.keys(c.changes || {}).join(", ") || "変更なし"}）</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamProjectForm({ mode, role, form, onChange, onSave, onCancel, onGenerate, onGenerateAiCommits, busy, actionError, companies, companiesError }) {
  const [genTheme, setGenTheme] = useState("");
  const [genStack, setGenStack] = useState("react");
  const [genLevel, setGenLevel] = useState("beginner");
  const [genMemberCount, setGenMemberCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
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
      const draft = await onGenerate({ theme: genTheme, stack: genStack, level: genLevel, memberCount: genMemberCount });
      if (draft) onChange(teamDraftToForm(draft));
    } catch (e) {
      setGenError(e?.errorMessage || e?.message || "AI下書き生成に失敗しました。");
    } finally { setGenerating(false); }
  }

  async function handleGenerateAiCommits() {
    setGeneratingAi(true); setGenError("");
    try {
      const input = teamFormToGenerateInput(form);
      const aiMembers = await onGenerateAiCommits({ ...input, commitsPerMember: 2 });
      set("aiMembers", aiMembers || []);
    } catch (e) {
      setGenError(e?.errorMessage || e?.message || "AIメンバーの生成に失敗しました。");
    } finally { setGeneratingAi(false); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold" style={{ color: T.textPrimary }}>{mode === "edit" ? "チーム開発案件 編集" : "チーム開発案件 新規作成"}</h3>
        <Btn kind="ghost" size="sm" icon={X} onClick={onCancel}>閉じる</Btn>
      </div>

      {mode === "create" && (
        <Card className="mb-4 p-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold" style={{ color: T.textPrimary }}><Sparkles size={15} />AIで下書き生成</h4>
          <p className="mb-2 text-xs" style={{ color: T.textMuted }}>複数人が別々の担当を持って同時に触る前提のコードと役割分担を生成します。保存前に必ず内容を確認・編集してください。</p>
          <div className="grid gap-2 sm:grid-cols-4">
            <input style={fieldStyle} placeholder="テーマ（例: 社内の勤怠管理ツール）" value={genTheme} onChange={e => setGenTheme(e.target.value)} />
            <select style={fieldStyle} value={genStack} onChange={e => setGenStack(e.target.value)}>
              {WORKSPACE_STACK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select style={fieldStyle} value={genLevel} onChange={e => setGenLevel(e.target.value)}>
              {DEVLAB_LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select style={fieldStyle} value={genMemberCount} onChange={e => setGenMemberCount(Number(e.target.value))}>
              {[2, 3, 4, 5].map(n => <option key={n} value={n}>{n}人チーム</option>)}
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
          <Field label="案件概要"><textarea style={{ ...fieldStyle, minHeight: 64 }} value={form.description} onChange={e => set("description", e.target.value)} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="スタック">
              <select style={fieldStyle} value={form.stack} onChange={e => set("stack", e.target.value)}>
                {WORKSPACE_STACK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="最初に開くファイル（entryHint）">
              <input style={{ ...fieldStyle, fontFamily: "monospace", fontSize: 12 }} value={form.entryHint} onChange={e => set("entryHint", e.target.value)} />
            </Field>
          </div>

          <Field label="役割分担">
            <RolesEditor roles={form.roles} onChange={roles => set("roles", roles)} />
          </Field>

          <Field label="AIメンバー（空席を埋めるメンバーの動き）">
            <AiMembersPanel
              aiMembers={form.aiMembers || []}
              generating={generatingAi}
              onGenerate={handleGenerateAiCommits}
              onClear={() => set("aiMembers", [])}
            />
          </Field>

          <Field label="出発点コード（チームのmain初期状態）">
            <FilesEditor files={form.baseFiles} onChange={files => set("baseFiles", files)} />
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

export function TeamProjectManager({ role }) {
  const { teamProjects, loading, error, create, update, remove, generate, generateAiCommits, busy, actionError, clearActionError } = useDevLabAdminTeamProjects();
  const { companies, companiesError } = useCompanyDirectory();
  const [editing, setEditing] = useState(null); // null=一覧 / "new" / teamProject
  const [form, setForm] = useState(emptyTeamProjectForm());

  function startCreate() { clearActionError(); setForm(emptyTeamProjectForm()); setEditing("new"); }
  function startEdit(teamProject) { clearActionError(); setForm(teamProjectToForm(teamProject)); setEditing(teamProject); }
  function cancel() { setEditing(null); }

  async function handleSave() {
    const payload = teamFormToPayload(form);
    if (editing === "new") await create(payload);
    else await update(editing.id, payload);
    setEditing(null);
  }

  async function handleDelete(teamProject) {
    if (!window.confirm(`「${teamProject.title}」を削除しますか？`)) return;
    await remove(teamProject.id);
  }

  if (editing) {
    return (
      <TeamProjectForm
        mode={editing === "new" ? "create" : "edit"}
        role={role}
        form={form}
        onChange={setForm}
        onSave={handleSave}
        onCancel={cancel}
        onGenerate={generate}
        onGenerateAiCommits={generateAiCommits}
        busy={busy}
        actionError={actionError}
        companies={companies}
        companiesError={companiesError}
      />
    );
  }

  return (
    <div>
      <SectionHead
        icon={Users}
        title="チーム開発案件"
        desc="複数人で1つのコードベースを触るチーム開発の題材を作成・編集します。空席はAIメンバーが埋めます。"
        action={<Btn icon={Plus} onClick={startCreate}>新規作成</Btn>}
      />
      {error && <Card className="mb-4 p-4"><p className="text-sm" style={{ color: T.danger }}>{error}</p></Card>}
      <Card>
        {loading ? <SkeletonRows rows={3} /> : teamProjects.length === 0 ? (
          <EmptyState icon={Users} title="チーム開発案件がありません" desc="「新規作成」から作成してください。" />
        ) : (
          <div className="divide-y" style={{ borderColor: T.border }}>
            {teamProjects.map(tp => (
              <div key={tp.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{tp.title}</span>
                    <Badge tone={devLabStatusTone(tp.status)}>{devLabStatusLabel(tp.status)}</Badge>
                    <Badge tone="cyan">{devLabLevelLabel(tp.level)}</Badge>
                    {tp.visibilityScope === "companies" && <Badge tone="amber">企業限定公開</Badge>}
                  </div>
                  <div className="mt-1 text-xs" style={{ color: T.textMuted }}>
                    {devLabWorkspaceStackLabel(tp.stack)} ・ 担当{(tp.roles || []).length}件 ・ AIメンバー{(tp.aiMembers || []).length}人 ・ ファイル{Object.keys(tp.baseFiles || {}).length}件
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Btn kind="ghost" size="sm" icon={Pencil} onClick={() => startEdit(tp)}>編集</Btn>
                  <Btn kind="ghost" size="sm" icon={Trash2} onClick={() => handleDelete(tp)}>削除</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
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

// 管理側の提出閲覧: 添付ファイル名一覧＋内容の展開表示(2026-07-22追加)。
function SubmittedFilesViewer({ files }) {
  const entries = Object.entries(files || {});
  if (!entries.length) return null;
  return (
    <div className="mt-2 rounded-xl p-3" style={{ background: T.bgBase, border: `1px solid ${T.border}` }}>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold" style={{ color: T.textMuted }}>
        <Paperclip size={12} />添付ファイル（{entries.length}件）
      </div>
      <div className="space-y-1.5">
        {entries.map(([path, content]) => (
          <details key={path} className="rounded-lg" style={{ border: `1px solid ${T.border}` }}>
            <summary className="cursor-pointer px-2 py-1 text-xs font-semibold" style={{ color: T.textPrimary }}>{path}</summary>
            <pre className="max-h-64 overflow-auto px-2 pb-2 text-[11px] leading-relaxed" style={{ color: T.textSecondary, whiteSpace: "pre-wrap" }}>{content}</pre>
          </details>
        ))}
      </div>
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
                  <SubmittedFilesViewer files={s.submittedFiles} />
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
