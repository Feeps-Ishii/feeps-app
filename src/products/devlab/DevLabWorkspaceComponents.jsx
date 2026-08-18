import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  SandpackProvider, SandpackLayout, SandpackFileExplorer, SandpackCodeEditor, SandpackPreview, useSandpack,
} from "@codesandbox/sandpack-react";
import {
  ArrowLeft, Code2, FileText, FolderTree, GitBranch as GitBranchIcon, GitCommitHorizontal, GitPullRequest,
  Loader2, Play, RefreshCcw, Save, Terminal,
} from "lucide-react";
import {
  Badge, Btn, Card, EmptyState, SectionHead, SkeletonRows, fieldStyle, T,
} from "../../components/common";
import { devLabLevelLabel, devLabMyStatusLabel, devLabMyStatusTone, devLabWorkspaceStackLabel } from "./DevLabCatalog.js";
import {
  useDevLabWorkspaceTemplates, useDevLabWorkspaceDetail, useDevLabWorkspaceActions,
  useDevLabTeamDetail, useDevLabTeamActions,
} from "./useDevLab.js";

// Sandpackを直接importする唯一のファイル(docs/decisions/0011参照)。DevLabProduct.jsxから
// React.lazyで読み込まれ、他画面のchunkにSandpackを含めない境界になっている。

// Prism Bright（既存デザイン言語）のライトトーンへ合わせたSandpackテーマ。
const SANDPACK_THEME = {
  colors: {
    surface1: T.bgSurface,
    surface2: T.bgBase,
    surface3: T.border,
    disabled: T.textMuted,
    base: T.textPrimary,
    clickable: T.textSecondary,
    hover: T.accent,
    accent: T.accent,
    error: T.danger,
    errorSurface: T.dangerSubtle,
  },
  syntax: {
    plain: T.textPrimary,
    comment: { color: T.textMuted, fontStyle: "italic" },
    keyword: "#7454C7",
    definition: T.accent,
    punctuation: T.textSecondary,
    property: "#238B85",
    tag: "#C26421",
    static: "#3D8A63",
    string: "#238B85",
  },
  font: {
    body: "inherit",
    mono: '"SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
    size: "13px",
    lineHeight: "20px",
  },
};

function stripLeadingSlash(path) {
  return String(path || "").replace(/^\/+/, "");
}
function withLeadingSlash(path) {
  const p = String(path || "");
  return p.startsWith("/") ? p : `/${p}`;
}

// テンプレファイルからREADME.md相当（パスの末尾がreadme.md、大文字小文字不問）を抜き出す。
// 無ければnull（パネル自体を表示しない）。
function extractReadmeContent(files) {
  if (!files) return null;
  const entry = Object.entries(files).find(([path]) => /(^|\/)readme\.md$/i.test(stripLeadingSlash(path)));
  return entry ? entry[1] : null;
}

