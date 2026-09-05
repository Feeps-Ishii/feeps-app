import React, { useMemo, useState } from "react";
import { Card, Badge, Btn, T } from "../../../components/common";
import { methodOf, roleSlotsFor, phasesFor, stepsForRole } from "./phases.js";

// 開発演習の入口（2026-09-05）。承認モック: mock/devlab-start
//
// 案件が並んでいても「自分はどれをやればいいのか」が分からない。
// **やりたいこと・経験・進め方**の3つを聞いて、案件と担当を1組にして出す。
//
// 質問は3つまで。増やすほど答えずに離脱する。
// **選ばなかった候補と、なぜ選んだかを必ず見せる**（隠すと「なぜこれ？」になる）。

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[19px] w-[19px]">{d}</svg>
);
const P = (...ds) => <>{ds.map((d, i) => <path key={i} d={d} />)}</>;

const ICONS = {
  hear: <Icon d={P("M3 6.5A2.5 2.5 0 0 1 5.5 4h8A2.5 2.5 0 0 1 16 6.5v4A2.5 2.5 0 0 1 13.5 13H8l-4 3v-3H5.5", "M19 9.5A2.5 2.5 0 0 1 21 12v4a2.5 2.5 0 0 1-2 2.45V21l-3-2.5h-4")} />,
  screen: <Icon d={<><rect x="2.5" y="4" width="19" height="13" rx="2" /><path d="M8 21h8M12 17v4M6 8h6M6 11h4" /></>} />,
  data: <Icon d={<><ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" /><path d="M4.5 5.5v6c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-6" /><path d="M4.5 11.5v6c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-6" /></>} />,
  check: <Icon d={P("M8.5 3.5h7a1 1 0 0 1 1 1V6a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z", "M16.5 5H19a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2.5", "m8.5 13 2.5 2.5 4.5-4.5")} />,
  loop: <Icon d={P("M4 9a8 8 0 0 1 13.6-4.6L20 7", "M20 3v4h-4", "M20 15a8 8 0 0 1-13.6 4.6L4 17", "M4 21v-4h4")} />,
  sprout: <Icon d={P("M12 20v-7", "M12 13c0-3.3-2.7-6-6-6H4v1.5A5.5 5.5 0 0 0 9.5 14H12Z", "M12 13c0-2.8 2.2-5 5-5h3v1a5 5 0 0 1-5 5h-3Z", "M7 20h10")} />,
  book: <Icon d={P("M4 5.5A2.5 2.5 0 0 1 6.5 3H19v14H6.5A2.5 2.5 0 0 0 4 19.5Z", "M4 19.5A2.5 2.5 0 0 1 6.5 17H19v4H6.5A2.5 2.5 0 0 1 4 19.5Z", "M8.5 7.5h6M8.5 10.5h4")} />,
  work: <Icon d={<><rect x="2.5" y="7" width="19" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M2.5 12.5h19M11 12v2h2v-2" /></>} />,
  steps: <Icon d={P("M3 20h5v-5", "M8 15h5v-5", "M13 10h5V5", "M18 5h3")} />,
  cycle: <Icon d={<><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 4v5h-5" /><circle cx="12" cy="12" r="2.5" /></>} />,
  auto: <Icon d={P("m12 3 1.6 4.2L18 8.8l-4.4 1.6L12 14.6l-1.6-4.2L6 8.8l4.4-1.6Z", "m18.5 15.5.8 2.1 2.2.8-2.2.8-.8 2.1-.8-2.1-2.2-.8 2.2-.8Z", "M5 16.5h4M7 14.5v4")} />,
};

const QUESTIONS = [
  {
    key: "want", title: "この案件で、いちばんやってみたいことは？",
    sub: "選んだものが、あなたの担当になります。あとから変えられます",
    opts: [
      { v: "upstream", ic: "hear", nm: "お客様の要望を聞いて、決める", ds: "曖昧な要望から要件を引き出し、設計に落とすところまで" },
      { v: "front", ic: "screen", nm: "画面をつくる", ds: "見た目と操作。入力チェックやエラー表示まで" },
      { v: "back", ic: "data", nm: "処理とデータをつくる", ds: "認証・保存・API。テーブル設計から実装まで" },
      { v: "qa", ic: "check", nm: "ちゃんと動くかを確かめる", ds: "テストの観点を作り、不具合を見つけて報告する" },
      { v: "all", ic: "loop", nm: "ひととおり全部やってみたい", ds: "1つの案件を、最初から最後まで自分で通す" },
    ],
  },
  {
    key: "exp", title: "開発の経験はどのくらい？",
    sub: "案件のレベルを決めるのに使います",
    opts: [
      { v: "none", ic: "sprout", nm: "はじめて", ds: "プログラムを書いたことがない、または学習中" },
      { v: "training", ic: "book", nm: "研修で少し書いた", ds: "Eラーニングの演習は通した。実務はこれから" },
      { v: "work", ic: "work", nm: "実務で書いている", ds: "業務でコードを書いた経験がある" },
    ],
  },
  {
    key: "method", title: "進め方はどちらがいい？",
    sub: "同じ案件でも、進み方と話す相手が変わります",
    opts: [
      { v: "waterfall", ic: "steps", nm: "決めてから作る", ds: "要件定義→設計→実装→テスト。工程の名前と順番を先に覚えられます" },
      { v: "agile", ic: "cycle", nm: "作りながら決める", ds: "2週間で動くものを見せて、次を決め直します" },
      { v: "any", ic: "auto", nm: "おまかせ", ds: "経験に合わせてこちらで選びます" },
    ],
  },
];

// 「やりたいこと」→ 担当。アジャイルの案件は担当の分け方が違うので読み替える
const AGILE_MAP = { upstream: "po", front: "dev", back: "dev", qa: "qa", all: "all" };

const COUNTERPART_LINE = {
  client: "相手役は<b>お客様</b>です。<b>聞かないと言ってくれません</b>",
  po: "相手役は<b>プロダクトオーナー</b>です。途中で要望が変わります",
  senpai: "相手役は<b>先輩エンジニア</b>です。<b>答えのコードは書きません</b>",
  qa_lead: "相手役は<b>QAリーダー</b>です。テストの観点と不具合報告の書き方を見ます",
  pm: "相手役は<b>PM</b>です。工数と優先順位を相談することになります",
  sre: "相手役は<b>インフラの先輩</b>です。構成とコストを見ます",
};

// 案件ごとに点を付ける。**規則は画面にも出す**（隠すと「なぜこれ？」になる）
function scoreProject(project, answers) {
  const method = methodOf(project);
  const slots = roleSlotsFor(project);
  const wantKey = method === "agile" ? AGILE_MAP[answers.want] : answers.want;
  const slot = slots.find(s => s.roleSlotId === wantKey);
  // その担当が置かれていない案件は候補から外す（APIだけの案件に「画面を作りたい」人は出さない）
  if (!slot) return null;
  // 上位プラン限定の担当はここでは勧めない
  if (slot.premium) return null;
  const count = stepsForRole(project.steps, slot).length;
  if (!count) return null;

  const reasons = [];
  let pts = 2;
  reasons.push(`<b>${slot.name}</b>として入れます（この案件では <b>${count} / ${(project.steps || []).length} 件</b>のタスクを担当します）`);

  const wantLevel = answers.exp === "work" ? "intermediate" : "beginner";
  if ((project.level || "beginner") === wantLevel) {
    pts += 2;
    reasons.push(answers.exp === "work"
      ? "実務経験があるので、<b>中級</b>の案件を選びました"
      : "<b>初級</b>の案件なので、はじめてでも進められます");
  }

  const wantMethod = answers.method === "any" ? (answers.exp === "work" ? "agile" : "waterfall") : answers.method;
  if (method === wantMethod) {
    pts += 2;
    reasons.push(method === "waterfall"
      ? "<b>ウォーターフォール</b>なので、工程の名前と順番を先に覚えられます"
      : "<b>アジャイル</b>なので、2週間で動くものを見せる進め方を体験できます");
  }

  reasons.push(COUNTERPART_LINE[slot.counterpart] || COUNTERPART_LINE.pm);
  return { project, slot, count, pts, reasons, method };
}

function Rail({ step }) {
  const labels = ["やりたいこと", "経験", "進め方", "おすすめ"];
  return (
    <div className="flex items-center px-1 pb-4 pt-1">
      {labels.map((lb, i) => (
        <React.Fragment key={lb}>
          {i > 0 && <span className="mx-2 h-0.5 flex-1 rounded" style={{ background: step >= i ? T.success : T.border }} />}
          <span className="flex min-w-0 items-center gap-2">
            <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-[11px] font-bold"
              style={step > i
                ? { background: T.success, color: "#fff", border: `2px solid ${T.success}` }
                : step === i
                  ? { background: T.bgSurface, color: T.accent, border: `2px solid ${T.accent}`, boxShadow: `0 0 0 4px ${T.accentSubtle}` }
                  : { background: T.bgSurface, color: T.textMuted, border: `2px solid ${T.border}` }}>
              {step > i ? "✓" : i + 1}
            </span>
            <span className="hidden whitespace-nowrap text-xs font-bold sm:inline"
              style={{ color: step >= i ? T.textPrimary : T.textMuted }}>{lb}</span>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

export default function StartWizard({ projects, onStart, onSkip }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});

  const ranked = useMemo(() => {
    if (step < QUESTIONS.length) return [];
    return projects.map(p => scoreProject(p, answers)).filter(Boolean).sort((a, b) => b.pts - a.pts);
  }, [step, answers, projects]);

  if (step < QUESTIONS.length) {
    const q = QUESTIONS[step];
    return (
      <Card className="p-5">
        <Rail step={step} />
        <h3 className="text-lg font-bold" style={{ color: T.textPrimary }}>{q.title}</h3>
        <p className="mb-4 mt-1 text-xs" style={{ color: T.textMuted }}>{q.sub}</p>
        <div className="grid gap-2.5">
          {q.opts.map(o => (
            <button
              key={o.v} type="button"
              onClick={() => { setAnswers(a => ({ ...a, [q.key]: o.v })); setStep(step + 1); }}
              className="flex items-start gap-3 rounded-xl border p-3.5 text-left transition hover:shadow-sm"
              style={{ borderColor: T.border, background: T.bgSurface }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = T.accentSubtle; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.bgSurface; }}
            >
              <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl"
                style={{ background: T.accentSubtle, color: T.accentHover }}>{ICONS[o.ic]}</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold" style={{ color: T.textPrimary }}>{o.nm}</span>
                <span className="block text-xs" style={{ color: T.textSecondary }}>{o.ds}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {step > 0 && <Btn kind="ghost" size="sm" onClick={() => setStep(step - 1)}>← 前へ</Btn>}
          <Btn kind="ghost" size="sm" onClick={onSkip}>質問せず一覧から選ぶ</Btn>
        </div>
      </Card>
    );
  }

  const top = ranked[0];
  if (!top) {
    return (
      <Card className="p-5">
        <p className="text-sm" style={{ color: T.textSecondary }}>
          いまの条件に合う案件がありませんでした。一覧から選んでください。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn kind="ghost" size="sm" onClick={() => { setStep(0); setAnswers({}); }}>答え直す</Btn>
          <Btn size="sm" onClick={onSkip}>一覧を見る</Btn>
        </div>
      </Card>
    );
  }

  const p = top.project;
  return (
    <Card className="p-5">
      <Rail step={3} />
      <p className="text-xs" style={{ color: T.textMuted }}>答えてもらった内容から、これをおすすめします</p>

      <div className="mt-2 rounded-2xl p-4"
        style={{ background: T.accentSubtle, border: `1px solid ${T.accent}` }}>
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-bold" style={{ color: T.textPrimary }}>{p.title}</h3>
            <p className="text-xs" style={{ color: T.textSecondary }}>{p.clientName}</p>
          </div>
          <span className="ml-auto flex flex-wrap gap-1.5">
            <Badge tone={p.level === "beginner" ? "green" : "amber"}>{p.level === "beginner" ? "初級" : p.level === "advanced" ? "上級" : "中級"}</Badge>
            <Badge tone="cyan">{top.method === "waterfall" ? "ウォーターフォール" : "アジャイル"}</Badge>
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {[["あなたの担当", top.slot.name], ["担当するタスク", `${top.count} / ${(p.steps || []).length} 件`],
            ["工程", (top.slot.phases || []).map(id => (phasesFor(top.method).find(x => x.id === id) || {}).label).filter(Boolean).join("・") || "工程の外"]]
            .map(([k, v]) => (
              <div key={k} className="rounded-xl border px-3 py-2" style={{ borderColor: T.border, background: T.bgSurface }}>
                <div className="text-[10.5px] font-bold" style={{ color: T.textMuted }}>{k}</div>
                <div className="text-[13.5px] font-bold" style={{ color: T.textPrimary }}>{v}</div>
              </div>
            ))}
        </div>

        <div className="mt-3 rounded-xl border p-3" style={{ borderColor: T.border, background: T.bgSurface }}>
          <h4 className="mb-1.5 text-[11.5px] font-bold" style={{ color: T.textMuted }}>この案件を選んだ理由</h4>
          <ul className="flex flex-col gap-1.5">
            {top.reasons.map((r, i) => (
              <li key={i} className="flex gap-2 text-[13px]" style={{ color: T.textSecondary }}>
                <span className="font-bold" style={{ color: T.success }}>✓</span>
                <span dangerouslySetInnerHTML={{ __html: r }} />
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Btn onClick={() => onStart(p.id, top.slot.roleSlotId)}>この担当で始める</Btn>
          <Btn kind="ghost" onClick={() => { setStep(0); setAnswers({}); }}>答え直す</Btn>
        </div>
      </div>

      {ranked.length > 1 && (
        <div className="mt-4">
          <h4 className="mb-2 text-[13px] font-bold" style={{ color: T.textPrimary }}>ほかの候補</h4>
          <div className="flex flex-col gap-2">
            {ranked.slice(1).map(x => (
              <div key={x.project.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
                style={{ borderColor: T.border, background: T.bgSurface }}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold" style={{ color: T.textPrimary }}>{x.project.title}</div>
                  <div className="text-xs" style={{ color: T.textSecondary }}>
                    {x.slot.name}として {x.count} / {(x.project.steps || []).length} 件。
                    {x.method === "waterfall" ? "ウォーターフォール" : "アジャイル"}
                  </div>
                </div>
                <span className="text-[11.5px]" style={{ color: T.textMuted }}>一致度 {x.pts} / 6</span>
                <Btn kind="ghost" size="sm" onClick={() => onStart(x.project.id, x.slot.roleSlotId)}>これにする</Btn>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs" style={{ color: T.textMuted }}>
        担当は始めたあとでも変えられます。同じ案件を、担当を変えて何周でもできます。
      </p>
    </Card>
  );
}
