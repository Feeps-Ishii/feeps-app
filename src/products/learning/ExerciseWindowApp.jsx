import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Play, RotateCcw, Smartphone } from "lucide-react";
import { T } from "../../components/common";
import JavaEditor from "./JavaEditor.jsx";
import WebEditor from "./WebEditor.jsx";
import { parseJavacError } from "./javaEditorSupport.js";
import { previewDocument, runWebChecks } from "./webChecks.js";
import { MSG, openChannel, send } from "./exerciseChannel.js";

// 2026-09-04: 従（演習ウィンドウ）側。**認証も合否の記録も持たない。**
// 課題は主から受け取り、書いたものは主へ返す。実行も主に頼む（ADR 0021）。
//
// ここが単独で動くことはない。主が居なければ、何も表示せず閉じるよう促す。

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const NARROW_W = 390;

export default function ExerciseWindowApp() {
  const [state, setState] = useState(null);
  const [lost, setLost] = useState(false);
  const chRef = useRef(null);
  const frameRef = useRef(null);
  const narrowRef = useRef(null);
  const [checks, setChecks] = useState([]);

  const id = useMemo(() => new URLSearchParams(location.search).get("ch") || "", []);

  useEffect(() => {
    const ch = openChannel(id);
    if (!ch) { setLost(true); return undefined; }
    chRef.current = ch;
    ch.onmessage = (e) => {
      const { type, payload } = e.data || {};
      if (type === MSG.STATE) { setState(payload); return; }
      if (type === MSG.CLOSE) { window.close(); return; }
    };
    send(ch, MSG.HELLO);
    // 主が居ないまま開かれた場合（URLを直接叩いた等）は、そう言って終わる
    const t = setTimeout(() => setLost(v => (v ? v : !document.title.startsWith("演習"))), 2500);
    const bye = () => send(ch, MSG.BYE);
    window.addEventListener("pagehide", bye);
    return () => { clearTimeout(t); window.removeEventListener("pagehide", bye); try { ch.close(); } catch (err) { /* 済 */ } };
  }, [id]);

  useEffect(() => {
    if (state?.title) document.title = `演習 — ${state.title}`;
  }, [state]);

  const isWeb = state?.kind === "web_run";
  const files = state?.files || {};
  const activeFile = state?.activeFile || (isWeb ? "index.html" : state?.mainName);

  const edit = useCallback((next) => {
    setState(s => ({ ...s, files: { ...s.files, ...next } }));
    send(chRef.current, MSG.EDIT, { files: next });
  }, []);

  const srcDoc = useMemo(() => (isWeb ? previewDocument(files) : ""), [isWeb, files]);
  const needsNarrow = useMemo(
    () => (state?.checks || []).some(c => c.at === "narrow"),
    [state],
  );

  // 表示の確認は、描いたこの窓でしか測れない。**測った結果は主へ返し、記録は主が行う。**
  const evaluate = useCallback(() => {
    if (!isWeb) return;
    const doc = frameRef.current?.contentDocument || null;
    if (!doc) return;
    const narrowDoc = needsNarrow ? (narrowRef.current?.contentDocument || null) : doc;
    const next = runWebChecks(state?.checks || [], { doc, narrowDoc, files });
    setChecks(next);
    send(chRef.current, MSG.EDIT, { files, checks: next });
  }, [isWeb, needsNarrow, state, files]);

  useEffect(() => {
    if (!isWeb) return undefined;
    const t = setTimeout(evaluate, 240);
    return () => clearTimeout(t);
  }, [srcDoc, isWeb, evaluate]);

  if (lost) {
    return (
      <Frame>
        <p className="text-sm" style={{ color: C.body }}>
          講義ウィンドウとつながっていません。この窓を閉じて、講義の画面から開き直してください。
        </p>
      </Frame>
    );
  }
  if (!state) {
    return (
      <Frame>
        <span className="flex items-center gap-2 text-sm" style={{ color: C.muted }}>
          <Loader2 size={15} className="animate-spin" />講義ウィンドウから課題を受け取っています…
        </span>
      </Frame>
    );
  }

  const result = state.result;
  const diagnostic = result && !result.compiled ? parseJavacError(result.compileError) : null;
  const done = isWeb && checks.length > 0 && checks.every(c => c.ok);

  return (
    <div className="min-h-screen" style={{ background: C.canvas }}>
      <header className="flex flex-wrap items-center gap-3 px-5 py-3" style={{ background: "#fff", borderBottom: `1px solid ${C.line}` }}>
        <span className="text-[10.5px] font-extrabold" style={{ color: T.accent, letterSpacing: "0.1em" }}>演習ウィンドウ</span>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold" style={{ color: C.ink }}>{state.title}</span>
        <span className="flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: T.success }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: T.success }} />講義ウィンドウと接続中
        </span>
      </header>

      <main className="mx-auto max-w-[1400px] p-5">
        {state.task && (
          <div className="mb-4 rounded-xl p-4" style={{ background: "#fff", border: `1px solid ${C.line}`, borderLeft: `3px solid ${T.accent}` }}>
            <div className="mb-1.5 text-[10.5px] font-extrabold" style={{ color: T.accent, letterSpacing: "0.1em" }}>やること</div>
            <p className="m-0 text-[14.5px] font-bold leading-[1.75]" style={{ color: C.ink }}>{state.task}</p>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${C.line}`, background: "#fff" }}>
          <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5" style={{ background: C.canvas, borderBottom: `1px solid ${C.line}` }}>
            {(state.fileNames || [activeFile]).map(name => (
              <button key={name} type="button"
                onClick={() => { setState(s => ({ ...s, activeFile: name })); send(chRef.current, MSG.EDIT, { activeFile: name }); }}
                aria-current={activeFile === name}
                className="rounded-lg px-2.5 py-1.5 text-[11.5px] transition hover:bg-black/[.04]"
                style={{
                  fontFamily: MONO,
                  color: activeFile === name ? T.accentHover : C.body,
                  background: activeFile === name ? T.accentSubtle : "transparent",
                  fontWeight: activeFile === name ? 700 : 400,
                }}>
                {name}
              </button>
            ))}
            <span className="ml-auto flex items-center gap-2">
              {state.canReset && (
                <button type="button" onClick={() => send(chRef.current, MSG.EDIT, { reset: true })}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition hover:bg-black/[.04]"
                  style={{ border: `1px solid ${C.line}`, color: C.muted }}>
                  <RotateCcw size={12} />最初に戻す
                </button>
              )}
              {!isWeb && (
                <button type="button" onClick={() => send(chRef.current, MSG.RUN)} disabled={state.running}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: T.accent }}>
                  {state.running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  {state.running ? "実行中…" : "実行する"}
                </button>
              )}
            </span>
          </div>

          <div className={isWeb ? "grid lg:grid-cols-2" : ""}>
            <div style={isWeb ? { borderRight: `1px solid ${C.line}` } : undefined}>
              {isWeb ? (
                <WebEditor
                  key={activeFile}
                  mode={activeFile === "style.css" ? "css" : "html"}
                  value={files[activeFile] || ""}
                  onChange={v => edit({ [activeFile]: v })}
                  level={state.completionLevel || 1}
                  maxHeight={560}
                />
              ) : (
                <JavaEditor
                  key={activeFile}
                  value={files[activeFile] || ""}
                  onChange={v => edit({ [activeFile]: v })}
                  readOnly={activeFile !== state.mainName}
                  diagnostic={diagnostic && diagnostic.file === activeFile ? diagnostic : null}
                  level={state.completionLevel || 1}
                  onRun={() => send(chRef.current, MSG.RUN)}
                />
              )}
            </div>

            {isWeb && (
              <div className="min-w-0">
                <div className="px-3.5 py-2 text-[10.5px] font-extrabold" style={{ background: C.canvas, borderBottom: `1px solid ${C.line}`, color: C.muted, letterSpacing: "0.08em" }}>
                  ブラウザでの見え方
                </div>
                <iframe ref={frameRef} title="書いたページの表示" srcDoc={srcDoc} onLoad={evaluate}
                  sandbox="allow-same-origin" className="block w-full border-0" style={{ height: 420, background: "#fff" }} />
                {needsNarrow && (
                  <>
                    <div className="flex items-center gap-1.5 px-3.5 py-2 text-[10.5px] font-extrabold" style={{ background: C.canvas, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, color: C.muted, letterSpacing: "0.08em" }}>
                      <Smartphone size={11} />スマホの幅（{NARROW_W}px）
                    </div>
                    <div className="overflow-x-auto p-3" style={{ background: C.canvas }}>
                      <iframe ref={narrowRef} title="スマホの幅での表示" srcDoc={srcDoc} onLoad={evaluate}
                        sandbox="allow-same-origin" className="block border-0"
                        style={{ width: NARROW_W, height: 300, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10 }} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${C.line}` }}>
            {isWeb ? (
              <>
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-extrabold"
                  style={{ background: C.canvas, borderBottom: `1px solid ${C.line}`, color: done ? T.success : C.body, letterSpacing: "0.05em" }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: done ? T.success : C.muted }} />
                  {done ? `できました（${checks.length} / ${checks.length}）` : `表示の確認（${checks.filter(c => c.ok).length} / ${checks.length}）`}
                  {done && <CheckCircle2 size={14} />}
                </div>
                <ul className="m-0 list-none p-3.5">
                  {checks.map((r, i) => (
                    <li key={i} className="flex items-start gap-2.5 py-1.5">
                      <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
                        style={{ background: r.ok ? T.successSubtle : "transparent", border: r.ok ? "none" : `1px solid ${C.line}`, color: T.success }}>
                        {r.ok ? "✓" : ""}
                      </span>
                      <span className="min-w-0">
                        <span className="text-[13px] font-bold" style={{ color: r.ok ? C.ink : C.body }}>{r.label}</span>
                        {r.why && <span className="ml-2 text-[11.5px]" style={{ fontFamily: MONO, color: C.muted }}>{r.why}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <div className="px-3.5 py-2.5 text-[11.5px] font-extrabold" style={{ background: C.canvas, borderBottom: `1px solid ${C.line}`, color: C.body, letterSpacing: "0.05em" }}>
                  {result ? (result.compiled ? "実行しました" : "コンパイルできませんでした") : "まだ実行していません"}
                </div>
                <pre className="m-0 overflow-x-auto px-4 py-3.5 text-[12px] leading-[1.8]"
                  style={{ fontFamily: MONO, color: C.body, minHeight: 72, whiteSpace: "pre" }}>
                  {!result && "実行するとここに結果が出ます。"}
                  {result && !result.compiled && (result.compileError || "")}
                  {result && result.compiled && (result.stdout || "")}
                  {result && result.compiled && result.stderr ? `\n${result.stderr}` : ""}
                </pre>
              </>
            )}
          </div>
        </div>

        {/* 質問はこちらでは受けない。**認証を従に持たせない**ため（ADR 0021）。 */}
        <p className="mt-3 flex items-center gap-1.5 text-[12px]" style={{ color: C.muted }}>
          <ExternalLink size={12} />
          解説とAIへの質問は、講義ウィンドウ側に出ています。合否もそちらに記録されます。
        </p>
      </main>
    </div>
  );
}

function Frame({ children }) {
  return (
    <div className="grid min-h-screen place-items-center p-8" style={{ background: C.canvas }}>
      <div className="max-w-md rounded-2xl p-6 text-center" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
        {children}
      </div>
    </div>
  );
}
