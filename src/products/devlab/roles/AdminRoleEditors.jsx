import React from "react";
import { Btn, fieldStyle, T } from "../../../components/common";
import { Plus, X } from "lucide-react";
import { METHODS, phasesFor, roleSlotsFor, INFRA_PHASE } from "./phases.js";
import { COUNTERPART_INFO } from "./CounterpartPanel.jsx";

// 案件管理で担当工程を編集する部品（2026-09-05）。正典: docs/specs/dev-lab-role-spec.md
//
// **何も設定しなければ今までどおり**。担当区分を1つも置かず、工程も選ばなければ、
// 案件は全ステップが全員に出る従来の形のまま動く。

export function MethodSelect({ value, onChange }) {
  return (
    <select style={fieldStyle} value={value || "waterfall"} onChange={e => onChange(e.target.value)}>
      {METHODS.map(m => <option key={m.id} value={m.id}>{m.name}（{m.tag}）</option>)}
    </select>
  );
}

export function PhaseSelect({ method, value, onChange }) {
  return (
    <select style={fieldStyle} value={value || ""} onChange={e => onChange(e.target.value)}>
      <option value="">指定なし（どの担当にも出す）</option>
      {phasesFor(method).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
      <option value={INFRA_PHASE}>インフラ（工程の外）</option>
    </select>
  );
}

export function RoleSlotEditor({ method, slots, onChange }) {
  const list = slots || [];
  const phases = [...phasesFor(method), { id: INFRA_PHASE, label: "インフラ" }];

  function update(i, key, value) {
    onChange(list.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)));
  }
  function togglePhase(i, phaseId) {
    const cur = list[i].phases || [];
    update(i, "phases", cur.includes(phaseId) ? cur.filter(p => p !== phaseId) : [...cur, phaseId]);
  }
  function add() {
    onChange([...list, { roleSlotId: `role_${list.length + 1}`, name: "", summary: "", phases: [], counterpart: "pm", premium: false, handoverNote: "" }]);
  }
  function fillDefault() {
    // 6つを手で打たせない。既定を入れてから消す・直す方が早い
    onChange(roleSlotsFor({ method }).map(s => ({ ...s })));
  }

  return (
    <div className="space-y-3">
      {list.length === 0 && (
        <p className="text-xs" style={{ color: T.textMuted }}>
          担当区分を置かないと、この案件は全ステップが全員に出ます（従来どおり）。
        </p>
      )}

      {list.map((slot, i) => (
        <div key={i} className="rounded-xl border p-3" style={{ borderColor: T.border }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: T.textMuted }}>担当{i + 1}</span>
            <button type="button" onClick={() => onChange(list.filter((_, idx) => idx !== i))} aria-label="削除">
              <X size={14} style={{ color: T.textMuted }} />
            </button>
          </div>
          <div className="space-y-2">
            <input style={fieldStyle} placeholder="担当名（例: 上流工程担当）" value={slot.name || ""} onChange={e => update(i, "name", e.target.value)} />
            <input style={fieldStyle} placeholder="一行説明（例: 要件を決めて設計に落とす）" value={slot.summary || ""} onChange={e => update(i, "summary", e.target.value)} />
            <div>
              <div className="mb-1 text-xs font-semibold" style={{ color: T.textMuted }}>担当する工程</div>
              <div className="flex flex-wrap gap-1.5">
                {phases.map(p => {
                  const on = (slot.phases || []).includes(p.id);
                  return (
                    <button
                      key={p.id} type="button" aria-pressed={on}
                      onClick={() => togglePhase(i, p.id)}
                      className="rounded-full px-3 py-1 text-xs font-semibold transition"
                      style={{
                        border: `1px solid ${on ? T.accent : T.border}`,
                        background: on ? T.accentSubtle : T.bgSurface,
                        color: on ? T.accentHover : T.textSecondary,
                      }}
                    >{p.label}</button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <div className="mb-1 text-xs font-semibold" style={{ color: T.textMuted }}>相手役</div>
                <select style={fieldStyle} value={slot.counterpart || "pm"} onChange={e => update(i, "counterpart", e.target.value)}>
                  {Object.entries(COUNTERPART_INFO).map(([id, info]) => (
                    <option key={id} value={id}>{info.nm}（{info.ro}）</option>
                  ))}
                </select>
              </label>
              <label className="flex items-end gap-2 pb-2 text-xs" style={{ color: T.textSecondary }}>
                <input type="checkbox" checked={slot.premium === true} onChange={e => update(i, "premium", e.target.checked)} />
                上位プラン限定にする
              </label>
            </div>
            <input style={fieldStyle} placeholder="前の工程から渡される物の説明（例: 基本設計書は渡されます）" value={slot.handoverNote || ""} onChange={e => update(i, "handoverNote", e.target.value)} />
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Btn kind="ghost" size="sm" icon={Plus} onClick={add}>担当を追加</Btn>
        {list.length === 0 && <Btn kind="ghost" size="sm" onClick={fillDefault}>既定の担当区分を入れる</Btn>}
      </div>
    </div>
  );
}

export function HearingEditor({ items, onChange }) {
  const list = items || [];
  function update(i, key, value) {
    onChange(list.map((h, idx) => (idx === i ? { ...h, [key]: value } : h)));
  }
  function add() {
    onChange([...list, { hearingItemId: `hear_${list.length + 1}`, question: "", hint: "", answer: "", initial: false }]);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: T.textMuted }}>
        お客様AIが<b style={{ color: T.textPrimary }}>聞かれたときだけ</b>答える内容です。
        受講生の画面には「項目名」と「ヒント」しか出ません。答えは聞いて初めて返ります。
      </p>
      {list.map((h, i) => (
        <div key={i} className="rounded-xl border p-3" style={{ borderColor: T.border }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: T.textMuted }}>項目{i + 1}</span>
            <button type="button" onClick={() => onChange(list.filter((_, idx) => idx !== i))} aria-label="削除">
              <X size={14} style={{ color: T.textMuted }} />
            </button>
          </div>
          <div className="space-y-2">
            <input style={fieldStyle} placeholder="項目名（例: 同時に使う人数）" value={h.question || ""} onChange={e => update(i, "question", e.target.value)} />
            <input style={fieldStyle} placeholder="ヒント（聞けていないときに出す。例: 「研修期間」という言葉が引っかかります）" value={h.hint || ""} onChange={e => update(i, "hint", e.target.value)} />
            <input style={fieldStyle} placeholder="答え（聞かれたら返す内容）" value={h.answer || ""} onChange={e => update(i, "answer", e.target.value)} />
            <label className="flex items-center gap-2 text-xs" style={{ color: T.textSecondary }}>
              <input type="checkbox" checked={h.initial === true} onChange={e => update(i, "initial", e.target.checked)} />
              最初から聞けている扱いにする（会話の取っ掛かり）
            </label>
          </div>
        </div>
      ))}
      <Btn kind="ghost" size="sm" icon={Plus} onClick={add}>聞き出す項目を追加</Btn>
    </div>
  );
}
