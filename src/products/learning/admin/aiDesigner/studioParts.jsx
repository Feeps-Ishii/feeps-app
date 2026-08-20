// AIコーススタジオの部品（2026-08-19新設）。
// 承認されたモック（mock/course-studio）に沿って、5ステップ表示をやめ
// 「作っているコースそのものが画面」になる構成へ作り替えたときに切り出したもの。
// AiLessonDesigner.jsx が肥大化しないよう、表示だけを持つ部品をここへ置く。
import React from "react";
import {
  AlertCircle, ArrowRight, CheckCircle2, ClipboardList, Eye, FileText,
  Loader2, MessageSquare, Pencil, Sparkles, Wand2,
} from "lucide-react";
import { T, NOVA, PRODUCT_ACCENT } from "../../../../components/common";

export const ACCENT = PRODUCT_ACCENT.learning.accent;
export const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border };

// スライドkind → 受講生・講師に伝わる日本語ラベル。演習系はまとめて「演習」に畳む
// （kind名を全部見せても作り手の判断材料にならないため）。
const KIND_GROUP = {
  concept: "説明", diagram: "図解", table: "表", compare: "比較",
  quiz: "クイズ", summary: "まとめ",
  terminal: "演習", selection_task: "演習", ordering_puzzle: "演習",
  fill_blank: "演習", interactive_form: "演習",
};
const GROUP_ORDER = ["説明", "図解", "表", "比較", "クイズ", "演習", "まとめ"];
const GROUP_TONE = {
  クイズ: { bg: T.accentSubtle, fg: T.accent, border: `${T.accent}29` },
  演習: { bg: T.aiSubtle, fg: T.aiAccentDeep, border: `${T.aiAccent}39` },
};

export function slideStats(lesson) {
  const counts = new Map();
  for (const slide of (lesson?.slides || [])) {
    const label = KIND_GROUP[slide?.kind] || "説明";
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return GROUP_ORDER.filter(g => counts.has(g)).map(g => ({ label: g, count: counts.get(g) }));
}

export function courseTotals(lessons) {
  const list = lessons || [];
  let slides = 0; let exercises = 0; let minutes = 0;
  for (const lesson of list) {
    slides += (lesson.slides || []).length;
    exercises += (lesson.slides || []).filter(s => KIND_GROUP[s?.kind] === "演習").length;
    minutes += Number(lesson.estimatedMinutes) || 0;
  }
  return { lessons: list.length, slides, exercises, minutes };
}

// ---- つくり方を選ぶ（入口） ----
// 既存の「＋コース追加」の選択（自分で作る／AIに任せる）を受けて、AIを使う場合の
// 入り方をここで選ばせる。あとから切り替えられることを明記して、重い決断にしない。
export function StartChooser({ onPickForm, onPickChat, chatEnabled, onSelfBuild }) {
  return (
    <div className="mx-auto max-w-[760px]">
      <div className="mb-5">
        <h3 className="text-lg font-bold" style={{ color: C.ink, letterSpacing: "-0.01em" }}>新しいコースをつくる</h3>
        <p className="mt-1 text-xs" style={{ color: C.muted }}>どのつくり方で始めますか？</p>
      </div>

      <div className={`grid gap-3 ${chatEnabled ? "sm:grid-cols-2" : ""}`}>
        {chatEnabled && (
          <button
            type="button"
            onClick={onPickChat}
            className="rounded-2xl p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: T.aiSubtle, border: `2px solid ${T.aiAccent}` }}
          >
            <span className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: T.aiAccentDeep }}>
              <MessageSquare size={20} color={NOVA.onDark} />
            </span>
            <div className="text-[15px] font-bold" style={{ color: C.ink }}>AIと相談してつくる</div>
            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: C.body }}>
              「新卒向けにAWSの基礎」のように話しかけるだけ。AIが足りない条件を聞きながら組み立てます。
            </p>
          </button>
        )}

        <button
          type="button"
          onClick={onPickForm}
          className="rounded-2xl p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg"
          style={{ background: NOVA.card, border: `1px solid ${C.line}`, boxShadow: NOVA.shadowSm }}
        >
          <span className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: T.accentSubtle }}>
            <FileText size={20} color={T.accent} />
          </span>
          <div className="text-[15px] font-bold" style={{ color: C.ink }}>フォームに条件を入れる</div>
          <p className="mt-1.5 text-xs leading-relaxed" style={{ color: C.body }}>
            目的・対象者・時間などを一度に入力します。つくるものが決まっているときはこちらが速いです。
          </p>
        </button>
      </div>

      {chatEnabled && (
        <div className="mt-3.5 flex items-center gap-2.5 rounded-2xl px-4 py-3" style={{ background: T.bgBase }}>
          <Sparkles size={15} style={{ color: C.muted, flexShrink: 0 }} />
          <span className="text-xs leading-relaxed" style={{ color: C.body }}>
            <span className="font-bold" style={{ color: C.ink }}>どちらを選んでも、あとから切り替えられます。</span>
            入れた条件はそのまま引き継がれます。
          </span>
        </div>
      )}

      {onSelfBuild && (
        <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4" style={{ borderColor: C.line }}>
          <button
            type="button"
            onClick={onSelfBuild}
            className="flex items-center gap-1.5 text-xs font-semibold transition hover:opacity-70"
            style={{ color: C.body }}
          >
            <Pencil size={14} />AIを使わず、自分で1から作る
          </button>
        </div>
      )}
    </div>
  );
}

