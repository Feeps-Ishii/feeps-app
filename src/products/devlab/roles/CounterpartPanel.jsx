import React, { useState } from "react";
import { Card, Badge, Btn, T } from "../../../components/common";

// 相手役AI。工程で相手が変わる。正典: docs/specs/dev-lab-role-spec.md §5
//
// お客様（client）とPO（po）だけ「聞き出す項目」を持つ。
// **聞くまで答えはBackendから返ってこない。** 画面に出ているのは項目名とヒントだけ。
// 「聞かないと言わない」を文面の約束ではなく、届くデータで成り立たせている。

export const COUNTERPART_INFO = {
  client: { nm: "お客様", ro: "発注元の担当者", av: "客" },
  po: { nm: "プロダクトオーナー", ro: "優先順位を決める人", av: "PO" },
  senpai: { nm: "先輩エンジニア", ro: "コードを見る人", av: "先" },
  qa_lead: { nm: "QAリーダー", ro: "品質を見る人", av: "Q" },
  pm: { nm: "PM", ro: "この案件の進行役", av: "PM" },
  sre: { nm: "インフラの先輩", ro: "構成とコストを見る人", av: "SRE" },
};

const HEARING_COUNTERPARTS = ["client", "po"];

function Bubble({ mine, who, text }) {
  return (
    <div className={mine ? "flex justify-end" : ""}>
      <div className="max-w-[92%]">
        <div className="mb-0.5 text-[10.5px] font-bold" style={{ color: T.textMuted, textAlign: mine ? "right" : "left" }}>{who}</div>
        <div
          className="whitespace-pre-wrap rounded-xl px-3 py-2 text-[13px] leading-relaxed"
          style={mine
            ? { background: T.accent, color: "#fff" }
            : { background: T.aiSubtle, border: `1px solid ${T.aiAccentDeep}33`, color: T.textPrimary }}
        >{text}</div>
      </div>
    </div>
  );
}

export default function CounterpartPanel({ project, assignment, roleSlot, stepId, actions, work }) {
  const [log, setLog] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // 聞けた項目はサーバーにも入るが、一覧の再取得はしない（画面が読み込み中に戻り会話が消えるため）。
  // 次にこの案件を開いたときは assignment.hearingGot から復元される。
  const [justHeard, setJustHeard] = useState([]);

  const counterpart = roleSlot?.counterpart || "pm";
  const info = COUNTERPART_INFO[counterpart] || COUNTERPART_INFO.pm;
  const items = Array.isArray(project?.hearingItems) ? project.hearingItems : [];
  const got = new Set([...(assignment?.hearingGot || []), ...justHeard]);
  const showHearing = HEARING_COUNTERPARTS.includes(counterpart) && items.length > 0;
  const remaining = items.filter(h => !h.initial && !got.has(h.hearingItemId)).length;

  async function hear(item) {
    setError("");
    setLog(prev => [...prev, { mine: true, who: "自分", text: `${item.question}について教えてください。` }]);
    try {
      const res = await actions.askHearing(project.id, item.hearingItemId);
      setJustHeard(prev => [...prev, item.hearingItemId]);
      setLog(prev => [...prev, { mine: false, who: info.nm, text: res?.answer || "" }]);
    } catch (e) {
      setError("聞き取りに失敗しました。時間をおいて試してください。");
    }
  }

  async function ask() {
    const question = draft.trim();
    if (!question || busy) return;
    setError("");
    setDraft("");
    setLog(prev => [...prev, { mine: true, who: "自分", text: question }]);
    setBusy(true);
    try {
      const res = await actions.askCounterpart(project.id, {
        question, stepId, work,
        history: log.slice(-4).map(m => ({ role: m.mine ? "trainee" : "counterpart", text: m.text })),
      });
      setLog(prev => [...prev, { mine: false, who: info.nm, text: res?.answer || "" }]);
    } catch (e) {
      setError("いま返事がもらえませんでした。時間をおいて試してください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white"
          style={{ background: T.aiAccentDeep }}>{info.av}</span>
        <span className="min-w-0">
          <span className="block text-sm font-bold" style={{ color: T.textPrimary }}>{info.nm}</span>
          <span className="block text-[11px]" style={{ color: T.textMuted }}>{info.ro}</span>
        </span>
        {/* aiAccent はAI機能にだけ使ってよい色（theme.js の注記）。ここはその用途 */}
        <span className="ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold"
          style={{ background: T.aiSubtle, color: T.aiAccentDeep }}>AI</span>
      </div>

      {showHearing && (
        <div className="mt-3 rounded-xl border" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-2 border-b px-3 py-2 text-[12.5px] font-bold"
            style={{ borderColor: T.border, color: T.textPrimary }}>
            聞き出す項目
            <span className="ml-auto text-[11.5px] font-normal" style={{ color: T.textMuted }}>
              {items.length - remaining} / {items.length}
            </span>
          </div>
          <ul className="px-1 py-1">
            {items.map(h => {
              const done = h.initial || got.has(h.hearingItemId);
              return (
                <li key={h.hearingItemId} className="flex items-start gap-2 px-2 py-1.5 text-[12.5px]">
                  <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded text-[10px] text-white"
                    style={{ background: done ? T.success : T.bgSurface, border: `1.5px solid ${done ? T.success : T.border}` }}>
                    {done ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1" style={{ color: done ? T.textPrimary : T.textMuted }}>
                    {h.question}
                    {!done && h.hint && (
                      <span className="block text-[11.5px]" style={{ color: T.warning }}>ヒント: {h.hint}</span>
                    )}
                  </span>
                  {!done && (
                    <Btn kind="ghost" size="sm" onClick={() => hear(h)}>聞く</Btn>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="border-t px-3 py-2 text-[11.5px]"
            style={{
              borderColor: T.border,
              background: remaining ? T.dangerSubtle : T.successSubtle,
              color: remaining ? T.danger : T.success,
            }}>
            {remaining
              ? `聞けていない項目が ${remaining}件あります。このまま進むと、後の工程で仕様変更として戻ってきます`
              : "全部聞けました。この内容で設計に進めます"}
          </div>
        </div>
      )}

      {log.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {log.map((m, i) => <Bubble key={i} mine={m.mine} who={m.who} text={m.text} />)}
        </div>
      )}

      {error && <p className="mt-2 text-[12px]" style={{ color: T.danger }}>{error}</p>}

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
          placeholder={`${info.nm}に聞く`}
          className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-[13px]"
          style={{ borderColor: T.border, background: T.bgSurface, color: T.textPrimary }}
        />
        <Btn disabled={busy || !draft.trim()} onClick={ask}>{busy ? "…" : "聞く"}</Btn>
      </div>
      <p className="mt-1.5 text-[11px]" style={{ color: T.textMuted }}>
        答えのコードや完成した書類は出しません。どこを見ればいいかまでをお伝えします。
      </p>
    </Card>
  );
}
