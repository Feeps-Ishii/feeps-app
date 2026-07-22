import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SandpackProvider, SandpackLayout, SandpackFileExplorer, SandpackCodeEditor, SandpackPreview, useSandpack,
} from "@codesandbox/sandpack-react";
import {
  ArrowLeft, Code2, FolderTree, Loader2, Play, RefreshCcw, Save, Terminal,
} from "lucide-react";
import {
  Badge, Btn, Card, EmptyState, SectionHead, SkeletonRows, T,
} from "../../components/common";
import { devLabLevelLabel, devLabMyStatusLabel, devLabMyStatusTone, devLabWorkspaceStackLabel } from "./DevLabCatalog.js";
import {
  useDevLabWorkspaceTemplates, useDevLabWorkspaceDetail, useDevLabWorkspaceActions,
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
        <SandpackLayout style={{ borderRadius: 16, border: `1px solid ${T.border}` }}>
          {/*
            ファイルツリー幅対応(2026-07-22実機フィードバック): 既定のflex:0.2/minWidth:200pxだと
            Java系の深い階層でファイル名が「co…」のように省略され読めない。要素へ渡すstyleは
            SandpackLayoutが敷く`.sp-layout > .sp-file-explorer`のflex指定より優先される(インライン
            styleは同要素のstylesheetルールに勝つ)ため、ここでflex-basisを広げつつ、CSSの
            resizeプロパティでユーザーがドラッグして幅を調整できるようにする(1440px想定で
            エディタ/プレビューとのバランスを保ちつつ既定でも広め)。
          */}
          <SandpackFileExplorer
            style={{
              height: 480,
              flex: "0 0 260px",
              minWidth: 220,
              maxWidth: 480,
              width: 260,
              resize: "horizontal",
              overflow: "auto",
            }}
          />
          <SandpackCodeEditor style={{ height: 480 }} showTabs showLineNumbers showInlineErrors closableTabs />
          {!isSpring && <SandpackPreview style={{ height: 480 }} showNavigator showRefreshButton showOpenInCodeSandbox={false} />}
        </SandpackLayout>
      </SandpackProvider>

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

function SaveStatusBadge({ state }) {
  if (state === "saving") return <Badge tone="cyan"><Loader2 size={11} className="animate-spin" />保存中…</Badge>;
  if (state === "dirty") return <Badge tone="amber">未保存の変更</Badge>;
  if (state === "saved") return <Badge tone="green">保存済み</Badge>;
  return <Badge tone="muted">変更なし</Badge>;
}
