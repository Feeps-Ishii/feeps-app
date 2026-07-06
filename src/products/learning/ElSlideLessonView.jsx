import React, { useState } from "react";
import {
  ChevronLeft, ChevronRight, Lightbulb, FileText, Download, Check, X,
  Play, PlayCircle, Circle, CheckCircle2, Loader2, Sparkles,
} from "lucide-react";
import { Btn, T, PRODUCT_ACCENT } from "../../components/common";
import { LessonBodyText } from "./LearningComponents.jsx";
import { apiPost } from "../../api.js";

// slidesを持つLesson専用の「メインスライド中心」表示。lesson.slides?.length > 0 の場合のみ
// ElLessonView.jsx からこのコンポーネントへ分岐する（既存のvideo/text/quiz Lessonはこのファイルを
// 一切経由しない）。UIモック(products/learning/mock/LessonPreviewMock.jsx)で検証した構成を踏襲しつつ、
// 実データ（course.color, lrn の各種Hook）に接続している。
// terminalの interaction はPhase1では本物のコード実行を行わないフロント内デモ動作のまま。
// quizのinteraction.type: "choice"(デフォルト、選択式、フロント内で完結) / "descriptive"(自由記述、
// Training製品で既に本番稼働中のPOST /ai/tests/evaluateをそのまま流用してAI採点。Backend新規実装
// なし。回答・スコアは永続化しない、フロント内デモのまま。2026-07-07追加)。

const C = {
  ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase,
};

const REACTIONS = [
  { key: "understood", emoji: "🙂", label: "理解できた" },
  { key: "uncertain", emoji: "😐", label: "少し不安" },
  { key: "review_later", emoji: "🤔", label: "後で復習したい" },
];

