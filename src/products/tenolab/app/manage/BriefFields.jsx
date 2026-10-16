import React, { useEffect, useRef, useState } from "react";
import { BRIEF_ICONS } from "../case/Brief.jsx";

/* 管理：案件の説明（project.brief）（2026-10-16）。受講生がアサインで読むページごとにタブで入れる。
   並ぶもの（数字の箱・流れの箱・年表など）は 1行に1つ「a | b | c」で書く。全部を JSON で直すタブもある。
   形は docs/specs/tenolab-course-model.md の brief。無いページは受講生に出さない／ticket・project から既定で埋める */

const TABS = [["company", "会社"], ["system", "システム"], ["history", "経緯"], ["problem", "いま"], ["issue", "課題"], ["wants", "修正内容"], ["role", "担当"], ["members", "メンバー"], ["json", "JSON"]];
const split = l => l.split("|").map(s => s.trim());
const rows = t => String(t || "").split("\n").map(l => l.trim()).filter(Boolean);
const num = s => { const n = Number(String(s || "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
const drop = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v != null && !(Array.isArray(v) && !v.length)));

// 1行1つの形 ⇔ データ
const F = {
  list: { to: v => (v || []).join("\n"), from: t => rows(t) },
  stats: {
    to: v => (v || []).map(s => [s.label, s.value, s.unit, s.icon, s.note].map(x => x ?? "").join(" | ").replace(/( \| )+$/, "")).join("\n"),
    from: t => rows(t).map(l => { const [label, value, unit, icon, note] = split(l); const n = num(value); return drop({ label, value: n, unit, icon, dots: icon ? Math.min(24, n) : undefined, meter: unit === "%" ? true : undefined, note }); }),
  },
  lanes: {
    to: v => (v || []).map(l => [`## ${l.label || ""}`, ...(l.nodes || []).map(n => [n.icon, n.title, n.sub, n.key ? "*" : ""].map(x => x ?? "").join(" | ").replace(/( \| )+$/, ""))].join("\n")).join("\n"),
    from: t => {
      const out = [];
      for (const l of rows(t)) {
        if (l.startsWith("##")) { out.push({ label: l.replace(/^#+\s*/, ""), nodes: [] }); continue; }
        if (!out.length) out.push({ label: "", nodes: [] });
        const [icon, title, sub, key] = split(l);
        out[out.length - 1].nodes.push(drop({ icon, title, sub, key: key === "*" ? true : undefined }));
      }
      return out;
    },
  },
  timeline: {
    to: v => (v || []).map(i => [i.when, i.icon, i.title, i.sub, i.kind].map(x => x ?? "").join(" | ").replace(/( \| )+$/, "")).join("\n"),
    from: t => rows(t).map(l => { const [when, icon, title, sub, kind] = split(l); return drop({ when, icon, title, sub, kind: ["rule", "alert"].includes(kind) ? kind : undefined }); }),
  },
  // 値に {46200→50000} と書くと、その間を数が動く
  screenRows: {
    to: v => (v || []).map(r => [r.label, r.count != null ? `${r.prefix || ""}{${r.from ?? 0}→${r.count}}${r.suffix || ""}` : r.value, r.bad ? "!" : ""].map(x => x ?? "").join(" | ").replace(/( \| )+$/, "")).join("\n"),
    from: t => rows(t).map(l => {
      const [label, value, bad] = split(l);
      const m = String(value || "").match(/^(.*?)\{\s*([\d,]+)\s*(?:→|->)\s*([\d,]+)\s*\}(.*)$/);
      const b = bad === "!" ? true : undefined;
      return m ? drop({ label, prefix: m[1], from: num(m[2]), count: num(m[3]), suffix: m[4], bad: b }) : drop({ label, value, bad: b });
    }),
  },
  pairs: { to: v => (v || []).map(x => `${x.label || ""} | ${x.value || ""}`).join("\n"), from: t => rows(t).map(l => { const [label, value] = split(l); return drop({ label, value }); }) },
  compare: {
    to: v => (v || []).map(r => [r.input, r.expected, r.actual, r.ng ? "✕" : ""].map(x => x ?? "").join(" | ").replace(/( \| )+$/, "")).join("\n"),
    from: t => rows(t).map(l => { const [input, expected, actual, ng] = split(l); return drop({ input, expected, actual, ng: /^(✕|x|×|ng)$/i.test(ng || "") ? true : undefined }); }),
  },
  items: { to: v => (v || []).map(i => [i.icon, i.title, i.tag].map(x => x ?? "").join(" | ").replace(/( \| )+$/, "")).join("\n"), from: t => rows(t).map(l => { const [icon, title, tag] = split(l); return drop({ icon, title, tag }); }) },
  members: {
    to: v => (v || []).map(m => [m.who, m.name, m.role, m.job, m.about, m.ask].map(x => x ?? "").join(" | ").replace(/( \| )+$/, "")).join("\n"),
    from: t => rows(t).map(l => { const [who, name, role, job, about, ask] = split(l); return drop({ who: ["client", "pm", "lead", "me"].includes(who) ? who : "client", name, role, job, about, ask }); }),
  },
};

// 書きかけの「a |」を消さないように、文字はこの欄で持つ（外から値が変わったときだけ入れ直す）
function Lines({ value, kind, onChange, rows: r = 4, placeholder }) {
  const f = F[kind];
  const [text, setText] = useState(() => f.to(value));
  const mine = useRef(value);
  useEffect(() => { if (value !== mine.current) { mine.current = value; setText(f.to(value)); } }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <textarea rows={r} value={text} placeholder={placeholder} onChange={e => { setText(e.target.value); const v = f.from(e.target.value); mine.current = v; onChange(v); }} />;
}

function JsonTab({ brief, onChange, Field }) {
  const [text, setText] = useState(() => JSON.stringify(brief || {}, null, 2));
  const [err, setErr] = useState("");
  const mine = useRef(brief);
  useEffect(() => { if (brief !== mine.current) { mine.current = brief; setText(JSON.stringify(brief || {}, null, 2)); } }, [brief]);
  return (
    <>
      <Field label="案件の説明（JSON）" wide>
        <textarea className="mono" rows={18} spellCheck={false} value={text} onChange={e => {
          setText(e.target.value);
          try { const x = JSON.parse(e.target.value || "{}"); if (!x || typeof x !== "object" || Array.isArray(x)) throw new Error("{ … } の形で書きます"); setErr(""); mine.current = x; onChange(x); } catch (er) { setErr(er.message || "JSON の形が正しくありません"); }
        }} />
      </Field>
      {err && <div className="verdict ng" role="alert" style={{ gridColumn: "1 / -1" }}>{err}</div>}
    </>
  );
}

export function BriefFields({ brief, onChange, Field }) {
  const [tab, setTab] = useState("company");
  const b = brief || {};
  const sec = k => b[k] || {};
  const setSec = (k, v) => onChange({ ...b, [k]: v });
  const put = (k, f) => v => setSec(k, { ...sec(k), [f]: v });
  const inp = (k, f, ph) => <input value={sec(k)[f] || ""} placeholder={ph} onChange={e => put(k, f)(e.target.value)} />;
  const area = (k, f, ph, r = 2) => <textarea rows={r} value={sec(k)[f] || ""} placeholder={ph} onChange={e => put(k, f)(e.target.value)} />;
  const lines = (k, f, kind, ph, r) => <Lines value={sec(k)[f]} kind={kind} rows={r} placeholder={ph} onChange={put(k, f)} />;
  const sub = (k, f, g) => <input value={sec(k)[f]?.[g] || ""} onChange={e => setSec(k, { ...sec(k), [f]: { ...(sec(k)[f] || {}), [g]: e.target.value } })} />;
  const filled = k => (k === "members" ? (b.members || []).length > 0 : k !== "json" && Object.keys(b[k] || {}).length > 0);
  return (
    <section className="card mcard">
      <div className="eyebrow">案件の説明（アサインで読むページ）</div>
      <div className="tabs-h" role="tablist" style={{ flexWrap: "wrap", justifySelf: "start" }}>
        {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}{filled(k) ? " ・" : ""}</button>)}
      </div>
      <div className="mgrid">
        {tab === "company" && <>
          <Field label="会社名">{inp("company", "name", "みなと文具")}</Field>
          <Field label="ひとことで" wide>{inp("company", "catch", "みなと文具は、文房具とオフィス用品を売る会社です")}</Field>
          <Field label="数字の箱（1行に1つ「名前 | 数 | 単位 | アイコン | メモ」。単位が % ならメーター）" wide>{lines("company", "stats", "stats", "お店 | 12 | 店 | store", 3)}</Field>
          <Field label="窓口のひとこと（図の下に出る）" wide>{inp("company", "owner", "社内のシステムは情報システム課が担当")}</Field>
          <Field label="どんな会社か（1行に1つ）" wide>{lines("company", "points", "list", "", 3)}</Field>
          <Field label="お客さまの言葉" wide>{inp("company", "quote")}</Field>
          <Field label="言った人">{inp("company", "quoteBy", "お客さま 情報システム課（AI）")}</Field>
        </>}
        {tab === "system" && <>
          <Field label="システム名">{inp("system", "name", "見積もりツール")}</Field>
          <Field label="見出し" wide>{inp("system", "headline")}</Field>
          <Field label="流れ（「## 流れの名前」の下に 1行に1つ「アイコン | 名前 | 説明 | *」。* が担当の箱）" wide>{lines("system", "lanes", "lanes", "## 見積もりを作る\nuser | 営業 | お客さまと話す\nform | 見積もり画面 | 明細を入れる | *", 5)}</Field>
          <Field label="図の下のひとこと" wide>{inp("system", "note", "今回の担当は「見積もり画面」の計算です")}</Field>
          <Field label="リーダーの言葉" wide>{area("system", "lead")}</Field>
        </>}
        {tab === "history" && <>
          <Field label="見出し" wide>{inp("history", "headline")}</Field>
          <Field label="年表（1行に1つ「いつ | アイコン | 名前 | 説明 | rule か alert」）" wide>{lines("history", "items", "timeline", "2022 | layers | 見積もりツールを導入 | 明細を画面で入れる\n2026.9 | alert | 計算ミスの報告 | 税・割引の間違い | alert", 4)}</Field>
          <Field label="左の見出し">{inp("history", "beforeLabel", "いま")}</Field>
          <Field label="右の見出し">{inp("history", "afterLabel", "こうしたい")}</Field>
          <Field label="いま（1行に1つ）">{lines("history", "before", "list", "", 3)}</Field>
          <Field label="こうしたい（1行に1つ）">{lines("history", "after", "list", "", 3)}</Field>
        </>}
        {tab === "problem" && <>
          <Field label="見出し" wide>{inp("problem", "headline")}</Field>
          <Field label="画面の URL">{sub("problem", "screen", "url")}</Field>
          <Field label="画面の名前">{sub("problem", "screen", "title")}</Field>
          <Field label="チケット番号">{sub("problem", "screen", "id")}</Field>
          <Field label="札の見出し">{sub("problem", "screen", "badgeLabel")}</Field>
          <Field label="札">{sub("problem", "screen", "badge")}</Field>
          <Field label="札の赤いしるし">{sub("problem", "screen", "flash")}</Field>
          <Field label="画面の行（1行に1つ「名前 | 値 | !」。! で赤く、値に ¥{46200→50000} で数が動く）" wide>
            <Lines value={sec("problem").screen?.rows} kind="screenRows" rows={4} onChange={v => setSec("problem", { ...sec("problem"), screen: { ...(sec("problem").screen || {}), rows: v } })} />
          </Field>
          <Field label="お客さまの声（図の下）" wide>{inp("problem", "voice")}</Field>
          <Field label="連絡の件名">{sub("problem", "mail", "subject")}</Field>
          <Field label="連絡の差出人">{sub("problem", "mail", "from")}</Field>
          <Field label="連絡の本文" wide><textarea rows={3} value={sec("problem").mail?.body || ""} onChange={e => setSec("problem", { ...sec("problem"), mail: { ...(sec("problem").mail || {}), body: e.target.value } })} /></Field>
          <Field label="影響（1行に1つ「名前 | 値」）" wide>{lines("problem", "impacts", "pairs", "問い合わせ | 2件", 3)}</Field>
        </>}
        {tab === "issue" && <>
          <Field label="見出し" wide>{inp("issue", "headline")}</Field>
          <Field label="比べる表の名前">{inp("issue", "compareTitle", "会員ページで試す")}</Field>
          <Field label="左の列の名前">{inp("issue", "compareLabel", "入れた金額")}</Field>
          <Field label="比べる表（1行に1つ「入れたもの | 期待 | いま | ✕」）" wide>{lines("issue", "compare", "compare", "50,000円 | ゴールド | シルバー | ✕", 4)}</Field>
          <Field label="問題" wide>{inp("issue", "problem")}</Field>
          <Field label="原因の見立て" wide>{inp("issue", "cause")}</Field>
          <Field label="課題" wide>{inp("issue", "task")}</Field>
        </>}
        {tab === "wants" && <>
          <Field label="見出し（どう直したいかだけ。答えは書かない）" wide>{inp("wants", "headline")}</Field>
          <Field label="PM の言葉" wide>{inp("wants", "pm", "どこをどう直すかは、チケットに入ってから自分で調べてください。")}</Field>
          <Field label="いま：名前">{sub("wants", "before", "label")}</Field>
          <Field label="いま：値">{sub("wants", "before", "value")}</Field>
          <Field label="直したあと：名前">{sub("wants", "after", "label")}</Field>
          <Field label="直したあと：値">{sub("wants", "after", "value")}</Field>
          <Field label="変えないこと（1行に1つ）" wide>{lines("wants", "keep", "list", "", 2)}</Field>
          <Field label="カード（1行に1つ「アイコン | 内容 | やる か 変えない」）" wide>{lines("wants", "items", "items", "medal | 会員規約どおりのランクにしたい | やる", 3)}</Field>
        </>}
        {tab === "role" && <>
          <Field label="見出し（空なら工程から作る）" wide>{inp("role", "headline")}</Field>
          <Field label="やること" wide>{inp("role", "tasks")}</Field>
          <Field label="出すもの" wide>{inp("role", "deliverables")}</Field>
          <Field label="完了の条件（答えになる数字は書かない）" wide>{inp("role", "done")}</Field>
          <Field label="目安">{inp("role", "deadline", "約2時間")}</Field>
        </>}
        {tab === "members" && (
          <Field label="上書きする人（1行に1つ「client・pm・lead・me | 名前 | 役割 | 仕事 | 人となり | 聞いていいこと」。空なら既定）" wide>
            <Lines value={b.members} kind="members" rows={4} onChange={v => onChange({ ...b, members: v })} placeholder="client | みなと文具 情報システム課 | お客さま | 今回の依頼主" />
          </Field>
        )}
        {tab === "json" && <JsonTab brief={brief} onChange={onChange} Field={Field} />}
      </div>
      {tab !== "json" && tab !== "members" && <div className="muted" style={{ fontSize: 12 }}>アイコン：{BRIEF_ICONS.join("・")}</div>}
    </section>
  );
}
