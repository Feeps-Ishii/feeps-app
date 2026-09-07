import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Circle, Cloud, HelpCircle, Play, RotateCcw, Server, Trash2 } from "lucide-react";
import { T } from "../../components/common";
import { SlideEyebrowText } from "../learning/SlideLayouts.jsx";
import { HTTP, SSH, initialLabState, labChecks, launchInstance, terminateInstance } from "./awsLabModel.js";

// 2026-09-07: AWSの構成を組み立てて、外から届くかを確かめる演習（モック）。
// 正典: docs/specs/aws-lab-spec.md。承認モック: mock/aws-vpc-lab/index.html
//
// **本物のAWSは使わない。** 費用0・アカウント0・事故0で、単元の中身だけを持ってくる。
// 本物のラボ（kind: aws_console）はこのあとに置き、ここで手順が固まってから作る。
//
// この画面の値打ちは2つ。
//   1. **どこで止まったかを名指しする。** 本物だと「なぜか繋がらない」で終わってしまう
//   2. **なぜその設定が要るのかを、その場で開いて読める。** 手順をなぞるだけにしない
//
// 判定は awsLabModel.js（純粋関数）が持つ。画面はその結果を出すだけにして、
// 「見た目を直したら判定が変わる」ことが起きないようにしている。

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

// なぜその設定が要るのか。**AWSの話なのでスライドごとに変わらない**。ここに持たせる
const WHY = {
  igw: {
    q: "なぜインターネットゲートウェイが要るの？",
    a: "VPCは作った時点では**外と完全に切り離されています**。インターネットゲートウェイは、そのVPCに開ける唯一の出入口です。これが無いと、中で何を正しく設定しても外の通信は入って来られません。",
  },
  route: {
    q: "なぜルートを書き換えるの？",
    a: "ルートテーブルは「この宛先はどっちへ流すか」の案内板です。既定では VPC の中（local）だけが書かれていて、**それ以外の宛先＝0.0.0.0/0 の行き先が空**です。ここにIGWを書いて初めて、そのサブネットは外とやり取りできます。**IGWを付けただけでは通らない**のはこのためです。ルートにIGWが書かれたサブネットを「パブリックサブネット」と呼びます。",
  },
  subnet: {
    q: "なぜサブネットを分けるの？",
    a: "外から見せたいもの（Webサーバー）と、見せたくないもの（データベース）を**別の部屋に置く**ためです。部屋ごとにルートを変えられるので、片方だけを公開できます。EC2をどのサブネットに置くかは**起動時に決まり、あとから移せません**。",
  },
  publicIp: {
    q: "なぜパブリックIPが要るの？",
    a: "外から呼ぶための**宛先そのもの**です。道（ルート）が通っていても、宛先が無ければ誰も呼べません。ルートもSGも正しいのに繋がらないとき、たいていここが抜けています。**起動時にしか決められません**（あとから付けるにはElastic IPが要ります）。",
  },
  sg: {
    q: "なぜセキュリティグループを開けるの？",
    a: "EC2の手前に立っている門番で、**既定では受け入れる通信がひとつもありません**。ここまで届いた通信も、開いていない番号なら黙って捨てられます。Webページを見せるなら80番（HTTP）です。SSH（22）を開けても、それは操作用の入口でありHTTPは通りません。**あとからいつでも変えられます。**",
  },
  userData: {
    q: "ユーザーデータって何？",
    a: "EC2が**初めて起動するときに1回だけ**実行されるスクリプトです。ここでWebサーバーを入れて動かしておけば、あとから手で入る必要がありません。引っかかりどころが3つあります。**1行目が #!/bin/bash でないと実行されない**（エラーも出ません）。**入れる（install）と動かす（systemctl）は別**。そして**書き直しても再実行されない**ので、変えたら起動し直します。",
  },
};

const DEFAULT_USER_DATA = "#!/bin/bash\n";
const SAMPLE_HINT = [
  "#!/bin/bash",
  "dnf install -y httpd",
  "systemctl enable --now httpd",
  'echo "<h1>Hello from EC2</h1>" > /var/www/html/index.html',
].join("\n");

