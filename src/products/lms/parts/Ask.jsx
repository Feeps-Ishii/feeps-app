import React, { useMemo, useState } from "react";
import { updatePassword } from "aws-amplify/auth";
import { Btn, Chip, Modal } from "./ui.jsx";

/* 使い方とパスワードの変更（モック helpDrawer / profile）。使い方は下の HELP が全部 */

// r: s=講師・管理者 c=企業担当者 t=受講生。go はその画面のキー（そのロールに無い画面の項目は出さない）
const HELP = [
  { r: "s", k: ["リマインド", "未提出", "催促", "出していない"], q: "日報を出していない人に知らせたい", a: ["日報 を開く", "「未提出」の人を見る", "「この人にリマインド」で知らせる"], go: "report" },
  { r: "s", k: ["休み", "研修日", "祝日", "時間"], q: "研修のお休みの日・時間を変えたい", a: ["コースの設定 を開く", "「AI に頼んで変える」に書いて「案を出す」", "案を確かめて反映し、下の帯から保存する"], go: "setting" },
  { r: "s", k: ["パスワード", "ログイン", "入れない", "忘れた"], q: "受講生がパスワードを忘れた", a: ["ユーザー で名前を探す", "「仮パスワードを出す」を押す", "本人に渡す。次のログインで自分のパスワードに変えてもらう"], go: "users" },
  { r: "s", k: ["席替え", "席", "並び"], q: "席替えをしたい", a: ["席替え を開く", "名前をドラッグして入れ替える。AI に頼んで案を出すこともできる", "保存して確定する"], go: "seat" },
  { r: "s", k: ["練習問題", "Word", "取り込"], q: "練習問題を Word から入れたい", a: ["練習問題 を開く", "「Word から作る」で問題と解答の Word を選ぶ", "できた問題集を確かめて公開する"], go: "prac" },
  { r: "s", k: ["欠勤", "勤怠", "打刻", "遅刻"], q: "受講生の勤怠を直したい", a: ["勤怠 を開く", "名前の行を押す", "状態と時刻を直し、直す理由を書いて保存する"], go: "att" },
  { r: "s", k: ["お知らせ", "取り消", "間違"], q: "送信済みのお知らせを直したい", a: ["お知らせ を開く", "送信済みのお知らせの「直す」を押す", "直して出し直す"], go: "ann" },
  { r: "c", k: ["日報", "読む"], q: "自社の受講生の日報を読みたい", a: ["日報 を開く", "日付を選ぶ", "名前を押すと全文を読める"], go: "report" },
  { r: "c", k: ["助成金", "書類", "賃金"], q: "助成金に出す書類をそろえたい", a: ["助成金 を開く", "「書類」で足りないものを見る", "自社で用意するものを入れる"], go: "grant" },
  { r: "t", k: ["日報", "直す", "前の日"], q: "前の日の日報を直したい", a: ["日報 を開く", "日付を選ぶ", "直して「直して提出する」を押す"], go: "report" },
  { r: "t", k: ["遅刻", "休む", "遅れる", "勤怠", "連絡"], q: "遅れる・休むとき", a: ["先に講師へ連絡する", "勤怠 を開く", "実際の時刻と理由を記録する"], go: "att" },
  { r: "scta", k: ["パスワード", "変える"], q: "自分のパスワードを変えたい", a: ["右上の名前を押す", "「パスワードを変える」を押す", "いまのパスワードと新しいパスワードを入れる"], pw: true },
];

const helpFor = (role, screens) => {
  const code = role === "trainee" ? "t" : role === "client" ? "c" : "s";
  return HELP.filter(h => h.r.includes(code) && (h.pw || screens.some(([k]) => k === h.go || (role === "admin" && h.go === "prac" && k === "lprac"))));
};
const goOf = (h, screens) => (screens.some(([k]) => k === h.go) ? h.go : "lprac");
const scoreOf = (h, q) => h.k.reduce((n, k) => n + (q.includes(k) ? k.length + 1 : 0), 0) + (h.q.includes(q) ? q.length : 0);

export function HelpPanel({ role, groups, initial = "", onClose, onGo, onPassword }) {
  const screens = useMemo(() => groups.flatMap(g => g[2]), [groups]);
  const list = useMemo(() => helpFor(role, screens), [role, screens]);
  const [q, setQ] = useState(initial); const [asked, setAsked] = useState(initial);
  const a = asked.trim();
  const hit = a ? list.map(h => [h, h.q === a ? 999 : scoreOf(h, a)]).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1])[0]?.[0] : null;
  const nameOf = k => screens.find(s => s[0] === k)?.[1] || k;
  return (
    <Modal title="使い方" width={520} onClose={onClose}>
      <form className="lms-help-q" onSubmit={e => { e.preventDefault(); setAsked(q); }}>
        <input type="text" className="in" value={q} placeholder="聞きたいこと（例：休みの日を変えたい）" aria-label="聞きたいこと" onChange={e => setQ(e.target.value)} />
        <Btn kind="sm" type="submit">探す</Btn>
      </form>
      {a && (hit ? (
        <div className="lms-help-a">
          <b>{hit.q}</b>
          <ol>{hit.a.map(x => <li key={x}>{x}</li>)}</ol>
          <span>{hit.pw ? <Btn kind="sm" onClick={onPassword}>パスワードを変える</Btn> : <Btn kind="sm" onClick={() => onGo(goOf(hit, screens))}>{nameOf(goOf(hit, screens))} を開く →</Btn>}</span>
        </div>
      ) : <span><Chip tone="warn">見つかりません</Chip></span>)}
      <span className="eyebrow">よく聞かれること</span>
      <div className="lms-help-l">{list.map(h => <button key={h.q} type="button" onClick={() => { setQ(h.q); setAsked(h.q); }}>{h.q}</button>)}</div>
    </Modal>
  );
}

const PW_ERR = {
  NotAuthorizedException: "いまのパスワードが違います",
  InvalidPasswordException: "新しいパスワードが決まりに合っていません（8 文字以上、大文字・小文字・数字・記号）",
  LimitExceededException: "回数が多すぎます。しばらくしてからやり直してください",
};

export function PasswordModal({ onClose, say }) {
  const [v, setV] = useState({ now: "", next: "", again: "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const f = k => e => setV(x => ({ ...x, [k]: e.target.value }));
  const save = async e => {
    e?.preventDefault();
    if (!v.now || !v.next) { setErr("パスワードを入れてください"); return; }
    if (v.next !== v.again) { setErr("新しいパスワードが 2 回で違います"); return; }
    setBusy(true); setErr("");
    try { await updatePassword({ oldPassword: v.now, newPassword: v.next }); say?.("パスワードを変えました"); onClose(); }
    catch (x) { setErr(PW_ERR[x?.name] || "変えられませんでした"); setBusy(false); }
  };
  return (
    <Modal title="パスワードを変える" width={420} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy} onClick={save}>変える</Btn></>}>
      <form onSubmit={save} style={{ display: "grid", gap: 10 }}>
        <label className="field">いまのパスワード<input type="password" autoComplete="current-password" value={v.now} onChange={f("now")} /></label>
        <label className="field">新しいパスワード<input type="password" autoComplete="new-password" value={v.next} onChange={f("next")} /></label>
        <label className="field">もう一度<input type="password" autoComplete="new-password" value={v.again} onChange={f("again")} /></label>
        <button type="submit" hidden aria-hidden="true" />
      </form>
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}