// ---- 左レール: つくる条件（案Aの粒度） ----
export function ConditionCard({ brief, onEdit }) {
  const chips = [brief.duration, brief.difficulty, brief.exercisesEnabled !== false ? "演習あり" : "演習なし"].filter(Boolean);
  const techs = String(brief.techs || "").split(/[,、]/).map(s => s.trim()).filter(Boolean);
  return (
    <div className="rounded-2xl p-4.5" style={{ background: NOVA.card, border: `1px solid ${C.line}`, boxShadow: NOVA.shadowSm, padding: 18 }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold" style={{ color: C.ink }}>つくる条件</span>
        <button type="button" onClick={onEdit} className="flex items-center gap-1 text-xs font-semibold transition hover:opacity-70" style={{ color: T.accent }}>
          <Pencil size={12} />変更
        </button>
      </div>
      <div className="space-y-2.5">
        <div>
          <div className="mb-0.5 text-[11px] font-semibold" style={{ color: C.muted }}>目的・到達点</div>
          <div className="text-xs leading-relaxed" style={{ color: C.ink }}>{brief.goals || "未設定"}</div>
        </div>
        <div className="h-px" style={{ background: C.line }} />
        <div>
          <div className="mb-0.5 text-[11px] font-semibold" style={{ color: C.muted }}>対象者</div>
          <div className="text-xs leading-relaxed" style={{ color: C.ink }}>{brief.audience || "未設定"}</div>
        </div>
        {chips.length > 0 && (
          <>
            <div className="h-px" style={{ background: C.line }} />
            <div className="flex flex-wrap gap-1.5">
              {chips.map(chip => (
                <span key={chip} className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: NOVA.soft, color: C.body }}>{chip}</span>
              ))}
            </div>
          </>
        )}
        {techs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {techs.map(tech => (
              <span key={tech} className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: T.accentSubtle, color: T.accent }}>{tech}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- 左レール: 公開までにやること ----
// 旧「5ステップ」の代わり。ステップは画面遷移ではなく“残りの仕事”として見せる。
export function TodoCard({ hasBrief, lessonsTotal, lessonsReviewed, hasFinalTest, saved }) {
  const items = [
    { label: "条件を決める", done: hasBrief },
    {
      label: "Lessonを確認する",
      done: lessonsTotal > 0 && lessonsReviewed >= lessonsTotal,
      sub: lessonsTotal > 0 && lessonsReviewed < lessonsTotal ? `残り${lessonsTotal - lessonsReviewed}件` : "",
      current: lessonsTotal > 0 && lessonsReviewed < lessonsTotal,
    },
    { label: "総合テストを作る", done: hasFinalTest },
    { label: "下書きを保存する", done: saved },
  ];
  return (
    <div className="rounded-2xl" style={{ background: NOVA.card, border: `1px solid ${C.line}`, boxShadow: NOVA.shadowSm, padding: 18 }}>
      <div className="mb-3.5 text-[13px] font-bold" style={{ color: C.ink }}>公開までにやること</div>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.label} className="flex items-start gap-2.5">
            <span
              className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
              style={item.done
                ? { background: T.successSubtle }
                : { border: `2px solid ${item.current ? T.aiAccent : "rgba(26,28,31,.16)"}` }}
            >
              {item.done && <CheckCircle2 size={12} style={{ color: T.success }} />}
            </span>
            <span className="text-xs leading-snug" style={{ color: item.done ? C.muted : C.ink, fontWeight: item.current ? 600 : 400, textDecoration: item.done ? "line-through" : "none" }}>
              {item.label}
              {item.sub && <><br /><span className="font-normal" style={{ color: C.muted }}>{item.sub}</span></>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- 左レール: できあがり ----
export function SummaryCard({ totals }) {
  const rows = [
    ["Lesson", `${totals.lessons}`],
    ["スライド", `${totals.slides}`],
    ["演習", `${totals.exercises}`],
    ["想定時間", totals.minutes > 0 ? `約${Math.round(totals.minutes / 60 * 10) / 10}時間` : "—"],
  ];
  return (
    <div className="rounded-2xl" style={{ background: NOVA.card, border: `1px solid ${C.line}`, boxShadow: NOVA.shadowSm, padding: 18 }}>
      <div className="mb-3 text-[13px] font-bold" style={{ color: C.ink }}>できあがり</div>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between text-xs" style={{ color: C.body }}>
            <span>{label}</span><span className="font-bold" style={{ color: C.ink }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- 本体: Lesson 1件 ----
export function LessonRow({ index, lesson, slideGen, reviewed, onToggleReview, onRegenerate, onOpenDetail, last }) {
  const status = slideGen?.status || "idle";
  const stats = slideStats(lesson);
  const generated = (lesson.slides || []).length > 0;
  return (
    <div
      className="flex gap-3.5 p-4.5"
      style={{
        padding: 18,
        borderBottom: last ? "none" : `1px solid ${C.line}`,
        background: status === "loading" ? "#FBFAFE" : "transparent",
      }}
    >
      <span
        className="mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-xs font-bold"
        style={reviewed
          ? { background: T.successSubtle, color: T.success }
          : status === "loading"
            ? { background: T.aiSubtle, color: T.aiAccentDeep }
            : { background: NOVA.soft, color: C.muted }}
      >
        {reviewed ? <CheckCircle2 size={13} /> : status === "loading" ? <Loader2 size={13} className="animate-spin" /> : index + 1}
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-bold" style={{ color: generated || status === "loading" ? C.ink : C.body }}>{lesson.title}</div>
        {lesson.summary && <p className="mt-1 text-xs leading-relaxed" style={{ color: C.body }}>{lesson.summary}</p>}

        {status === "loading" && (
          <div className="mt-2.5 flex items-center gap-2.5">
            <div className="h-[5px] max-w-[260px] flex-1 overflow-hidden rounded-full" style={{ background: `${T.aiAccent}24` }}>
              <div className="h-full animate-pulse rounded-full" style={{ width: "62%", background: `linear-gradient(135deg, ${T.aiAccentDeep}, ${T.aiAccent})` }} />
            </div>
            <span className="text-[11.5px] font-semibold" style={{ color: T.aiAccentDeep }}>スライドを作成中…</span>
          </div>
        )}

        {status === "error" && (
          <div className="mt-2.5 flex items-start gap-1.5 rounded-xl p-2.5" style={{ background: T.dangerSubtle }}>
            <AlertCircle size={13} style={{ color: T.danger, flexShrink: 0, marginTop: 1 }} />
            <span className="whitespace-pre-wrap text-[11.5px] leading-relaxed" style={{ color: C.body }}>{slideGen.notice}</span>
          </div>
        )}

        {stats.length > 0 && status !== "loading" && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {stats.map(({ label, count }) => {
              const tone = GROUP_TONE[label];
              return (
                <span
                  key={label}
                  className="rounded-lg px-2 py-[3px] text-[11px]"
                  style={tone
                    ? { background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`, fontWeight: 600 }
                    : { background: T.bgBase, color: C.body, border: `1px solid ${C.line}` }}
                >
                  {label} {count}
                </span>
              );
            })}
          </div>
        )}

        {status === "idle" && !generated && (
          <div className="mt-1.5 text-[11.5px]" style={{ color: C.muted }}>順番待ち</div>
        )}
      </div>

      {generated && status !== "loading" && (
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onOpenDetail(lesson.id)}
            className="rounded-xl px-3 py-[7px] text-xs font-semibold transition hover:opacity-70"
            style={{ background: NOVA.card, border: `1px solid ${C.line}` , color: C.ink }}
          >
            開く
          </button>
          <button
            type="button"
            onClick={() => onRegenerate(lesson.id)}
            title="このLessonを作り直す"
            aria-label="このLessonを作り直す"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-xl transition hover:opacity-70"
            style={{ background: NOVA.card, border: `1px solid ${C.line}`, color: C.muted }}
          >
            <Wand2 size={13} />
          </button>
          <button
            type="button"
            onClick={() => onToggleReview(lesson.id)}
            title={reviewed ? "確認済みを解除する" : "内容を確認した"}
            aria-label={reviewed ? "確認済みを解除する" : "内容を確認した"}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-xl transition hover:opacity-70"
            style={reviewed
              ? { background: T.success, border: `1px solid ${T.success}`, color: NOVA.onDark }
              : { background: NOVA.card, border: `1px solid ${C.line}`, color: C.muted }}
          >
            <CheckCircle2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ---- 本体: 総合テスト ----
export function FinalTestSection({ state, notice, questions, canGenerate, onGenerate }) {
  const has = questions.length > 0;
  return (
    <>
      <div className="mt-1 flex items-center gap-2.5">
        <h2 className="text-[15px] font-bold" style={{ color: C.ink }}>総合テスト</h2>
        <span className="h-px flex-1" style={{ background: C.line }} />
      </div>
      <div
        className="rounded-2xl"
        style={has
          ? { background: NOVA.card, border: `1px solid ${C.line}`, boxShadow: NOVA.shadowSm, padding: 18 }
          : { background: NOVA.card, border: `1px dashed rgba(26,28,31,.18)`, padding: "16px 20px" }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-xl" style={{ background: T.bgBase }}>
            <ClipboardList size={15} style={{ color: C.muted }} />
          </span>
          <span className="flex-1 text-xs" style={{ color: C.body }}>
            {has ? `${questions.length}問できています` : canGenerate ? "コース全体を横断する問題を作れます" : "全Lessonが揃うと、まとめの問題を作れます"}
          </span>
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate || state === "loading"}
            className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-45"
            style={canGenerate
              ? { background: T.aiSubtle, border: `1px solid ${T.aiAccent}39`, color: T.aiAccentDeep }
              : { background: NOVA.soft, border: "1px solid transparent", color: C.muted }}
          >
            {state === "loading" ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {state === "loading" ? "作成中…" : has ? "作り直す" : "総合テストを作る"}
          </button>
        </div>
        {state === "error" && (
          <p className="mt-2.5 whitespace-pre-wrap text-[11.5px] font-semibold" style={{ color: T.danger }}>{notice}</p>
        )}
        {has && (
          <div className="mt-3 space-y-1.5">
            {questions.map((q, i) => (
              <div key={i} className="rounded-xl px-3 py-2 text-xs" style={{ background: T.bgBase, color: C.ink }}>
                {i + 1}. {q.question}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ---- 保存後の導線 ----
export function SavedPanel({ saveNotice, onOpenCourseManager }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: PRODUCT_ACCENT.learning.subtle, border: `1px solid ${ACCENT}30` }}>
      <div className="mb-1 flex items-center gap-2 text-sm font-bold" style={{ color: ACCENT }}>
        <CheckCircle2 size={15} />保存しました
      </div>
      <p className="text-xs leading-relaxed" style={{ color: C.body }}>{saveNotice}</p>
      <button
        type="button"
        onClick={onOpenCourseManager}
        className="mt-3 flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition hover:opacity-80"
        style={{ background: ACCENT, color: NOVA.onDark }}
      >
        コース管理で公開準備へ<ArrowRight size={12} />
      </button>
    </div>
  );
}

export { Eye };
