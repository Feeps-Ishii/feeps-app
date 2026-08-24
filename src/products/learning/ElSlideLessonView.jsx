import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Lightbulb, FileText, Download, Check, X,
  Play, PlayCircle, Circle, CheckCircle2, Loader2, Sparkles, PanelRightClose, PanelRightOpen,
  Clock, HelpCircle, AlertCircle,
} from "lucide-react";
import { Btn, T, PRODUCT_ACCENT } from "../../components/common";
import { LessonBodyText } from "./LearningComponents.jsx";
import SlideIllustration from "./SlideIllustrations.jsx";
import LearningExperienceFlow, { learningStageForSlide } from "./LearningExperienceFlow.jsx";
// スライド下の読み物（要約とノート）と読み上げ。2026-08-21に別ファイルへ切り出した。
import { SlideNarration, SlideNote } from "./SlideNarrationBlocks.jsx";
import SlideQuestionBox from "./SlideQuestionBox.jsx";
import LecturePlayer from "./LecturePlayer.jsx";
import SlideFocusLayer from "./SlideFocusLayer.jsx";
import SlideFigure from "./SlideFigures.jsx";
import { AgendaSlide, ChapterSlide, ColumnsSlide, HookSlide, RoleCallouts, SlideEyebrowText, StepsSlide, WorkSlide } from "./SlideLayouts.jsx";

// slidesを持つLesson専用の「メインスライド中心」表示。lesson.slides?.length > 0 の場合のみ
// ElLessonView.jsx からこのコンポーネントへ分岐する（既存のvideo/text/quiz Lessonはこのファイルを
// 一切経由しない）。UIモック(products/learning/mock/LessonPreviewMock.jsx)で検証した構成を踏襲しつつ、
// 実データ（course.color, lrn の各種Hook）に接続している。
// terminalの interaction はPhase1では本物のコード実行を行わないフロント内デモ動作のまま
// （判定はクライアント内、2026-07-21よりPOST /learning/exercises/submitで結果を永続化）。
// quizのinteraction.type: "choice"(デフォルト、選択式、フロント内で完結) / "descriptive"(自由記述、
// 2026-07-21よりPOST /learning/exercises/submitでBackendがBedrock採点・教材根拠付きフィードバックを
// 生成し提出とともに永続化する。修了判定には使わない自己学習用フィードバック)。

const C = {
  ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase,
};

// ---- スライドの見せ方（2026-08-20刷新。承認モック: mock/slide-design） ----
// 旧UIは全kindが「白い箱・黒い見出し・グレー本文」で、種別の違いが見た目に出ず質素だった。
// またAIが生成しているcalloutsを一切描画していなかった。ここで:
//   ・種別ごとの色と小さなラベル＋通し番号を出す
//   ・見出しと本文のサイズ差を広げ、行長を制限する（旧: 1行50字近くまで伸びていた）
//   ・calloutsを描画する
//   ・conceptとsummaryに抽象SVGの図版帯を添える（AIは8種から選ぶだけ。画像生成はしない）
const SLIDE_KIND_TONE = {
  concept: { label: "説明", fg: T.accent },
  diagram: { label: "図解", fg: "#176B67" },
  table: { label: "くらべる", fg: "#176B67" },
  compare: { label: "くらべる", fg: "#176B67" },
  quiz: { label: "確認", fg: T.aiAccentDeep },
  summary: { label: "まとめ", fg: T.success },
  image: { label: "図版", fg: T.accent },
  video: { label: "動画", fg: T.accent },
  terminal: { label: "演習", fg: T.aiAccentDeep },
  selection_task: { label: "演習", fg: T.aiAccentDeep },
  ordering_puzzle: { label: "演習", fg: T.aiAccentDeep },
  fill_blank: { label: "演習", fg: T.aiAccentDeep },
  interactive_form: { label: "演習", fg: T.aiAccentDeep },
};

function SlideEyebrow({ kind, index, total }) {
  const tone = SLIDE_KIND_TONE[kind] || SLIDE_KIND_TONE.concept;
  return (
    <div className="mb-2.5 flex items-center gap-2 text-[11.5px] font-bold" style={{ color: tone.fg, letterSpacing: "0.08em" }}>
      <span>{tone.label}</span>
      {Number.isInteger(index) && Number.isInteger(total) && (
        <span style={{ color: C.muted, fontWeight: 600 }}>・{String(index + 1).padStart(2, "0")}</span>
      )}
    </div>
  );
}

function SlideTitle({ children }) {
  return (
    <h3 className="mb-4 text-[26px] font-bold leading-[1.4]" style={{ color: C.ink, letterSpacing: "-0.025em" }}>{children}</h3>
  );
}