// 説明文の **ここ** を太字にする。判定側（awsLabModel.js）が返す理由文にも同じ書き方を使う
function Rich({ text, strong = T.textPrimary }) {
  return String(text || "").split("**").map((part, i) => (
    i % 2 ? <b key={i} style={{ color: strong }}>{part}</b> : <span key={i}>{part}</span>
  ));
}

function Chip({ on, onClick, children, disabled }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-pressed={on}
      className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition disabled:opacity-45"
      style={{
        border: `1px solid ${on ? T.accent : C.line}`,
        background: on ? T.accentSubtle : T.bgSurface,
        color: on ? T.accentHover : C.body,
      }}>
      {children}
    </button>
  );
}

// 「なぜ？」は既定で閉じておく。開けば読める、という置き方にしないと、
// 説明で埋まって肝心の操作盤が見えなくなる
function Why({ item }) {
  const [open, setOpen] = useState(false);
  if (!item) return null;
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}
        className="flex items-center gap-1 text-[11.5px] font-bold" style={{ color: T.aiAccentDeep }}>
        <HelpCircle size={12} />{item.q}
        <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (
        <p className="mt-1.5 mb-0 rounded-lg px-2.5 py-2 text-[12px] leading-[1.85]"
          style={{ background: T.aiSubtle, color: C.body }}>
          <Rich text={item.a} strong={C.ink} />
        </p>
      )}
    </div>
  );
}

function Group({ title, children, why }) {
  return (
    <div className="px-3.5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
      <h4 className="mb-2 mt-0 text-[11.5px] font-extrabold" style={{ color: C.ink, letterSpacing: "0.03em" }}>{title}</h4>
      {children}
      <Why item={why} />
    </div>
  );
}

// ネットワークの絵。SVGではなく箱で組む（390pxでも縦に積んで崩れない）
function NetView({ st }) {
  const inst = st.instance;
  const pub = s => (s === "a" ? st.routeA : st.routeB) === "igw" && st.igw;
  const box = (id, label, cidr) => {
    const isPub = pub(id);
    const here = inst?.subnet === id;
    return (
      <div key={id} className="flex-1 rounded-xl p-2.5" style={{
        border: `1px solid ${isPub ? T.accent : C.line}`,
        background: isPub ? T.accentSubtle : T.bgSurface, minWidth: 150,
      }}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-extrabold" style={{ color: C.ink }}>サブネット{id.toUpperCase()}</span>
          <span className="rounded px-1.5 py-[1px] text-[10px] font-bold" style={{
            background: isPub ? T.accent : T.bgBase, color: isPub ? "#fff" : C.muted,
          }}>{isPub ? "パブリック" : "プライベート"}</span>
        </div>
        <div className="mt-0.5 text-[10.5px]" style={{ fontFamily: MONO, color: C.muted }}>{cidr}</div>
        <div className="mt-1 text-[10.5px]" style={{ color: C.body }}>
          ルート: <b>{(id === "a" ? st.routeA : st.routeB) === "igw" ? "0.0.0.0/0 → IGW" : "local のみ"}</b>
        </div>
        <div className="mt-2 rounded-lg px-2 py-1.5 text-[11px]" style={{
          border: `1px ${here ? "solid" : "dashed"} ${here ? T.accent : C.line}`,
          background: here ? T.bgSurface : "transparent", color: here ? C.ink : C.muted,
        }}>
          {here ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <Server size={12} style={{ color: T.accent }} />
              <b>web-01</b>
              <span style={{ color: C.muted }}>
                {inst.publicIp ? "パブリックIP あり" : "パブリックIP なし"}
                {" ／ "}
                {inst.boot.running ? "httpd 起動中" : "アプリ停止中"}
              </span>
            </span>
          ) : "ここにEC2を置けます"}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center gap-2 text-[12px] font-bold" style={{ color: C.body }}>
        <Cloud size={14} />インターネット
      </div>
      <div className="ml-[7px] h-4 w-[2px]" style={{ background: st.igw ? T.accent : C.line }} />
      <div className="inline-block rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold" style={{
        border: `1px solid ${st.igw ? T.accent : C.line}`,
        background: st.igw ? T.accentSubtle : T.bgSurface,
        color: st.igw ? T.accentHover : C.muted,
      }}>
        インターネットゲートウェイ（{st.igw ? "付いている" : "無し"}）
      </div>
      <div className="ml-[7px] h-4 w-[2px]" style={{ background: st.igw ? T.accent : C.line }} />
      <div className="rounded-xl p-2.5" style={{ border: `1px solid ${C.line}`, background: C.canvas }}>
        <div className="mb-2 text-[11.5px] font-extrabold" style={{ color: C.body }}>
          VPC <span style={{ fontFamily: MONO, fontWeight: 400, color: C.muted }}>10.0.0.0/16</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {box("a", "A", "10.0.1.0/24")}
          {box("b", "B", "10.0.2.0/24")}
        </div>
      </div>
    </div>
  );
}