// 「課題の説明」パネル。既存の学習教材Markdown表示(LearningComponents.jsxのLessonBodyText)と
// 同じ`.feeps-lesson-md`(index.css)クラス・react-markdown(既存依存、新規追加なし)を流用し、
// DevLabワークスペース独自のチャンク分離(ADR-0011 D)を保つため、大きいLearningComponents.jsx
// を直接importせずローカルで完結させている。デフォルト展開、長い内容は折りたたみ可能。
function ReadmePanel({ content }) {
  const [expanded, setExpanded] = useState(true);
  if (!content) return null;
  return (
    <Card className="mb-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText size={14} style={{ color: T.textMuted }} />
          <h3 className="text-sm font-bold" style={{ color: T.textPrimary }}>課題の説明（README）</h3>
        </div>
        <button type="button" onClick={() => setExpanded(e => !e)} className="text-xs font-semibold" style={{ color: T.accent }}>
          {expanded ? "折りたたむ" : "続きを見る"}
        </button>
      </div>
      {expanded && (
        <div
          className="feeps-lesson-md mt-3 text-[13px] leading-[1.8]"
          style={{ color: T.textSecondary, maxHeight: 340, overflow: "auto" }}
        >
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
    </Card>
  );
}

// テンプレファイル＋自分のoverlayをマージし、deletedPathsを除いたSandpack向けfiles初期状態を作る。
function buildInitialSandpackFiles(templateFiles, overlay, deletedPaths) {
  const merged = { ...(templateFiles || {}), ...(overlay || {}) };
  const deleted = new Set(deletedPaths || []);
  const out = {};
  for (const [path, content] of Object.entries(merged)) {
    if (deleted.has(path)) continue;
    out[withLeadingSlash(path)] = { code: content };
  }
  return out;
}

// ===================== テンプレート一覧 =====================
export function WorkspaceCatalog({ onOpenTemplate }) {
  const { templates, loading, error, reload } = useDevLabWorkspaceTemplates();

  return (
    <div>
      <SectionHead icon={FolderTree} title="プロジェクト体験" desc="用意されたベースプロジェクトを開き、ファイルを編集してブラウザ内で開発を体験します。編集内容は自動的に保存され、いつでも再開できます。" />
      {error && (
        <Card className="mb-4 p-4">
          <p className="text-sm" style={{ color: T.danger }}>{error}</p>
          <Btn kind="ghost" size="sm" className="mt-2" onClick={reload}>再試行</Btn>
        </Card>
      )}
      <Card>
        {loading ? <SkeletonRows rows={3} /> : templates.length === 0 ? (
          <EmptyState icon={FolderTree} title="公開中のテンプレートはありません" desc="新しいベースプロジェクトが公開されるまでお待ちください。" />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {templates.map(tpl => (
              <button
                key={tpl.id}
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
                  <Badge tone={tpl.stack === "spring_sim" ? "amber" : "cyan"}>{tpl.stack === "spring_sim" ? "疑似コンソール実行" : "ブラウザ内プレビュー"}</Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// Sandpackの現在のファイル状態を監視し、差分(overlay/deletedPaths)を親へ通知する。
// 比較基準は「テンプレのfiles」ではなく「マウント時点のsandpack.files」にする点が重要:
// template="react"はpackage.json/public/index.html等の既定ファイルを自動追加するため、
// テンプレfilesだけを基準にすると、ユーザーが何も編集していなくても既定ファイルが
// 「差分あり」として誤検知され、開いた瞬間に未保存扱い＋不要なoverlay保存が発生してしまう。
// マウント時点の状態（テンプレ既定＋overlay反映後）を基準にすることでこれを防ぐ。
function SandpackChangeWatcher({ onChange }) {
  const { sandpack } = useSandpack();
  const baselineRef = useRef(null);
  if (baselineRef.current === null) baselineRef.current = sandpack.files;

  useEffect(() => {
    const baseline = baselineRef.current;
    const overlay = {};
    const currentPaths = new Set();
    for (const [path, file] of Object.entries(sandpack.files)) {
      currentPaths.add(path);
      const original = baseline[path];
      if (!original || original.code !== file.code) {
        overlay[stripLeadingSlash(path)] = file.code;
      }
    }
    const deletedPaths = Object.keys(baseline).filter(path => !currentPaths.has(path)).map(stripLeadingSlash);
    onChange(overlay, deletedPaths);
  }, [sandpack.files]);

  return null;
}

// ===================== ワークスペース詳細（React: エディタ＋プレビュー／spring_sim: エディタ＋疑似コンソール） =====================
export function WorkspaceDetail({ templateId, onBack, backLabel }) {
  const { template, workspace, loading, error, reload } = useDevLabWorkspaceDetail(templateId);
  const { save, reset, saving, saveError, clearSaveError } = useDevLabWorkspaceActions();
  const [pending, setPending] = useState(null); // {overlay, deletedPaths} 直近のエディタ差分
  const [saveState, setSaveState] = useState("idle"); // idle | dirty | saving | saved
  const [resetConfirm, setResetConfirm] = useState(false);
  const [activeScenario, setActiveScenario] = useState(null);
  const [consoleLines, setConsoleLines] = useState([]);
  const autosaveTimer = useRef(null);

  useEffect(() => () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); }, []);

  // SandpackProviderへ渡すfiles propはマウント時（＝template/workspaceが実際にロード/再ロードされた時）
  // だけ再生成する。ここをuseMemoでガードせず毎レンダー新規オブジェクトにすると、タイプ入力→
  // SandpackChangeWatcher.onChange→setPending/setSaveState→親再レンダー→files参照変化→
  // sandpack-react内部のuseFilesが`useEffect([props.files,...])`で内部stateをprops.filesへ
  // 巻き戻す、という無限ループになり「入力してもすぐ消える」バグを引き起こしていた
  // (sandpack-react/dist/index.js useFiles参照)。template/workspaceの参照は
  // useDevLabWorkspaceDetailのload()時のみ変わるため、これを依存にすることで
  // 自動保存等の派生state更新では再生成されなくなる。
  const initialFiles = useMemo(
    () => (template ? buildInitialSandpackFiles(template.files, workspace?.overlay, workspace?.deletedPaths) : {}),
    [template, workspace],
  );
  const readmeContent = useMemo(() => extractReadmeContent(template?.files), [template]);

  function handleSandpackChange(overlay, deletedPaths) {
    // マウント直後（テンプレ既定と一致=差分なし）は保存不要。実際に編集が入った時だけdirty化する。
    if (Object.keys(overlay).length === 0 && deletedPaths.length === 0) return;
    setPending({ overlay, deletedPaths });
    setSaveState("dirty");
    clearSaveError();
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      doSave(overlay, deletedPaths);
    }, 3000);
  }

  async function doSave(overlay, deletedPaths) {
    setSaveState("saving");
    try {
      await save(templateId, overlay, deletedPaths);
      setSaveState("saved");
    } catch (e) {
      setSaveState("dirty");
    }
  }

  function handleManualSave() {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    if (pending) doSave(pending.overlay, pending.deletedPaths);
  }

  async function handleReset() {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    await reset(templateId);
    setResetConfirm(false);
    setPending(null);
    setSaveState("idle");
    await reload();
  }

  function runScenario(scenario) {
    setActiveScenario(scenario.command);
    setConsoleLines([]);
    const lines = String(scenario.output || "").split("\n");
    lines.forEach((line, i) => {
      setTimeout(() => setConsoleLines(prev => [...prev, line]), i * 120);
    });
  }

  if (loading) return <Card><SkeletonRows rows={4} /></Card>;
  if (error || !template) {
    return (
      <Card className="p-5">
        <p className="text-sm" style={{ color: T.danger }}>{error || "テンプレートが見つかりません。"}</p>
        <Btn kind="ghost" size="sm" className="mt-2" onClick={onBack}>一覧に戻る</Btn>
      </Card>
    );
  }

  const isSpring = template.stack === "spring_sim";
  const activeFile = template.entryHint ? withLeadingSlash(template.entryHint) : undefined;
  const scenarios = template.simulatedRun?.scenarios || [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <button type="button" onClick={onBack} className="text-xs font-semibold" style={{ color: T.textMuted }}>
          <ArrowLeft size={12} className="mr-1 inline" />{backLabel || "一覧へ戻る"}
        </button>
        <div className="flex items-center gap-2">
          <SaveStatusBadge state={saveState} />
          <Btn kind="ghost" size="sm" icon={Save} disabled={saveState !== "dirty" && saveState !== "saving"} onClick={handleManualSave}>保存</Btn>
          {!resetConfirm ? (
            <Btn kind="ghost" size="sm" icon={RefreshCcw} onClick={() => setResetConfirm(true)}>リセット</Btn>
          ) : (
            <>
              <span className="text-xs" style={{ color: T.danger }}>編集内容を破棄して初期状態に戻しますか？</span>
              <Btn kind="danger" size="sm" onClick={handleReset}>リセットする</Btn>
              <Btn kind="ghost" size="sm" onClick={() => setResetConfirm(false)}>キャンセル</Btn>
            </>
          )}
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold" style={{ color: T.textPrimary }}>{template.title}</h2>
          <Badge tone={isSpring ? "amber" : "cyan"}>{devLabWorkspaceStackLabel(template.stack)}</Badge>
        </div>
        <p className="mt-1 text-xs" style={{ color: T.textSecondary }}>{template.description}</p>
      </div>

      <ReadmePanel content={readmeContent} />

      {saveError && <Card className="mb-3 p-3"><p className="text-xs" style={{ color: T.danger }}>{saveError}</p></Card>}

      <SandpackProvider
        template={isSpring ? "static" : "react"}
        theme={SANDPACK_THEME}
        files={initialFiles}
        options={{
          visibleFiles: Object.keys(initialFiles),
          activeFile: activeFile && initialFiles[activeFile] ? activeFile : undefined,
          autorun: !isSpring,
          autoReload: !isSpring,
          recompileMode: "delayed",
          recompileDelay: 500,
        }}
      >
        <SandpackChangeWatcher onChange={handleSandpackChange} />
        {/*
          レイアウト(2026-07-22実機フィードバック): [ツリー|エディタ|プレビュー]の3カラムだと
          エディタが狭い。上段=[ファイルツリー|エディタ(広く)]・下段=実行結果(プレビュー/疑似
          コンソール)の上下2段構成へ変更。SandpackLayoutは単なるflexラッパーで、同一
          SandpackProvider配下であれば複数回使ってよい(状態は全てProviderが持つ)ため、
          上段用・下段用で2つに分けている。
        */}
        <SandpackLayout style={{ borderRadius: 16, border: `1px solid ${T.border}` }}>
          {/*
            ファイルツリー幅対応(2026-07-22実機フィードバック): 既定のflex:0.2/minWidth:200pxだと
            Java系の深い階層でファイル名が「co…」のように省略され読めない。要素へ渡すstyleは
            SandpackLayoutが敷く`.sp-layout > .sp-file-explorer`のflex指定より優先される(インライン
            styleは同要素のstylesheetルールに勝つ)ため、ここでflex-basisを広げつつ、CSSの
            resizeプロパティでユーザーがドラッグして幅を調整できるようにする(1440px想定で
            エディタとのバランスを保ちつつ既定でも広め)。
          */}
          <SandpackFileExplorer
            style={{
              height: 560,
              flex: "0 0 260px",
              minWidth: 220,
              maxWidth: 480,
              width: 260,
              resize: "horizontal",
              overflow: "auto",
            }}
          />
          <SandpackCodeEditor style={{ height: 560 }} showTabs showLineNumbers showInlineErrors closableTabs />
        </SandpackLayout>
        {!isSpring && (
          <SandpackLayout style={{ marginTop: 12, borderRadius: 16, border: `1px solid ${T.border}` }}>
            <SandpackPreview
              style={{ height: 340, minHeight: 220, resize: "vertical", overflow: "auto" }}
              showNavigator
              showRefreshButton
            />
          </SandpackLayout>
        )}
      </SandpackProvider>
      {!isSpring && (
        <p className="mt-2 text-xs leading-relaxed" style={{ color: T.textMuted }}>
          「Open Sandbox」でCodeSandbox（外部サイト）を開くことができますが、そちらでの編集内容はこのアプリには保存・反映されません。提出に使うコードは必ずこの画面内のエディタで編集してください。
        </p>
      )}

      {isSpring && (
        <Card className="mt-4 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Terminal size={14} style={{ color: T.textMuted }} />
            <h3 className="text-sm font-bold" style={{ color: T.textPrimary }}>疑似コンソール</h3>
          </div>
          <p className="mb-3 text-xs" style={{ color: T.textMuted }}>
            ブラウザ上でJava/Spring Bootを実際に起動することはできないため、想定コマンドと実行結果の台本を再生して動作イメージを確認します。
          </p>
          <div className="flex flex-wrap gap-2">
            {scenarios.map(s => (
              <Btn key={s.command} kind={activeScenario === s.command ? "primary" : "ghost"} size="sm" icon={Play} onClick={() => runScenario(s)}>
                {s.label}
              </Btn>
            ))}
          </div>
          <pre
            className="mt-3 max-h-64 overflow-auto rounded-xl p-3 text-xs leading-relaxed"
            style={{ background: "#151A2C", color: "#ECEDEF", fontFamily: SANDPACK_THEME.font.mono }}
          >
            {consoleLines.length === 0 ? "実行したいコマンドを選択してください。" : consoleLines.join("\n")}
          </pre>
        </Card>
      )}
    </div>
  );
}

// ===================== チーム開発: 自分のブランチで作業する（Step3、2026-08-18新設） =====================
// docs/specs/dev-team-spec.md。既存のWorkspaceDetailと同じSandpack構成に、
// pull（取り込み）／commit（mainへ反映）とコミット履歴を足したもの。
// 衝突はサーバ側の3-wayマージがGit標準マーカーでファイルへ埋め込むため、受講生は
// エディタ上でマーカーを消しながら解決する（実際のGitと同じ操作感）。
function CommitHistory({ commits, myTraineeId }) {
  if (!commits?.length) {
    return <p className="text-xs" style={{ color: T.textMuted }}>まだコミットがありません。最初の変更をコミットしてみましょう。</p>;
  }
  return (
    <ol className="space-y-1.5">
      {[...commits].reverse().map(c => (
        <li key={c.commitId} className="flex items-start gap-2 text-xs">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.authorType === "ai" ? T.warning : T.accent }} />
          <span className="min-w-0">
            <span className="font-semibold" style={{ color: T.textPrimary }}>{c.message}</span>
            <span className="ml-1.5" style={{ color: T.textMuted }}>
              {c.authorName}{c.roleName ? `（${c.roleName}）` : ""}
              {c.authorId === myTraineeId ? " ・ あなた" : ""}
            </span>
            {c.changedPaths?.length > 0 && (
              <span className="ml-1.5" style={{ color: T.textMuted }}>／ {c.changedPaths.join(", ")}</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function TeamBranchWorkspace({ teamId, onBack }) {
  const { data, loading, error, reload } = useDevLabTeamDetail(teamId);
  const { saveBranch, pull, commit, busy, actionError, clearActionError } = useDevLabTeamActions(teamId);
  const [files, setFiles] = useState(null);       // 現在の作業ファイル（サーバ由来 or pull結果）
  const [saveState, setSaveState] = useState("idle");
  const [pullResult, setPullResult] = useState(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [needsPull, setNeedsPull] = useState(false);
  const [notice, setNotice] = useState("");
  const [editorKey, setEditorKey] = useState(0); // pull後にエディタを作り直すためのkey
  const autosaveTimer = useRef(null);
  const latestFiles = useRef(null);

  useEffect(() => () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); }, []);
  useEffect(() => {
    if (data?.workingFiles) {
      setFiles(data.workingFiles);
      latestFiles.current = data.workingFiles;
    }
  }, [data]);

  const initialFiles = useMemo(() => {
    if (!files) return {};
    const out = {};
    for (const [path, content] of Object.entries(files)) out[withLeadingSlash(path)] = { code: content };
    return out;
  }, [files, editorKey]);

  function handleChange(overlay, deletedPaths) {
    if (!latestFiles.current) return;
    if (Object.keys(overlay).length === 0 && deletedPaths.length === 0) return;
    const next = { ...latestFiles.current, ...overlay };
    for (const p of deletedPaths) delete next[p];
    latestFiles.current = next;
    setSaveState("dirty");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      setSaveState("saving");
      try { await saveBranch(next); setSaveState("saved"); } catch { setSaveState("dirty"); }
    }, 3000);
  }

  async function handlePull() {
    clearSaveTimer();
    setNotice(""); clearSaveError();
    try {
      // 未保存の変更を先に確定させてからpullする（保存前の編集が消えないように）
      if (latestFiles.current && saveState === "dirty") await saveBranch(latestFiles.current);
      const res = await pull();
      setFiles(res.files);
      latestFiles.current = res.files;
      setPullResult(res);
      setNeedsPull(false);
      setSaveState("saved");
      setEditorKey(k => k + 1);
      await reload();
    } catch { /* actionErrorに出る */ }
  }

  async function handleCommit() {
    if (!commitMessage.trim() || !latestFiles.current) return;
    clearSaveTimer();
    setNotice(""); clearSaveError();
    try {
      const res = await commit(commitMessage.trim(), latestFiles.current);
      setCommitMessage("");
      setPullResult(null);
      setNeedsPull(false);
      setSaveState("saved");
      setNotice(`コミットしました: ${res.commit.message}`);
      await reload();
    } catch (e) {
      if (e?.status === 409 || e?.data?.needsPull) setNeedsPull(true);
    }
  }

  function clearSaveTimer() { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); }
  function clearSaveError() { clearActionError(); }

  if (loading) return <Card><SkeletonRows rows={4} /></Card>;
  if (error || !data?.team) {
    return (
      <Card className="p-5">
        <p className="text-sm" style={{ color: T.danger }}>{error || "チームが見つかりません。"}</p>
        <Btn kind="ghost" size="sm" className="mt-2" onClick={onBack}>一覧に戻る</Btn>
      </Card>
    );
  }

  const team = data.team;
  const isSpring = team.stack === "spring_sim";
  const activeFile = team.entryHint ? withLeadingSlash(team.entryHint) : undefined;
  const myMember = (team.members || []).find(m => m.traineeId === data.myTraineeId) || null;
  const myRole = (team.roles || []).find(r => r.roleId === myMember?.roleId) || null;
  const hasConflicts = (pullResult?.conflictPaths || []).length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <button type="button" onClick={onBack} className="text-xs font-semibold" style={{ color: T.textMuted }}>
          <ArrowLeft size={12} className="mr-1 inline" />チーム一覧へ戻る
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <SaveStatusBadge state={saveState} />
          <Btn kind="ghost" size="sm" icon={busy ? Loader2 : GitPullRequest} disabled={busy} onClick={handlePull}>
            取り込む（pull）
          </Btn>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-bold" style={{ color: T.textPrimary }}>{team.title}</h2>
          <Badge tone={isSpring ? "amber" : "cyan"}>{devLabWorkspaceStackLabel(team.stack)}</Badge>
          {myRole && <Badge tone="green">あなた: {myRole.name}</Badge>}
        </div>
        {myRole?.description && <p className="mt-1 text-xs" style={{ color: T.textSecondary }}>{myRole.description}</p>}
        {myRole?.ownedPaths?.length > 0 && (
          <p className="mt-0.5 text-xs" style={{ color: T.textMuted }}>担当ファイル: {myRole.ownedPaths.join(", ")}</p>
        )}
      </div>

      {actionError && <Card className="mb-3 p-3"><p className="text-xs" style={{ color: T.danger }}>{actionError}</p></Card>}
      {notice && <Card className="mb-3 p-3"><p className="text-xs" style={{ color: T.success }}>{notice}</p></Card>}
      {needsPull && (
        <Card className="mb-3 p-3" style={{ background: T.warningSubtle }}>
          <p className="text-xs" style={{ color: T.warning }}>
            他のメンバーの変更が先に入っています。「取り込む（pull）」を実行してから、もう一度コミットしてください。
          </p>
        </Card>
      )}

      {pullResult && (
        <Card className="mb-3 p-4">
          <h3 className="mb-2 text-sm font-bold" style={{ color: T.textPrimary }}>取り込み結果</h3>
          {(pullResult.newCommits || []).length > 0 ? (
            <ul className="mb-2 space-y-0.5">
              {pullResult.newCommits.map((c, i) => (
                <li key={i} className="text-xs" style={{ color: T.textSecondary }}>
                  ・{c.authorName}{c.roleName ? `（${c.roleName}）` : ""}: {c.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-2 text-xs" style={{ color: T.textMuted }}>新しい変更はありませんでした。</p>
          )}
          {hasConflicts ? (
            <div className="rounded-xl p-3" style={{ background: T.dangerSubtle }}>
              <p className="text-xs font-bold" style={{ color: T.danger }}>
                コンフリクト（衝突）が {pullResult.conflictPaths.length} 件あります: {pullResult.conflictPaths.join(", ")}
              </p>
              <p className="mt-1 text-xs" style={{ color: T.textSecondary }}>
                該当ファイルに <code>{"<<<<<<<"}</code> / <code>=======</code> / <code>{">>>>>>>"}</code> のマーカーが入っています。
                どちらを残すか決めて、マーカーの行ごと消してから保存・コミットしてください。
              </p>
            </div>
          ) : (
            <p className="text-xs" style={{ color: T.success }}>
              衝突はありませんでした
              {(pullResult.mergedPaths || []).length > 0 && `（${pullResult.mergedPaths.length}件は自動で統合されました）`}。
            </p>
          )}
        </Card>
      )}

      <SandpackProvider
        key={editorKey}
        template={isSpring ? "static" : "react"}
        theme={SANDPACK_THEME}
        files={initialFiles}
        options={{
          visibleFiles: Object.keys(initialFiles),
          activeFile: activeFile && initialFiles[activeFile] ? activeFile : undefined,
          autorun: !isSpring,
          autoReload: !isSpring,
          recompileMode: "delayed",
          recompileDelay: 500,
        }}
      >
        <SandpackChangeWatcher onChange={handleChange} />
        <SandpackLayout style={{ borderRadius: 16, border: `1px solid ${T.border}` }}>
          <SandpackFileExplorer style={{ height: 520, flex: "0 0 260px", minWidth: 220, maxWidth: 480, width: 260, resize: "horizontal", overflow: "auto" }} />
          <SandpackCodeEditor style={{ height: 520 }} showTabs showLineNumbers showInlineErrors closableTabs />
        </SandpackLayout>
        {!isSpring && (
          <SandpackLayout style={{ marginTop: 12, borderRadius: 16, border: `1px solid ${T.border}` }}>
            <SandpackPreview style={{ height: 300, minHeight: 200, resize: "vertical", overflow: "auto" }} showNavigator showRefreshButton />
          </SandpackLayout>
        )}
      </SandpackProvider>

      <Card className="mt-3 p-4">
        <h3 className="mb-2 text-sm font-bold" style={{ color: T.textPrimary }}>コミットする</h3>
        <div className="flex flex-wrap items-center gap-2">
          <input
            style={{ ...fieldStyle, flex: 1, minWidth: 240 }}
            placeholder="コミットメッセージ（例: 予約の削除機能を実装）"
            value={commitMessage}
            onChange={e => setCommitMessage(e.target.value)}
          />
          <Btn icon={busy ? Loader2 : GitCommitHorizontal} disabled={busy || !commitMessage.trim() || hasConflicts} onClick={handleCommit}>
            コミット
          </Btn>
        </div>
        {hasConflicts && (
          <p className="mt-1.5 text-xs" style={{ color: T.danger }}>衝突を解決するまでコミットできません。</p>
        )}
      </Card>

      <Card className="mt-3 p-4">
        <div className="mb-2 flex items-center gap-2">
          <GitBranchIcon size={14} style={{ color: T.textMuted }} />
          <h3 className="text-sm font-bold" style={{ color: T.textPrimary }}>コミット履歴</h3>
        </div>
        <CommitHistory commits={team.commits} myTraineeId={data.myTraineeId} />
      </Card>

      <Card className="mt-3 p-4">
        <h3 className="mb-2 text-sm font-bold" style={{ color: T.textPrimary }}>チームメンバー</h3>
        <div className="flex flex-wrap gap-2">
          {(team.members || []).map(m => {
            const r = (team.roles || []).find(x => x.roleId === m.roleId);
            return (
              <span key={m.traineeId} className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: T.accentSubtle, color: T.accentHover }}>
                {m.traineeName}{r ? `（${r.name}）` : ""}
              </span>
            );
          })}
          {(team.aiSeats || []).map(s => {
            const r = (team.roles || []).find(x => x.roleId === s.roleId);
            return (
              <span key={s.memberId} className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: T.warningSubtle, color: T.warning }}>
                {s.name}{r ? `（${r.name}）` : ""} ・ AI
              </span>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function SaveStatusBadge({ state }) {
  if (state === "saving") return <Badge tone="cyan"><Loader2 size={11} className="animate-spin" />保存中…</Badge>;
  if (state === "dirty") return <Badge tone="amber">未保存の変更</Badge>;
  if (state === "saved") return <Badge tone="green">保存済み</Badge>;
  return <Badge tone="muted">変更なし</Badge>;
}