// AIが生成しているのに従来は捨てていた強調。左ボーダー1本ではなく淡い面で出す。
function Callouts({ items }) {
  if (!items?.length) return null;
  return (
    <div className="mt-4 space-y-2">
      {items.map((c, i) => {
        const warn = c.type === "warning";
        const fg = warn ? T.warning : T.accent;
        const bg = warn ? T.warningSubtle : T.accentSubtle;
        const Icon = warn ? AlertCircle : Lightbulb;
        return (
          <div key={i} data-focus={`callout-${i}`} className="flex items-start gap-2.5 rounded-2xl p-3.5" style={{ background: bg }}>
            <Icon size={17} className="mt-0.5 shrink-0" style={{ color: fg }} />
            <div>
              <div className="mb-0.5 text-[12px] font-bold" style={{ color: fg }}>{warn ? "注意" : "ポイント"}</div>
              <div className="text-sm leading-[1.75]" style={{ color: C.ink }}>{c.text}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 2026-08-20(v2): **本文スライドの横には挿絵を置かない。**
// 長い本文やコードブロックの隣に絵があると必ずバランスが崩れる（実機で指摘を受けた）。
// 挿絵は表紙(SlideCover)と中扉(SlideDivider)へ集約し、本文は文字と図表だけにする。
//
// 本文の幅は段落・コード・表で揃える。段落だけに行長制限をかけると右端がギザギザになり、
// 「余白が中途半端」に見える。列全体を1つの幅に収めれば、余白は意図的な余白として読める。
const CONTENT_COLUMN = 720;

function ContentColumn({ children }) {
  return <div style={{ maxWidth: CONTENT_COLUMN }}>{children}</div>;
}

// ---- 表紙と中扉（2026-08-20 v2新設。承認モック: mock/slide-design の 提案v2） ----
//
// どちらも**保存されたスライドではなく、表示時に組み立てる合成スライド**。
// レッスンのtitle/goalと既存の学習ステージ判定(learningStageForSlide)から作れるので、
// AI生成も、既存教材のデータ移行も要らない。
const STAGE_VISUAL = {
  explanation: { label: "短い説明", lead: "まずは要点をつかみます。", fg: T.accent, tint: T.accentSubtle, illustration: "document" },
  example: { label: "例で見る", lead: "図や比較で具体的に確かめます。", fg: "#176B67", tint: "#E7F7F5", illustration: "compare" },
  practice: { label: "やってみる", lead: "ここからは手を動かします。間違えても大丈夫です。", fg: T.aiAccentDeep, tint: T.aiSubtle, illustration: "checklist" },
  feedback: { label: "確かめる", lead: "その場で理解を修正します。", fg: T.aiAccentDeep, tint: T.aiSubtle, illustration: "checklist" },
  review: { label: "ふりかえり", lead: "学んだことを整理します。", fg: T.success, tint: T.successSubtle, illustration: "checklist" },
  final: { label: "総合テスト", lead: "最後に通しで確認します。", fg: T.success, tint: T.successSubtle, illustration: "checklist" },
};

// 中扉・目次のためのステージ判定。LearningExperienceFlowのlearningStageForSlideは
// 「index===0だけexplanation、あとは全部example」なので、説明スライドが3枚続いても
// 2枚目の手前で「例で見る」の中扉が出てしまう。ここでは**kindだけ**で判定する。
const PRACTICE_SLIDE_KINDS = new Set(["quiz", "terminal", "selection_task", "ordering_puzzle", "fill_blank", "interactive_form"]);
function displayStage(slide) {
  const kind = String(slide?.kind || "").toLowerCase();
  if (kind === "summary") return "review";
  if (PRACTICE_SLIDE_KINDS.has(kind)) return "practice";
  if (kind === "concept") return "explanation";
  return "example";
}

export function buildDisplaySlides(lesson, slides) {
  const out = [{ id: "__cover", kind: "_cover", stage: "explanation", lesson, allSlides: slides }];
  // 中扉は**そのステージが初めて出てくるところにだけ**挟む。concept→diagram→conceptのように
  // 行き来する構成でも、中扉が何枚も挟まってテンポが悪くならないようにするため。
  const seen = new Set(["explanation"]);
  slides.forEach((slide, i) => {
    const stage = displayStage(slide);
    if (i > 0 && !seen.has(stage) && STAGE_VISUAL[stage]) {
      out.push({ id: `__divider_${stage}_${i}`, kind: "_divider", stage });
    }
    seen.add(stage);
    // 通し番号は元の並び順で固定する（中扉が増えても番号がずれないように）
    out.push({ ...slide, _index: i });
  });
  return out;
}

function SlideCover({ lesson, slides, accent }) {
  // 目次は中扉と同じ4区分でまとめる（初出順）。同じステージが離れて出てきても1つにまとめる。
  const groups = [];
  slides.forEach(slide => {
    const stage = displayStage(slide);
    if (!STAGE_VISUAL[stage]) return;
    const found = groups.find(g => g.stage === stage);
    if (found) found.labels.push(slide.navLabel || slide.title);
    else groups.push({ stage, labels: [slide.navLabel || slide.title] });
  });
  const exercises = slides.filter(slideNeedsSubmission).length;

  return (
    <div className="-m-5 sm:-m-8 lg:-m-10">
      <div className="flex flex-col md:flex-row md:items-stretch">
        <div className="min-w-0 flex-1 p-8 sm:p-10">
          <span className="mb-4 inline-flex items-center rounded-full px-3 py-1.5 text-[11.5px] font-bold" style={{ background: T.accentSubtle, color: accent, letterSpacing: "0.06em" }}>
            このレッスン
          </span>
          <h2 className="mb-3.5 text-[30px] font-bold leading-[1.3]" style={{ color: C.ink, letterSpacing: "-0.03em" }}>{lesson.title}</h2>
          {lesson.goal && (
            <p className="mb-6 text-[15.5px] leading-[1.85]" style={{ color: C.body, maxWidth: "34ch" }}>{lesson.goal}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {lesson.duration && (
              <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px]" style={{ background: T.bgBase, border: `1px solid ${C.line}`, color: C.body }}>
                <Clock size={13} />{lesson.duration}
              </span>
            )}
            <span className="rounded-full px-3 py-1.5 text-[12.5px]" style={{ background: T.bgBase, border: `1px solid ${C.line}`, color: C.body }}>{slides.length}ページ</span>
            {exercises > 0 && (
              <span className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold" style={{ background: T.aiSubtle, color: T.aiAccentDeep }}>演習 {exercises}</span>
            )}
          </div>
        </div>
        <div
          className="flex items-center justify-center p-7 md:w-[300px] md:shrink-0"
          style={{ background: `linear-gradient(165deg, ${T.accentSubtle} 0%, ${T.aiSubtle} 100%)` }}
        >
          <SlideIllustration name="document" width={240} height={170} />
        </div>
      </div>

      {groups.length > 0 && (
        <div className="border-t p-8 pt-6 sm:px-10" style={{ borderColor: C.line }}>
          <div className="mb-3.5 text-[12px] font-bold" style={{ color: C.muted, letterSpacing: "0.06em" }}>このレッスンの流れ</div>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {groups.map((g, i) => {
              const v = STAGE_VISUAL[g.stage];
              return (
                <div key={`${g.stage}-${i}`} className="rounded-2xl p-3.5" style={{ background: T.bgBase }}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: v.fg, color: "#fff" }}>{i + 1}</span>
                    <span className="text-[12.5px] font-bold" style={{ color: C.ink }}>{v.label}</span>
                  </div>
                  <div className="text-[11.5px] leading-[1.7]" style={{ color: C.muted }}>{g.labels.join(" ・ ")}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SlideDivider({ stage }) {
  const v = STAGE_VISUAL[stage] || STAGE_VISUAL.example;
  return (
    <div className="-m-5 flex flex-col items-center gap-6 rounded-2xl p-7 sm:-m-8 sm:flex-row sm:justify-between sm:p-10 lg:-m-10 lg:p-12"
      style={{ background: `linear-gradient(150deg, ${v.tint} 0%, ${T.bgBase} 64%)` }}>
      <div className="min-w-0">
        <div className="mb-3.5 flex items-center gap-2 text-[12px] font-bold" style={{ color: v.fg, letterSpacing: "0.08em" }}>
          つぎのパート
        </div>
        <h2 className="mb-3 text-[32px] font-bold leading-[1.25]" style={{ color: C.ink, letterSpacing: "-0.03em" }}>{v.label}</h2>
        <p className="text-[15.5px] leading-[1.85]" style={{ color: C.body, maxWidth: "30ch" }}>{v.lead}</p>
      </div>
      <div className="shrink-0">
        <SlideIllustration name={v.illustration} width={226} height={160} />
      </div>
    </div>
  );
}


// 2026-07-14 AI Lesson Studio Phase2: 絵文字を廃止しアイコン+ラベルのボタンUIへ変更。
// uncertain(旧・少し不安)は選択肢から外し、need_help(質問したい)に置き換え。過去データの
// uncertainは引き続きLearningComponents.jsx/QuizManager.jsxのラベル表示・useLearning.jsの
// 集計ロジックでは認識する(後方互換)。新規保存はこの3値(understood/review_later/need_help)のみ。
const REACTIONS = [
  { key: "understood", icon: CheckCircle2, label: "理解できた" },
  { key: "review_later", icon: Clock, label: "あとで復習する" },
  { key: "need_help", icon: HelpCircle, label: "質問したい" },
];

function orderedSlides(lesson) {
  return [...(lesson.slides || [])].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

// 提出(POST /learning/exercises/submit)が必要な演習系kind。ChoiceQuizBody(4択の確認問題)は
// 従来どおりクライアント内完結の自己チェックのままなので対象外(2026-07-21フェーズ2の設計を踏襲)。
const EXERCISE_KINDS = new Set(["terminal", "selection_task", "ordering_puzzle", "fill_blank", "interactive_form"]);
function slideNeedsSubmission(slide) {
  if (!slide) return false;
  if (EXERCISE_KINDS.has(slide.kind)) return true;
  if (slide.kind === "quiz" && slide.interaction?.type === "descriptive") return true;
  return false;
}

// YouTube URL(watch/youtu.be/embed の各形式)ならembed用URLを返す。それ以外(S3動画URL等)はnull。
function youtubeEmbedUrl(url) {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/watch\?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }
  return null;
}

function SectionLabel({ children }) {
  return <div className="mb-2.5 text-xs font-bold uppercase" style={{ color: C.muted, letterSpacing: "0.08em" }}>{children}</div>;
}

function LeftSlideNav({ slides, current, onSelect, accent, pendingIds }) {
  // スマホでは既定で閉じておく。開いてページを選んだらそのまま閉じる。
  const [open, setOpen] = useState(false);
  const currentSlide = slides[current];
  const currentLabel = currentSlide?.kind === "_cover" ? "はじめに"
    : currentSlide?.kind === "_divider" ? (STAGE_VISUAL[currentSlide.stage]?.label || "")
      : currentSlide?.navLabel || currentSlide?.title || "";
  return (
    <div className="order-2 lg:order-none lg:sticky lg:top-6 lg:w-[190px] lg:shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold lg:hidden"
        style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.ink }}
      >
        <span className="min-w-0 truncate">
          ページ一覧
          <span className="ml-2 text-xs font-normal" style={{ color: C.muted }}>{currentLabel}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs" style={{ color: C.muted }}>
          {slides.length}ページ
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>
      <div className={`${open ? "mt-2 block" : "hidden"} lg:mt-0 lg:block`}>
      <div className="hidden lg:block"><SectionLabel>このLessonのページ</SectionLabel></div>
      <div className="space-y-1">
        {slides.map((slide, i) => {
          const active = i === current;
          const pending = pendingIds?.has(slide.id);
          // 表紙・中扉は本文ページではないので、番号を振らず一段小さく出す。
          // 中扉はそのままセクション見出しとして機能する。
          const cover = slide.kind === "_cover";
          const divider = slide.kind === "_divider";
          const stageVisual = divider ? STAGE_VISUAL[slide.stage] : null;
          const label = cover ? "はじめに" : divider ? stageVisual?.label || "" : slide.navLabel || slide.title;
          return (
            <button
              key={slide.id || i}
              type="button"
              onClick={() => { onSelect(i); setOpen(false); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition"
              style={{
                background: active ? accent : "transparent",
                color: active ? "#fff" : divider || cover ? C.muted : C.body,
                fontWeight: active ? 700 : divider ? 700 : 500,
                fontSize: divider || cover ? 12.5 : undefined,
                marginTop: divider ? 8 : undefined,
              }}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={{
                  background: active ? "rgba(255,255,255,.25)" : divider ? stageVisual?.tint || T.bgBase : T.bgBase,
                  color: active ? "#fff" : divider ? stageVisual?.fg || C.muted : C.muted,
                }}
              >
                {cover ? "0" : divider ? "" : (slide._index ?? i) + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {pending && (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: active ? "#fff" : T.warning }}
                  title="演習が未提出です"
                />
              )}
            </button>
          );
        })}
      </div>
      </div>
    </div>
  );
}

function TerminalSlideBody({ slide, accent, lrn, courseId, lessonId }) {
  const interaction = slide.interaction || {};
  const existing = lrn?.getExerciseSubmission ? lrn.getExerciseSubmission(courseId, lessonId, slide.id) : null;
  const [command, setCommand] = useState(existing?.submittedAnswer || interaction.initialCommand || "");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(() => (existing
    ? { ok: existing.isCorrect === true, text: existing.isCorrect ? interaction.successOutput : interaction.errorOutput }
    : null));

  // terminalの正誤判定はPhase1同様クライアント内の完全一致のみ(温存)。判定結果だけを
  // POST /learning/exercises/submitへ送って履歴・復習導線用に永続化する(fire-and-forget)。
  function handleRun() {
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      setRunning(false);
      const ok = command.trim() === String(interaction.expectedCommand || "").trim();
      setResult({ ok, text: ok ? interaction.successOutput : interaction.errorOutput });
      if (lrn?.submitExercise && courseId && lessonId) {
        lrn.submitExercise({ courseId, lessonId, slideId: slide.id, kind: "terminal", submittedAnswer: command.trim(), isCorrect: ok }).catch(() => {});
      }
    }, 600);
  }

  return (
    <div>
      <h3 className="mb-2 text-xl font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{slide.title}</h3>
      {slide.content?.description && <p className="mb-4 text-sm leading-relaxed" style={{ color: C.body }}>{slide.content.description}</p>}
      <div className="overflow-hidden rounded-xl" style={{ background: "#1e1e2e" }}>
        <div className="flex items-center gap-1.5 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#ff5f56" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#ffbd2e" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#27c93f" }} />
          <span className="ml-2 text-xs" style={{ color: "rgba(255,255,255,.5)" }}>terminal</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="text-[13px] font-bold" style={{ color: "#86efac", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>$</span>
          <input
            value={command}
            onChange={e => setCommand(e.target.value)}
            spellCheck={false}
            className="flex-1 bg-transparent text-[13px] outline-none"
            style={{ color: "#d4d4d4", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          />
        </div>
        <div className="flex justify-end px-4 pb-3">
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-60"
            style={{ background: accent }}
          >
            <Play size={12} />{running ? "実行中..." : "実行する"}
          </button>
        </div>
      </div>
      {result && (
        <div className="mt-3 overflow-hidden rounded-xl" style={{ background: result.ok ? "#111827" : "#2a1a1a" }}>
          <div className="px-4 py-2 text-[11px] font-bold" style={{ color: result.ok ? "rgba(255,255,255,.5)" : "#fca5a5" }}>
            {result.ok ? "実行結果（デモ）" : "実行できませんでした"}
          </div>
          <pre
            className="overflow-x-auto whitespace-pre-wrap px-4 pb-3 text-[12px] leading-relaxed"
            style={{ color: result.ok ? "#86efac" : "#fca5a5", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          >
            {result.text}
          </pre>
          {!result.ok && interaction.hint && (
            <div className="px-4 pb-3 text-xs" style={{ color: "rgba(255,255,255,.6)" }}>ヒント: {interaction.hint}</div>
          )}
        </div>
      )}
    </div>
  );
}

function ChoiceQuizBody({ slide, interaction }) {
  const [selected, setSelected] = useState(null);
  const answered = selected !== null;
  const isCorrect = answered && selected === interaction.answerIndex;
  const choices = interaction.choices || [];

  return (
    <div>
      <h3 className="mb-1 text-xl font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{slide.title}</h3>
      {slide.content?.intro && <p className="mb-4 text-xs" style={{ color: C.muted }}>{slide.content.intro}</p>}
      <p className="mb-4 text-[16px] font-bold leading-relaxed" style={{ color: C.ink }}>{interaction.question}</p>
      <div className="space-y-2">
        {choices.map((choice, i) => {
          const isAnswer = i === interaction.answerIndex;
          const isSelected = selected === i;
          let border = C.line;
          let bg = "#fff";
          if (answered && isAnswer) { border = "#22c55e"; bg = "#f0fdf4"; }
          else if (answered && isSelected) { border = "#ef4444"; bg = "#fef2f2"; }
          return (
            <button
              key={choice}
              type="button"
              disabled={answered}
              onClick={() => setSelected(i)}
              className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left text-sm font-semibold transition disabled:cursor-default"
              style={{ border: `1.5px solid ${border}`, background: bg, color: C.ink }}
            >
              {choice}
              {answered && isAnswer && <Check size={16} style={{ color: "#22c55e" }} />}
              {answered && isSelected && !isCorrect && <X size={16} style={{ color: "#ef4444" }} />}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="mt-4 rounded-xl p-4" style={{ background: isCorrect ? "#f0fdf4" : "#fffbeb", border: `1px solid ${isCorrect ? "#bbf7d0" : "#fde68a"}` }}>
          <div className="mb-1 text-sm font-bold" style={{ color: isCorrect ? "#15803d" : "#b45309" }}>{isCorrect ? "正解です！" : "不正解です"}</div>
          <p className="text-sm leading-relaxed" style={{ color: C.body }}>{interaction.explanation}</p>
        </div>
      )}
    </div>
  );
}

// 自由記述式quiz。Eラーニング改善フェーズ2(2026-07-21)でPOST /learning/exercises/submit
// (kind: "descriptive")へ切替。Backend側でこのレッスンの他スライド本文を教材根拠としてBedrockへ渡し、
// 提出・AI採点結果ともに永続化される（以前のPOST /ai/tests/evaluate流用は永続化されず廃止）。
// AIフィードバックは自己学習用であり修了判定には使わないため、その旨とAI生成である旨を明示する。
function DescriptiveQuizBody({ slide, interaction, accent, lrn, courseId, lessonId }) {
  const existing = lrn?.getExerciseSubmission ? lrn.getExerciseSubmission(courseId, lessonId, slide.id) : null;
  const [answer, setAnswer] = useState(existing?.submittedAnswer || "");
  const [state, setState] = useState(() => {
    if (!existing) return "idle";
    return existing.aiFeedbackError ? "error" : (existing.aiFeedback != null ? "done" : "idle");
  }); // idle | grading | done | error
  const [result, setResult] = useState(() => (existing && !existing.aiFeedbackError && existing.aiFeedback != null
    ? { score: existing.aiScore, comment: existing.aiFeedback, basis: existing.aiFeedbackBasis }
    : null));
  const [errorMsg, setErrorMsg] = useState(existing?.aiFeedbackError
    ? "前回の提出でAIフィードバックの生成に失敗しました。回答は保存されています。もう一度お試しください。"
    : "");

  async function handleGrade() {
    if (!answer.trim() || state === "grading" || !lrn?.submitExercise) return;
    setState("grading");
    setErrorMsg("");
    try {
      const submission = await lrn.submitExercise({
        courseId, lessonId, slideId: slide.id, kind: "descriptive",
        submittedAnswer: answer.trim(),
      });
      if (submission?.aiFeedbackError) {
        setErrorMsg("回答は保存されました。AIフィードバックの生成に失敗しました。時間をおいて再度お試しください。");
        setState("error");
        return;
      }
      setResult({ score: submission?.aiScore, comment: submission?.aiFeedback, basis: submission?.aiFeedbackBasis });
      setState("done");
    } catch (e) {
      setErrorMsg(e?.errorMessage || e?.message || "採点に失敗しました。時間をおいて再度お試しください。");
      setState("error");
    }
  }

  return (
    <div>
      <h3 className="mb-1 text-xl font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{slide.title}</h3>
      {slide.content?.intro && <p className="mb-4 text-xs" style={{ color: C.muted }}>{slide.content.intro}</p>}
      <p className="mb-4 text-[16px] font-bold leading-relaxed" style={{ color: C.ink }}>{interaction.question}</p>
      <textarea
        value={answer}
        onChange={e => setAnswer(e.target.value)}
        disabled={state === "done"}
        rows={5}
        placeholder="ここに回答を入力してください"
        className="w-full resize-y rounded-xl px-3 py-2.5 text-sm outline-none disabled:opacity-70"
        style={{ border: `1px solid ${C.line}`, color: C.ink }}
      />
      {/* 2026-07-21監査対応(T-3): 回答後にtextareaが恒久disabledになり、「復習が必要な演習」欄の
          「再挑戦すると自動的にこの一覧から外れます」という案内と矛盾していた。「書き直して再挑戦する」で
          stateをidleへ戻しtextareaを再度有効化する。提出はsubmitExercise側でattemptCountを増やして
          上書き保存される（履歴はattemptCount/createdAt/updatedAtで保持）。 */}
      {state === "done" && (
        <button
          type="button"
          onClick={() => { setState("idle"); setResult(null); setErrorMsg(""); }}
          className="mt-3 rounded-full px-4 py-2 text-xs font-bold transition hover:opacity-80"
          style={{ border: `1px solid ${C.line}`, color: C.ink }}
        >
          書き直して再挑戦する
        </button>
      )}
      {state !== "done" && (
        <button
          type="button"
          onClick={handleGrade}
          disabled={state === "grading" || !answer.trim()}
          className="mt-3 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: accent }}
        >
          {state === "grading" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {state === "grading" ? "採点しています..." : "AIフィードバックを受ける"}
        </button>
      )}
      {state === "error" && (
        <p className="mt-3 text-xs font-semibold" style={{ color: "#ef4444" }}>{errorMsg}</p>
      )}
      {state === "done" && result && (
        <div className="mt-4 rounded-xl p-4" style={{ background: T.bgBase, border: `1px solid ${C.line}` }}>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase" style={{ color: accent, letterSpacing: "0.06em" }}>
            <Sparkles size={13} />AIによるフィードバック（参考評価: {Number(result.score) || 0}点・修了判定には使用しません）
          </div>
          {result.comment && <p className="text-sm leading-relaxed" style={{ color: C.body }}>{result.comment}</p>}
          {Array.isArray(result.basis) && result.basis.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-[11px] font-bold" style={{ color: C.muted }}>根拠にした教材</div>
              <ul className="space-y-1">
                {result.basis.map((b, i) => (
                  <li key={i} className="text-xs leading-relaxed" style={{ color: C.muted }}>
                    <span className="font-semibold" style={{ color: C.body }}>{b.slideTitle}</span>{b.note ? `：${b.note}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuizSlideBody({ slide, accent, lrn, courseId, lessonId }) {
  const interaction = slide.interaction || {};
  if (interaction.type === "descriptive") {
    return <DescriptiveQuizBody slide={slide} interaction={interaction} accent={accent} lrn={lrn} courseId={courseId} lessonId={lessonId} />;
  }
  return <ChoiceQuizBody slide={slide} interaction={interaction} />;
}

function VideoSlideBody({ slide }) {
  const [playing, setPlaying] = useState(false);
  const content = slide.content || {};
  const embedUrl = youtubeEmbedUrl(content.url);
  if (embedUrl) {
    return (
      <div>
        <h3 className="mb-3 text-xl font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{slide.title}</h3>
        <div className="overflow-hidden rounded-xl" style={{ aspectRatio: "16 / 9" }}>
          <iframe
            src={embedUrl}
            title={slide.title}
            className="h-full w-full"
            style={{ border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }
  if (content.url) {
    return (
      <div>
        <h3 className="mb-3 text-xl font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{slide.title}</h3>
        <video src={content.url} controls className="w-full rounded-xl" />
      </div>
    );
  }
  return (
    <div className="relative flex min-h-[300px] flex-col justify-end overflow-hidden rounded-xl" style={{ background: "linear-gradient(160deg, #0f172a, #1e293b)" }}>
      <div className="absolute left-5 top-5 text-sm font-bold" style={{ color: "#fff" }}>{content.title || slide.title}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <button
          type="button"
          onClick={() => setPlaying(p => !p)}
          className="flex h-16 w-16 items-center justify-center rounded-full transition hover:scale-105"
          style={{ background: "rgba(255,255,255,.15)", border: "2px solid rgba(255,255,255,.4)" }}
        >
          {playing ? <Circle size={26} style={{ color: "#fff" }} /> : <PlayCircle size={26} style={{ color: "#fff" }} />}
        </button>
      </div>
      <div className="relative flex items-center gap-3 border-t px-5 py-3" style={{ borderColor: "rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }}>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.2)" }}>
          <div className="h-full rounded-full" style={{ width: playing ? "35%" : "0%", background: "#fff" }} />
        </div>
        <span className="tabular-nums text-xs" style={{ color: "rgba(255,255,255,.7)" }}>{playing ? "01:10" : "00:00"} / {content.duration || "--:--"}</span>
      </div>
    </div>
  );
}

// ---- 中央: メインスライドの中身。kindごとに描画を出し分ける ----
// content.materialId(PDFインポート等でMaterialとして登録された画像)があれば
// lrn.getMaterialViewUrlで署名付き閲覧URLを解決する。content.url(手入力の外部URL等)は
// 従来どおりそのまま使う(materialIdが無ければ何も変わらない、後方互換)。
function ImageSlideBody({ slide, content, lrn }) {
  const [resolvedUrl, setResolvedUrl] = useState(content.url || "");
  const [resolveError, setResolveError] = useState(false);

  useEffect(() => {
    if (!content.materialId || !lrn?.getMaterialViewUrl) return;
    let alive = true;
    setResolveError(false);
    lrn.getMaterialViewUrl(content.materialId)
      .then(res => { if (alive && res?.url) setResolvedUrl(res.url); })
      .catch(() => { if (alive) setResolveError(true); });
    return () => { alive = false; };
  }, [content.materialId, lrn]);

  return (
    <div>
      <h3 className="mb-3 text-xl font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{slide.title}</h3>
      {resolvedUrl && (
        <img src={resolvedUrl} alt={content.alt || slide.title} className="max-h-[68vh] min-h-[360px] w-full rounded-xl object-contain" style={{ background: T.bgBase }} />
      )}
      {resolveError && <p className="text-xs" style={{ color: "#ef4444" }}>画像を読み込めませんでした。</p>}
      {/* 説明(caption)はスライドの外で出す（読み上げボタンを付けるため、他のkindと同じ場所に寄せた） */}
    </div>
  );
}

// ---- AI Lesson Studio Phase3: 操作できる教材(2026-07-14追加) ----
// selection_task/ordering_puzzle/fill_blank/interactive_formの4kind。いずれも
// 操作→判定→解説→(既存の"次へ"ボタンで)次へ、という流れを各コンポーネント内で完結させる。
// ドラッグ操作・CLI・コード入力は対象外(並び替えはボタンでの入れ替えのみ)。判定ロジック自体は
// クライアント内のまま温存し、判定結果をPOST /learning/exercises/submitで永続化する
// (2026-07-21、Eラーニング改善フェーズ2)。

function SelectionTaskBody({ slide, lrn, courseId, lessonId }) {
  const content = slide.content || {};
  const existing = lrn?.getExerciseSubmission ? lrn.getExerciseSubmission(courseId, lessonId, slide.id) : null;
  const [selected, setSelected] = useState(Number.isInteger(existing?.submittedAnswer) ? existing.submittedAnswer : null);
  const answered = selected !== null;
  const isCorrect = answered && selected === content.correctIndex;
  const choices = content.choices || [];
  function choose(i) {
    setSelected(i);
    if (lrn?.submitExercise && courseId && lessonId) {
      lrn.submitExercise({ courseId, lessonId, slideId: slide.id, kind: "selection_task", submittedAnswer: i, isCorrect: i === content.correctIndex }).catch(() => {});
    }
  }
  return (
    <div>
      <h3 className="mb-4 text-xl font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{slide.title}</h3>
      <p className="mb-4 text-[16px] font-bold leading-relaxed" style={{ color: C.ink }}>{content.question}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {choices.map((choice, i) => {
          const isAnswer = i === content.correctIndex;
          const isSelected = selected === i;
          let border = C.line;
          let bg = "#fff";
          if (answered && isAnswer) { border = "#22c55e"; bg = "#f0fdf4"; }
          else if (answered && isSelected) { border = "#ef4444"; bg = "#fef2f2"; }
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => choose(i)}
              className="flex items-center justify-between gap-2 rounded-xl px-4 py-3 text-left text-sm font-semibold transition disabled:cursor-default"
              style={{ border: `1.5px solid ${border}`, background: bg, color: C.ink }}
            >
              {choice}
              {answered && isAnswer && <Check size={16} style={{ color: "#22c55e" }} />}
              {answered && isSelected && !isCorrect && <X size={16} style={{ color: "#ef4444" }} />}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="mt-4 rounded-xl p-4" style={{ background: isCorrect ? "#f0fdf4" : "#fffbeb", border: `1px solid ${isCorrect ? "#bbf7d0" : "#fde68a"}` }}>
          <div className="mb-1 text-sm font-bold" style={{ color: isCorrect ? "#15803d" : "#b45309" }}>{isCorrect ? "正解です！" : "不正解です"}</div>
          <p className="text-sm leading-relaxed" style={{ color: C.body }}>{content.explanation}</p>
        </div>
      )}
      {/* 2026-07-21監査対応(T-3): 一度回答すると選択肢が恒久disabledになり「復習が必要な演習」欄の
          「再挑戦すると自動的にこの一覧から外れます」という案内と矛盾していた。再挑戦を許可し、
          提出はsubmitExercise側でattemptCountを増やして保存される（履歴は保持したまま上書き）。 */}
      {answered && (
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="mt-3 rounded-full px-4 py-2 text-xs font-bold transition hover:opacity-80"
          style={{ border: `1px solid ${C.line}`, color: C.ink }}
        >
          再挑戦する
        </button>
      )}
    </div>
  );
}

function shuffleIndexes(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // 元の並びのままだと判定が最初から正解になってしまうため、シャッフル結果が
  // 元の順序と完全一致した場合は先頭2つを入れ替えて必ず並び替えが必要な状態にする。
  if (n > 1 && a.every((v, i) => v === i)) [a[0], a[1]] = [a[1], a[0]];
  return a;
}

function OrderingPuzzleBody({ slide, lrn, courseId, lessonId }) {
  const content = slide.content || {};
  const correctItems = content.items || [];
  const existing = lrn?.getExerciseSubmission ? lrn.getExerciseSubmission(courseId, lessonId, slide.id) : null;
  const existingOrder = Array.isArray(existing?.submittedAnswer) && existing.submittedAnswer.length === correctItems.length
    ? existing.submittedAnswer
    : null;
  const [order, setOrder] = useState(() => existingOrder || shuffleIndexes(correctItems.length));
  const [checked, setChecked] = useState(!!existingOrder);
  const isCorrect = checked && order.every((idx, pos) => idx === pos);

  function move(pos, dir) {
    if (checked) return;
    const target = pos + dir;
    if (target < 0 || target >= order.length) return;
    setOrder(prev => {
      const next = [...prev];
      [next[pos], next[target]] = [next[target], next[pos]];
      return next;
    });
  }

  function handleCheck() {
    setChecked(true);
    if (lrn?.submitExercise && courseId && lessonId) {
      const ok = order.every((idx, pos) => idx === pos);
      lrn.submitExercise({ courseId, lessonId, slideId: slide.id, kind: "ordering_puzzle", submittedAnswer: order, isCorrect: ok }).catch(() => {});
    }
  }

  return (
    <div>
      <h3 className="mb-3 text-xl font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{slide.title}</h3>
      {content.instruction && <p className="mb-1 text-sm" style={{ color: C.body }}>{content.instruction}</p>}
      <p className="mb-4 text-xs" style={{ color: C.muted }}>項目を正しい順番へ並べ替える教材です。↑↓ボタンで移動できます。</p>
      <div className="space-y-2">
        {order.map((itemIdx, pos) => {
          const isRight = checked && itemIdx === pos;
          const isWrong = checked && itemIdx !== pos;
          return (
            <div
              key={itemIdx}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ border: `1.5px solid ${isRight ? "#22c55e" : isWrong ? "#ef4444" : C.line}`, background: isRight ? "#f0fdf4" : isWrong ? "#fef2f2" : "#fff" }}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: T.bgBase, color: C.muted }}>{pos + 1}</span>
              <span className="min-w-0 flex-1 text-sm font-semibold" style={{ color: C.ink }}>{correctItems[itemIdx]}</span>
              <div className="flex shrink-0 gap-1">
                <button type="button" disabled={checked || pos === 0} onClick={() => move(pos, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 disabled:opacity-25" style={{ color: C.ink }}><ChevronUp size={15} /></button>
                <button type="button" disabled={checked || pos === order.length - 1} onClick={() => move(pos, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 disabled:opacity-25" style={{ color: C.ink }}><ChevronDown size={15} /></button>
              </div>
            </div>
          );
        })}
      </div>
      {content.hint && !checked && (
        <p className="mt-3 text-xs" style={{ color: C.muted }}>ヒント: {content.hint}</p>
      )}
      {!checked ? (
        <Btn className="mt-4" size="sm" icon={Check} onClick={handleCheck}>判定する</Btn>
      ) : (
        <div className="mt-4 rounded-xl p-4" style={{ background: isCorrect ? "#f0fdf4" : "#fffbeb", border: `1px solid ${isCorrect ? "#bbf7d0" : "#fde68a"}` }}>
          <div className="mb-1 text-sm font-bold" style={{ color: isCorrect ? "#15803d" : "#b45309" }}>{isCorrect ? "正解です！" : "順番が違います"}</div>
          <p className="text-sm leading-relaxed" style={{ color: C.body }}>{content.explanation}</p>
        </div>
      )}
    </div>
  );
}

function FillBlankBody({ slide, accent, lrn, courseId, lessonId }) {
  const content = slide.content || {};
  const existing = lrn?.getExerciseSubmission ? lrn.getExerciseSubmission(courseId, lessonId, slide.id) : null;
  const [value, setValue] = useState(typeof existing?.submittedAnswer === "string" ? existing.submittedAnswer : "");
  const [checked, setChecked] = useState(!!existing);
  const accepted = [content.answer, ...(content.acceptableAnswers || [])]
    .map(s => String(s || "").trim().toLowerCase())
    .filter(Boolean);
  const isCorrect = checked && accepted.includes(value.trim().toLowerCase());

  function submit() {
    if (!value.trim() || checked) return;
    setChecked(true);
    if (lrn?.submitExercise && courseId && lessonId) {
      const ok = accepted.includes(value.trim().toLowerCase());
      lrn.submitExercise({ courseId, lessonId, slideId: slide.id, kind: "fill_blank", submittedAnswer: value.trim(), isCorrect: ok }).catch(() => {});
    }
  }

  return (
    <div>
      <h3 className="mb-4 text-xl font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{slide.title}</h3>
      <p className="mb-4 flex flex-wrap items-center gap-2 text-[16px] leading-relaxed" style={{ color: C.ink }}>
        <span>{content.textBefore}</span>
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
          disabled={checked}
          placeholder="ここに入力"
          className="w-40 max-w-full rounded-lg px-2.5 py-1.5 text-center text-[16px] font-bold outline-none disabled:opacity-70"
          style={{ border: `1.5px solid ${checked ? (isCorrect ? "#22c55e" : "#ef4444") : accent}`, color: C.ink }}
        />
        <span>{content.textAfter}</span>
      </p>
      {!checked ? (
        <Btn size="sm" icon={Check} onClick={submit} disabled={!value.trim()}>判定する</Btn>
      ) : (
        <div className="mt-2 rounded-xl p-4" style={{ background: isCorrect ? "#f0fdf4" : "#fffbeb", border: `1px solid ${isCorrect ? "#bbf7d0" : "#fde68a"}` }}>
          <div className="mb-1 text-sm font-bold" style={{ color: isCorrect ? "#15803d" : "#b45309" }}>{isCorrect ? "正解です！" : `不正解です（正解: ${content.answer}）`}</div>
          <p className="text-sm leading-relaxed" style={{ color: C.body }}>{content.explanation}</p>
        </div>
      )}
    </div>
  );
}

// 疑似設定画面。ADR0006の「テンプレート方式」思想を踏襲し、AIはfields(値)のみ生成、描画・
// 判定ロジックはこの固定コンポーネントが担う。判定はAIではなくルールベース(correctValueとの
// 文字列一致)。実際のAWS/Azureコンソールに似せる必要はなく、教育用のシンプルなUIで構成する。
function InteractiveFormBody({ slide, accent, lrn, courseId, lessonId }) {
  const content = slide.content || {};
  const fields = content.fields || [];
  const existing = lrn?.getExerciseSubmission ? lrn.getExerciseSubmission(courseId, lessonId, slide.id) : null;
  const existingValues = existing?.submittedAnswer && typeof existing.submittedAnswer === "object" ? existing.submittedAnswer : null;
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(f => [f.key, existingValues?.[f.key] || ""])));
  const [checked, setChecked] = useState(!!existingValues);

  function setFieldValue(key, v) {
    if (checked) return;
    setValues(prev => ({ ...prev, [key]: v }));
  }

  function isFieldCorrect(field) {
    const v = String(values[field.key] || "").trim().toLowerCase();
    const correct = String(field.correctValue || "").trim().toLowerCase();
    return v === correct;
  }

  const allFilled = fields.every(f => String(values[f.key] || "").trim());
  const allCorrect = checked && fields.every(isFieldCorrect);

  function handleSubmit() {
    setChecked(true);
    if (lrn?.submitExercise && courseId && lessonId) {
      const ok = fields.every(isFieldCorrect);
      lrn.submitExercise({ courseId, lessonId, slideId: slide.id, kind: "interactive_form", submittedAnswer: values, isCorrect: ok }).catch(() => {});
    }
  }

  return (
    <div>
      <h3 className="mb-1 text-xl font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{slide.title || content.title}</h3>
      {content.instruction && <p className="mb-4 text-sm" style={{ color: C.body }}>{content.instruction}</p>}
      <div className="space-y-3 rounded-xl p-4" style={{ background: T.bgBase, border: `1px solid ${C.line}` }}>
        {fields.map(field => {
          const isRight = checked && isFieldCorrect(field);
          const isWrong = checked && !isFieldCorrect(field);
          const fieldBorder = checked ? (isRight ? "#22c55e" : "#ef4444") : C.line;
          return (
            <div key={field.key}>
              <div className="mb-1 flex items-center gap-1.5 text-xs font-bold" style={{ color: C.muted }}>
                {field.label}
                {checked && (isRight ? <Check size={13} style={{ color: "#22c55e" }} /> : <X size={13} style={{ color: "#ef4444" }} />)}
              </div>
              {field.type === "select" ? (
                <select
                  value={values[field.key] || ""}
                  onChange={e => setFieldValue(field.key, e.target.value)}
                  disabled={checked}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-70"
                  style={{ border: `1.5px solid ${fieldBorder}`, color: C.ink, background: "#fff" }}
                >
                  <option value="">選択してください</option>
                  {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : field.type === "toggle" ? (
                <div className="flex gap-2">
                  {(field.options || []).map(o => (
                    <button
                      key={o}
                      type="button"
                      disabled={checked}
                      onClick={() => setFieldValue(field.key, o)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default"
                      style={values[field.key] === o
                        ? { background: accent, color: "#fff" }
                        : { background: "#fff", color: C.body, border: `1px solid ${C.line}` }}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  value={values[field.key] || ""}
                  onChange={e => setFieldValue(field.key, e.target.value)}
                  disabled={checked}
                  placeholder={field.placeholder}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-70"
                  style={{ border: `1.5px solid ${fieldBorder}`, color: C.ink }}
                />
              )}
              {field.hint && !checked && <p className="mt-1 text-[11px]" style={{ color: C.muted }}>{field.hint}</p>}
            </div>
          );
        })}
      </div>
      {!checked ? (
        <Btn className="mt-4" size="sm" icon={Check} onClick={handleSubmit} disabled={!allFilled}>作成する</Btn>
      ) : (
        <div className="mt-4 rounded-xl p-4" style={{ background: allCorrect ? "#f0fdf4" : "#fffbeb", border: `1px solid ${allCorrect ? "#bbf7d0" : "#fde68a"}` }}>
          <div className="mb-1 text-sm font-bold" style={{ color: allCorrect ? "#15803d" : "#b45309" }}>{allCorrect ? "正しく設定できました！" : "一部の設定を見直しましょう"}</div>
          {allCorrect && content.completionPreview && (
            <pre className="my-2 overflow-x-auto rounded-lg px-3 py-2 text-xs" style={{ background: "#0f172a", color: "#e2e8f0" }}>{content.completionPreview}</pre>
          )}
          <p className="text-sm leading-relaxed" style={{ color: C.body }}>{content.explanation}</p>
        </div>
      )}
    </div>
  );
}

// 2026-07-16 Phase5: diagram(structured node/edge)の描画。AIは値(ノード/エッジ)のみを生成し、
// 実際の描画レイアウトはここで固定的に決める(自由なSVG/HTML/JSは一切生成させない)。
// diagramType別に3つの表示モードへ振り分ける最小実装:
// - hierarchy: 親子関係をインデントで表現するツリー表示
// - flow/timeline: edgeを辿って一直線の手順として並べる(辿れない場合はnodes宣言順にフォールバック)
// - relationship/architecture/その他: ノードをチップ表示し、edgeを「A → B」のリストで補足
// legacy: content.nodesが無い(＝content.layersのみの)既存スライドはこれまで通りlayers表示のまま。
function chainOrderFromEdges(nodes, edges) {
  const outMap = new Map();
  const inDegree = new Map(nodes.map(n => [n.id, 0]));
  edges.forEach(e => {
    if (!outMap.has(e.from)) outMap.set(e.from, []);
    outMap.get(e.from).push(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
  });
  const roots = nodes.filter(n => (inDegree.get(n.id) || 0) === 0);
  if (roots.length !== 1) return null;
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const order = [];
  const visited = new Set();
  let cur = roots[0].id;
  while (cur && !visited.has(cur)) {
    visited.add(cur);
    order.push(cur);
    const nexts = outMap.get(cur) || [];
    cur = nexts.length === 1 ? nexts[0] : null;
  }
  if (order.length !== nodes.length) return null;
  return order.map(id => nodeById.get(id));
}

function buildDiagramTree(nodes, edges) {
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const childrenMap = new Map();
  const hasParent = new Set();
  edges.forEach(e => {
    if (!childrenMap.has(e.from)) childrenMap.set(e.from, []);
    childrenMap.get(e.from).push(e.to);
    hasParent.add(e.to);
  });
  const roots = nodes.filter(n => !hasParent.has(n.id));
  const rows = [];
  const visit = (id, depth) => {
    const node = nodeById.get(id);
    if (!node) return;
    rows.push({ node, depth });
    (childrenMap.get(id) || []).forEach(childId => visit(childId, depth + 1));
  };
  (roots.length ? roots : nodes).forEach(n => visit(n.id, 0));
  return rows;
}

function DiagramBody({ slide, accent }) {
  const content = slide.content || {};
  const nodes = content.nodes || [];
  const edges = content.edges || [];
  const layers = content.layers || [];

  if (!nodes.length) {
    return (
      <div>
        <h3 className="mb-4 text-xl font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{slide.title}</h3>
        <div className="space-y-2">
          {layers.map((layer, i, arr) => (
            <div key={layer.label}>
              <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: `${accent}${14 - i * 3}`, border: `1px solid ${accent}30` }}>
                <span className="text-sm font-bold" style={{ color: C.ink }}>{layer.label}</span>
                <span className="text-xs" style={{ color: C.muted }}>{layer.who}</span>
              </div>
              {i < arr.length - 1 && <div className="mx-auto h-3 w-px" style={{ background: C.line }} />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const diagramType = content.diagramType || "flow";

  if (diagramType === "hierarchy") {
    const rows = buildDiagramTree(nodes, edges);
    return (
      <div>
        <h3 className="mb-4 text-xl font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{slide.title}</h3>
        <div className="space-y-1.5">
          {rows.map(({ node, depth }) => (
            <div key={node.id} className="flex items-center gap-2" style={{ marginLeft: depth * 24 }}>
              {depth > 0 && <span style={{ color: C.muted }}>└</span>}
              <span className="rounded-lg px-3 py-1.5 text-sm font-semibold" style={{ background: `${accent}14`, border: `1px solid ${accent}30`, color: C.ink }}>{node.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (diagramType === "flow" || diagramType === "timeline") {
    const chain = chainOrderFromEdges(nodes, edges) || nodes;
    return (
      <div>
        <h3 className="mb-4 text-xl font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{slide.title}</h3>
        <div className="space-y-2">
          {chain.map((node, i, arr) => (
            <div key={node.id}>
              <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: `${accent}${14 - i * 2}`, border: `1px solid ${accent}30` }}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: T.bgBase, color: C.muted }}>{i + 1}</span>
                <span className="text-sm font-bold" style={{ color: C.ink }}>{node.label}</span>
              </div>
              {i < arr.length - 1 && <div className="mx-auto h-3 w-px" style={{ background: C.line }} />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-4 text-xl font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{slide.title}</h3>
      <div className="mb-3 flex flex-wrap gap-2">
        {nodes.map(node => (
          <span key={node.id} className="rounded-lg px-3 py-1.5 text-sm font-semibold" style={{ background: `${accent}14`, border: `1px solid ${accent}30`, color: C.ink }}>{node.label}</span>
        ))}
      </div>
      {edges.length > 0 && (
        <div className="space-y-1">
          {edges.map((e, i) => {
            const fromNode = nodes.find(n => n.id === e.from);
            const toNode = nodes.find(n => n.id === e.to);
            return (
              <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs" style={{ color: C.body }}>
                <span className="font-semibold">{fromNode?.label || e.from}</span>
                <span style={{ color: C.muted }}>→</span>
                <span className="font-semibold">{toNode?.label || e.to}</span>
                {e.label && <span style={{ color: C.muted }}>（{e.label}）</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// CMS(admin/slideEditor/LessonSlideStudio.jsx)のプレビューパネルから「受講者画面と全く同じ表示」を
// 再現するために再利用する。ここでexportしても受講画面側の挙動・呼び出し方は一切変えない。
export function SlideRenderer({ slide, accent, lrn, courseId, lessonId, index, total }) {
  if (!slide) return null;
  const content = slide.content || {};
  switch (slide.kind) {
    case "_cover":
      return <SlideCover lesson={slide.lesson} slides={slide.allSlides} accent={accent} />;
    case "_divider":
      return <SlideDivider stage={slide.stage} />;
    case "concept":
      return (
        <ContentColumn>
          {content.chapter || content.chapterTitle
            ? <SlideEyebrowText chapter={content.chapter} chapterTitle={content.chapterTitle} />
            : <SlideEyebrow kind="concept" index={index} total={total} />}
          <SlideTitle>{slide.title}</SlideTitle>
          <LessonBodyText body={content.body} />
          {/* 囲みは役割で分ける（ポイント/誤解しやすい/現場感覚）。roleが無い旧データは
              従来どおりの見た目になるよう RoleCallouts 側で type を見ている。 */}
          <RoleCallouts items={content.callouts} />
        </ContentColumn>
      );

    // ---- 2026-08-24 追加の版面。仕様: docs/design/slide-layouts.md ----
    case "chapter":
      return <ChapterSlide content={content} />;
    case "agenda":
      return <AgendaSlide slide={slide} content={content} />;
    case "hook":
      return <HookSlide slide={slide} content={content} />;
    case "steps":
      return <StepsSlide slide={slide} content={content} />;
    case "columns":
      return <ColumnsSlide slide={slide} content={content} />;
    case "work":
      return <WorkSlide slide={slide} content={content} />;
    case "figure":
      return (
        <div>
          <SlideEyebrowText chapter={content.chapter} chapterTitle={content.chapterTitle} />
          <SlideTitle>{slide.title}</SlideTitle>
          {content.intro && (
            <p className="mb-5 text-[14.5px] leading-[1.95]" style={{ color: C.body, maxWidth: "64ch" }}>{content.intro}</p>
          )}
          <SlideFigure content={content} />
          <RoleCallouts items={content.callouts} />
        </div>
      );
    case "image":
      return <ImageSlideBody key={slide.id} slide={slide} content={content} lrn={lrn} />;
    case "diagram":
      return <DiagramBody slide={slide} accent={accent} />;
    case "table":
      return (
        <div>
          <SlideEyebrow kind="table" index={index} total={total} />
          <SlideTitle>{slide.title}</SlideTitle>
          {/* モバイル390px等、列数の多い表は横幅が入りきらないことがあるため、テーブルだけを
              overflow-x-autoでスクロール可能にし、ページ全体の横スクロールを防ぐ。 */}
          <div className="overflow-x-auto rounded-2xl" style={{ border: `1px solid ${C.line}` }}>
            <table className="w-full min-w-[480px] border-collapse text-[14.5px]">
              <thead>
                <tr>
                  {(content.columns || []).map((col, i) => (
                    <th key={col} data-focus={`col-${i}`} className="px-[18px] py-3.5 text-left text-xs font-bold" style={{ background: T.bgBase, color: C.muted, letterSpacing: "0.04em", borderBottom: `1px solid ${C.line}` }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(content.rows || []).map((row, ri) => (
                  <tr key={ri} data-focus={`row-${ri}`} style={{ background: ri % 2 === 1 ? "#FCFDFE" : "transparent" }}>
                    {row.map((cell, i) => (
                      <td key={i} className="px-[18px] py-4 leading-[1.7]" style={{ color: i === 0 ? C.ink : C.body, fontWeight: i === 0 ? 700 : 400, borderBottom: `1px solid ${T.bgBase}` }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    case "video":
      return <VideoSlideBody slide={slide} />;
    case "terminal":
      return <TerminalSlideBody slide={slide} accent={accent} lrn={lrn} courseId={courseId} lessonId={lessonId} />;
    case "quiz":
      return <QuizSlideBody slide={slide} accent={accent} lrn={lrn} courseId={courseId} lessonId={lessonId} />;
    case "compare": {
      // AI Lesson Studio Phase1で追加。content: { left: {label, items[]}, right: {label, items[]} }
      // (docs/specs/ai-lesson-studio-spec.md §4.3)。既存kindと同じくcontentが空でもクラッシュしない。
      const left = content.left || {};
      const right = content.right || {};
      // 2026-08-20: 見出し帯に色を持たせて左右を区別する。
      // **色は位置ではなく内容で決める。** 実機で「良い対応」が青、「よくある失敗例」が緑（成功色）
      // になり、意味と色が逆転していた。side.tone(positive/negative)があればそれに従い、
      // 無ければ善し悪しを含意しない中立色（青／teal）を左右に振る。
      const COMPARE_TONE = {
        positive: { bg: T.successSubtle, fg: T.success },
        negative: { bg: T.dangerSubtle, fg: T.danger },
      };
      const NEUTRAL = [{ bg: T.accentSubtle, fg: T.accentHover }, { bg: "#E7F7F5", fg: "#176B67" }];
      const toneFor = (side, i) => COMPARE_TONE[side?.tone] || NEUTRAL[i];
      // 見出しにアイコンを添えて、望ましい/避けたいが色だけに頼らず伝わるようにする
      // （色覚特性で緑と赤が判別しづらい場合の担保も兼ねる）。
      const ToneIcon = ({ tone }) => {
        if (tone === "positive") return <Check size={15} className="shrink-0" />;
        if (tone === "negative") return <X size={15} className="shrink-0" />;
        return null;
      };
      const Column = ({ side, tone, at }) => (
        <div className="min-w-0 flex-1 overflow-hidden rounded-2xl" style={{ border: `1px solid ${C.line}` }}>
          <div data-focus={`${at}-head`} className="flex items-center gap-2 px-4 py-3 text-[13px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
            <ToneIcon tone={side?.tone} />{side.label}
          </div>
          <ul className="space-y-2.5 p-4">
            {(side.items || []).map((item, i) => (
              <li key={i} data-focus={`${at}-${i}`} className="flex items-start gap-2.5 text-[14.5px] leading-[1.75]" style={{ color: C.body }}>
                <Check size={15} className="mt-1 shrink-0" style={{ color: tone.fg }} />{item}
              </li>
            ))}
          </ul>
        </div>
      );
      return (
        <div>
          <SlideEyebrow kind="compare" index={index} total={total} />
          <SlideTitle>{slide.title}</SlideTitle>
          <div className="flex flex-col gap-3.5 sm:flex-row">
            <Column side={left} tone={toneFor(left, 0)} at="left" />
            <Column side={right} tone={toneFor(right, 1)} at="right" />
          </div>
        </div>
      );
    }
    case "selection_task":
      return <SelectionTaskBody slide={slide} lrn={lrn} courseId={courseId} lessonId={lessonId} />;
    case "ordering_puzzle":
      return <OrderingPuzzleBody slide={slide} lrn={lrn} courseId={courseId} lessonId={lessonId} />;
    case "fill_blank":
      return <FillBlankBody slide={slide} accent={accent} lrn={lrn} courseId={courseId} lessonId={lessonId} />;
    case "interactive_form":
      return <InteractiveFormBody slide={slide} accent={accent} lrn={lrn} courseId={courseId} lessonId={lessonId} />;
    case "summary":
    default:
      // まとめは「順番のある要点」に見せる（従来は全部チェックマークで比較と同じ顔だった）。
      // 挿絵は左に置いて、説明スライドとリズムを変える。
      return (
        <ContentColumn>
          <SlideEyebrow kind="summary" index={index} total={total} />
          <SlideTitle>{slide.title}</SlideTitle>
          <ol className="space-y-3">
            {(content.points || []).map((p, i) => (
              <li key={i} data-focus={`point-${i}`} className="flex items-start gap-3.5">
                <span
                  className="mt-0.5 flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold"
                  style={{ background: T.successSubtle, color: T.success }}
                >{i + 1}</span>
                <span className="text-[15.5px] leading-[1.75]" style={{ color: C.ink }}>{p}</span>
              </li>
            ))}
          </ol>
          {content.nextLessonPreview && (
            <div className="mt-6 flex items-center gap-2.5 border-t pt-4" style={{ borderColor: C.line }}>
              <ChevronRight size={15} style={{ color: accent }} />
              <span className="text-[13.5px]" style={{ color: C.body }}>{content.nextLessonPreview}</span>
            </div>
          )}
        </ContentColumn>
      );
  }
}

function MainSlidePanel({ slides, index, setIndex, accent, lrn, courseId, lessonId, contentCount, lesson }) {
  const slide = slides[index];
  // 古いimageスライドは content.caption 側にだけ説明を持っていることがある。
  const slideCaption = slide?.caption || slide?.content?.caption || "";
  // 質問を開いている間は講義の読み上げを止める
  const [askOpen, setAskOpen] = useState(false);
  // 指し示しの位置を測る基準（このパネルの内側を0-100%とみなす）
  const stageRef = useRef(null);
  // 表紙・中扉には解説を付けない。それ以外はkindによらずスライドの外に出す。
  const synthetic = slide?.kind === "_cover" || slide?.kind === "_divider";
  const captionShownInBody = synthetic;
  return (
    <div className="order-1 min-w-0 flex-1 lg:order-none">
      <div
        ref={stageRef}
        className="relative overflow-hidden rounded-2xl p-5 sm:p-8 lg:p-10"
        style={{ background: "#fff", border: `1px solid ${C.line}` }}
      >
        <div className="flex min-h-[300px] flex-col justify-center">
          <SlideRenderer
            slide={slide}
            accent={accent}
            lrn={lrn}
            courseId={courseId}
            lessonId={lessonId}
            index={slide?._index}
            total={contentCount}
            key={slide?.id}
          />
        </div>
        {/* 2026-08-24: 読み上げに合わせてスライドの該当箇所を指す。
            指す場所が無いスライドでは何も描かない。 */}
        {!synthetic && slide?.focus?.length > 0 && (
          <SlideFocusLayer focus={slide.focus} stageRef={stageRef} slideId={slide.id} />
        )}
      </div>

      {/* スライドの下に置く読み物。要点はスライド、補足は解説、詳しい説明はノート。
          解説(caption)はAIが書き、ノート(note)は管理者が書く。どちらも読み上げできる。 */}
      {!captionShownInBody && <SlideNarration text={slideCaption} />}
      {!synthetic && <SlideNote note={slide?.note} />}
      {/* 表紙・中扉は教材の中身ではないので質問欄を出さない。
          質問を開いている間は講義の読み上げを止める（重なって聞こえないように）。 */}
      {!synthetic && slide?.id && (
        <SlideQuestionBox
          courseId={courseId}
          lessonId={lessonId}
          slideId={slide.id}
          slideTitle={slide.title}
          onOpenChange={setAskOpen}
        />
      )}

      {/* 2026-08-24: 講義プレイヤー。カンペ（ノート・解説）を読み上げながら自動で送る。 */}
      <LecturePlayer
        slides={slides}
        index={index}
        setIndex={setIndex}
        lesson={lesson}
        paused={askOpen}
        onPausedChange={next => { if (!next) setAskOpen(false); }}
      />

      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => setIndex(i => Math.max(0, i - 1))}
          disabled={index <= 0}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-black/5 disabled:opacity-25"
          style={{ color: C.ink }}
        >
          <ChevronLeft size={14} />前へ
        </button>
        <span className="text-xs font-semibold tabular-nums" style={{ color: C.body }}>
          {index + 1} / {slides.length}
          {index < slides.length - 1 && (
            <span className="ml-1.5 font-normal" style={{ color: C.muted }}>（残り{slides.length - index - 1}枚）</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setIndex(i => Math.min(slides.length - 1, i + 1))}
          disabled={index >= slides.length - 1}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-black/5 disabled:opacity-25"
          style={{ color: C.ink }}
        >
          次へ<ChevronRight size={14} />
        </button>
      </div>

    </div>
  );
}

// 既存のLessonMaterialsCard(LearningComponents.jsx)と同じダウンロード方式(s3keyはpopup+署名URL、
// urlは直接window.open)を踏襲した、補足資料専用の簡易リスト表示。
function SupplementMaterials({ course, lesson, lrn }) {
  const materials = lrn.materialsForLesson ? lrn.materialsForLesson(course.id, lesson.id) : [];
  const [openingId, setOpeningId] = useState(null);
  if (!materials.length) return null;

  function handleOpen(material) {
    const id = material.id || material.materialId;
    if (material.s3key) {
      const win = window.open("", "_blank", "noopener,noreferrer");
      setOpeningId(id);
      lrn.getMaterialViewUrl(id)
        .then(res => { if (res?.url && win) win.location.href = res.url; else if (win) win.close(); })
        .catch(() => { if (win) win.close(); })
        .finally(() => setOpeningId(null));
    } else if (material.url) {
      window.open(material.url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div>
      <SectionLabel>補足資料</SectionLabel>
      <div className="space-y-0.5">
        {materials.map(material => {
          const id = material.id || material.materialId;
          return (
            <button
              key={id}
              type="button"
              disabled={openingId === id}
              onClick={() => handleOpen(material)}
              className="group flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-black/[.03] disabled:opacity-60"
            >
              <span className="flex min-w-0 items-center gap-2 truncate text-xs" style={{ color: C.body }}>
                <FileText size={13} style={{ color: C.muted }} />{material.title}
              </span>
              <Download size={13} className="shrink-0" style={{ color: C.muted }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RightSidebar({ course, lesson, lrn, idx, lessons, accent, compact, onToggle }) {
  return (
    <div className={`space-y-4 lg:sticky lg:top-6 lg:shrink-0 ${compact ? "lg:w-[72px]" : "lg:w-[240px]"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`min-w-0 ${compact ? "lg:hidden" : ""}`}>
          <div className="mb-1 text-xs font-bold uppercase" style={{ color: accent, letterSpacing: "0.08em" }}>{course.title} · Lesson {idx + 1}</div>
          <h2 className="text-lg font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{lesson.title}</h2>
          {lesson.summary && <p className="mt-0.5 text-xs" style={{ color: C.muted }}>{lesson.summary}</p>}
        </div>
        <button
          type="button"
          title={compact ? "Lesson情報を開く" : "Lesson情報を閉じる"}
          onClick={onToggle}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition hover:bg-black/[.04]"
          style={{ border: `1px solid ${C.line}`, color: C.muted, background: "#fff" }}
        >
          {compact ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
        </button>
      </div>

      {compact ? (
        <div className="hidden space-y-2 lg:block">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold tabular-nums" style={{ background: T.bgBase, color: C.body, border: `1px solid ${C.line}` }}>
            {idx + 1}/{lessons.length}
          </div>
          <div className="mx-auto h-20 w-1.5 overflow-hidden rounded-full" style={{ background: C.line }}>
            <div className="w-full rounded-full" style={{ height: `${lessons.length ? ((idx + 1) / lessons.length) * 100 : 0}%`, background: accent }} />
          </div>
        </div>
      ) : null}

      <div className={compact ? "lg:hidden" : ""}>
        <div>
          <SectionLabel>進捗</SectionLabel>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: C.line }}>
              <div className="h-full rounded-full" style={{ width: `${lessons.length ? ((idx + 1) / lessons.length) * 100 : 0}%`, background: accent }} />
            </div>
            <span className="shrink-0 text-xs font-semibold tabular-nums" style={{ color: C.muted }}>{idx + 1} / {lessons.length}</span>
          </div>
        </div>

        {lesson.points?.length > 0 && (
          <div>
            <SectionLabel>学習ポイント</SectionLabel>
            <ul className="space-y-1.5">
              {lesson.points.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: C.body }}>
                  <Lightbulb size={13} className="mt-0.5 shrink-0" style={{ color: accent }} />{p}
                </li>
              ))}
            </ul>
          </div>
        )}

        <SupplementMaterials course={course} lesson={lesson} lrn={lrn} />
      </div>
    </div>
  );
}

function ReactionBar({ course, lesson, lrn, accent }) {
  const review = lrn.getLessonReview(course.id, lesson.id);
  function select(status) { lrn.setLessonReview(course.id, lesson.id, { status, reviewed: false }); }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {REACTIONS.map(r => {
        const active = review?.status === r.key;
        const Icon = r.icon;
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => select(r.key)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition"
            style={active
              ? { background: accent, border: `1px solid ${accent}`, color: "#fff" }
              : { background: "#fff", border: `1px solid ${C.line}`, color: C.body }}
          >
            <Icon size={14} />
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ElSlideLessonView({ course, lesson, lrn, onBack, onNavigate, onComplete, lessons, initialSlideId }) {
  const contentSlides = orderedSlides(lesson);
  // 表示用の並び（表紙＋中扉を挟んだもの）。以降のindexはすべてこの配列に対するもの。
  const slides = useMemo(() => buildDisplaySlides(lesson, contentSlides), [lesson, contentSlides.length]);
  // 2026-07-21 監査P1(T-4)対応: 「復習が必要な演習」から該当スライドへ直接ジャンプできるよう、
  // initialSlideIdが渡された場合はそのスライドから開始する（見つからなければ従来通り先頭から）
  const [slideIndex, setSlideIndex] = useState(() => {
    if (!initialSlideId) return 0;
    const found = slides.findIndex(s => s.id === initialSlideId);
    return found >= 0 ? found : 0;
  });
  const [rightCompact, setRightCompact] = useState(true);

  // 2026-08-21 実バグ: 「次のLessonへ」で移動してもこのコンポーネントは作り直されないため、
  // slideIndexが前のLessonの位置のまま残り、**新しいLessonの途中（クイズやまとめ）から
  // 始まっていた。** Lessonが変わったら必ず先頭（表紙）へ戻す。
  // initialSlideIdが指すスライドがあるときだけそこへ飛ぶ（復習導線からのジャンプ）。
  useEffect(() => {
    const found = initialSlideId ? slides.findIndex(s => s.id === initialSlideId) : -1;
    setSlideIndex(found >= 0 ? found : 0);
    // slidesは毎回新しい配列なので依存に入れない（入れると毎レンダー先頭へ戻る）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, initialSlideId]);

  const accent = course.color || PRODUCT_ACCENT.learning.accent;
  const lessonsDone = lrn.getLessonsDone(course.id);
  const completed = !!lessonsDone[lesson.id]?.completed;
  const idx = lessons.findIndex(l => l.id === lesson.id);
  const prev = idx > 0 ? lessons[idx - 1] : null;
  const next = idx < lessons.length - 1 ? lessons[idx + 1] : null;

  // 演習未提出の明示（フェーズ4）。既存の一括取得フック(lrn.getExerciseSubmissionsForLesson)を使い、
  // スライドごとの個別リクエストを増やさない。
  const exerciseSubmissions = lrn?.getExerciseSubmissionsForLesson ? lrn.getExerciseSubmissionsForLesson(course.id, lesson.id) : [];
  const submittedSlideIds = new Set(exerciseSubmissions.map(s => s.slideId));
  const pendingSlides = contentSlides.filter(s => slideNeedsSubmission(s) && !submittedSlideIds.has(s.id));
  const pendingIds = new Set(pendingSlides.map(s => s.id));

  function handleComplete() {
    onComplete(course.id, lesson.id);
    if (next) onNavigate(next);
    else onBack();
  }

  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-70" style={{ color: C.muted }}>
        <ChevronLeft size={16} />{course.title}へ戻る
      </button>

      <LearningExperienceFlow
        activeKey={slides[slideIndex]?.stage || displayStage(slides[slideIndex])}
        compact
        className="mb-5"
      />

      {pendingSlides.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-2.5" style={{ background: T.warningSubtle, border: `1px solid ${T.warning}30` }}>
          <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: T.warning }}>
            <AlertCircle size={14} />未提出の演習が{pendingSlides.length}件あります
          </span>
          <button
            type="button"
            onClick={() => setSlideIndex(slides.findIndex(s => s.id === pendingSlides[0].id))}
            className="text-xs font-bold underline"
            style={{ color: T.warning }}
          >
            該当ページへ移動
          </button>
        </div>
      )}

      {/* 2026-08-21 スマホ対応: 縦積みのままだと、スライド本文に着くまでに全ページの一覧を
          スクロールすることになっていた。スマホでは**本文を最初**に出し、ページ一覧は
          その下（折りたたみ）へ回す。lg以上は従来どおり左ナビ・本文・右情報の3カラム。 */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <LeftSlideNav slides={slides} current={slideIndex} onSelect={setSlideIndex} accent={accent} pendingIds={pendingIds} />
        <MainSlidePanel slides={slides} index={slideIndex} setIndex={setSlideIndex} accent={accent} lrn={lrn} courseId={course.id} lessonId={lesson.id} contentCount={contentSlides.length} lesson={lesson} />
        <RightSidebar course={course} lesson={lesson} lrn={lrn} idx={idx} lessons={lessons} accent={accent} compact={rightCompact} onToggle={() => setRightCompact(v => !v)} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4" style={{ background: C.canvas }}>
        <ReactionBar course={course} lesson={lesson} lrn={lrn} accent={accent} />
        <div className="flex items-center gap-2">
          {prev && (
            <button onClick={() => onNavigate(prev)} className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:shadow-sm" style={{ border: `1px solid ${C.line}`, background: "#fff", color: C.body }}>
              <ChevronLeft size={15} />前のレッスン
            </button>
          )}
          <Btn icon={completed ? CheckCircle2 : Check} onClick={handleComplete}>
            {completed ? "次へ進む" : next ? "完了して次のLessonへ" : "完了する"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