// onPassed: クラウド実習の単元として使うときの通過通知（Eラーニングのスライドとして
// 使うときは lrn.submitExercise が担当する）。どちらも**通ったときに1回だけ**呼ぶ。
export default function AwsLabSlide({ slide, content = {}, lrn, courseId, lessonId, onPassed }) {
  const start = useMemo(
    () => initialLabState({ userData: content.userDataStarter || DEFAULT_USER_DATA, ...(content.initial || {}) }),
    [content.initial, content.userDataStarter],
  );
  const [st, setSt] = useState(start);
  const [tested, setTested] = useState(false);
  const submittedRef = useRef(false);

  // 別のスライドへ移ったら、前のスライドの組み立てを引きずらない
  useEffect(() => {
    setSt(start);
    setTested(false);
    submittedRef.current = false;
  }, [slide.id, start]);

  const { checks, trace } = useMemo(() => labChecks(st), [st]);
  const passedCount = checks.filter(c => c.ok).length;
  const done = trace.ok;

  // 合格の記録は**通ったときに1回だけ**。押し直しても二重に送らない
  useEffect(() => {
    if (!done || submittedRef.current) return;
    submittedRef.current = true;
    if (onPassed) onPassed();
    if (!lrn?.submitExercise || !courseId || !lessonId) return;
    lrn.submitExercise({
      courseId, lessonId, slideId: slide.id, kind: "aws_lab",
      submittedAnswer: JSON.stringify({
        igw: st.igw, routeA: st.routeA, routeB: st.routeB, sg: st.sg,
        subnet: st.instance?.subnet, publicIp: st.instance?.publicIp,
        userData: st.instance?.userDataAtBoot,
      }),
      isCorrect: true,
    }).catch(() => {});
    // onPassed は呼び出し側で毎回作り直される可能性があるので依存に入れない
    // （入れると「通過を何度も記録する」に化ける。submittedRef で1回に絞っている）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, lrn, courseId, lessonId, slide.id, st]);

  const edit = fn => { setSt(prev => fn(prev)); setTested(false); };
  const launched = !!st.instance;

  return (
    <div>
      <SlideEyebrowText chapter={content.chapter} chapterTitle={content.chapterTitle} />
      <h3 className="mb-4 text-[24px] font-extrabold leading-[1.4]" style={{ color: C.ink, letterSpacing: "-0.025em" }}>{slide.title}</h3>
      {content.intro && <p className="mb-4 text-[14.5px] leading-[1.95]" style={{ color: C.body }}>{content.intro}</p>}

      {content.task && (
        <div data-focus="run-task" className="mb-4 rounded-xl p-4" style={{ background: C.canvas, border: `1px solid ${C.line}`, borderLeft: `3px solid ${T.accent}` }}>
          <div className="mb-1.5 text-[10.5px] font-extrabold" style={{ color: T.accent, letterSpacing: "0.1em" }}>やること</div>
          <p className="m-0 text-[14.5px] font-bold leading-[1.75]" style={{ color: C.ink }}>{content.task}</p>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_330px]">
        {/* ── 左: 構成の絵と、確かめた結果 ── */}
        <div className="rounded-2xl p-3.5" style={{ border: `1px solid ${C.line}`, background: T.bgSurface }}>
          <NetView st={st} />

          {tested && (
            <div className="mt-3 rounded-xl p-3" style={{
              border: `1px solid ${trace.ok ? T.success : T.danger}`,
              background: trace.ok ? T.successSubtle : T.dangerSubtle,
            }}>
              <div className="mb-1.5 text-[13px] font-extrabold" style={{ color: trace.ok ? T.success : T.danger }}>
                {trace.ok ? "✓ つながりました" : "✕ つながりません"}
              </div>
              {trace.ok ? (
                <p className="m-0 text-[12.5px] leading-[1.8]" style={{ color: C.body }}>
                  ブラウザから <code style={{ fontFamily: MONO }}>http://（パブリックIP）</code> を開くと、ユーザーデータで置いたページが表示されます。
                </p>
              ) : (
                <div className="text-[12.5px] leading-[1.8]" style={{ color: C.body }}>
                  <p className="m-0 font-bold" style={{ color: C.ink }}><Rich text={trace.why} strong={T.danger} /></p>
                  <p className="mb-0 mt-1">→ <Rich text={trace.fix} strong={C.ink} /></p>
                </div>
              )}
              <div className="mt-2.5 rounded-lg px-2.5 py-2 text-[11px] leading-[1.9]" style={{ background: T.bgSurface, color: C.muted, fontFamily: MONO }}>
                たどった経路<br />
                {trace.steps.length
                  ? trace.steps.map((s, i) => <span key={i}>　{s}<br /></span>)
                  : <span>　（まだ何も起動していません）<br /></span>}
                {!trace.ok && <span style={{ color: T.danger }}>　ここで止まりました</span>}
              </div>
            </div>
          )}

          {/* 確認項目。通ったところまでが緑になる */}
          <div className="mt-3 rounded-xl p-3" style={{ border: `1px solid ${C.line}`, background: C.canvas }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-extrabold" style={{ color: C.body, letterSpacing: "0.06em" }}>できていること</span>
              <span className="text-[11px] font-bold" style={{ color: done ? T.success : C.muted }}>{passedCount} / {checks.length}</span>
            </div>
            <ul className="m-0 list-none space-y-1 p-0">
              {checks.map(c => (
                <li key={c.label} className="flex items-start gap-1.5 text-[12px] leading-[1.7]" style={{ color: c.ok ? C.ink : C.muted }}>
                  {c.ok
                    ? <CheckCircle2 size={13} className="mt-[3px] shrink-0" style={{ color: T.success }} />
                    : <Circle size={13} className="mt-[3px] shrink-0" style={{ color: C.line }} />}
                  {c.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── 右: 操作盤 ── */}
        <aside className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${C.line}`, background: T.bgSurface }}>
          <Group title="インターネットゲートウェイ" why={WHY.igw}>
            <Chip on={st.igw} onClick={() => edit(p => ({ ...p, igw: !p.igw }))}>
              {st.igw ? "付いている（外す）" : "付ける"}
            </Chip>
          </Group>

          <Group title="サブネットのルート" why={WHY.route}>
            {["a", "b"].map(id => (
              <div key={id} className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span className="w-4 text-[11.5px] font-bold" style={{ color: C.muted }}>{id.toUpperCase()}</span>
                {[["local", "local のみ"], ["igw", "0.0.0.0/0 → IGW"]].map(([v, nm]) => (
                  <Chip key={v} on={st[id === "a" ? "routeA" : "routeB"] === v}
                    onClick={() => edit(p => ({ ...p, [id === "a" ? "routeA" : "routeB"]: v }))}>{nm}</Chip>
                ))}
              </div>
            ))}
          </Group>

          <Group title="セキュリティグループ" why={WHY.sg}>
            <div className="flex flex-wrap gap-1.5">
              {[[HTTP, "HTTP（80）"], [SSH, "SSH（22）"]].map(([p, nm]) => (
                <Chip key={p} on={st.sg.includes(p)}
                  onClick={() => edit(s => ({ ...s, sg: s.sg.includes(p) ? s.sg.filter(x => x !== p) : [...s.sg, p] }))}>{nm}</Chip>
              ))}
            </div>
          </Group>

          <Group title="EC2を置くサブネット" why={WHY.subnet}>
            <div className="flex flex-wrap gap-1.5">
              {["a", "b"].map(id => (
                <Chip key={id} on={st.subnet === id} disabled={launched}
                  onClick={() => edit(p => ({ ...p, subnet: id }))}>サブネット{id.toUpperCase()}</Chip>
              ))}
            </div>
          </Group>

          <Group title="パブリックIP" why={WHY.publicIp}>
            <div className="flex flex-wrap gap-1.5">
              {[[true, "付ける"], [false, "付けない"]].map(([v, nm]) => (
                <Chip key={String(v)} on={st.publicIp === v} disabled={launched}
                  onClick={() => edit(p => ({ ...p, publicIp: v }))}>{nm}</Chip>
              ))}
            </div>
          </Group>

          <Group title="ユーザーデータ（起動時のスクリプト）" why={WHY.userData}>
            <textarea
              value={st.userData} readOnly={launched} spellCheck={false} rows={7}
              onChange={e => edit(p => ({ ...p, userData: e.target.value }))}
              className="w-full resize-y rounded-lg px-2.5 py-2 text-[11.5px] leading-[1.7]"
              style={{
                fontFamily: MONO, border: `1px solid ${C.line}`,
                background: launched ? C.canvas : T.bgSurface, color: C.ink,
              }} />
            {launched && (
              <p className="mb-0 mt-1.5 text-[11px] leading-[1.7]" style={{ color: C.muted }}>
                起動中は書き換えられません。ユーザーデータは<b style={{ color: C.ink }}>最初の起動時にだけ</b>動きます。
              </p>
            )}
            {!launched && !st.userData.includes("httpd") && (
              <details className="mt-1.5">
                <summary className="cursor-pointer text-[11px] font-bold" style={{ color: T.accent }}>書き方の例を見る</summary>
                <pre className="mt-1.5 mb-0 overflow-x-auto rounded-lg px-2.5 py-2 text-[11px] leading-[1.7]"
                  style={{ fontFamily: MONO, background: C.canvas, color: C.body }}>{SAMPLE_HINT}</pre>
              </details>
            )}
          </Group>

          <div className="p-3.5">
            {launched && (
              <p className="mb-2 mt-0 rounded-lg px-2.5 py-2 text-[11.5px] leading-[1.7]"
                style={{ background: T.warningSubtle, color: T.warning }}>
                サブネット・パブリックIP・ユーザーデータは<b>起動時に決まります</b>。変えるには作り直します。
                セキュリティグループとルートは<b>いま変えてもすぐ効きます</b>。
              </p>
            )}
            {launched ? (
              <button type="button" onClick={() => { edit(terminateInstance); }}
                className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px] font-bold"
                style={{ border: `1px solid ${C.line}`, color: C.body, background: T.bgSurface }}>
                <Trash2 size={13} />EC2を終了して作り直す
              </button>
            ) : (
              <button type="button" onClick={() => { edit(launchInstance); }}
                className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px] font-bold text-white"
                style={{ background: T.accent }}>
                <Play size={13} />EC2を起動する
              </button>
            )}
            <button type="button" onClick={() => setTested(true)} disabled={!launched}
              className="mb-2 w-full rounded-xl py-2.5 text-[12.5px] font-bold disabled:opacity-45"
              style={{ border: `1px solid ${T.accent}`, color: T.accentHover, background: T.accentSubtle }}>
              外からアクセスしてみる
            </button>
            <button type="button" onClick={() => { setSt(start); setTested(false); }}
              className="flex w-full items-center justify-center gap-1.5 py-1.5 text-[11.5px] font-bold" style={{ color: C.muted }}>
              <RotateCcw size={12} />最初から
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
