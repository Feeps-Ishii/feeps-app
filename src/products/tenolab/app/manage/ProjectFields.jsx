import React, { useEffect, useState } from "react";

/* 管理：案件の進め方（project）と、AWS の演習の手順（aws.steps）（2026-10-13）
   進め方は 1行に1つの書き方で入れる（聞き出すこと「質問 | 答え」、会話「client: 文」）。
   AWS の手順は形が深いので JSON で入れる（形は docs/specs/tenolab-course-model.md） */

const MODES = [["fixed", "実装だけ（概要も仕様も決まっている）"], ["ask", "聞き出して提案する"], ["turn", "聞き出して提案（お客さまの中で決まっていることへ誘導される）"], ["done", "聞き出し済み（結果のまとめと会話を見る）"]];
const PHASES = [["req", "要件定義"], ["basic", "基本設計"], ["detail", "詳細設計"], ["impl", "実装"], ["unit", "単体テスト"], ["it", "結合テスト"], ["st", "総合テスト"], ["uat", "受入テスト"]];
const WHO = [["me", "あなた（受講生）"], ["done", "済み"], ["client", "お客さま"], ["pm", "PM"], ["lead", "リーダー"]];
const DEFAULT_PHASES = { req: "done", basic: "done", detail: "pm", impl: "me", unit: "me", it: "lead", st: "pm", uat: "client" };
const lines = v => String(v || "").split("\n");

export function ProjectFields({ project, onChange, Field }) {
  const pj = project || {};
  const set = (k, v) => onChange({ ...pj, [k]: v });
  const ph = { ...DEFAULT_PHASES, ...(pj.phases || {}) };
  const mode = pj.mode || "fixed";
  return (
    <section className="card mcard">
      <div className="eyebrow">進め方（概要の画面・ヒアリング）</div>
      <div className="mgrid">
        <Field label="依頼の受け方" wide><select value={mode} onChange={e => set("mode", e.target.value)}>{MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="受講生の立場"><input value={pj.role || ""} onChange={e => set("role", e.target.value)} placeholder="開発メンバー（実装担当）" /></Field>
        <Field label="いま" wide><input value={pj.story?.now || ""} onChange={e => set("story", { ...(pj.story || {}), now: e.target.value })} placeholder="経理の担当者が、毎月の人件費を手で集計している" /></Field>
        <Field label="困っていること" wide><input value={pj.story?.problem || ""} onChange={e => set("story", { ...(pj.story || {}), problem: e.target.value })} /></Field>
        <Field label="ゴール" wide><input value={pj.story?.goal || ""} onChange={e => set("story", { ...(pj.story || {}), goal: e.target.value })} /></Field>
      </div>
      <div className="eyebrow">V字のどこを誰が受け持つか</div>
      <div className="mgrid">
        {PHASES.map(([k, l]) => <Field key={k} label={l}><select value={ph[k]} onChange={e => set("phases", { ...ph, [k]: e.target.value })}>{WHO.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></Field>)}
      </div>
      <div className="mgrid">
        <Field label="決まっている方針（1行に1つ）" wide><textarea rows={3} value={(pj.policy || []).join("\n")} onChange={e => set("policy", lines(e.target.value))} /></Field>
        {mode !== "fixed" && <>
          <Field label="お客さまの最初の相談（ざっくりした依頼）" wide><textarea rows={2} value={pj.request || ""} onChange={e => set("request", e.target.value)} /></Field>
          <Field label="聞き出すこと（1行に1つ「質問 | お客さまの答え」）" wide>
            <textarea rows={4} value={(pj.hearing || []).map(h => `${h.q}${h.a ? ` | ${h.a}` : ""}`).join("\n")}
              onChange={e => set("hearing", lines(e.target.value).map(l => { const [q, ...a] = l.split("|"); return { q: q.trim(), a: a.join("|").trim() }; }))} placeholder="返信はいつまでに必要ですか？ | 翌営業日まで" />
          </Field>
          {(mode === "turn" || mode === "done") && <Field label={mode === "turn" ? "お客さまの中で決まっていること（1行に1つ。違う提案はこちらへ誘導される）" : "決まった方針（1行に1つ）"} wide>
            <textarea rows={3} value={(pj.decided || []).join("\n")} onChange={e => set("decided", lines(e.target.value))} /></Field>}
          {mode === "done" && <Field label="会話の記録（1行に1つ「client: 文」。client・pm・lead・me）" wide>
            <textarea rows={5} value={(pj.log || []).map(m => `${m.who}: ${m.text}`).join("\n")}
              onChange={e => set("log", lines(e.target.value).map(l => { const m = l.match(/^\s*(client|pm|lead|me)\s*[:：]\s*(.*)$/); return m ? { who: m[1], text: m[2] } : { who: "client", text: l }; }))} /></Field>}
        </>}
      </div>
    </section>
  );
}

export function AwsStepsField({ steps, onChange, Field }) {
  const [text, setText] = useState(() => (steps?.length ? JSON.stringify(steps, null, 2) : ""));
  const [err, setErr] = useState("");
  useEffect(() => { if (!text && steps?.length) setText(JSON.stringify(steps, null, 2)); }, [steps]); // eslint-disable-line react-hooks/exhaustive-deps
  const change = v => {
    setText(v);
    if (!v.trim()) { setErr(""); onChange([]); return; }
    try {
      const x = JSON.parse(v);
      if (!Array.isArray(x)) throw new Error("配列（[ … ]）で書きます");
      setErr(""); onChange(x);
    } catch (e) { setErr(e.message || "JSON の形が正しくありません"); }
  };
  return (
    <section className="card mcard">
      <div className="eyebrow">手順（JSON・任意）</div>
      <Field label={`[{ "title", "ops": [{ "text", "shot" }], "values": [{ "k", "v" }], "decided": [{ "k", "v" }], "stuck", "checks": [判定の id] }]`} wide>
        <textarea className="mono" rows={14} value={text} onChange={e => change(e.target.value)} spellCheck={false} />
      </Field>
      {err && <div className="verdict ng" role="alert">{err}</div>}
    </section>
  );
}