function orderedSlides(lesson) {
  return [...(lesson.slides || [])].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
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

function LeftSlideNav({ slides, current, onSelect, accent }) {
  return (
    <div className="lg:sticky lg:top-6 lg:w-[190px] lg:shrink-0">
      <SectionLabel>このLessonのページ</SectionLabel>
      <div className="space-y-1">
        {slides.map((slide, i) => {
          const active = i === current;
          return (
            <button
              key={slide.id || i}
              type="button"
              onClick={() => onSelect(i)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition"
              style={{ background: active ? accent : "transparent", color: active ? "#fff" : C.body, fontWeight: active ? 700 : 500 }}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: active ? "rgba(255,255,255,.25)" : T.bgBase, color: active ? "#fff" : C.muted }}
              >
                {i + 1}
              </span>
              <span className="truncate">{slide.navLabel || slide.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TerminalSlideBody({ slide, accent }) {
  const interaction = slide.interaction || {};
  const [command, setCommand] = useState(interaction.initialCommand || "");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  function handleRun() {
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      setRunning(false);
      const ok = command.trim() === String(interaction.expectedCommand || "").trim();
      setResult({ ok, text: ok ? interaction.successOutput : interaction.errorOutput });
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

// 自由記述式quiz。Training製品で既に本番稼働中のPOST /ai/tests/evaluate(questionType: "descriptive")
// をそのまま流用してBedrockでAI採点する。Backend側の新規実装は無い。回答・スコアは永続化しない
// (terminal/quizと同じくフロント内デモで完結、ページ離脱で消える)。
function DescriptiveQuizBody({ slide, interaction, accent }) {
  const [answer, setAnswer] = useState("");
  const [state, setState] = useState("idle"); // idle | grading | done | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleGrade() {
    if (!answer.trim() || state === "grading") return;
    setState("grading");
    setErrorMsg("");
    try {
      const data = await apiPost("/ai/tests/evaluate", {
        questionId: slide.id || "",
        questionType: "descriptive",
        answerMode: "explanation",
        question: interaction.question || "",
        studentAnswer: answer.trim(),
        modelAnswer: interaction.modelAnswer || "",
        explanation: interaction.rubric || "",
        points: 10,
      });
      setResult(data);
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
      {state !== "done" && (
        <button
          type="button"
          onClick={handleGrade}
          disabled={state === "grading" || !answer.trim()}
          className="mt-3 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: accent }}
        >
          {state === "grading" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {state === "grading" ? "採点しています..." : "採点する"}
        </button>
      )}
      {state === "error" && (
        <p className="mt-3 text-xs font-semibold" style={{ color: "#ef4444" }}>{errorMsg}</p>
      )}
      {state === "done" && result && (
        <div className="mt-4 rounded-xl p-4" style={{ background: result.correct ? "#f0fdf4" : "#fffbeb", border: `1px solid ${result.correct ? "#bbf7d0" : "#fde68a"}` }}>
          <div className="mb-1 text-sm font-bold" style={{ color: result.correct ? "#15803d" : "#b45309" }}>
            AI採点: {Number(result.score) || 0}点{result.correct ? "（正解）" : ""}
          </div>
          {result.comment && <p className="text-sm leading-relaxed" style={{ color: C.body }}>{result.comment}</p>}
          {result.advice && <p className="mt-2 text-xs leading-relaxed" style={{ color: C.muted }}>アドバイス: {result.advice}</p>}
        </div>
      )}
    </div>
  );
}

function QuizSlideBody({ slide, accent }) {
  const interaction = slide.interaction || {};
  if (interaction.type === "descriptive") {
    return <DescriptiveQuizBody slide={slide} interaction={interaction} accent={accent} />;
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
function SlideRenderer({ slide, accent }) {
  if (!slide) return null;
  const content = slide.content || {};
  switch (slide.kind) {
    case "concept":
      return (
        <div>
          <h3 className="mb-3 text-xl font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{slide.title}</h3>
          <LessonBodyText body={content.body} />
        </div>
      );
    case "image":
      return (
        <div>
          <h3 className="mb-3 text-xl font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{slide.title}</h3>
          {content.url && (
            <img src={content.url} alt={content.alt || slide.title} className="max-h-[420px] w-full rounded-xl object-contain" style={{ background: T.bgBase }} />
          )}
          {content.caption && <p className="mt-3 text-sm leading-relaxed" style={{ color: C.muted }}>{content.caption}</p>}
        </div>
      );
    case "diagram":
      return (
        <div>
          <h3 className="mb-4 text-xl font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{slide.title}</h3>
          <div className="space-y-2">
            {(content.layers || []).map((layer, i, arr) => (
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
    case "table":
      return (
        <div>
          <h3 className="mb-4 text-xl font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{slide.title}</h3>
          <table className="w-full border-collapse overflow-hidden rounded-xl text-sm" style={{ border: `1px solid ${C.line}` }}>
            <thead>
              <tr>
                {(content.columns || []).map(col => (
                  <th key={col} className="px-3 py-2 text-left text-xs font-bold" style={{ background: T.bgBase, color: C.muted, borderBottom: `1px solid ${C.line}` }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(content.rows || []).map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, i) => (
                    <td key={i} className="px-3 py-2.5" style={{ color: i === 0 ? C.ink : C.body, fontWeight: i === 0 ? 700 : 400, borderBottom: `1px solid ${C.line}` }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "video":
      return <VideoSlideBody slide={slide} />;
    case "terminal":
      return <TerminalSlideBody slide={slide} accent={accent} />;
    case "quiz":
      return <QuizSlideBody slide={slide} accent={accent} />;
    case "summary":
    default:
      return (
        <div>
          <h3 className="mb-4 text-xl font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{slide.title}</h3>
          <ul className="space-y-2.5">
            {(content.points || []).map((p, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[16px]" style={{ color: C.body }}>
                <Check size={16} className="mt-0.5 shrink-0" style={{ color: accent }} />{p}
              </li>
            ))}
          </ul>
        </div>
      );
  }
}

function MainSlidePanel({ slides, index, setIndex, accent }) {
  const slide = slides[index];
  return (
    <div className="min-w-0 flex-1">
      <div className="rounded-2xl p-8" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
        <div className="flex min-h-[300px] flex-col justify-center">
          <SlideRenderer slide={slide} accent={accent} />
        </div>
      </div>

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
        <span className="text-xs font-semibold tabular-nums" style={{ color: C.body }}>{index + 1} / {slides.length}</span>
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

      {slide?.caption && (
        <div className="mt-4 rounded-xl p-4" style={{ background: T.bgBase }}>
          <div className="mb-1 text-xs font-bold" style={{ color: C.muted }}>このページの説明</div>
          <p className="text-sm leading-relaxed" style={{ color: C.body }}>{slide.caption}</p>
        </div>
      )}
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

function RightSidebar({ course, lesson, lrn, idx, lessons, accent }) {
  return (
    <div className="space-y-6 lg:sticky lg:top-6 lg:w-[280px] lg:shrink-0">
      <div>
        <div className="mb-1 text-xs font-bold uppercase" style={{ color: accent, letterSpacing: "0.08em" }}>{course.title} · Lesson {idx + 1}</div>
        <h2 className="text-lg font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{lesson.title}</h2>
        {lesson.summary && <p className="mt-0.5 text-xs" style={{ color: C.muted }}>{lesson.summary}</p>}
      </div>

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
  );
}

function ReactionBar({ course, lesson, lrn, accent }) {
  const review = lrn.getLessonReview(course.id, lesson.id);
  function select(status) { lrn.setLessonReview(course.id, lesson.id, { status, reviewed: false }); }
  return (
    <div className="flex items-center gap-1.5">
      {REACTIONS.map(r => (
        <button
          key={r.key}
          type="button"
          title={r.label}
          onClick={() => select(r.key)}
          className="rounded-full px-2.5 py-1.5 text-base transition"
          style={{ background: review?.status === r.key ? `${accent}1A` : "transparent" }}
        >
          {r.emoji}
        </button>
      ))}
    </div>
  );
}

export default function ElSlideLessonView({ course, lesson, lrn, onBack, onNavigate, onComplete, lessons }) {
  const slides = orderedSlides(lesson);
  const [slideIndex, setSlideIndex] = useState(0);
  const accent = course.color || PRODUCT_ACCENT.learning.accent;
  const lessonsDone = lrn.getLessonsDone(course.id);
  const completed = !!lessonsDone[lesson.id]?.completed;
  const idx = lessons.findIndex(l => l.id === lesson.id);
  const prev = idx > 0 ? lessons[idx - 1] : null;
  const next = idx < lessons.length - 1 ? lessons[idx + 1] : null;

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

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <LeftSlideNav slides={slides} current={slideIndex} onSelect={setSlideIndex} accent={accent} />
        <MainSlidePanel slides={slides} index={slideIndex} setIndex={setSlideIndex} accent={accent} />
        <RightSidebar course={course} lesson={lesson} lrn={lrn} idx={idx} lessons={lessons} accent={accent} />
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
