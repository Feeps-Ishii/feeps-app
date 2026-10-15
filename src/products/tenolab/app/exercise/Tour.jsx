import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";

/* 初めてのときだけのツアー（2026-10-15、モック devhub-lesson-drill-link.html の ②）。
   コードを動かす画面を初めて開いたときに、場所を順に光らせて案内する。画面の種類（env）ごとに1回ずつ。
   見たかどうかはこの端末に覚える。レッスンの上の「？ 操作の説明」でいつでも見直せる。
   光らせる場所は CSS のセレクタで指定し、画面に無いものは飛ばす */
const SEEN_KEY = "tl-tour-seen-v1";
const readSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); } catch (e) { return []; } };
export const tourSeen = env => readSeen().includes(env);
const markSeen = env => { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...readSeen(), env])])); } catch (e) { /* 覚えられなくても進める */ } };

export const TOUR_STEPS = {
  "js-trace": [
    [".tr-code", "サンプルのコード", "このあと1行ずつ動かします。いま動かしている行に色が付きます。"],
    [".tr-run.go", "「動きを見る」で動かす", "「1行ずつ」で自分のペースでも進められます。"],
    [".tr-con", "出力", "console.log で出したものがここに出ます。"],
    [".tr-watch", "変数の中身", "1行ずつ進めると、変数がどう変わるかが見えます。"],
    [".tr-edit", "書き換えて試す", "自分でコードを変えて動かしたくなったら、ここから。"],
  ],
  js: [
    [".xb-ed", "ここにコードを書きます", "カッコは自動で閉じます。「最初に戻す」でいつでも最初に戻せます。"],
    [".xb-btn.go", "「実行」で動かす", "Ctrl + Enter でも動きます。"],
    [".xb-pv", "動かした画面", "書いたコードで動く画面がここに出ます。"],
    [".xb-out", "コンソール", "console.log の出力とエラーが出ます。"],
  ],
  java: [
    [".xb-task", "課題", "何を作るかと、確かめることが書いてあります。"],
    [".xb-ed", "ここにコードを書きます", "カッコは自動で閉じます。「最初に戻す」でいつでも最初に戻せます。"],
    [".xb-btn.go", "「実行」で動かす", "Ctrl + Enter でも動きます。"],
    [".xb-out", "結果", "出力とエラーがここに出ます。期待する出力とも比べられます。"],
  ],
  web: [
    [".xb-ed", "ここに HTML・CSS を書きます", "上のタブでファイルを切り替えます。"],
    [".xb-pv", "見た目", "書くとすぐにここへ映ります。PC とスマホの幅を切り替えられます。"],
  ],
  sql: [
    [".xb-ed", "ここに SQL を書きます", "テーブル名や列名は候補が出ます。"],
    [".xb-btn.go", "「実行」で動かす", "Ctrl + Enter でも動きます。"],
    [".xb-out", "結果", "取り出した行やエラーがここに出ます。"],
  ],
  codequiz: [
    [".qz-code", "空欄のあるコード", "空欄に入るものを下から選びます。"],
    [".qz-picks", "入るものを選ぶ", "選ぶと空欄に入ります。"],
    [".qz-run", "「実行」で確かめる", "テストが通るかどうかがすぐ分かります。"],
  ],
};

// レッスンのスライドが、どの画面の種類か（ツアーの無いページは ""）
export function tourEnvOf(slide, isSample) {
  if (!slide) return "";
  if (slide.kind === "js_run") return isSample && slide.content?.trace !== false ? "js-trace" : "js";
  if (slide.kind === "code_run") return "java";
  if (slide.kind === "web_run") return "web";
  if (slide.kind === "sql_run") return "sql";
  if (slide.kind === "quiz" && slide.interaction?.type === "code") return "codequiz";
  return "";
}

export default function Tour({ env, root, onClose }) {
  const steps = (TOUR_STEPS[env] || []).filter(([sel]) => root?.querySelector(sel));
  const [k, setK] = useState(0);
  const [box, setBox] = useState(null);
  const step = steps[k];
  const measure = useCallback(() => {
    const el = step && root?.querySelector(step[0]);
    if (!el) { setBox(null); return; }
    const r = el.getBoundingClientRect();
    setBox({ x: r.left - 4, y: r.top - 4, w: r.width + 8, h: r.height + 8 });
  }, [step, root]);
  useLayoutEffect(() => { measure(); }, [measure]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [measure]);
  const finish = useCallback(() => { markSeen(env); onClose?.(); }, [env, onClose]);
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") finish(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [finish]);
  // 光らせる場所がまだ無い（読み込み中など）ときは、見たことにせず閉じる（次に開いたときにまた出る）
  useEffect(() => { if (!steps.length) onClose?.(); }, [steps.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!step || !box) return null;
  // 吹き出しは光らせた場所の右か下。画面からはみ出すときは内側へ
  const W = 300, vw = window.innerWidth, vh = window.innerHeight;
  let px = box.x + box.w + 14, py = box.y;
  if (px + W > vw - 12) { px = Math.max(12, Math.min(box.x, vw - W - 12)); py = box.y + box.h + 12; }
  if (py + 170 > vh - 12) py = Math.max(12, box.y - 182);
  const lastStep = k === steps.length - 1;
  return (
    <div className="tl-tour" role="dialog" aria-modal="true" aria-label="操作の説明">
      <div className="hole" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} />
      <div className="pop" style={{ left: px, top: py, width: W }}>
        <b>{step[1]}</b>
        <p>{step[2]}</p>
        <div className="r">
          <span className="dots" aria-hidden="true">{steps.map((_, i) => <i key={i} className={i === k ? "on" : ""} />)}</span>
          <small>{k + 1} / {steps.length}</small>
          <button type="button" className="skip" onClick={finish}>あとで</button>
          <button type="button" className="btn go" autoFocus onClick={() => (lastStep ? finish() : setK(k + 1))}>{lastStep ? "はじめる" : "次へ"}</button>
        </div>
      </div>
    </div>
  );
}
